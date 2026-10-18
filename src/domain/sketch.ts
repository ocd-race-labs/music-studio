// The musician's idea: the song's form (blocks in order, a block may come back), chords bar by bar, a rhythm per
// block from the Colección styles, and the instruments that play it. It renders to a song to hear it, and it writes
// the detail when accepted. The detail never writes back: the idea stays as the reference.

import type { ChordsContent, Clip, Lang, Note, NotesContent, PatternContent, Section, SectionKind, Sketch, SketchBlock, SketchGroove, Song, Track } from './types';
import { BAR_TICKS, STEP_TICKS } from './types';
import { newId, now, roleName, roleOf, retarget, songBars, trackFor } from './factory';
import { kindLabel, MAX_BARS } from './arrange';
import { ENTRIES, GROUPS } from '../packs/collection';
import type { Genre, Groove } from '../packs/collection';
import { findByKey, ref, resolveRow, rowsOf } from '../packs/core';
import { chordMidi, diatonicTriads, noteNameAscii, spellInKey } from '../theory';

export type Feel = SketchGroove['feel'];
export const FEELS: Feel[] = ['soft', 'normal', 'strong', 'half'];
export const BLOCK_KINDS: SectionKind[] = ['intro', 'verse', 'prechorus', 'chorus', 'bridge', 'solo', 'break', 'outro'];

/** "Coro 1", or the name the person gave it. */
export const blockName = (b: SketchBlock, lang: Lang): string => b.name?.trim() || `${kindLabel(b.kind, lang)} ${b.n}`;

/* ---------------------------------------------------------------- starting points */

export const isMinorKey = (song: Song) => /minor|aeolian|dorian|phrygian/i.test(song.key_mode);

/** Typical chords by part, one per bar, as scale degrees: a sound place to start that the musician then changes. */
export function startingChords(kind: SectionKind, minor: boolean, bars: number): (number | null)[] {
  const major: Partial<Record<SectionKind, number[]>> = {
    intro: [0, 0, 3, 3], verse: [0, 5, 3, 4], prechorus: [1, 3, 4, 4], chorus: [3, 4, 0, 5], bridge: [5, 3, 0, 4], solo: [0, 3, 4, 3], outro: [3, 4, 0, 0],
  };
  const min: Partial<Record<SectionKind, number[]>> = {
    intro: [0, 0, 5, 5], verse: [0, 5, 2, 6], prechorus: [3, 3, 4, 4], chorus: [5, 6, 0, 0], bridge: [3, 4, 5, 6], solo: [0, 6, 5, 6], outro: [5, 6, 0, 0],
  };
  const prog = (minor ? min : major)[kind];
  if (!prog) return Array.from({ length: bars }, () => null);
  return Array.from({ length: bars }, (_, i) => prog[i % prog.length]);
}

/** How hard each kind of part plays by default; a break has no drums. */
export const startingFeel = (kind: SectionKind): Feel | null =>
  kind === 'break' ? null : kind === 'intro' || kind === 'outro' ? 'soft' : kind === 'chorus' || kind === 'solo' ? 'strong' : kind === 'bridge' ? 'half' : 'normal';

/** Progressions to fill a block with, by scale degree. */
export const PROGRESSIONS: { id: string; degrees: number[]; minor?: boolean }[] = [
  { id: 'I-V-vi-IV', degrees: [0, 4, 5, 3] },
  { id: 'vi-IV-I-V', degrees: [5, 3, 0, 4] },
  { id: 'I-vi-IV-V', degrees: [0, 5, 3, 4] },
  { id: 'I-IV-V-IV', degrees: [0, 3, 4, 3] },
  { id: 'ii-V-I-I', degrees: [1, 4, 0, 0] },
  { id: 'i-VI-III-VII', degrees: [0, 5, 2, 6], minor: true },
  { id: 'i-VII-VI-VII', degrees: [0, 6, 5, 6], minor: true },
  { id: 'i-iv-v-i', degrees: [0, 3, 4, 0], minor: true },
];

