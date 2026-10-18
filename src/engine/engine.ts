// The audio engine: reads the song, never edits it. One channel per track:
// voice -> pedals in the song's order -> channel (volume, pan, mute, solo) -> master.
// No AudioWorklets: they need blob: or same-origin module loads that some hosts block,
// and they cost the most CPU on a tablet.

import * as Tone from 'tone';
import { findByKey, findItem, lowOf, rowsOf, rowVoice } from '../packs/core';
import { chordMidi, diatonicTriads } from '../theory';
import type { ChordsContent, NotesContent, PatternContent, Song, Track } from '../domain/types';
import { PPQ, STEP_TICKS } from '../domain/types';
import { loopSteps } from '../domain/factory';
import { createDrumKit, createMelodicVoice } from './voices';
import type { Voice } from './voices';
import { createPedal } from './pedals';
import type { Pedal } from './pedals';

interface TrackChannel {
  instrumentKey: string;
  voice: Voice;
  /** The pedal chain, in the song's order; rebuilt when pedals are added, removed or moved. */
  pedals: { key: string; pedal: Pedal | null }[];
  chainSig: string;
  channel: Tone.Channel;
  meter: Tone.Meter;
}

type AudioSessionNav = Navigator & { audioSession?: { type: string } };


const gainToDb = (g: number) => (g <= 0.0001 ? -Infinity : 20 * Math.log10(g));

export class StudioEngine {
  private song: Song | null = null;
  private channels = new Map<string, TrackChannel>();
  private master: Tone.Limiter | null = null;
  private meter: Tone.Meter | null = null;
  /** When set, only this track sounds: a listening aid, never saved in the song. */
  private focusId: string | null = null;
  private unlockBound = false;
  private repeatId: number | null = null;
  private stepListeners = new Set<(step: number) => void>();
  started = false;

  /**
   * Audio can only start after a tap (iPad rule). Call from a click handler, before any await.
   * Builds the sound graph right away and resolves true once the device is really playing.
   */
  async start(): Promise<boolean> {
    const resumed = this.ensure();
    if (this.running) return true;
    await Promise.race([resumed, new Promise((r) => setTimeout(r, 1500))]);
    return this.running;
  }

  /** Synchronous part of start: unlock audio inside the tap and build the graph. */
  private ensure(): Promise<void> {
    unlockMediaSession();
    if (!this.started) {
      // iPhone and iPad: a context created inside the tap starts reliably; the one Tone made at page load may stay suspended.
      try {
        Tone.setContext(new Tone.Context({ latencyHint: 'interactive', lookAhead: 0.05 }), true);
      } catch { /* keep the existing context */ }
    }
    const resumed = Tone.start().catch(() => undefined);
    kickWebKit();
    this.bindUnlock();
    if (!this.started) {
      Tone.getContext().lookAhead = 0.05;
      this.meter = new Tone.Meter({ smoothing: 0.5 });
      this.master = new Tone.Limiter(-1);
      this.master.connect(this.meter);
      this.master.toDestination();
      this.started = true;
      if (this.song) this.sync(this.song);
    }
    return resumed;
  }

  /** True when the device is producing audio. */
  get running(): boolean {
    return Tone.getContext().state === 'running';
  }

