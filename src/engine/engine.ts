// The audio engine: reads the song, never edits it. One channel per track:
// voice -> drive -> delay -> reverb -> channel (volume, pan, mute, solo) -> master.

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
  reverb: Tone.Freeverb;
  channel: Tone.Channel;
}

const DRUM_VOICE_BY_KEY: Record<string, string> = {
  'sound.kick': 'kick', 'sound.snare': 'snare', 'sound.clap': 'clap', 'sound.hat-closed': 'hatClosed',
  'sound.hat-open': 'hatOpen', 'sound.rim': 'rim', 'sound.tom': 'tom', 'sound.crash': 'crash',
};

const gainToDb = (g: number) => (g <= 0.0001 ? -Infinity : 20 * Math.log10(g));

export class StudioEngine {
  private song: Song | null = null;
  private channels = new Map<string, TrackChannel>();
  private master: Tone.Limiter | null = null;
  private repeatId: number | null = null;
  private stepListeners = new Set<(step: number) => void>();
  started = false;

  /** Audio can only start after a tap (iPad rule). Call from a click handler. */
  async start(): Promise<void> {
    if (this.started) return;
    await Tone.start();
    Tone.getContext().lookAhead = 0.05;
    this.master = new Tone.Limiter(-1).toDestination();
    this.started = true;
    if (this.song) this.sync(this.song);
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
    const reverb = new Tone.Freeverb({ roomSize: 0.8, dampening: 3000 });
    const channel = new Tone.Channel({ volume: 0, pan: 0 });
    voice.output.connect(drive);
    drive.connect(delay);
    delay.connect(reverb);
    reverb.connect(channel);
    channel.connect(this.master!);
    return { instrumentKey: t.instrument?.key ?? '', voice, drive, delay, reverb, channel };
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
        ch.reverb.roomSize.value = Math.min(0.95, 0.5 + ((p.size ?? 2.5) - 0.5) / 7.5 * 0.45);
      }
    }
  }

  private disposeChannel(ch: TrackChannel): void {
    ch.voice.dispose();
    [ch.drive, ch.delay, ch.reverb, ch.channel].forEach((n) => n.dispose());
  }

  async play(): Promise<void> {
    await this.start();
    if (!this.song) return;
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
    await this.start();
    const ch = this.channels.get(trackId);
    if (ch?.voice.kind === 'melodic') ch.voice.play(midi, 0.4, Tone.now(), 0.8, this.song?.tuning_a4_hz ?? 440);
  }

  async previewDrum(trackId: string, soundKey: string): Promise<void> {
    await this.start();
    const ch = this.channels.get(trackId);
    const name = DRUM_VOICE_BY_KEY[soundKey];
    if (ch?.voice.kind === 'drums' && name) ch.voice.hit(name, Tone.now(), 1);
  }

  /** Hear an idea before keeping it: notes (seconds from now) on a melodic track. */
  async previewNotes(trackId: string, items: { midi: number; at: number; dur: number; vel: number }[]): Promise<void> {
    await this.start();
    const ch = this.channels.get(trackId);
    if (ch?.voice.kind !== 'melodic') return;
    const t0 = Tone.now() + 0.05;
    for (const n of items) ch.voice.play(n.midi, n.dur, t0 + n.at, n.vel, this.song?.tuning_a4_hz ?? 440);
  }

  /** Hear a drum idea: sound keys at seconds from now. */
  async previewHits(trackId: string, items: { soundKey: string; at: number; vel: number }[]): Promise<void> {
    await this.start();
    const ch = this.channels.get(trackId);
    if (ch?.voice.kind !== 'drums') return;
    const t0 = Tone.now() + 0.05;
    for (const h of items) {
      const name = DRUM_VOICE_BY_KEY[h.soundKey];
      if (name) ch.voice.hit(name, t0 + h.at, h.vel);
    }
  }

  /** What the device reports about its audio timing, for the Phase 0 latency spike. */
  latencyInfo(): { sampleRate: number; baseLatencyMs: number | null; outputLatencyMs: number | null; lookAheadMs: number } {
    const raw = Tone.getContext().rawContext as AudioContext;
    return {
      sampleRate: raw.sampleRate,
      baseLatencyMs: typeof raw.baseLatency === 'number' ? raw.baseLatency * 1000 : null,
      outputLatencyMs: typeof raw.outputLatency === 'number' ? raw.outputLatency * 1000 : null,
      lookAheadMs: Tone.getContext().lookAhead * 1000,
    };
  }
}

export const engine = new StudioEngine();
