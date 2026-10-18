import { CUSTOM_KIT, DEFAULT_KIT, effectParams, isDrumKit, kitSlots, ref, resolveRow, roleOfInstrument, ROLES, rowsOf } from '../packs/core';
import type { KitSlot } from '../packs/core';
import type { CatalogRef, Clip, ClipKind, FxChain, Hat, Lang, Profile, Role, Song, StarredInstrument, ThemePreset, Track, TrackKind } from './types';
import { BAR_TICKS, STEP_TICKS } from './types';

export const newId = (): string => crypto.randomUUID();
export const now = (): string => new Date().toISOString();

export const TRACK_COLORS = ['#2DD4BF', '#38BDF8', '#A78BFA', '#F0509E', '#FB7185', '#FBBF24'];

export function newProfile(name: string, preset: ThemePreset, ring: string, hat?: Hat): Profile {
  const t = now();
  return {
    id: newId(),
    name,
    avatar: { kind: 'initial', ring },
    theme: { preset, base: preset === 'daylight' ? 'light' : 'dark' },
    default_hat: hat ?? (preset === 'graphite' ? 'producer' : 'musician'),
    ui_lang: 'en',
    lyrics_lang: 'es',
    musician_level: 'starter',
    producer_level: 'starter',
    musician_styles: [],
    producer_styles: [],
    instruments: [],
    classroom: preset === 'midnight-jewel',
    status: 'active',
    settings_schema_version: 1,
    created_at: t,
    updated_at: t,
  };
}

/** Classroom is on for a profile that says so; profiles made before it existed follow the young musician's theme. */
export const classroomOn = (p: Profile): boolean => p.classroom ?? p.theme.preset === 'midnight-jewel';

/** Swing a new song starts with; the reset button returns here. */
export const DEFAULT_SWING = 0.1;

/** The settings a pedal starts with on a new track; the reset button returns here. */
export function defaultFxParams(key: string): Record<string, number> {
  return Object.fromEntries(effectParams(ref(key)).map((p) => [p.name, key === 'effect.reverb' && p.name === 'mix' ? 0.12 : p.default]));
}

export function defaultFxChain(): FxChain {
  return {
    routing: 'series',
    slots: ['effect.drive', 'effect.delay', 'effect.reverb'].map((key) => ({
      effect: ref(key),
      bypass: key !== 'effect.reverb',
      params: defaultFxParams(key),
    })),
  };
}