const KIT_STYLE: Record<string, string> = { 'kit.rock': 'rock-modern', 'kit.electronic': 'el-house', 'kit.hiphop': 'hh-boombap' };
const drumsOf = (group: string) => ENTRIES.find((e) => e.group === group && e.family === 'drums');
const firstOf = (song: Song, kind: Clip['kind'], role?: string) => song.tracks.find((t) => t.clips[0]?.kind === kind && (!role || roleOf(t) === role));
const chordsTrackOf = (song: Song) => firstOf(song, 'chords');
const drumsTrackOf = (song: Song) => song.tracks.find((t) => t.clips[0]?.kind === 'pattern' && roleOf(t) === 'drums') ?? firstOf(song, 'pattern');
const bassTrackOf = (song: Song) => song.tracks.find((t) => t.clips[0]?.kind === 'notes' && roleOf(t) === 'bass');

/** A first idea for a song: no parts yet, the song's own instruments and a style from its kit. */
export function newSketch(song: Song): Sketch {
  const style = KIT_STYLE[song.kit_key ?? ''] ?? 'rock-modern';
  return {
    blocks: [],
    order: [],
    chords_instrument: chordsTrackOf(song)?.instrument ?? ref('instrument.keys-piano'),
    drums_instrument: drumsTrackOf(song)?.instrument ?? (drumsOf(style) ? ref(drumsOf(style)!.instrument) : null),
    bass_instrument: bassTrackOf(song)?.instrument ?? null,
    style_group: style,
    accepted_at: null,
    schema_version: 1,
    updated_at: now(),
  };
}

const touch = (s: Sketch): Sketch => ({ ...s, updated_at: now() });

export function makeBlock(sketch: Sketch, kind: SectionKind, bars: number, minor: boolean): SketchBlock {
  const n = sketch.blocks.filter((b) => b.kind === kind).reduce((m, b) => Math.max(m, b.n), 0) + 1;
  const feel = startingFeel(kind);
  return { id: newId(), kind, n, bars, chords: startingChords(kind, minor, bars), groove: feel ? { group: sketch.style_group, feel } : null };
}

/** Templates for the form; a part listed twice by the same letter is the same block played again. */
export const TEMPLATES: { id: string; parts: [SectionKind, number, string][] }[] = [
  { id: 'song', parts: [['intro', 4, 'a'], ['verse', 8, 'b'], ['chorus', 8, 'c'], ['verse', 8, 'd'], ['chorus', 8, 'c'], ['bridge', 8, 'e'], ['chorus', 8, 'f'], ['outro', 4, 'g']] },
  { id: 'short', parts: [['intro', 4, 'a'], ['verse', 8, 'b'], ['chorus', 8, 'c'], ['verse', 8, 'b'], ['chorus', 8, 'c'], ['outro', 4, 'd']] },
  { id: 'beat', parts: [['intro', 4, 'a'], ['verse', 8, 'b'], ['chorus', 8, 'c'], ['verse', 8, 'b'], ['chorus', 8, 'c']] },
  { id: 'loop', parts: [['verse', 4, 'a'], ['chorus', 4, 'b']] },
];

export function applyTemplate(sketch: Sketch, id: string, minor: boolean): Sketch {
  const tpl = TEMPLATES.find((x) => x.id === id);
  if (!tpl) return sketch;
  let next: Sketch = { ...sketch, blocks: [], order: [] };
  const byLetter = new Map<string, string>();
  for (const [kind, bars, letter] of tpl.parts) {
    let bid = byLetter.get(letter);
    if (!bid) {
      const b = makeBlock(next, kind, bars, minor);
      next = { ...next, blocks: [...next.blocks, b] };
      bid = b.id;
      byLetter.set(letter, bid);
    }
    next = { ...next, order: [...next.order, bid] };
  }
  return touch(next);
}

export const totalBars = (s: Sketch): number => s.order.reduce((n, id) => n + (s.blocks.find((b) => b.id === id)?.bars ?? 0), 0);

