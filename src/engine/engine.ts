// The audio engine: reads the song, never edits it. One channel per track:
// voice -> drive -> delay -> reverb -> channel (volume, pan, mute, solo) -> master.
// No AudioWorklets: they need blob: or same-origin module loads that some hosts block,
// and they cost the most CPU on a tablet.

import * as Tone from 'tone';
import { findItem } from '../packs/core';
import { chordMidi, diatonicTriads } from '../theory';
import type { ChordsContent, NotesContent, PatternContent, Song, Track } from '../domain/types';
import { PPQ, STEP_TICKS } from '../domain/types';
import { loopSteps } from '../domain/factory';
import { createDrumKit, createMelodicVoice } from './voices';
import type { Voice } from './voices';

interface TrackChannel {
  instrumentKey: string;
  voice: Voice;
  drive: Tone.Distortion;
  delay: Tone.FeedbackDelay;
  reverb: Tone.Reverb;
  reverbSize: number;
  reverbTimer: ReturnType<typeof setTimeout> | null;
  channel: Tone.Channel;
}

type AudioSessionNav = Navigator & { audioSession?: { type: string } };

const DRUM_VOICE_BY_KEY: Record<string, string> = {
  'sound.kick': 'kick', 'sound.snare': 'snare', 'sound.clap': 'clap', 'sound.hat-closed': 'hatClosed',
  'sound.hat-open': 'hatOpen', 'sound.rim': 'rim', 'sound.tom': 'tom', 'sound.crash': 'crash',
};

const gainToDb = (g: number) => (g <= 0.0001 ? -Infinity : 20 * Math.log10(g));

export class StudioEngine {
  private song: Song | null = null;
  private channels = new Map<string, TrackChannel>();
  private master: Tone.Limiter | null = null;
  private meter: Tone.Meter | null = null;
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
    const drive = new Tone.Distortion(0.35);
    const delay = new Tone.FeedbackDelay('8n.', 0.35);
    const reverb = new Tone.Reverb({ decay: 2.5, preDelay: 0.01, wet: 0 });
    const channel = new Tone.Channel({ volume: 0, pan: 0 });
    voice.output.connect(drive);
    drive.connect(delay);
    delay.connect(reverb);
    reverb.connect(channel);
    channel.connect(this.master!);
    return { instrumentKey: t.instrument?.key ?? '', voice, drive, delay, reverb, reverbSize: 2.5, reverbTimer: null, channel };
  }

  private applyMix(ch: TrackChannel, t: Track): void {
    ch.channel.volume.rampTo(gainToDb(t.gain), 0.05);
    ch.channel.pan.rampTo(t.pan, 0.05);
    ch.channel.mute = t.muted;
    ch.channel.solo = t.solo;
    for (const slot of t.fx_chain.slots) {
      const p = slot.params;
      if (slot.effect.key === 'effect.drive') {
        ch.drive.wet.value = slot.bypass ? 0 : 1;
        ch.drive.distortion = p.amount ?? 0.35;
      } else if (slot.effect.key === 'effect.delay') {
        ch.delay.wet.value = slot.bypass ? 0 : (p.mix ?? 0.25);
        ch.delay.feedback.value = p.feedback ?? 0.35;
      } else if (slot.effect.key === 'effect.reverb') {
        ch.reverb.wet.value = slot.bypass ? 0 : (p.mix ?? 0.3);
        const size = Math.max(0.3, Math.min(8, p.size ?? 2.5));
        if (Math.abs(size - ch.reverbSize) > 0.04) {
          // A new size rebuilds the room's echo; wait until the slider rests.
          ch.reverbSize = size;
          if (ch.reverbTimer) clearTimeout(ch.reverbTimer);
          ch.reverbTimer = setTimeout(() => { ch.reverbTimer = null; ch.reverb.decay = size; }, 250);
        }
      }
    }
  }

  private disposeChannel(ch: TrackChannel): void {
    if (ch.reverbTimer) clearTimeout(ch.reverbTimer);
    ch.voice.dispose();
    [ch.drive, ch.delay, ch.reverb, ch.channel].forEach((n) => n.dispose());
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
    this.stepListeners.forEach((fn) => fn(-1));
  }

  private secondsFor(ticks: number, song: Song): number {
    return (ticks / PPQ) * (60 / song.tempo_bpm);
  }

  private playStep(song: Song, step: number, time: number): void {
    const stepStart = step * STEP_TICKS;
    const key = { tonic: song.key_tonic, mode: song.key_mode };
    for (const t of song.tracks) {
      const ch = this.channels.get(t.id);
      const clip = t.clips[0];
      if (!ch || !clip) continue;
      if (clip.kind === 'pattern' && ch.voice.kind === 'drums') {
        const p = clip.content as PatternContent;
        for (const row of p.rows) {
          const hit = row.hits.find((h) => h.step === step);
          const name = DRUM_VOICE_BY_KEY[row.sound.key];
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
    const name = DRUM_VOICE_BY_KEY[soundKey];
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
      const name = DRUM_VOICE_BY_KEY[h.soundKey];
      if (name) ch.voice.hit(name, t0 + h.at, h.vel);
    }
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
