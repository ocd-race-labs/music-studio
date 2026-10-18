// The producer's desk as data: six console characters (how each one's EQ, compressor, warmth and glue behave), the
// flat starting values of a channel and of the master, and the commands that change them. A flat channel changes
// nothing in the sound, so songs made before the desk sound as they did; only the final ceiling is now exact, which
// takes back the half dB the old limiter added on its own.

import type { ChannelStrip, ConsoleModel, MixSettings, Song, Track } from './types';
import { now } from './factory';

export const STRIP_FLAT: ChannelStrip = {
  trim_db: 0, hpf_hz: 0,
  low_db: 0, low_hz: 100, lmid_db: 0, lmid_hz: 400, hmid_db: 0, hmid_hz: 2500, high_db: 0, high_hz: 10000,
  comp: 0, drive: 0, send_room: 0, send_echo: 0,
};

export const MIX_FLAT: MixSettings = {
  console: 'clean', glue: 0, glue_model: 'british', body_db: 0, air_db: 0, ceiling_db: -1,
  room_kind: 'plate', room_level: 0.8, echo_time: '1/4', echo_feedback: 0.3, echo_level: 0.7, schema_version: 1,
};

export const stripOf = (t: Track): ChannelStrip => ({ ...STRIP_FLAT, ...t.strip });
export const mixOf = (s: Song): MixSettings => ({ ...MIX_FLAT, ...s.mix });

export type Band = 'low' | 'lmid' | 'hmid' | 'high';
type Text = { en: string; es: string };

/** How one EQ band can be set on a console: a range, or fixed steps like the hardware's switches. */
export interface BandSpec { min: number; max: number; steps?: number[]; fixed?: number; hidden?: boolean }

export interface ConsoleSpec {
  id: ConsoleModel;
  name: Text;
  era: Text;
  blurb: Text;
  bands: Record<Band, BandSpec>;
  /** Gains a band can take; steps snap like a stepped switch. */
  gain: { max: number; steps?: number[] };
  /** Peak width: fixed, or narrower as the boost grows (proportional). */
  q: 'fixed' | 'proportional';
  qFixed: number;
  /** A small dip and bump next to each shelf, as some classic shelves have. */
  shelfBump: boolean;
  hpfSteps?: number[];
  comp: { attack: number; knee: number };
  drive: 'clean' | 'transformer' | 'opamp' | 'silk';
  glue: MixSettings['glue_model'];
}

const T = (en: string, es: string): Text => ({ en, es });