/** Add a new block at the end of the form (or after `at`); null when the song would pass the bar limit. */
export function addBlock(sketch: Sketch, kind: SectionKind, bars: number, minor: boolean, at = sketch.order.length): Sketch | null {
  if (totalBars(sketch) + bars > MAX_BARS) return null;
  const b = makeBlock(sketch, kind, bars, minor);
  return touch({ ...sketch, blocks: [...sketch.blocks, b], order: [...sketch.order.slice(0, at), b.id, ...sketch.order.slice(at)] });
}

/** Play a block again: the same chords and rhythm, at `at` in the form. */
export function repeatBlock(sketch: Sketch, blockId: string, at = sketch.order.length): Sketch | null {
  const b = sketch.blocks.find((x) => x.id === blockId);
  if (!b || totalBars(sketch) + b.bars > MAX_BARS) return null;
  return touch({ ...sketch, order: [...sketch.order.slice(0, at), blockId, ...sketch.order.slice(at)] });
}

/** A copy of a block as a new part ("Coro 2" from "Coro 1"), to change without changing the first. */
export function copyBlock(sketch: Sketch, blockId: string, at = sketch.order.length): Sketch | null {
  const b = sketch.blocks.find((x) => x.id === blockId);
  if (!b || totalBars(sketch) + b.bars > MAX_BARS) return null;
  const n = sketch.blocks.filter((x) => x.kind === b.kind).reduce((m, x) => Math.max(m, x.n), 0) + 1;
  const copy: SketchBlock = { ...structuredClone(b), id: newId(), n, name: undefined };
  return touch({ ...sketch, blocks: [...sketch.blocks, copy], order: [...sketch.order.slice(0, at), copy.id, ...sketch.order.slice(at)] });
}

/** Take one place out of the form; a block no longer in the form goes away. */
export function removeAt(sketch: Sketch, index: number): Sketch {
  const order = sketch.order.filter((_, i) => i !== index);
  return touch({ ...sketch, order, blocks: sketch.blocks.filter((b) => order.includes(b.id)) });
}

export function moveAt(sketch: Sketch, index: number, delta: -1 | 1): Sketch {
  const j = index + delta;
  if (j < 0 || j >= sketch.order.length) return sketch;
  const order = [...sketch.order];
  [order[index], order[j]] = [order[j], order[index]];
  return touch({ ...sketch, order });
}

const mapBlock = (sketch: Sketch, id: string, fn: (b: SketchBlock) => SketchBlock): Sketch =>
  touch({ ...sketch, blocks: sketch.blocks.map((b) => (b.id === id ? fn(b) : b)) });

/** Make a block longer or shorter; new bars repeat its chords from the start. */
export function setBlockBars(sketch: Sketch, id: string, bars: number): Sketch | null {
  const b = sketch.blocks.find((x) => x.id === id);
  if (!b) return sketch;
  const target = Math.max(1, Math.min(32, Math.round(bars)));
  const uses = sketch.order.filter((x) => x === id).length;
  if (totalBars(sketch) + (target - b.bars) * uses > MAX_BARS) return null;
  const per = b.split ? 2 : 1;
  const chords = Array.from({ length: target * per }, (_, i) => (i < b.chords.length ? b.chords[i] : b.chords[i % Math.max(1, b.chords.length)] ?? null));
  return mapBlock(sketch, id, (x) => ({ ...x, bars: target, chords }));
}

export const setChordAt = (sketch: Sketch, id: string, slot: number, degree: number | null): Sketch =>
  mapBlock(sketch, id, (b) => ({ ...b, chords: b.chords.map((c, i) => (i === slot ? degree : c)) }));

/** Two chords per bar, or one again (the first half of each bar stays). */
export const setSplit = (sketch: Sketch, id: string, split: boolean): Sketch =>
  mapBlock(sketch, id, (b) => (!!b.split === split ? b : {
    ...b, split, chords: split ? b.chords.flatMap((c) => [c, c]) : b.chords.filter((_, i) => i % 2 === 0),
  }));

/** Fill a block's chords with a progression, cycling over its bars. */
export const fillChords = (sketch: Sketch, id: string, degrees: number[]): Sketch =>
  mapBlock(sketch, id, (b) => ({ ...b, chords: b.chords.map((_, i) => degrees[Math.floor(i / (b.split ? 2 : 1)) % degrees.length]) }));

