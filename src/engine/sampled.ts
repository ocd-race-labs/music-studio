// Recorded drum kits for the Colección. Each piece is a few short recordings (soft to hard, with alternates so
// repeated hits are not identical), processed offline into its kit's sound and loaded only when a kit is used.
// Playback uses plain buffer sources: cheap on a tablet, sample-accurate with the transport.

import * as Tone from 'tone';
import type { DrumVoice } from './voices';

export interface SampledPiece {
  /** Velocity layers from soft to hard; each layer lists its alternate takes (file names in the kit's folder). */
  layers: string[][];
  /** Pieces this one silences when it plays: the closed hi-hat stops the open one. */
  chokes?: string[];
  /** Level of the piece in the kit, in dB. */
  gainDb?: number;
}

export interface SampledKitSpec {
  /** Folder under collection/drums/ with the kit's files. */
  id: string;
  /** Loudness trim in dB, so every kit plays at about the same level. */
  trimDb: number;
  /** By voice: kick, snare, tom1, tom2, hatClosed, hatOpen, ride, crash, china. */
  pieces: Record<string, SampledPiece>;
}

const base = (): string => (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
export const kitFolder = (id: string): string => `${base()}collection/drums/${id}/`;

/* ---------------------------------------------------------------- loading */

const cache = new Map<string, Promise<AudioBuffer | null>>();
/** Buffers already decoded, for hits scheduled right after a kit is built. */
const ready = new Map<string, AudioBuffer>();

/** Compressed files begin with a few milliseconds of encoder silence; a drum must start on the beat. */
function trimLead(buf: AudioBuffer, ctx: BaseAudioContext): AudioBuffer {
  const floor = 0.0018; // about -55 dBFS
  let first = buf.length;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < Math.min(d.length, first); i++) if (Math.abs(d[i]) > floor) { first = i; break; }
  }
  const start = Math.max(0, first - Math.round(buf.sampleRate * 0.0005));
  if (start < 8 || start >= buf.length) return buf;
  const out = ctx.createBuffer(buf.numberOfChannels, buf.length - start, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(start), c);
  return out;
}

export function loadBuffer(url: string): Promise<AudioBuffer | null> {
  let p = cache.get(url);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.arrayBuffer();
        const ctx = Tone.getContext().rawContext as BaseAudioContext;
        const buf = await new Promise<AudioBuffer>((ok, fail) => {
          // Safari still prefers the callback form.
          const r = ctx.decodeAudioData(data, ok, fail) as Promise<AudioBuffer> | undefined;
          r?.then(ok, fail);
        });
        const out = trimLead(buf, ctx);
        ready.set(url, out);
        return out;
      } catch {
        return null;
      }
    })();
    cache.set(url, p);
    p.then((b) => { if (!b) cache.delete(url); }); // a failed load can be tried again later
  }
  return p;
}

/** Every file of a kit, loaded (or already cached). Resolves with how many loaded. */
export async function loadKit(spec: SampledKitSpec): Promise<number> {
  const urls = Object.values(spec.pieces).flatMap((p) => p.layers.flat()).map((f) => kitFolder(spec.id) + f);
  const got = await Promise.all(urls.map(loadBuffer));
  return got.filter(Boolean).length;
}

/* ---------------------------------------------------------------- playing */

/**
 * Which layer plays at this velocity, and how loud within it. Three layers split at 0.5 and 0.8, so the
 * sequencer's off-beats (0.75) land on the middle layer, its down-beats (0.9) on the hard one, and ghost notes on the soft one.
 */
export function pickLayer(vel: number, layers: number): { layer: number; gain: number } {
  const v = Math.max(0.02, Math.min(1, vel));
  const bounds = layers === 3 ? [0.5, 0.8, 1] : Array.from({ length: layers }, (_, i) => (i + 1) / layers);
  const layer = Math.max(0, bounds.findIndex((b) => v < b || b === 1));
  const gain = Math.max(0.3, Math.pow(v / bounds[layer], 0.9));
  return { layer, gain };
}

export function createSampledKit(spec: SampledKitSpec): DrumVoice {
  const bus = new Tone.Gain(Tone.dbToGain(spec.trimDb));
  const folder = kitFolder(spec.id);
  void loadKit(spec);
  const bufferOf = (file: string) => ready.get(folder + file);
  const rr = new Map<string, number>();
  const sounding = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }[]>();
  let disposed = false;

  const silence = (voice: string, time: number) => {
    for (const s of sounding.get(voice) ?? []) {
      try {
        s.gain.gain.cancelScheduledValues(time);
        s.gain.gain.setTargetAtTime(0, time, 0.012);
        s.src.stop(time + 0.08);
      } catch { /* already stopped */ }
    }
    sounding.set(voice, []);
  };

  return {
    kind: 'drums',
    output: bus,
    hit(voice, time, vel) {
      const piece = spec.pieces[voice];
      if (!piece || disposed) return;
      const { layer, gain } = pickLayer(vel, piece.layers.length);
      const takes = piece.layers[layer];
      const n = (rr.get(`${voice}:${layer}`) ?? 0) + 1;
      rr.set(`${voice}:${layer}`, n);
      const buf = bufferOf(takes[n % takes.length]) ?? takes.map(bufferOf).find(Boolean);
      if (!buf) return; // still loading: the first bar may miss a hit, never the beat
      for (const other of piece.chokes ?? []) silence(other, time);
      const ctx = Tone.getContext().rawContext as AudioContext;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = gain * Tone.dbToGain(piece.gainDb ?? 0);
      src.connect(g);
      Tone.connect(g, bus);
      const list = sounding.get(voice) ?? [];
      list.push({ src, gain: g });
      sounding.set(voice, list);
      src.onended = () => {
        g.disconnect();
        const l = sounding.get(voice);
        if (l) sounding.set(voice, l.filter((x) => x.src !== src));
      };
      src.start(Math.max(time, ctx.currentTime));
    },
    dispose() {
      disposed = true;
      for (const v of sounding.keys()) silence(v, Tone.now());
      setTimeout(() => bus.dispose(), 200);
    },
  };
}
