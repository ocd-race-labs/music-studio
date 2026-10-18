// Song form: how long the song is and which part is which (intro, verse, chorus...). Sections are marks over
// whole bars; the notes live in the tracks. Copying, repeating or deleting a section moves the notes of every
// track with it, the way an arranger track works in a desktop studio.

import type { ChordsContent, Clip, Lang, NotesContent, PatternContent, Section, SectionKind, Song } from './types';
import { BAR_TICKS, STEP_TICKS } from './types';
import { newId, now, songBars, songLength } from './factory';

export const MAX_BARS = 96;

export const SECTION_KINDS: SectionKind[] = ['intro', 'verse', 'prechorus', 'chorus', 'bridge', 'break', 'solo', 'outro', 'other'];

const LABELS: Record<Lang, Record<SectionKind, string>> = {
  en: { intro: 'Intro', verse: 'Verse', prechorus: 'Pre-chorus', chorus: 'Chorus', bridge: 'Bridge', break: 'Break', solo: 'Solo', outro: 'Outro', other: 'Section' },
  es: { intro: 'Intro', verse: 'Verso', prechorus: 'Pre-coro', chorus: 'Coro', bridge: 'Puente', break: 'Break', solo: 'Solo', outro: 'Outro', other: 'Sección' },
};

/** One color per kind, so every chorus looks like a chorus. Readable with dark text in both modes. */
export const SECTION_COLORS: Record<SectionKind, string> = {
  intro: '#38BDF8', verse: '#2DD4BF', prechorus: '#FBBF24', chorus: '#F0509E', bridge: '#A78BFA',
  break: '#FB7185', solo: '#F97316', outro: '#94A3B8', other: '#84CC16',
};

export const kindLabel = (kind: SectionKind, lang: Lang): string => LABELS[lang][kind];
export const sectionColor = (s: Pick<Section, 'kind'>): string => SECTION_COLORS[s.kind ?? 'other'];
export const sectionBars = (s: Section): number => Math.round(s.length_ticks / BAR_TICKS);
export const sectionStartBar = (s: Section): number => Math.round(s.start_tick / BAR_TICKS);

/** The section a bar belongs to, if any. */
export const sectionAtBar = (song: Song, bar: number): Section | undefined =>
  song.sections.find((s) => bar * BAR_TICKS >= s.start_tick && bar * BAR_TICKS < s.start_tick + s.length_ticks);

/** True for a name the app gave ("Coro 2"), never one a person typed. */
function isAutoName(name: string): boolean {
  const base = name.replace(/ \d+$/, '');
  return (['en', 'es'] as Lang[]).some((l) => Object.values(LABELS[l]).includes(base)) || base === 'Loop';
}

/** Sort by start, renumber, and give automatic names: "Verso" alone, "Verso 1" and "Verso 2" when there are two. */
function tidy(sections: Section[], lang: Lang): Section[] {
  const sorted = [...sections].sort((a, b) => a.start_tick - b.start_tick);
  const count: Partial<Record<SectionKind, number>> = {};
  for (const s of sorted) count[s.kind ?? 'other'] = (count[s.kind ?? 'other'] ?? 0) + 1;
  const seen: Partial<Record<SectionKind, number>> = {};
  return sorted.map((s, i) => {
    const kind = s.kind ?? 'other';
    const n = (seen[kind] = (seen[kind] ?? 0) + 1);
    const name = isAutoName(s.name) ? `${kindLabel(kind, lang)}${(count[kind] ?? 0) > 1 ? ` ${n}` : ''}` : s.name;
    return { ...s, position: i + 1, name };
  });
}

const section = (kind: SectionKind, startBar: number, bars: number): Section => ({
  id: newId(), position: 0, name: kindLabel(kind, 'en'), kind,
  start_tick: startBar * BAR_TICKS, length_ticks: bars * BAR_TICKS, key_tonic: null, key_mode: null, lyrics_lang: null,
});