export const setGroove = (sketch: Sketch, id: string, groove: SketchGroove | null): Sketch => mapBlock(sketch, id, (b) => ({ ...b, groove }));
export const setBlockKind = (sketch: Sketch, id: string, kind: SectionKind): Sketch => {
  const n = sketch.blocks.filter((x) => x.kind === kind && x.id !== id).reduce((m, x) => Math.max(m, x.n), 0) + 1;
  return mapBlock(sketch, id, (b) => (b.kind === kind ? b : { ...b, kind, n }));
};
export const renameBlock = (sketch: Sketch, id: string, name: string): Sketch => mapBlock(sketch, id, (b) => ({ ...b, name: name.trim().slice(0, 40) || undefined }));

/** A rhythm for every block, or the instruments of the idea. */
export const setIdeaInstruments = (sketch: Sketch, patch: Partial<Pick<Sketch, 'chords_instrument' | 'drums_instrument' | 'bass_instrument' | 'style_group'>>): Sketch => touch({ ...sketch, ...patch });
export const setStyleEverywhere = (sketch: Sketch, group: string): Sketch =>
  touch({ ...sketch, style_group: group, blocks: sketch.blocks.map((b) => (b.groove ? { ...b, groove: { ...b.groove, group } } : b)) });

/* ---------------------------------------------------------------- the form laid out in bars */

export interface Place { blockId: string; occ: number; index: number; startBar: number; bars: number; id: string }

/** Where every place of the form lands: its first bar, its length, and the id its section gets in the detail. */
export function layout(sketch: Sketch): Place[] {
  const seen = new Map<string, number>();
  let bar = 0;
  return sketch.order.flatMap((blockId, index) => {
    const b = sketch.blocks.find((x) => x.id === blockId);
    if (!b) return [];
    const occ = seen.get(blockId) ?? 0;
    seen.set(blockId, occ + 1);
    const place = { blockId, occ, index, startBar: bar, bars: b.bars, id: `sk-${blockId}-${occ}` };
    bar += b.bars;
    return [place];
  });
}

/** True when the detail's parts are exactly the idea's form as last written: a single block can be written again. */
export function detailFollowsForm(song: Song): boolean {
  const s = song.sketch;
  if (!s) return false;
  const places = layout(s);
  return places.length === song.sections.length && places.every((p, i) => {
    const sec = [...song.sections].sort((a, b) => a.start_tick - b.start_tick)[i];
    return sec.id === p.id && sec.start_tick === p.startBar * BAR_TICKS && sec.length_ticks === p.bars * BAR_TICKS;
  });
}

/* ---------------------------------------------------------------- rendering the idea */

const VOICE_ROW: Record<string, string> = {
  kick: 'sound.kick', snare: 'sound.snare', clap: 'sound.clap', hatClosed: 'sound.hat-closed', hatOpen: 'sound.hat-open', rim: 'sound.rim',
  tom: 'sound.tom', tom1: 'sound.tom-1', tom2: 'sound.tom-2', ride: 'sound.ride', crash: 'sound.crash', china: 'sound.china',
};