export const CONSOLES: ConsoleSpec[] = [
  {
    id: 'clean', name: T('Clean', 'Limpia'), era: T('Today, transparent', 'Actual, transparente'),
    blurb: T('Adds no color of its own: every band can go anywhere.', 'No le agrega color propio: cada banda puede ir a cualquier frecuencia.'),
    bands: { low: { min: 20, max: 500 }, lmid: { min: 100, max: 2000 }, hmid: { min: 800, max: 8000 }, high: { min: 2000, max: 16000 } },
    gain: { max: 15 }, q: 'fixed', qFixed: 0.9, shelfBump: false, comp: { attack: 0.01, knee: 6 }, drive: 'clean', glue: 'british',
  },
  {
    id: 'british', name: T('British modern', 'Británica moderna'), era: T('80s big studio', 'Gran estudio de los 80'),
    blurb: T('Precise EQ whose peaks narrow as they rise, punchy channel compression and the glue of its bus compressor.', 'Ecualizador preciso cuyos picos se angostan al subir, compresión con golpe en cada canal y el pegamento de su compresor de bus.'),
    bands: { low: { min: 30, max: 450 }, lmid: { min: 200, max: 2500 }, hmid: { min: 600, max: 7000 }, high: { min: 1500, max: 16000 } },
    gain: { max: 15 }, q: 'proportional', qFixed: 1, shelfBump: true, comp: { attack: 0.003, knee: 2 }, drive: 'clean', glue: 'british',
  },
  {
    id: 'inductor', name: T('Classic inductor', 'Clásica de inductores'), era: T('70s British, class A', 'Británica de los 70, clase A'),
    blurb: T('Transformers and coils that round and warm the sound; the EQ moves in steps, like its switches.', 'Transformadores y bobinas que redondean y calientan el sonido; el ecualizador se mueve por pasos, como sus perillas.'),
    bands: {
      low: { min: 35, max: 220, steps: [35, 60, 110, 220] }, lmid: { min: 360, max: 1600, steps: [360, 700, 1600] },
      hmid: { min: 1600, max: 7200, steps: [1600, 3200, 4800, 7200] }, high: { min: 12000, max: 12000, fixed: 12000 },
    },
    gain: { max: 16 }, q: 'fixed', qFixed: 1.2, shelfBump: true, hpfSteps: [0, 50, 80, 160, 300], comp: { attack: 0.006, knee: 8 }, drive: 'transformer', glue: 'diode',
  },
  {
    id: 'american', name: T('American transformer', 'Americana con transformador'), era: T('70s American, punchy', 'Americana de los 70, con golpe'),
    blurb: T('Punch and presence; the EQ is stepped and gets narrower the more you boost.', 'Golpe y presencia; el ecualizador va por pasos y se angosta cuanto más subes.'),
    bands: {
      low: { min: 50, max: 400, steps: [50, 100, 200, 300, 400] }, lmid: { min: 400, max: 1500, steps: [400, 800, 1500] },
      hmid: { min: 1500, max: 5000, steps: [1500, 3000, 5000] }, high: { min: 5000, max: 15000, steps: [5000, 7500, 10000, 12500, 15000] },
    },
    gain: { max: 12, steps: [-12, -9, -6, -4, -2, 0, 2, 4, 6, 9, 12] }, q: 'proportional', qFixed: 1, shelfBump: false, comp: { attack: 0.01, knee: 6 }, drive: 'opamp', glue: 'american',
  },
  {
    id: 'modern', name: T('Modern transformer', 'Moderna con transformador'), era: T('Today, boutique', 'Actual, de autor'),
    blurb: T('Clean until pushed: then warmth adds sheen on top and weight below.', 'Limpia hasta que la empujas: entonces el calor suma brillo arriba y cuerpo abajo.'),
    bands: { low: { min: 30, max: 400 }, lmid: { min: 150, max: 2000 }, hmid: { min: 1000, max: 8000 }, high: { min: 3000, max: 16000 } },
    gain: { max: 15 }, q: 'fixed', qFixed: 0.8, shelfBump: false, comp: { attack: 0.02, knee: 4 }, drive: 'silk', glue: 'british',
  },
  {
    id: 'compact', name: T('Compact rehearsal', 'Compacta de ensayo'), era: T('Small rehearsal mixer', 'Mezcladora de sala de ensayo'),
    blurb: T('Three knobs per channel and one for compression: simple and quick.', 'Tres perillas por canal y una de compresión: simple y rápida.'),
    bands: {
      low: { min: 100, max: 100, fixed: 100 }, lmid: { min: 400, max: 400, hidden: true },
      hmid: { min: 2500, max: 2500, fixed: 2500 }, high: { min: 10000, max: 10000, fixed: 10000 },
    },
    gain: { max: 15 }, q: 'fixed', qFixed: 0.9, shelfBump: false, hpfSteps: [0, 80], comp: { attack: 0.025, knee: 6 }, drive: 'clean', glue: 'british',
  },
];
export const consoleOf = (id: ConsoleModel): ConsoleSpec => CONSOLES.find((c) => c.id === id) ?? CONSOLES[0];

export const GLUES: { id: MixSettings['glue_model']; name: Text; blurb: Text }[] = [
  { id: 'british', name: T('British glue', 'Pegamento británico'), blurb: T('Slow attack that lets the hits through and holds the song together.', 'Ataque lento que deja pasar los golpes y mantiene unida la canción.') },
  { id: 'diode', name: T('Classic diode', 'Diodo clásico'), blurb: T('Smooth and round; it never sounds squeezed.', 'Suave y redondo; nunca suena apretado.') },
  { id: 'american', name: T('American push', 'Empuje americano'), blurb: T('Firm and forward: the mix comes towards you.', 'Firme y hacia adelante: la mezcla viene hacia ti.') },
];

/** Snap a value to a band's steps, or keep it inside its range. */
export function snapFreq(spec: BandSpec, hz: number): number {
  if (spec.fixed) return spec.fixed;
  if (spec.steps) return spec.steps.reduce((a, b) => (Math.abs(b - hz) < Math.abs(a - hz) ? b : a));
  return Math.min(spec.max, Math.max(spec.min, hz));
}
export const snapGain = (c: ConsoleSpec, db: number): number => {
  const clamped = Math.max(-c.gain.max, Math.min(c.gain.max, db));
  return c.gain.steps ? c.gain.steps.reduce((a, b) => (Math.abs(b - clamped) < Math.abs(a - clamped) ? b : a)) : clamped;
};

/** Peak width for a band: fixed, or narrower as the gain grows (wide at 2 dB, narrow at 12 dB). */
export function qFor(c: ConsoleSpec, db: number): number {
  if (c.q === 'fixed') return c.qFixed;
  const g = Math.abs(db);
  return g <= 2 ? 0.5 : g <= 4 ? 0.7 : g <= 6 ? 0.9 : g <= 9 ? 1.2 : 1.5;
}

/** The one-knob compressor: deeper threshold and higher ratio as it turns; the level stays about the same. */
export function compSettings(c: ConsoleSpec, amount: number) {
  const k = Math.max(0, Math.min(1, amount));
  const threshold = k <= 0 ? 0 : -2 - 30 * k;
  const ratio = k <= 0 ? 1 : 1 + 3 * k;
  // The browser's compressor adds its own makeup; cancel it, then give back a measured amount.
  const auto = 0.6 * Math.abs(threshold) * (1 - 1 / ratio);
  return { threshold, ratio, attack: c.comp.attack, release: 0.3, knee: c.comp.knee, trimDb: -auto + 7 * k };
}