/** Sections minus a range of ticks: whatever was there is trimmed or dropped. */
function carve(sections: Section[], from: number, to: number): Section[] {
  const out: Section[] = [];
  for (const s of sections) {
    const a = s.start_tick, b = s.start_tick + s.length_ticks;
    if (b <= from || a >= to) { out.push(s); continue; }
    if (a < from) out.push({ ...s, length_ticks: from - a });
    if (b > to) out.push({ ...s, id: a < from ? newId() : s.id, start_tick: to, length_ticks: b - to });
  }
  return out;
}

const done = (song: Song, patch: Partial<Song>, by: string | null): Song => ({ ...song, ...patch, updated_at: now(), updated_by: by ?? song.updated_by });

/* ---------------------------------------------------------------- moving notes in time */

type Content = Clip['content'];

/** Apply one change to every track's clip content, and set the new song length. */
function mapContent(song: Song, length: number, fn: (c: Clip) => Content): Song['tracks'] {
  const at = now();
  return song.tracks.map((t) => ({
    ...t,
    clips: t.clips.map((c) => {
      const content = fn(c);
      const next = { ...c, length_ticks: length, content, updated_at: at };
      if (c.kind === 'pattern') (next.content as PatternContent).steps = length / STEP_TICKS;
      return next;
    }),
  }));
}

/** Content inside [from, to), moved to start at `dest`; notes are cut at the end of the range. */
function slice(c: Clip, from: number, to: number, dest: number): Content {
  const shift = dest - from;
  if (c.kind === 'notes') {
    return { notes: (c.content as NotesContent).notes.filter((n) => n.tick >= from && n.tick < to)
      .map((n) => ({ ...n, id: newId(), tick: n.tick + shift, dur: Math.min(n.dur, to - n.tick) })) };
  }
  if (c.kind === 'chords') {
    return { chords: (c.content as ChordsContent).chords.filter((x) => x.tick >= from && x.tick < to)
      .map((x) => ({ ...x, id: newId(), tick: x.tick + shift, dur: Math.min(x.dur, to - x.tick) })) };
  }
  if (c.kind === 'pattern') {
    const p = c.content as PatternContent;
    const [a, b, d] = [from / STEP_TICKS, to / STEP_TICKS, shift / STEP_TICKS];
    return { steps: p.steps, rows: p.rows.map((r) => ({ ...r, hits: r.hits.filter((h) => h.step >= a && h.step < b).map((h) => ({ ...h, step: h.step + d })) })) };
  }
  return c.content;
}

/** Remove what is in [from, to); later content moves by `shift` (negative closes the gap, zero leaves a hole). */
function cut(c: Clip, from: number, to: number, shift: number, length: number): Content {
  const keep = (tick: number) => tick < from || tick >= to;
  const move = (tick: number) => (tick >= to ? tick + shift : tick);
  if (c.kind === 'notes') {
    return { notes: (c.content as NotesContent).notes.filter((n) => keep(n.tick))
      .map((n) => ({ ...n, tick: move(n.tick), dur: n.tick < from ? Math.min(n.dur, from - n.tick) : n.dur }))
      .filter((n) => n.tick < length).map((n) => ({ ...n, dur: Math.min(n.dur, length - n.tick) })) };
  }
  if (c.kind === 'chords') {
    return { chords: (c.content as ChordsContent).chords.filter((x) => keep(x.tick))
      .map((x) => ({ ...x, tick: move(x.tick), dur: x.tick < from ? Math.min(x.dur, from - x.tick) : x.dur }))
      .filter((x) => x.tick < length) };
  }
  if (c.kind === 'pattern') {
    const p = c.content as PatternContent;
    const [a, b, d, end] = [from / STEP_TICKS, to / STEP_TICKS, shift / STEP_TICKS, length / STEP_TICKS];
    return { steps: end, rows: p.rows.map((r) => ({ ...r, hits: r.hits.filter((h) => h.step < a || h.step >= b)
      .map((h) => ({ ...h, step: h.step >= b ? h.step + d : h.step })).filter((h) => h.step < end) })) };
  }
  return c.content;
}

/** Open room at `at` for `len` ticks: everything from there on moves later. A note playing across `at` stops there. */
function open(c: Clip, at: number, len: number, length: number): Content {
  return cut(c, at, at, len, length);
}

