import { effectParams, ref } from '../packs/core';
import type { CatalogRef, Clip, ClipKind, FxChain, Profile, Song, ThemePreset, Track, TrackKind } from './types';
import { BAR_TICKS, STEP_TICKS } from './types';

export const newId = (): string => crypto.randomUUID();
export const now = (): string => new Date().toISOString();

export const TRACK_COLORS = ['#2DD4BF', '#38BDF8', '#A78BFA', '#F0509E', '#FB7185', '#FBBF24'];

export function newProfile(name: string, preset: ThemePreset, ring: string): Profile {
  const t = now();
  return {
    id: newId(),
    name,
    avatar: { kind: 'initial', ring },
    theme: { preset, base: preset === 'daylight' ? 'light' : 'dark' },
    default_hat: preset === 'graphite' ? 'producer' : 'musician',
    ui_lang: 'en',
    lyrics_lang: 'es',
    musician_level: 'starter',
    producer_level: 'starter',
    musician_styles: [],
    producer_styles: [],
    instruments: [],
    status: 'active',
    settings_schema_version: 1,
    created_at: t,
    updated_at: t,
  };
}

export function defaultFxChain(): FxChain {
  return {
    routing: 'series',
    slots: ['effect.drive', 'effect.delay', 'effect.reverb'].map((key) => {
      const r = ref(key);
      return {
        effect: r,
        bypass: key !== 'effect.reverb',
        params: Object.fromEntries(effectParams(r).map((p) => [p.name, key === 'effect.reverb' && p.name === 'mix' ? 0.12 : p.default])),
      };
    }),
  };
}

function clip(kind: ClipKind, lengthTicks: number, content: Clip['content']): Clip {
  const t = now();
  return {
    id: newId(),
    name: null,
    kind,
    start_tick: 0,
    length_ticks: lengthTicks,
    loop: true,
    content,
    content_schema_version: 1,
    recording_id: null,
    idea_id: null,
    origin: 'person',
    created_at: t,
    updated_at: t,
  };
}

function track(position: number, name: string, kind: TrackKind, instrument: CatalogRef, c: Clip): Track {
  const t = now();
  return {
    id: newId(),
    position,
    name,
    kind,
    instrument,
    color: TRACK_COLORS[(position - 1) % TRACK_COLORS.length],
    muted: false,
    solo: false,
    gain: 0.8,
    pan: 0,
    fx_chain: defaultFxChain(),
    fx_schema_version: 1,
    origin: 'person',
    clips: [c],
    created_at: t,
    updated_at: t,
  };
}

export const DRUM_ROW_KEYS = [
  'sound.kick', 'sound.snare', 'sound.clap', 'sound.hat-closed',
  'sound.hat-open', 'sound.rim', 'sound.tom', 'sound.crash',
];

/** A starting beat: kick, snare and hats, so pressing play makes music right away. */
function starterPattern(bars: number) {
  const steps = bars * 16;
  const hitsFor = (key: string): { step: number; vel: number }[] => {
    const out: { step: number; vel: number }[] = [];
    for (let s = 0; s < steps; s++) {
      const inBar = s % 16;
      if (key === 'sound.kick' && (inBar === 0 || inBar === 7 || inBar === 10)) out.push({ step: s, vel: 1 });
      if (key === 'sound.snare' && (inBar === 4 || inBar === 12)) out.push({ step: s, vel: 1 });
      if (key === 'sound.hat-closed' && inBar % 2 === 0) out.push({ step: s, vel: inBar % 4 === 0 ? 0.9 : 0.6 });
    }
    return out;
  };
  return { steps, rows: DRUM_ROW_KEYS.map((key) => ({ sound: ref(key), hits: hitsFor(key) })) };
}

export function newSong(ownerProfileId: string, title = 'Untitled', bars = 2): Song {
  const t = now();
  const length = bars * BAR_TICKS;
  const chords = Array.from({ length: bars }, (_, i) => ({ id: newId(), tick: i * BAR_TICKS, dur: BAR_TICKS, degree: [0, 4, 5, 3][i % 4] }));
  return {
    id: newId(),
    owner_profile_id: ownerProfileId,
    title,
    ppq: 960,
    tempo_bpm: 90,
    tempo_map: [{ tick: 0, bpm: 90 }],
    swing: 0.1,
    time_sig_num: 4,
    time_sig_den: 4,
    key_tonic: 'C',
    key_mode: 'major',
    tuning_a4_hz: 440,
    lyrics_lang: 'es',
    musician_style_key: null,
    producer_style_key: null,
    status: 'active',
    origin: 'person',
    schema_version: 1,
    sections: [{ id: newId(), position: 1, name: 'Loop', start_tick: 0, length_ticks: length, key_tonic: null, key_mode: null, lyrics_lang: null }],
    tracks: [
      track(1, 'Drums', 'drums', ref('instrument.drums-boom-bap'), clip('pattern', length, starterPattern(bars))),
      track(2, '808', 'instrument', ref('instrument.bass-808'), clip('notes', length, { notes: [] })),
      track(3, 'Chords', 'instrument', ref('instrument.pad-warm'), clip('chords', length, { chords })),
      track(4, 'Keys', 'instrument', ref('instrument.keys-ep'), clip('notes', length, { notes: [] })),
      track(5, 'Lead', 'instrument', ref('instrument.lead-bright'), clip('notes', length, { notes: [] })),
      track(6, 'Strings', 'instrument', ref('instrument.strings-ensemble'), clip('notes', length, { notes: [] })),
    ],
    created_by: ownerProfileId,
    updated_by: ownerProfileId,
    created_at: t,
    updated_at: t,
  };
}

export const loopBars = (song: Song): number => Math.round(song.sections[0].length_ticks / BAR_TICKS);
export const loopSteps = (song: Song): number => song.sections[0].length_ticks / STEP_TICKS;