/** The hits of a groove in one bar of a place, shaped by how hard the block plays. */
function barHits(groove: Groove, feel: Feel, barInPlace: number, bars: number, fillAtEnd: boolean): { voice: string; step: number; vel: number }[] {
  const span = Math.max(1, groove.bars);
  const offset = (barInPlace % span) * 16;
  const out: { voice: string; step: number; vel: number }[] = [];
  const vel = (voice: string, s: number) => (groove.soft?.[voice]?.includes(s + offset) ? 0.45 : s % 4 === 0 ? 0.9 : 0.75);
  for (const [voice, steps] of Object.entries(groove.steps)) {
    for (const raw of steps ?? []) {
      if (raw < offset || raw >= offset + 16) continue;
      const s = raw - offset;
      out.push({ voice, step: s, vel: vel(voice, raw) });
    }
  }
  let hits = out;
  const backbeat = (v: string) => v === 'snare' || v === 'clap';
  if (feel === 'soft') {
    // Kick and cymbals only, softer; the backbeat becomes a side stick.
    hits = hits.filter((h) => !['crash', 'china', 'tom', 'tom1', 'tom2'].includes(h.voice)).map((h) => (backbeat(h.voice) ? { voice: 'rim', step: h.step, vel: 0.5 } : { ...h, vel: h.vel * 0.7 }));
  } else if (feel === 'half') {
    // Half time: the backbeat once a bar, on beat three; the kick keeps only its first half.
    hits = hits.filter((h) => !backbeat(h.voice) && (h.voice !== 'kick' || h.step < 8));
    hits.push({ voice: 'snare', step: 8, vel: 0.9 });
    if (!hits.some((h) => h.voice === 'kick' && h.step === 0)) hits.push({ voice: 'kick', step: 0, vel: 0.9 });
  } else if (feel === 'strong') {
    hits = hits.map((h) => ({ ...h, vel: Math.min(1, h.vel * 1.12) }));
    if (barInPlace === 0) hits.push({ voice: 'crash', step: 0, vel: 0.85 });
  }
  if (fillAtEnd && barInPlace === bars - 1 && feel !== 'soft') {
    // A short fill into the next part: the last beat in sixteenths on the snare.
    hits = hits.filter((h) => h.step < 12 || h.voice === 'kick');
    [12, 13, 14, 15].forEach((s, i) => hits.push({ voice: 'snare', step: s, vel: 0.55 + i * 0.12 }));
  }
  return hits;
}

const rootMidi = (song: Song, degree: number): number | null => {
  const triad = diatonicTriads({ tonic: song.key_tonic, mode: song.key_mode })[degree];
  if (!triad) return null;
  const pc = ((chordMidi(triad, 52)[0] % 12) + 12) % 12;
  return 36 + pc; // C2 to B2
};

const spell = (song: Song, midi: number) => noteNameAscii(midi, spellInKey(midi, { tonic: song.key_tonic, mode: song.key_mode }));

/** What the idea writes into the chords, drums and bass tracks, over the whole form. */
function ideaContent(song: Song, sketch: Sketch): { chords: ChordsContent; pattern: PatternContent | null; bass: NotesContent | null; length: number } {
  const places = layout(sketch);
  const length = Math.max(1, places.reduce((n, p) => n + p.bars, 0)) * BAR_TICKS;
  const chords: ChordsContent = { chords: [] };
  const kit = sketch.drums_instrument?.key ?? drumsTrackOf(song)?.instrument?.key ?? '';
  const rows = kit && findByKey(kit) ? rowsOf(kit) : [];
  const hits = new Map<string, Map<number, number>>(rows.map((r) => [r, new Map()]));
  const bassNotes: Note[] = [];
  places.forEach((p, pi) => {
    const b = sketch.blocks.find((x) => x.id === p.blockId)!;
    const next = places[pi + 1] ? sketch.blocks.find((x) => x.id === places[pi + 1].blockId) : undefined;
    const per = b.split ? 2 : 1;
    const groove = b.groove ? drumsOf(b.groove.group)?.groove : undefined;
    for (let bar = 0; bar < b.bars; bar++) {
      const barTick = (p.startBar + bar) * BAR_TICKS;
      // chords
      for (let h = 0; h < per; h++) {
        const deg = b.chords[bar * per + h];
        if (deg === null || deg === undefined) continue;
        chords.chords.push({ id: newId(), tick: barTick + (h * BAR_TICKS) / per, dur: BAR_TICKS / per, degree: deg });
      }
      // drums
      const barH = groove && b.groove ? barHits(groove, b.groove.feel, bar, b.bars, !!next && next.id !== b.id && next.kind !== b.kind) : [];
      for (const hit of barH) {
        const row = resolveRow(rows, VOICE_ROW[hit.voice] ?? hit.voice);
        if (!row) continue;
        const step = (p.startBar + bar) * 16 + hit.step;
        const m = hits.get(row)!;
        m.set(step, Math.max(m.get(step) ?? 0, hit.vel));
      }
      // bass: the chord's root on every kick, or twice a bar with no drums
      if (sketch.bass_instrument) {
        const kicks = barH.filter((x) => x.voice === 'kick').map((x) => x.step).sort((a, c) => a - c);
        const starts = kicks.length ? [...new Set(kicks)] : [0, 8];
        starts.forEach((s, i) => {
          const deg = b.chords[bar * per + (per === 2 && s >= 8 ? 1 : 0)];
          if (deg === null || deg === undefined) return;
          const midi = rootMidi(song, deg);
          if (midi === null) return;
          const end = starts[i + 1] ?? 16;
          const len = Math.max(2, Math.min(8, end - s));
          bassNotes.push({ id: newId(), tick: barTick + s * STEP_TICKS, dur: Math.min(len, 16 - s) * STEP_TICKS, midi, spell: spell(song, midi), vel: 0.85 });
        });
      }
    }
  });
  const pattern: PatternContent | null = rows.length ? {
    steps: length / STEP_TICKS,
    rows: rows.map((r) => ({ sound: ref(r), hits: [...hits.get(r)!].map(([step, vel]) => ({ step, vel })).sort((a, c) => a.step - c.step) })),
  } : null;
  return { chords, pattern, bass: sketch.bass_instrument ? { notes: bassNotes } : null, length };
}