function merge(c: Clip, a: Content, b: Content): Content {
  if (c.kind === 'notes') return { notes: [...(a as NotesContent).notes, ...(b as NotesContent).notes].sort((x, y) => x.tick - y.tick || x.midi - y.midi) };
  if (c.kind === 'chords') return { chords: [...(a as ChordsContent).chords, ...(b as ChordsContent).chords].sort((x, y) => x.tick - y.tick) };
  if (c.kind === 'pattern') {
    const pa = a as PatternContent, pb = b as PatternContent;
    return { steps: pa.steps, rows: pa.rows.map((r, i) => {
      const extra = pb.rows[i]?.hits ?? [];
      const hits = [...r.hits.filter((h) => !extra.some((e) => e.step === h.step)), ...extra].sort((x, y) => x.step - y.step);
      return { ...r, hits };
    }) };
  }
  return a;
}

/* ---------------------------------------------------------------- commands */

/** Make the song longer or shorter. New bars start empty; bars cut off take their notes and marks with them. */
export function setSongBars(song: Song, bars: number, by: string | null): Song {
  const target = Math.max(1, Math.min(MAX_BARS, Math.round(bars)));
  if (target === songBars(song)) return song;
  const length = target * BAR_TICKS;
  const old = songLength(song);
  return done(song, {
    length_ticks: length,
    sections: carve(song.sections, length, Math.max(length, old) + 1),
    tracks: mapContent(song, length, (c) => cut(c, length, Number.MAX_SAFE_INTEGER, 0, length)),
  }, by);
}

/** Mark bars `fromBar` to `toBar` (both included) as one part of the song. Marks already there give way. */
export function markSection(song: Song, fromBar: number, toBar: number, kind: SectionKind, lang: Lang, by: string | null): Song {
  const a = Math.max(0, Math.min(fromBar, toBar));
  const b = Math.min(songBars(song) - 1, Math.max(fromBar, toBar));
  if (b < a) return song;
  const others = carve(song.sections, a * BAR_TICKS, (b + 1) * BAR_TICKS);
  return done(song, { sections: tidy([...others, section(kind, a, b - a + 1)], lang) }, by);
}

export function renameSection(song: Song, id: string, name: string, lang: Lang, by: string | null): Song {
  const clean = name.trim().slice(0, 40);
  const target = song.sections.find((s) => s.id === id);
  if (!target || target.name === clean) return song;
  // An empty name goes back to the automatic one.
  const next = song.sections.map((s) => (s.id === id ? { ...s, name: clean || kindLabel(s.kind ?? 'other', 'en') } : s));
  return done(song, { sections: tidy(next, lang) }, by);
}

export function setSectionKind(song: Song, id: string, kind: SectionKind, lang: Lang, by: string | null): Song {
  const next = song.sections.map((s) => (s.id === id ? { ...s, kind, name: isAutoName(s.name) ? kindLabel(kind, 'en') : s.name } : s));
  return done(song, { sections: tidy(next, lang) }, by);
}

/** Take the mark away; the notes stay. */
export function removeSection(song: Song, id: string, lang: Lang, by: string | null): Song {
  return done(song, { sections: tidy(song.sections.filter((s) => s.id !== id), lang) }, by);
}

export type CopyMode = 'insert' | 'replace';

/**
 * Put a copy of a section at bar `atBar`, with the notes of every track. "insert" opens room there and moves
 * the rest of the song later; "replace" writes over what those bars had. The song grows when it needs to.
 * Returns the song unchanged when the result would pass the bar limit.
 */