/** The master's glue compressor for each style. */
export function glueSettings(model: MixSettings['glue_model'], amount: number) {
  const k = Math.max(0, Math.min(1, amount));
  if (k <= 0) return { threshold: 0, ratio: 1, attack: 0.03, release: 0.3, knee: 0, trimDb: 0 };
  const base = model === 'british' ? { ratio: 2 + 2 * k, attack: 0.03, release: 0.2, knee: 0 }
    : model === 'diode' ? { ratio: 1.5 + 1.5 * k, attack: 0.005, release: 0.4, knee: 8 }
      : { ratio: 2 + 2 * k, attack: 0.01, release: 0.2, knee: 6 };
  const threshold = -6 - 18 * k;
  const auto = 0.6 * Math.abs(threshold) * (1 - 1 / base.ratio);
  return { ...base, threshold, trimDb: -auto + 3 * k };
}

/** Warmth curve: odd and even harmonics by character, unity slope near zero so level stays the same. */
export function driveCurve(kind: ConsoleSpec['drive'], drive: number, size = 2048): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(size * 4));
  const k = Math.max(0, Math.min(1, drive));
  const g = 1 + 5 * k; // pre-gain into the curve; the output is divided back
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    const u = x * g;
    let y: number;
    if (k <= 0) y = u;
    else if (kind === 'transformer') { const b = 0.04, a = 1.2; y = (Math.tanh(a * (u + b)) - Math.tanh(a * b)) / (a * (1 - Math.tanh(a * b) ** 2)); }
    else if (kind === 'opamp') { const f = (v: number) => v / Math.cbrt(1 + Math.abs(v) ** 3); y = f(u + 0.04) - f(0.04); }
    else if (kind === 'silk') { const v = Math.max(-1.5, Math.min(1.5, u)); y = v + 0.1 * v * v - 0.1 * v * v * v; }
    else y = Math.tanh(u * 0.9) / 0.9;
    curve[i] = Math.max(-1, Math.min(1, y / g));
  }
  return curve;
}

/* ---------------------------------------------------------------- commands */

const touch = (song: Song, by: string | null): Song => ({ ...song, updated_at: now(), updated_by: by ?? song.updated_by });

export const setStrip = (song: Song, trackId: string, patch: Partial<ChannelStrip>, by: string | null): Song =>
  touch({ ...song, tracks: song.tracks.map((t) => (t.id === trackId ? { ...t, strip: { ...stripOf(t), ...patch }, updated_at: now() } : t)) }, by);

/** Back to a flat channel. */
export const resetStrip = (song: Song, trackId: string, by: string | null): Song =>
  touch({ ...song, tracks: song.tracks.map((t) => { if (t.id !== trackId) return t; const { strip: _s, ...rest } = t; return { ...rest, updated_at: now() }; }) }, by);

export const setMix = (song: Song, patch: Partial<MixSettings>, by: string | null): Song => touch({ ...song, mix: { ...mixOf(song), ...patch } }, by);

/** Changing the desk's character keeps every knob, moved to the nearest place the new desk allows. */
export function setConsole(song: Song, model: ConsoleModel, by: string | null): Song {
  const c = consoleOf(model);
  const tracks = song.tracks.map((t) => {
    if (!t.strip) return t;
    const s = stripOf(t);
    const hpf = c.hpfSteps && s.hpf_hz ? c.hpfSteps.reduce((a, b) => (Math.abs(b - s.hpf_hz) < Math.abs(a - s.hpf_hz) ? b : a)) : s.hpf_hz;
    return {
      ...t,
      strip: {
        ...s, hpf_hz: hpf,
        low_hz: snapFreq(c.bands.low, s.low_hz), lmid_hz: snapFreq(c.bands.lmid, s.lmid_hz), hmid_hz: snapFreq(c.bands.hmid, s.hmid_hz), high_hz: snapFreq(c.bands.high, s.high_hz),
        low_db: snapGain(c, s.low_db), lmid_db: c.bands.lmid.hidden ? 0 : snapGain(c, s.lmid_db), hmid_db: snapGain(c, s.hmid_db), high_db: snapGain(c, s.high_db),
      },
    };
  });
  return touch({ ...song, tracks, mix: { ...mixOf(song), console: model, glue_model: c.glue } }, by);
}

/** Echo time in seconds for a note value at a tempo. */
export const echoSeconds = (time: MixSettings['echo_time'], bpm: number): number => {
  const beat = 60 / bpm;
  return time === '1/8' ? beat / 2 : time === '3/8' ? beat * 1.5 : time === '1/2' ? beat * 2 : beat;
};
export const ROOM_SECONDS: Record<MixSettings['room_kind'], number> = { room: 0.9, plate: 1.8, hall: 3.2 };