/** Sections of the detail that follow the idea's form. */
function formSections(sketch: Sketch, lang: Lang): Section[] {
  return layout(sketch).map((p, i) => {
    const b = sketch.blocks.find((x) => x.id === p.blockId)!;
    return {
      id: p.id, position: i + 1, name: blockName(b, lang), kind: b.kind, start_tick: p.startBar * BAR_TICKS, length_ticks: p.bars * BAR_TICKS,
      key_tonic: null, key_mode: null, lyrics_lang: null,
    };
  });
}

const withInstrument = (t: Track, key: string | undefined): Track => (!key || t.instrument?.key === key || !findByKey(key) ? t : retarget(t, key, roleOf(t), t.name));
const emptyOf = (c: Clip, length: number): Clip['content'] =>
  c.kind === 'notes' ? { notes: [] } : c.kind === 'chords' ? { chords: [] } : c.kind === 'pattern' ? { steps: length / STEP_TICKS, rows: (c.content as PatternContent).rows.map((r) => ({ ...r, hits: [] })) } : c.content;

/** The song with a track for each job the idea plays (chords, drums, and bass when it has one), added when missing. */
export function withIdeaTracks(song: Song, lang: Lang, fresh = false): Song {
  const s = song.sketch;
  if (!s) return song;
  const add: Track[] = [];
  const bars = songBars(song);
  // While only heard, the added tracks keep fixed ids so the sound engine does not rebuild them on every change.
  const FIXED = { chords: '00000000-0000-4000-8000-000000000001', drums: '00000000-0000-4000-8000-000000000002', bass: '00000000-0000-4000-8000-000000000003' };
  const next = (role: 'chords' | 'drums' | 'bass', instrument: string) => {
    const tr = trackFor({ role, instrument }, song.tracks.length + add.length + 1, roleName(role, lang, 1), bars, { starter: false });
    return fresh ? tr : { ...tr, id: FIXED[role] };
  };
  if (!chordsTrackOf(song)) add.push(next('chords', s.chords_instrument.key));
  if (!drumsTrackOf(song) && s.drums_instrument) add.push(next('drums', s.drums_instrument.key));
  if (!bassTrackOf(song) && s.bass_instrument) add.push(next('bass', s.bass_instrument.key));
  return add.length ? { ...song, tracks: [...song.tracks, ...add] } : song;
}

/**
 * The idea as a song of its own, to hear it: the same tracks with nothing written but the idea's chords, drums and
 * bass, on the idea's instruments, over the idea's form.
 */