export function copySection(song: Song, id: string, atBar: number, mode: CopyMode, lang: Lang, by: string | null): Song {
  const src = song.sections.find((s) => s.id === id);
  if (!src) return song;
  const len = src.length_ticks;
  const at = Math.max(0, Math.round(atBar)) * BAR_TICKS;
  const old = songLength(song);
  const length = mode === 'insert' ? Math.max(old, at) + len : Math.max(old, at + len);
  if (length > MAX_BARS * BAR_TICKS) return song;
  // Where the source sits after room is opened.
  const from = mode === 'insert' && src.start_tick >= at ? src.start_tick + len : src.start_tick;
  const tracks = song.tracks.map((t) => ({
    ...t,
    clips: t.clips.map((c) => {
      const base = { ...c, length_ticks: length, content: c.content };
      if (c.kind === 'pattern') base.content = { ...(c.content as PatternContent), steps: length / STEP_TICKS };
      const spaced = mode === 'insert' ? open(base, at, len, length) : cut(base, at, at + len, 0, length);
      const prepared = { ...base, content: spaced };
      // Insert copies from the moved source; replace copies from the song as it was, in case the ranges overlap.
      const piece = slice(mode === 'insert' ? prepared : base, from, from + len, at);
      return { ...prepared, content: merge(prepared, spaced, piece), updated_at: now() };
    }),
  }));
  let sections = song.sections;
  if (mode === 'insert') {
    sections = sections.map((s) => {
      if (s.start_tick >= at) return { ...s, start_tick: s.start_tick + len };
      if (s.start_tick + s.length_ticks > at) return { ...s, length_ticks: s.length_ticks + len }; // room opened inside a part makes it longer
      return s;
    });
  } else {
    sections = carve(sections, at, at + len);
  }
  const copy = { ...section(src.kind ?? 'other', at / BAR_TICKS, len / BAR_TICKS), name: src.name };
  return done(song, { length_ticks: length, tracks, sections: tidy([...carve(sections, at, at + len), copy], lang) }, by);
}

/**
 * Play a section `times` more times right after itself; each copy goes in before what came next.
 * With `extend`, the copies become part of the same section (a 2-bar groove grows into a 16-bar verse);
 * otherwise each copy is a section of its own (Chorus 1, Chorus 2).
 */
export function repeatSection(song: Song, id: string, times: number, lang: Lang, by: string | null, extend = false): Song {
  const original = song.sections.find((s) => s.id === id);
  if (!original) return song;
  let next = song;
  let current: Section | undefined = original;
  let made = 0;
  for (let i = 0; i < Math.max(0, Math.round(times)) && current; i++) {
    const after: number = current.start_tick + current.length_ticks;
    const moved = copySection(next, id, after / BAR_TICKS, 'insert', lang, by);
    if (moved === next) break;
    next = moved;
    made++;
    current = next.sections.find((s) => s.start_tick === after) ?? current;
  }
  if (!extend || !made) return next;
  const from = original.start_tick + original.length_ticks;
  const to = from + original.length_ticks * made;
  const sections = next.sections
    .filter((s) => s.id === id || s.start_tick < from || s.start_tick >= to)
    .map((s) => (s.id === id ? { ...s, length_ticks: original.length_ticks * (made + 1) } : s));
  return { ...next, sections: tidy(sections, lang) };
}

/** Remove a section and its bars: the notes in it go, and the rest of the song moves up to close the gap. */
export function deleteSectionBars(song: Song, id: string, lang: Lang, by: string | null): Song {
  const target = song.sections.find((s) => s.id === id);
  if (!target) return song;
  const from = target.start_tick, len = target.length_ticks, to = from + len;
  const old = songLength(song);
  const length = Math.max(BAR_TICKS, old - len);
  const sections = carve(song.sections, from, to).map((s) => (s.start_tick >= to ? { ...s, start_tick: s.start_tick - len } : s));
  return done(song, {
    length_ticks: length,
    sections: tidy(sections, lang),
    tracks: mapContent(song, length, (c) => cut(c, from, to, -len, length)),
  }, by);
}

/** Bars of the song that no section covers yet, as ranges. */
export function unmarkedRanges(song: Song): { from: number; to: number }[] {
  const bars = songBars(song);
  const out: { from: number; to: number }[] = [];
  let start = -1;
  for (let b = 0; b <= bars; b++) {
    const free = b < bars && !sectionAtBar(song, b);
    if (free && start < 0) start = b;
    if (!free && start >= 0) { out.push({ from: start, to: b - 1 }); start = -1; }
  }
  return out;
}