export function clip(kind: ClipKind, lengthTicks: number, content: Clip['content']): Clip {
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

function track(position: number, name: string, kind: TrackKind, instrument: CatalogRef, c: Clip, role?: Role): Track {
  const t = now();
  return {
    id: newId(),
    position,
    name,
    kind,
    instrument,
    ...(role ? { role } : {}),
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

/* ---------------------------------------------------------------- starting beats */

type BarPattern = [row: number, steps: number[], vel?: number][];
const EIGHTHS = [0, 2, 4, 6, 8, 10, 12, 14];

/** One bar per kit, row by row, so pressing play on a new song makes music right away. */
const STARTERS: Record<string, BarPattern> = {
  'instrument.drums-boom-bap': [[0, [0, 7, 10]], [1, [4, 12]], [3, EIGHTHS]],
  'instrument.drums-trap': [[0, [0, 7, 10]], [1, [4, 12]], [3, EIGHTHS]],
  'instrument.drums-pop': [[0, [0, 6, 8]], [1, [4, 12]], [2, [12], 0.6], [3, EIGHTHS]],
  'instrument.drums-rock': [[0, [0, 8, 10]], [1, [4, 12]], [3, EIGHTHS]],
  'instrument.drums-909': [[0, [0, 4, 8, 12]], [2, [4, 12]], [4, [2, 6, 10, 14], 0.7]],
  'instrument.drums-jazz': [[0, [0], 0.6], [3, [4, 12], 0.7], [7, [0, 4, 7, 8, 12, 15], 0.7]],
  'instrument.drums-latin': [[0, [0, 8]], [5, [0, 3, 6, 10, 12]], [3, EIGHTHS, 0.6]],
  'instrument.drums-orch': [[0, [0, 8]], [1, [4, 12], 0.7], [3, [0], 0.6]],
  'instrument.perc-latin': [[5, [0, 3, 6, 10, 12]], [4, EIGHTHS, 0.6], [1, [6, 14]], [0, [12]]],
};

/** Tempo a new song starts at in each genre. */
const KIT_TEMPO: Record<string, number> = {
  'kit.hiphop': 90, 'kit.pop': 110, 'kit.rock': 120, 'kit.electronic': 124, 'kit.jazz': 120, 'kit.classical': 84, 'kit.latin': 100,
};

function pattern(instrumentKey: string, bars: number, starter: boolean) {
  const steps = bars * 16;
  const bar = starter ? STARTERS[instrumentKey] ?? [] : [];
  const rows = rowsOf(instrumentKey).map((key, i) => {
    const hits: { step: number; vel: number }[] = [];
    for (const [row, inBar, vel] of bar) {
      if (row !== i) continue;
      for (let b = 0; b < bars; b++) for (const s of inBar) hits.push({ step: b * 16 + s, vel: vel ?? (s % 4 === 0 ? 0.9 : 0.75) });
    }
    hits.sort((a, b) => a.step - b.step);
    return { sound: ref(key), hits };
  });
  return { steps, rows };
}

/* ---------------------------------------------------------------- track names */

/** Starting track names; a song keeps the names it was born with, in the language of the day. */
export const ROLE_NAMES: Record<Lang, Record<Role, string>> = {
  en: { drums: 'Drums', perc: 'Percussion', bass: 'Bass', chords: 'Chords', keys: 'Comping', lead: 'Melody', color: 'Countermelody' },
  es: { drums: 'Batería', perc: 'Percusión', bass: 'Bajo', chords: 'Acordes', keys: 'Acompañamiento', lead: 'Melodía', color: 'Contramelodía' },
};
/** Names songs got before kits existed; switching kit may rename them. */
const OLD_NAMES = ['Drums', '808', 'Chords', 'Keys', 'Lead', 'Strings', 'Batería', 'Acordes', 'Teclado', 'Melodía', 'Cuerdas'];

const roleName = (role: Role, lang: Lang, n: number) => (n > 1 ? `${ROLE_NAMES[lang][role]} ${n}` : ROLE_NAMES[lang][role]);

/** True for a name the app gave, never one a person typed. */
export const isAutoName = (name: string): boolean => {
  const base = name.replace(/ \d+$/, '');
  return OLD_NAMES.includes(name) || (['en', 'es'] as Lang[]).some((l) => Object.values(ROLE_NAMES[l]).includes(base));
};

/* ---------------------------------------------------------------- kits */

/** The job a track does. Songs made before kits have no role; it comes from the clip and the instrument. */
export function roleOf(t: Track): Role {
  if (t.role) return t.role;
  if (t.clips[0]?.kind === 'chords') return 'chords';
  const key = t.instrument?.key ?? '';
  if (t.kind === 'drums') return roleOfInstrument(key) === 'perc' ? 'perc' : 'drums';
  return roleOfInstrument(key);
}

/** The slots of a kit. The custom kit is the starred instruments, grouped by role; with no stars it is hip hop. */
export function slotsFor(kitKey: string, starred: StarredInstrument[] = []): KitSlot[] {
  if (kitKey === CUSTOM_KIT) {
    const slots = ROLES.flatMap((role) => starred.filter((s) => s.role === role && rowsOrVoice(s.key)).map((s) => ({ role, instrument: s.key })));
    if (slots.length) return slots;
  }
  const slots = kitSlots(kitKey);
  return slots.length ? slots : kitSlots(DEFAULT_KIT);
}
const rowsOrVoice = (key: string) => { try { ref(key); return true; } catch { return false; } };

function trackFor(slot: KitSlot, position: number, name: string, bars: number, opts: { starter: boolean; chords?: Clip['content'] }): Track {
  const length = bars * BAR_TICKS;
  const drums = isDrumKit(slot.instrument);
  const c = drums
    ? clip('pattern', length, pattern(slot.instrument, bars, opts.starter))
    : slot.role === 'chords'
      ? clip('chords', length, opts.chords ?? { chords: [] })
      : clip('notes', length, { notes: [] });
  return track(position, name, drums ? 'drums' : 'instrument', ref(slot.instrument), c, slot.role);
}

/**
 * A new song. With `example`, the first one a profile gets: a starting beat and four chords to hear right away.
 * Without it the song starts empty: the person decides what goes in (a catalog of example beats, opened on request,
 * is planned).
 */
export function newSong(ownerProfileId: string, title = 'Untitled', bars = 2, lang: Lang = 'en', kitKey: string = DEFAULT_KIT, starred: StarredInstrument[] = [], example = true): Song {
  const t = now();
  const length = bars * BAR_TICKS;
  const chords = !example ? undefined : { chords: Array.from({ length: bars }, (_, i) => ({ id: newId(), tick: i * BAR_TICKS, dur: BAR_TICKS, degree: [0, 4, 5, 3][i % 4] })) };
  const slots = slotsFor(kitKey, starred);
  const counts: Partial<Record<Role, number>> = {};
  let starterUsed = false;
  const tracks = slots.map((slot, i) => {
    const n = (counts[slot.role] = (counts[slot.role] ?? 0) + 1);
    // One starting beat per family: the first drum track, plus the latin percussion that completes it.
    const starter = example && isDrumKit(slot.instrument) && (!starterUsed || slot.instrument === 'instrument.perc-latin');
    if (starter) starterUsed = true;
    return trackFor(slot, i + 1, roleName(slot.role, lang, n), bars, { starter, chords: n === 1 ? chords : undefined });
  });
  const tempo = KIT_TEMPO[kitKey] ?? 90;
  return {
    id: newId(),
    owner_profile_id: ownerProfileId,
    title,
    ppq: 960,
    tempo_bpm: tempo,
    tempo_map: [{ tick: 0, bpm: tempo }],
    swing: DEFAULT_SWING,
    time_sig_num: 4,
    time_sig_den: 4,
    key_tonic: 'C',
    key_mode: 'major',
    tuning_a4_hz: 440,
    lyrics_lang: 'es',
    musician_style_key: null,
    producer_style_key: null,
    kit_key: kitKey === CUSTOM_KIT && !starred.length ? DEFAULT_KIT : kitKey,
    length_ticks: length,
    status: 'active',
    origin: 'person',
    schema_version: 1,
    sections: [],
    tracks,
    created_by: ownerProfileId,
    updated_by: ownerProfileId,
    created_at: t,
    updated_at: t,
  };
}

const hasContent = (t: Track): boolean => {
  const c = t.clips[0]?.content as { notes?: unknown[]; rows?: { hits: unknown[] }[]; chords?: unknown[] } | undefined;
  return !!c && ((c.notes?.length ?? 0) > 0 || (c.chords?.length ?? 0) > 0 || (c.rows ?? []).some((r) => r.hits.length > 0));
};

/** The same track on another instrument: drum rows move by place (kick to bass drum), notes and chords stay. */
export function retarget(t: Track, instrumentKey: string, role: Role, name: string): Track {
  const at = now();
  const drums = isDrumKit(instrumentKey);
  const clips = t.clips.map((c) => {
    if (c.kind !== 'pattern' || !drums) return c;
    const p = c.content as { steps: number; rows: { sound: CatalogRef; hits: { step: number; vel: number }[] }[] };
    // Each old row lands on the row that plays it in the new kit; two rows landing together keep every hit.
    const target = rowsOf(instrumentKey);
    const merged = new Map<string, Map<number, number>>(target.map((k) => [k, new Map()]));
    for (const r of p.rows) {
      const dest = resolveRow(target, r.sound.key);
      const into = dest ? merged.get(dest) : undefined;
      if (!into) continue;
      for (const h of r.hits) into.set(h.step, Math.max(into.get(h.step) ?? 0, h.vel));
    }
    const rows = target.map((key) => ({
      sound: ref(key),
      hits: [...merged.get(key)!].map(([step, vel]) => ({ step, vel })).sort((a, b) => a.step - b.step),
    }));
    return { ...c, content: { steps: p.steps, rows }, updated_at: at };
  });
  const { sound: _sound, ...rest } = t; // a saved sound belongs to the instrument it was made on
  return { ...rest, name, role, instrument: ref(instrumentKey), clips, updated_at: at };
}

/**
 * Move a song to another kit and keep what was written: each track goes to the instrument with the same role in
 * the new kit. Roles the old kit lacked get empty tracks; tracks the new kit has no place for stay if they have
 * notes, so nothing written is lost.
 */
export function switchKit(song: Song, kitKey: string, slots: KitSlot[], lang: Lang, by: string | null): Song {
  const bars = songBars(song);
  const used = new Set<string>();
  const counts: Partial<Record<Role, number>> = {};
  const tracks: Track[] = [];
  for (const slot of slots) {
    const n = (counts[slot.role] = (counts[slot.role] ?? 0) + 1);
    const name = roleName(slot.role, lang, n);
    const match = song.tracks.find((t) => !used.has(t.id) && roleOf(t) === slot.role && !!t.instrument && isDrumKit(t.instrument.key) === isDrumKit(slot.instrument));
    if (match) {
      used.add(match.id);
      tracks.push(retarget(match, slot.instrument, slot.role, isAutoName(match.name) ? name : match.name));
    } else {
      tracks.push(trackFor(slot, tracks.length + 1, name, bars, { starter: false }));
    }
  }
  for (const t of song.tracks) {
    if (used.has(t.id) || !hasContent(t)) continue;
    const role = roleOf(t);
    const n = (counts[role] = (counts[role] ?? 0) + 1);
    tracks.push({ ...t, role, name: isAutoName(t.name) ? roleName(role, lang, n) : t.name });
  }
  return {
    ...song,
    kit_key: kitKey,
    tracks: tracks.map((t, i) => ({ ...t, position: i + 1 })),
    updated_by: by,
    updated_at: now(),
  };
}

/** How long the song is, in ticks. Songs from before song form kept it in their single "Loop" section. */
export function songLength(song: Song): number {
  if (song.length_ticks && song.length_ticks > 0) return song.length_ticks;
  const clip = song.tracks.find((t) => t.clips[0])?.clips[0];
  return song.sections[0]?.length_ticks ?? clip?.length_ticks ?? 2 * BAR_TICKS;
}
export const songBars = (song: Song): number => Math.max(1, Math.round(songLength(song) / BAR_TICKS));
export const songSteps = (song: Song): number => songLength(song) / STEP_TICKS;
/** Old names, kept so nothing else had to change. */
export const loopBars = songBars;
export const loopSteps = songSteps;

/**
 * Bring an older song to the current shape: its length moves out of the "Loop" section into the song, and
 * that placeholder section goes away (sections are now the parts the person marks: intro, verse, chorus).
 */
export function normalizeSong(song: Song): Song {
  if (song.length_ticks && song.length_ticks > 0) return song;
  const length = songLength(song);
  const placeholder = song.sections.length === 1 && song.sections[0].name === 'Loop' && !song.sections[0].kind
    && song.sections[0].start_tick === 0 && song.sections[0].length_ticks === length;
  return { ...song, length_ticks: length, sections: placeholder ? [] : song.sections };
}