  /** Browsers can suspend audio again (phone call, tab in background); any later tap brings it back. */
  private bindUnlock(): void {
    if (this.unlockBound || typeof document === 'undefined') return;
    this.unlockBound = true;
    const unlock = () => {
      if (Tone.getContext().state !== 'running') {
        unlockMediaSession();
        Tone.getContext().resume().catch(() => undefined);
        kickWebKit();
      }
    };
    for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, unlock, { capture: true, passive: true });
  }

  /** One second of A4, for the Lab sound check. Resolves with the loudest output level seen. */
  async testTone(): Promise<{ state: string; peak: number }> {
    await this.start();
    if (!this.master) return { state: Tone.getContext().state, peak: 0 };
    const tone = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.2 }, volume: -6 });
    tone.connect(this.master);
    tone.triggerAttackRelease('A4', 1, Tone.now() + 0.05);
    let peak = 0;
    const started = performance.now();
    await new Promise<void>((done) => {
      const poll = () => {
        peak = Math.max(peak, this.outputLevel());
        if (performance.now() - started < 1300) setTimeout(poll, 30); else done();
      };
      poll();
    });
    setTimeout(() => tone.dispose(), 500);
    return { state: Tone.getContext().state, peak };
  }

  /** A short soft tick so a person knows the sound is on. */
  previewClick(): void {
    if (!this.master) return;
    const blip = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.05 }, volume: -14 });
    blip.connect(this.master);
    blip.triggerAttackRelease('A5', 0.06, Tone.now() + 0.02);
    setTimeout(() => blip.dispose(), 600);
  }

  /** Listen to one track alone (or everything again with null). Mute and solo in the song stay as they are. */
  setFocus(trackId: string | null): void {
    if (this.focusId === trackId) return;
    this.focusId = trackId;
    if (this.song && this.started) this.sync(this.song);
  }

  /** Output level 0..1 for the meter next to Play. */
  outputLevel(): number {
    if (!this.meter) return 0;
    const db = this.meter.getValue() as number;
    return Number.isFinite(db) ? Math.max(0, Math.min(1, (db + 54) / 54)) : 0;
  }

  onStep(fn: (step: number) => void): () => void {
    this.stepListeners.add(fn);
    return () => this.stepListeners.delete(fn);
  }

  get playing(): boolean {
    return Tone.getTransport().state === 'started';
  }

  /** Give the engine the latest song after every change; it adjusts sounds and mix live. */
  setSong(song: Song): void {
    this.song = song;
    if (this.started) this.sync(song);
  }

  private sync(song: Song): void {
    const transport = Tone.getTransport();
    transport.bpm.value = song.tempo_bpm;
    transport.swing = song.swing;
    transport.swingSubdivision = '16n';

    const seen = new Set<string>();
    for (const t of song.tracks) {
      seen.add(t.id);
      const key = t.instrument?.key ?? '';
      let ch = this.channels.get(t.id);
      if (ch && ch.instrumentKey !== key) {
        this.disposeChannel(ch);
        ch = undefined;
      }
      if (!ch) {
        ch = this.createChannel(t);
        this.channels.set(t.id, ch);
      }
      this.applyMix(ch, t);
    }
    for (const [id, ch] of this.channels) {
      if (!seen.has(id)) {
        this.disposeChannel(ch);
        this.channels.delete(id);
      }
    }
  }

  private createChannel(t: Track): TrackChannel {
    const item = t.instrument ? findItem(t.instrument) : undefined;
    const manifest = (item?.manifest ?? {}) as { type?: string; kit?: string; voice?: string };
    const voice: Voice = manifest.type === 'drumkit'
      ? createDrumKit(manifest.kit ?? 'boomBap')
      : createMelodicVoice(manifest.voice ?? 'keysEp');
    const channel = new Tone.Channel({ volume: 0, pan: 0 });
    const meter = new Tone.Meter({ smoothing: 0.6 });
    channel.connect(this.master!);
    channel.connect(meter);
    const ch: TrackChannel = { instrumentKey: t.instrument?.key ?? '', voice, pedals: [], chainSig: '', channel, meter };
    this.buildChain(ch, t);
    return ch;
  }

  /** Wire voice -> pedals -> channel for the track's current chain. */
  private buildChain(ch: TrackChannel, t: Track): void {
    ch.voice.output.disconnect();
    ch.pedals.forEach(({ pedal }) => pedal?.dispose());
    // Unknown pedals (from a newer file) keep their place in the list but pass the sound through.
    ch.pedals = t.fx_chain.slots.map((slot) => ({ key: slot.effect.key, pedal: createPedal(slot.effect.key) }));
    let prev: Tone.ToneAudioNode = ch.voice.output;
    for (const { pedal } of ch.pedals) if (pedal) { prev.connect(pedal.input); prev = pedal.output; }
    prev.connect(ch.channel);
    ch.chainSig = t.fx_chain.slots.map((s) => s.effect.key).join('|');
  }

  private applyMix(ch: TrackChannel, t: Track): void {
    ch.channel.volume.rampTo(gainToDb(t.gain), 0.05);
    ch.channel.pan.rampTo(t.pan, 0.05);
    const focus = this.focusId !== null && this.song?.tracks.some((x) => x.id === this.focusId) ? this.focusId : null;
    ch.channel.mute = focus ? t.id !== focus : t.muted;
    ch.channel.solo = focus ? false : t.solo;
    if (ch.chainSig !== t.fx_chain.slots.map((x) => x.effect.key).join('|')) this.buildChain(ch, t);
    t.fx_chain.slots.forEach((slot, i) => ch.pedals[i]?.pedal?.set(slot.params, slot.bypass));
  }

  private disposeChannel(ch: TrackChannel): void {
    ch.voice.dispose();
    ch.pedals.forEach(({ pedal }) => pedal?.dispose());
    ch.channel.dispose();
    ch.meter.dispose();
  }

  /** Level 0..1 of one track after its fader, for the mixer. */
  trackLevel(trackId: string): number {
    const m = this.channels.get(trackId)?.meter;
    if (!m) return 0;
    const db = m.getValue() as number;
    return Number.isFinite(db) ? Math.max(0, Math.min(1, (db + 54) / 54)) : 0;
  }

  async play(): Promise<boolean> {
    const ok = await this.start();
    if (!this.song) return ok;
    const transport = Tone.getTransport();
    if (this.repeatId !== null) transport.clear(this.repeatId);
    // Count sixteenths ourselves: swing moves the off-beats in time, so deriving the step from time is fragile.
    let counter = 0;
    this.repeatId = transport.scheduleRepeat((time) => {
      const song = this.song;
      if (!song) return;
      const step = counter++ % loopSteps(song);
      this.playStep(song, step, time);
      Tone.getDraw().schedule(() => this.stepListeners.forEach((fn) => fn(step)), time);
    }, '16n', 0);
    transport.position = 0;
    transport.start('+0.05');
    // Some hosts block the clock's background worker without an error; fall back to timers.
    setTimeout(() => {
      const ctx = Tone.getContext();
      if (this.repeatId !== null && counter === 0 && this.running && ctx instanceof Tone.Context && ctx.clockSource === 'worker') {
        ctx.clockSource = 'timeout';
      }
    }, 600);
    return ok;
  }

  stop(): void {
    const transport = Tone.getTransport();
    transport.stop();
    if (this.repeatId !== null) transport.clear(this.repeatId);
    this.repeatId = null;
    Tone.getDraw().cancel(0); // drop playhead moves already queued, or the playhead lingers after Stop
    for (const ch of this.channels.values()) ch.pedals.forEach(({ pedal }) => pedal?.rest?.());
    this.stepListeners.forEach((fn) => fn(-1));
  }

  private secondsFor(ticks: number, song: Song): number {
    return (ticks / PPQ) * (60 / song.tempo_bpm);
  }

  private playStep(song: Song, step: number, time: number): void {
    const stepStart = step * STEP_TICKS;
    if (step % 4 === 0) {
      const beat = 60 / song.tempo_bpm;
      for (const ch of this.channels.values()) ch.pedals.forEach(({ pedal }) => pedal?.onBeat?.(time, beat));
    }
    const key = { tonic: song.key_tonic, mode: song.key_mode };
    for (const t of song.tracks) {
      const ch = this.channels.get(t.id);
      const clip = t.clips[0];
      if (!ch || !clip) continue;
      if (clip.kind === 'pattern' && ch.voice.kind === 'drums') {
        const p = clip.content as PatternContent;
        for (const row of p.rows) {
          const hit = row.hits.find((h) => h.step === step);
          const name = hit && rowVoice(ch.instrumentKey, row.sound.key);
          if (hit && name) ch.voice.hit(name, time, hit.vel);
        }
      } else if (clip.kind === 'notes' && ch.voice.kind === 'melodic') {
        for (const n of (clip.content as NotesContent).notes) {
          if (n.tick >= stepStart && n.tick < stepStart + STEP_TICKS) {
            const offset = this.secondsFor(n.tick - stepStart, song);
            ch.voice.play(n.midi, this.secondsFor(n.dur, song) * 0.95, time + offset, n.vel, song.tuning_a4_hz);
          }
        }
      } else if (clip.kind === 'chords' && ch.voice.kind === 'melodic') {
        const triads = diatonicTriads(key);
        for (const c of (clip.content as ChordsContent).chords) {
          if (c.tick >= stepStart && c.tick < stepStart + STEP_TICKS && triads[c.degree]) {
            const dur = this.secondsFor(c.dur, song) * 0.98;
            for (const m of chordMidi(triads[c.degree], 52)) ch.voice.play(m, dur, time, 0.6, song.tuning_a4_hz);
          }
        }
      }
    }
  }

  /** Tap a pad or a key: hear it now. */
  async previewNote(trackId: string, midi: number): Promise<void> {
    this.ensure();
    const ch = this.channels.get(trackId);
    if (ch?.voice.kind === 'melodic') ch.voice.play(midi, 0.4, Tone.now(), 0.8, this.song?.tuning_a4_hz ?? 440);
  }

  async previewDrum(trackId: string, soundKey: string): Promise<void> {
    this.ensure();
    const ch = this.channels.get(trackId);
    const name = ch && rowVoice(ch.instrumentKey, soundKey);
    if (ch?.voice.kind === 'drums' && name) ch.voice.hit(name, Tone.now(), 1);
  }

  /** Hear an idea before keeping it: notes (seconds from now) on a melodic track. */
  async previewNotes(trackId: string, items: { midi: number; at: number; dur: number; vel: number }[]): Promise<void> {
    this.ensure();
    const ch = this.channels.get(trackId);
    if (ch?.voice.kind !== 'melodic') return;
    const t0 = Tone.now() + 0.05;
    for (const n of items) ch.voice.play(n.midi, n.dur, t0 + n.at, n.vel, this.song?.tuning_a4_hz ?? 440);
  }

  /** Hear a drum idea: sound keys at seconds from now. */
  async previewHits(trackId: string, items: { soundKey: string; at: number; vel: number }[]): Promise<void> {
    this.ensure();
    const ch = this.channels.get(trackId);
    if (ch?.voice.kind !== 'drums') return;
    const t0 = Tone.now() + 0.05;
    for (const h of items) {
      const name = rowVoice(ch.instrumentKey, h.soundKey);
      if (name) ch.voice.hit(name, t0 + h.at, h.vel);
    }
  }

  private previews = new Map<string, Voice>();

  /** Hear any instrument from the catalog, even one no track uses yet: a short phrase or a short beat. */
  previewInstrument(instrumentKey: string): void {
    this.ensure();
    if (!this.master) return;
    const manifest = (findByKey(instrumentKey)?.manifest ?? {}) as { type?: string; kit?: string; voice?: string };
    let voice = this.previews.get(instrumentKey);
    if (!voice) {
      voice = manifest.type === 'drumkit' ? createDrumKit(manifest.kit ?? 'boomBap') : createMelodicVoice(manifest.voice ?? 'keysEp');
      voice.output.connect(this.master);
      this.previews.set(instrumentKey, voice);
    }
    const t0 = Tone.now() + 0.05;
    const beat = 0.18;
    if (voice.kind === 'drums') {
      const rows = rowsOf(instrumentKey);
      const voiceOf = (i: number) => findByKey(rows[i])?.manifest.voice as string;
      [[0, 0], [3, 1], [1, 2], [3, 3], [0, 4], [5, 5], [1, 6], [7, 7]].forEach(([row, at]) => voice!.kind === 'drums' && voice!.hit(voiceOf(row), t0 + at * beat, 0.9));
    } else {
      const root = Math.ceil(lowOf(instrumentKey) / 12) * 12;
      [0, 4, 7, 12].forEach((iv, i) => voice!.kind === 'melodic' && voice!.play(root + iv, beat * 1.6, t0 + i * beat * 1.5, 0.8, this.song?.tuning_a4_hz ?? 440));
    }
  }

  /** Free the instruments built only to be previewed. */
  disposePreviews(): void {
    for (const v of this.previews.values()) v.dispose();
    this.previews.clear();
  }

  /** What the device reports about its audio timing, for the Phase 0 latency spike. */
  latencyInfo(): { state: string; session: string; sampleRate: number; baseLatencyMs: number | null; outputLatencyMs: number | null; lookAheadMs: number } {
    const raw = Tone.getContext().rawContext as AudioContext;
    return {
      state: Tone.getContext().state,
      session: (navigator as AudioSessionNav).audioSession?.type ?? 'not available',
      sampleRate: raw.sampleRate,
      baseLatencyMs: typeof raw.baseLatency === 'number' ? raw.baseLatency * 1000 : null,
      outputLatencyMs: typeof raw.outputLatency === 'number' ? raw.outputLatency * 1000 : null,
      lookAheadMs: Tone.getContext().lookAhead * 1000,
    };
  }
}