export function renderIdea(raw: Song, lang: Lang): Song {
  const sketch = raw.sketch;
  if (!sketch || !sketch.order.length) return raw;
  const song = withIdeaTracks(raw, lang);
  const content = ideaContent(song, sketch);
  const length = content.length;
  const chordsT = chordsTrackOf(song), drumsT = drumsTrackOf(song), bassT = bassTrackOf(song);
  const tracks = song.tracks.map((t0) => {
    let t = t0;
    if (t.id === chordsT?.id) t = withInstrument(t, sketch.chords_instrument.key);
    if (t.id === drumsT?.id) t = withInstrument(t, sketch.drums_instrument?.key);
    if (t.id === bassT?.id && sketch.bass_instrument) t = withInstrument(t, sketch.bass_instrument.key);
    const clips = t.clips.map((c, i) => {
      let body: Clip['content'] = emptyOf(c, length);
      if (i === 0 && t.id === chordsT?.id && c.kind === 'chords') body = content.chords;
      if (i === 0 && t.id === drumsT?.id && c.kind === 'pattern' && content.pattern) {
        // Rows follow the track's kit after retargeting.
        const own = rowsOf(t.instrument?.key ?? '');
        body = { steps: length / STEP_TICKS, rows: own.map((r) => ({ sound: ref(r), hits: content.pattern!.rows.find((x) => x.sound.key === r)?.hits ?? [] })) };
      }
      if (i === 0 && t.id === bassT?.id && c.kind === 'notes' && content.bass) body = content.bass;
      return { ...c, length_ticks: length, content: body };
    });
    return { ...t, clips };
  });
  return { ...song, length_ticks: length, sections: formSections(sketch, lang), tracks };
}

/* ---------------------------------------------------------------- writing the detail */

/** Content of a clip between two ticks, moved to start at `dest` and cut to `maxLen`. */
function moved(c: Clip, from: number, len: number, dest: number): Clip['content'] {
  const shift = dest - from;
  const to = from + len;
  if (c.kind === 'notes') {
    return { notes: (c.content as NotesContent).notes.filter((n) => n.tick >= from && n.tick < to).map((n) => ({ ...n, id: newId(), tick: n.tick + shift, dur: Math.min(n.dur, to - n.tick) })) };
  }
  if (c.kind === 'chords') {
    return { chords: (c.content as ChordsContent).chords.filter((x) => x.tick >= from && x.tick < to).map((x) => ({ ...x, id: newId(), tick: x.tick + shift, dur: Math.min(x.dur, to - x.tick) })) };
  }
  if (c.kind === 'pattern') {
    const p = c.content as PatternContent;
    const [a, z, d] = [from / STEP_TICKS, to / STEP_TICKS, shift / STEP_TICKS];
    return { steps: p.steps, rows: p.rows.map((r) => ({ ...r, hits: r.hits.filter((h) => h.step >= a && h.step < z).map((h) => ({ ...h, step: h.step + d })) })) };
  }
  return c.content;
}
function joined(c: Clip, parts: Clip['content'][], length: number): Clip['content'] {
  if (c.kind === 'notes') return { notes: parts.flatMap((x) => (x as NotesContent).notes).sort((a, b) => a.tick - b.tick || a.midi - b.midi) };
  if (c.kind === 'chords') return { chords: parts.flatMap((x) => (x as ChordsContent).chords).sort((a, b) => a.tick - b.tick) };
  if (c.kind === 'pattern') {
    const rows = (c.content as PatternContent).rows;
    return { steps: length / STEP_TICKS, rows: rows.map((r, i) => ({ ...r, hits: parts.flatMap((x) => (x as PatternContent).rows[i]?.hits ?? []).sort((a, b) => a.step - b.step) })) };
  }
  return c.content;
}

export interface ApplyPlan {
  /** Tracks the idea writes over, with what plays them. */
  writes: { trackId: string; name: string; instrument: string }[];
  /** Tracks whose own notes move with their part (or stay, when the detail had no form yet). */
  keeps: string[];
  bars: number;
}

