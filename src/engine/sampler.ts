// Recorded melodic instruments for the Colección (electric guitar and bass recorded direct, no amp): every few
// semitones a real note, played at the nearest sample's speed for the notes between. The amp, cabinet and the
// rest of the sound come from the instrument's studio chain.

import * as Tone from 'tone';
import { cachedBuffer, loadBuffer } from './sampled';
import type { MelodicVoice } from './voices';

export interface SamplerSpec {
  /** Folder under collection/strings/. */
  folder: string;
  /** By layer (mf softer, f harder): MIDI note of each recording -> file. */
  layers: Record<string, Record<string, string>>;
  license?: string;
  credit?: string;
}

const base = (): string => (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
const urlOf = (spec: SamplerSpec, file: string) => `${base()}collection/strings/${spec.folder}/${file}`;

/** Every recording of an instrument, loaded (or already cached). Resolves with how many loaded. */
export async function loadSampler(spec: SamplerSpec): Promise<number> {
  const files = Object.values(spec.layers).flatMap((l) => Object.values(l));
  const got = await Promise.all(files.map((f) => loadBuffer(urlOf(spec, f))));
  return got.filter(Boolean).length;
}

/** The recording that plays a note: the nearest sampled pitch (the lower one on a tie). */
export function nearest(notes: number[], midi: number): number {
  let best = notes[0];
  for (const n of notes) if (Math.abs(n - midi) < Math.abs(best - midi) || (Math.abs(n - midi) === Math.abs(best - midi) && n < best)) best = n;
  return best;
}

export function createSampler(spec: SamplerSpec, opts: { mono?: boolean; release?: number; maxVoices?: number } = {}): MelodicVoice {
  const out = new Tone.Gain(1);
  const release = opts.release ?? 0.12;
  const maxVoices = opts.maxVoices ?? 12;
  void loadSampler(spec);
  const notesOf = (layer: string) => Object.keys(spec.layers[layer] ?? {}).map(Number).sort((a, b) => a - b);
  const sorted: Record<string, number[]> = Object.fromEntries(Object.keys(spec.layers).map((l) => [l, notesOf(l)]));
  let playing: { src: AudioBufferSourceNode; gain: GainNode; end: number }[] = [];
  let disposed = false;

  const cut = (v: { src: AudioBufferSourceNode; gain: GainNode }, at: number, fade = 0.015) => {
    try {
      v.gain.gain.cancelScheduledValues(at);
      v.gain.gain.setTargetAtTime(0, at, fade / 3);
      v.src.stop(at + fade * 4);
    } catch { /* already stopped */ }
  };

  return {
    kind: 'melodic',
    output: out,
    play(midi, dur, time, vel, a4) {
      if (disposed) return;
      const layer = vel >= 0.6 && spec.layers.f ? 'f' : spec.layers.mf ? 'mf' : Object.keys(spec.layers)[0];
      const notes = sorted[layer];
      if (!notes?.length) return;
      const sampleNote = nearest(notes, midi);
      const file = spec.layers[layer][String(sampleNote)];
      const buf = cachedBuffer(urlOf(spec, file));
      if (!buf) return; // still loading: the first notes may be missed, never the song
      const ctx = Tone.getContext().rawContext as AudioContext;
      const start = Math.max(time, ctx.currentTime);
      // A bass plays one note at a time: the next one stops the last, as a hand on the string would.
      if (opts.mono) { playing.forEach((v) => cut(v, start)); playing = []; }
      while (playing.length >= maxVoices) { const old = playing.shift(); if (old) cut(old, start); }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = Math.pow(2, (midi - sampleNote) / 12) * (a4 / 440);
      const g = ctx.createGain();
      const level = Math.pow(0.45 + 0.55 * Math.max(0, Math.min(1, vel)), 1.4);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(level, start + 0.002);
      const end = start + Math.max(0.03, dur);
      g.gain.setValueAtTime(level, end);
      g.gain.setTargetAtTime(0, end, release / 3);
      src.connect(g);
      Tone.connect(g, out);
      src.start(start);
      src.stop(end + release * 2);
      const v = { src, gain: g, end };
      playing.push(v);
      src.onended = () => { g.disconnect(); playing = playing.filter((x) => x !== v); };
    },
    dispose() {
      disposed = true;
      playing.forEach((v) => cut(v, Tone.now()));
      playing = [];
      setTimeout(() => out.dispose(), 200);
    },
  };
}