export const engine = new StudioEngine();

/**
 * iPhone and iPad mute web audio in silent mode unless the page asks for playback.
 * Safari 16.4+ has navigator.audioSession; older versions switch when an <audio> element plays.
 */
let silentAudio: HTMLAudioElement | null = null;
function unlockMediaSession(): void {
  if (typeof navigator === 'undefined') return;
  const session = (navigator as AudioSessionNav).audioSession;
  if (session) {
    try { session.type = 'playback'; } catch { /* not allowed here */ }
  }
  // Belt and braces on iPhone and iPad: an <audio> element playing also switches the device to playback.
  if (!/iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) || !('ontouchend' in document)) return;
  try {
    if (!silentAudio) {
      silentAudio = new Audio(silentWavDataUri());
      silentAudio.setAttribute('playsinline', '');
      silentAudio.loop = true;
    }
    silentAudio.play().catch(() => undefined);
  } catch { /* best effort */ }
}

/** A tenth of a second of silence as a WAV data URI (8 kHz, 8-bit mono). */
function silentWavDataUri(): string {
  const n = 800;
  const bytes = new Uint8Array(44 + n);
  const v = new DataView(bytes.buffer);
  const text = (o: number, str: string) => { for (let i = 0; i < str.length; i++) bytes[o + i] = str.charCodeAt(i); };
  text(0, 'RIFF'); v.setUint32(4, 36 + n, true); text(8, 'WAVE');
  text(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  text(36, 'data'); v.setUint32(40, n, true);
  bytes.fill(128, 44);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return `data:audio/wav;base64,${btoa(bin)}`;
}

/** The old iPhone unlock: play one silent sample inside the tap. */
function kickWebKit(): void {
  try {
    const raw = Tone.getContext().rawContext as unknown as AudioContext;
    const src = raw.createBufferSource();
    src.buffer = raw.createBuffer(1, 1, raw.sampleRate);
    src.connect(raw.destination);
    src.start(0);
  } catch { /* best effort */ }
}