export function applyPlan(raw: Song, lang: Lang = 'en'): ApplyPlan | null {
  const s = raw.sketch;
  if (!s || !s.order.length) return null;
  const song = withIdeaTracks(raw, lang);
  const writes = [chordsTrackOf(song), drumsTrackOf(song), s.bass_instrument ? bassTrackOf(song) : undefined]
    .filter((x): x is Track => !!x)
    .map((t) => ({ trackId: t.id, name: t.name, instrument: t === chordsTrackOf(song) ? s.chords_instrument.key : t === drumsTrackOf(song) ? s.drums_instrument?.key ?? t.instrument?.key ?? '' : s.bass_instrument!.key }));
  const keeps = song.tracks.filter((t) => !writes.some((w) => w.trackId === t.id)).map((t) => t.name);
  return { writes, keeps, bars: totalBars(s) };
}

/**
 * Accept the idea: the detail takes the idea's form, its chords, drums and bass (on the idea's instruments); every
 * other track keeps what was written, moved with its part when the detail already followed the idea's form.
 * With `blockId`, only that block's places are written again (the form must be the same as last time).
 */
export function applyIdea(raw: Song, lang: Lang, by: string | null, blockId?: string): Song {
  const sketch = raw.sketch;
  if (!sketch || !sketch.order.length) return raw;
  const song = withIdeaTracks(raw, lang, true);
  const idea = renderIdea(song, lang);
  const places = layout(sketch);
  const length = idea.length_ticks ?? BAR_TICKS;
  const plan = applyPlan(song, lang)!;
  const written = new Set(plan.writes.map((w) => w.trackId));
  const at = now();

  if (blockId) {
    if (!detailFollowsForm(song)) return song;
    const ranges = places.filter((p) => p.blockId === blockId).map((p) => [p.startBar * BAR_TICKS, (p.startBar + p.bars) * BAR_TICKS] as const);
    const tracks = song.tracks.map((t) => {
      if (!written.has(t.id)) return t;
      const it = idea.tracks.find((x) => x.id === t.id)!;
      const retargeted = it.instrument?.key !== t.instrument?.key ? withInstrument(t, it.instrument?.key) : t;
      const clips = retargeted.clips.map((c, i) => {
        if (i !== 0) return c;
        const outside: Clip['content'][] = [];
        let cursor = 0;
        for (const [a, z] of ranges) { outside.push(moved(c, cursor, a - cursor, cursor)); cursor = z; }
        outside.push(moved(c, cursor, length - cursor, cursor));
        const inside = ranges.map(([a, z]) => moved(it.clips[0], a, z - a, a));
        return { ...c, content: joined(c, [...outside, ...inside], length), updated_at: at };
      });
      return { ...retargeted, clips, updated_at: at };
    });
    return { ...song, tracks, sketch: { ...sketch, accepted_at: at }, updated_at: at, updated_by: by ?? song.updated_by };
  }

  // The parts the detail had from the last time the idea was written, by id: their notes move with them.
  const old = new Map(song.sections.filter((x) => x.id.startsWith('sk-')).map((x) => [x.id, x]));
  const follows = old.size > 0;
  const tracks = song.tracks.map((t) => {
    if (written.has(t.id)) {
      const it = idea.tracks.find((x) => x.id === t.id)!;
      return { ...it, updated_at: at };
    }
    const clips = t.clips.map((c) => {
      let content: Clip['content'];
      if (follows) {
        const parts = places.map((p) => {
          const was = old.get(p.id);
          return was ? moved(c, was.start_tick, Math.min(was.length_ticks, p.bars * BAR_TICKS), p.startBar * BAR_TICKS) : emptyOf(c, length);
        });
        content = joined(c, parts, length);
      } else {
        content = joined(c, [moved(c, 0, length, 0)], length);
      }
      return { ...c, length_ticks: length, content, updated_at: at };
    });
    return { ...t, clips, updated_at: at };
  });
  return {
    ...song, length_ticks: length, sections: formSections(sketch, lang), tracks,
    sketch: { ...sketch, accepted_at: at }, updated_at: at, updated_by: by ?? song.updated_by,
  };
}

/** Colección styles to pick a rhythm from, by genre. */
export const STYLE_GROUPS = (genre: Genre) => GROUPS.filter((g) => g.genre === genre && ENTRIES.some((e) => e.group === g.id && e.family === 'drums'));
