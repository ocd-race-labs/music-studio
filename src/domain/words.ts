// Idea from words: a guided path from a few words to a whole idea, general to specific: the idea (style, tempo,
// key), the form, the chords bar by bar, the instruments and the groove. Each step offers three choices made by plain
// rules from the Colección, or the ones an idea file from Claude brings; free text per step is read by the same kind
// of rules, which say what they understood instead of guessing. Nothing here needs a network or an AI.
// The result is a new song whose idea (the Idea stage) holds all of it; accepting writes the detail from it.

import type { CatalogRef, Lang, SectionKind, Sketch, SketchBlock, SketchGroove, Song } from './types';
import { entriesOf, norm, parseRequest, planFor, tempoRange } from './beat';
import type { Parsed } from './beat';
import { ENTRIES, entryOf, GROUPS } from '../packs/collection';
import type { Genre } from '../packs/collection';
import { findByKey, INSTRUMENTS, ref, title as catalogTitle } from '../packs/core';
import { applyIdea, newSketch, renderIdea } from './sketch';
import type { Feel } from './sketch';
import { kindLabel, MAX_BARS, SECTION_KINDS } from './arrange';
import { newId, newSong, now } from './factory';
import * as C from './commands';

type T = { en: string; es: string };
const tx = (en: string, es: string): T => ({ en, es });

/* ---------------------------------------------------------------- what each step picks */

export interface IdeaPick { group: string; tempo: number; tonic: string; mode: 'minor' | 'major'; swing: number; title: T; note: T; claude?: boolean }
export interface FormPart { kind: SectionKind; bars: number; letter: string; chords?: (number | null)[]; feel?: Feel | null }
export interface FormPick { parts: FormPart[]; title: T; note: T; claude?: boolean }
export interface ChordPick { verse: number[]; chorus: number[]; other: Partial<Record<SectionKind, number[]>>; fromForm?: boolean; title: T; note: T; claude?: boolean }
export interface InstPick { chords: string; drums: string | null; bass: string | null; title: T; note: T; claude?: boolean }
export type GrooveMode = 'song' | 'half' | 'steady' | 'soft' | 'strong';
export interface GroovePick { group: string; mode: GrooveMode; noIntro?: boolean; fromForm?: boolean; title: T; note: T; claude?: boolean }
export interface WordsChoice { idea: IdeaPick; form: FormPick; chords: ChordPick; inst: InstPick; groove: GroovePick }

const groupTitle = (id: string): T => GROUPS.find((g) => g.id === id)?.title ?? tx(id, id);
export const genreOf = (group: string): Genre => GROUPS.find((g) => g.id === group)?.genre ?? 'rock';
const hasDrums = (group: string) => ENTRIES.some((e) => e.group === group && e.family === 'drums');
/** Other styles of the same genre, the nearest first (the order of the Colección). */
const neighbours = (group: string): string[] => {
  const genre = genreOf(group);
  const list = GROUPS.filter((g) => g.genre === genre && hasDrums(g.id)).map((g) => g.id);
  const i = list.indexOf(group);
  return [...list.slice(i + 1), ...list.slice(0, Math.max(0, i))].filter((g) => g !== group);
};

/* ---------------------------------------------------------------- step 1: the idea */

/** True when the words name a specific song (its form, "la estructura de …"): its real form is Claude's job. */
export function namesASong(raw: string): boolean {
  const text = norm(raw);
  const asksForm = /\b(estructura|forma|cancion|tema|song|track|structure|form)\b/.test(text);
  const quoted = /["“”«»]/.test(raw);
  const referenced = parseRequest(raw).styles.some((s) => s.score >= 3);
  return asksForm && (quoted || referenced || /\b(de|by|of)\s+[a-z0-9&]+/.test(text));
}

const MINOR_TONICS = ['A', 'D', 'C'];
const MAJOR_TONICS = ['C', 'G', 'F'];

function pickFromPlan(parsed: Parsed, group: string, slot: number, label?: T): IdeaPick {
  const plan = planFor(parsed, group);
  const tonics = plan.mode === 'minor' ? MINOR_TONICS : MAJOR_TONICS;
  const blurb = entriesOf(group, 'drums')[0]?.blurb;
  return {
    group, tempo: plan.tempo, tonic: tonics[slot % tonics.length], mode: plan.mode, swing: plan.swing,
    title: label ?? groupTitle(group), note: blurb ?? tx('', ''),
  };
}

/**
 * Three ways to understand the words: the best style; then a second style when the words point to one, else the
 * same style moved in tempo; then a neighbour style. With no style in the words, three common starts.
 */
export function ideaPicks(raw: string): { parsed: Parsed; picks: IdeaPick[]; matched: boolean } {
  const parsed = parseRequest(raw);
  const groups = parsed.styles.map((s) => s.group).filter(hasDrums);
  if (!groups.length) {
    const starts = parsed.mood === 'bright' ? ['el-house', 'hh-westcoast', 'rock-classic'] : ['hh-boombap', 'el-triphop', 'rock-modern'];
    return { parsed, matched: false, picks: starts.map((g, i) => pickFromPlan(parsed, g, i)) };
  }
  const first = groups[0];
  const a = pickFromPlan(parsed, first, 0);
  let b: IdeaPick;
  const second = groups[1];
  const scoreOf = (g: string) => parsed.styles.find((x) => x.group === g)?.score ?? 0;
  if (second && (scoreOf(second) >= scoreOf(first) * 0.6 || genreOf(second) !== genreOf(first))) {
    b = pickFromPlan(parsed, second, 1);
  } else {
    const [lo, hi] = tempoRange(first);
    const up = a.tempo + 8 <= hi + 4;
    const tempo = Math.round(Math.min(220, Math.max(50, up ? a.tempo + 8 : a.tempo - 8)));
    const base = groupTitle(first);
    b = { ...pickFromPlan(parsed, first, 1), tempo, title: up ? tx(`${base.en}, livelier`, `${base.es}, más movido`) : tx(`${base.en}, slower`, `${base.es}, más lento`) };
    if (tempo < lo - 10) b.tempo = lo;
  }
  const third = groups.find((g) => g !== first && g !== b.group) ?? neighbours(first).find((g) => g !== b.group) ?? first;
  const c = pickFromPlan({ ...parsed, tempo: undefined }, third, 2);
  return { parsed, matched: true, picks: [a, b, c] };
}

/* ---------------------------------------------------------------- step 2: the form */

const P = (kind: SectionKind, bars: number, letter: string): FormPart => ({ kind, bars, letter });

export function formPicks(idea: IdeaPick): FormPick[] {
  const genre = genreOf(idea.group);
  const direct: FormPick = {
    parts: [P('intro', 4, 'a'), P('verse', 8, 'b'), P('chorus', 8, 'c'), P('verse', 8, 'b'), P('chorus', 8, 'c'), P('outro', 4, 'd')],
    title: tx('Direct', 'Directa'), note: tx('Verse and chorus twice, no detours.', 'Dos vueltas de verso y coro, sin rodeos.'),
  };
  const bridge: FormPick = {
    parts: [P('intro', 8, 'a'), P('verse', 8, 'b'), P('chorus', 8, 'c'), P('verse', 8, 'd'), P('chorus', 8, 'c'), P('bridge', 8, 'e'), P('chorus', 8, 'f'), P('outro', 4, 'g')],
    title: tx('With a bridge', 'Con puente'), note: tx('A bridge before the last chorus, for a change of air.', 'Un puente antes del último coro, para cambiar de aire.'),
  };
  if (genre === 'electronic') {
    return [
      { parts: [P('intro', 8, 'a'), P('verse', 16, 'b'), P('chorus', 16, 'c'), P('break', 8, 'd'), P('chorus', 16, 'c'), P('outro', 8, 'e')],
        title: tx('Club', 'De pista'), note: tx('A long build, the drop, a break with no drums and the drop again.', 'Una subida larga, la caída, un quiebre sin batería y otra caída.') },
      direct,
      { parts: [P('intro', 8, 'a'), P('verse', 16, 'b'), P('chorus', 8, 'c'), P('break', 8, 'd'), P('verse', 16, 'e'), P('chorus', 8, 'c'), P('outro', 8, 'f')],
        title: tx('Cinematic', 'Cinematográfica'), note: tx('Long verses and a break in the middle; it grows slowly.', 'Versos largos y un quiebre al medio; crece de a poco.') },
    ];
  }
  if (genre === 'hiphop') {
    return [
      { parts: [P('intro', 4, 'a'), P('verse', 16, 'b'), P('chorus', 8, 'c'), P('verse', 16, 'd'), P('chorus', 8, 'c'), P('outro', 4, 'e')],
        title: tx('Beat with verses', 'Beat con versos'), note: tx('Sixteen-bar verses to rap over, a short hook between them.', 'Versos de 16 compases para rapear y un coro corto entre ellos.') },
      direct,
      bridge,
    ];
  }
  return [
    direct,
    bridge,
    { parts: [P('intro', 4, 'a'), P('verse', 8, 'b'), P('chorus', 8, 'c'), P('verse', 8, 'd'), P('chorus', 8, 'c'), P('solo', 8, 'e'), P('chorus', 8, 'f'), P('outro', 4, 'g')],
      title: tx('With a solo', 'Con solo'), note: tx('A solo before the last chorus.', 'Un solo antes del último coro.') },
  ];
}

export const formBars = (f: FormPick): number => f.parts.reduce((n, p) => n + p.bars, 0);
/** Minutes and seconds the form lasts at a tempo, in 4/4. */
export const formTime = (f: FormPick, tempo: number): string => {
  const secs = Math.round((formBars(f) * 4 * 60) / Math.max(1, tempo));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
};

/* ---------------------------------------------------------------- step 3: the chords */

export function chordPicks(idea: IdeaPick): ChordPick[] {
  if (idea.mode === 'minor') {
    return [
      { verse: [0, 6, 5, 4], chorus: [5, 6, 0, 0], other: { bridge: [3, 4, 5, 6], prechorus: [3, 3, 4, 4] },
        title: tx('Falling', 'Que baja'), note: tx('Steps down bar by bar; tense and cinematic.', 'Desciende paso a paso; tensa y cinematográfica.') },
      { verse: [0, 3, 0, 4], chorus: [3, 4, 0, 0], other: { bridge: [5, 3, 4, 4], prechorus: [3, 3, 4, 4] },
        title: tx('Suspended', 'Suspendida'), note: tx('Moves little and leaves room for the voice.', 'Se mueve poco y deja espacio a la voz.') },
      { verse: [0, 5, 2, 6], chorus: [5, 2, 6, 0], other: { bridge: [3, 5, 6, 6], prechorus: [5, 5, 6, 6] },
        title: tx('Breathing', 'Que respira'), note: tx('Brighter; the chorus opens up.', 'Más luminosa; el coro se abre.') },
    ];
  }
  return [
    { verse: [0, 4, 5, 3], chorus: [3, 4, 0, 0], other: { bridge: [5, 3, 0, 4], prechorus: [1, 3, 4, 4] },
      title: tx('Classic pop', 'Pop clásica'), note: tx('The four chords of a thousand songs; it always works.', 'Los cuatro acordes de mil canciones; siempre funciona.') },
    { verse: [0, 5, 3, 4], chorus: [3, 4, 0, 5], other: { bridge: [5, 3, 0, 4], prechorus: [1, 3, 4, 4] },
      title: tx('Rising', 'Que sube'), note: tx('Climbs towards the chorus.', 'Va subiendo hacia el coro.') },
    { verse: [0, 3, 0, 4], chorus: [3, 0, 4, 0], other: { bridge: [5, 4, 3, 4], prechorus: [3, 3, 4, 4] },
      title: tx('Open', 'Abierta'), note: tx('Simple and bright, like a folk song.', 'Simple y luminosa, como una canción folk.') },
  ];
}

/** The degrees a part plays over its bars, from a chord pick (and the form, when Claude wrote them there). */
export function chordsFor(pick: ChordPick, part: FormPart): (number | null)[] {
  if (pick.fromForm && part.chords?.length) return Array.from({ length: part.bars }, (_, i) => part.chords![i % part.chords!.length] ?? null);
  const prog = part.kind === 'chorus' || part.kind === 'outro' ? pick.chorus
    : part.kind === 'verse' || part.kind === 'intro' || part.kind === 'solo' || part.kind === 'break' ? pick.verse
      : pick.other[part.kind] ?? pick.verse;
  return Array.from({ length: part.bars }, (_, i) => prog[i % prog.length]);
}

/* ---------------------------------------------------------------- step 4: the instruments */

const chordSounds = (group: string) => [...entriesOf(group, 'synth'), ...entriesOf(group, 'guitar')].map((e) => e.instrument);
const firstKnown = (...keys: (string | undefined)[]) => keys.find((k): k is string => !!k && !!findByKey(k));

export function instPicks(idea: IdeaPick, wants: string[] = []): InstPick[] {
  const g = idea.group;
  const genre = genreOf(g);
  const drums = entriesOf(g, 'drums')[0]?.instrument ?? null;
  const bass = entriesOf(g, 'bass')[0]?.instrument ?? null;
  const own = chordSounds(g);
  const wanted = wants.includes('piano') ? 'instrument.keys-ep' : wants.includes('strings') ? 'instrument.strings-ensemble'
    : wants.includes('guitar') ? 'instrument.guitar-clean-60' : wants.includes('bells') ? 'instrument.bells-fm' : wants.includes('pad') ? 'instrument.pad-warm' : undefined;
  const a: InstPick = {
    chords: firstKnown(wanted, own[0], 'instrument.keys-piano')!, drums, bass,
    title: tx('The style’s own', 'Del estilo'), note: tx('The sounds that belong to the style.', 'Los sonidos propios del estilo.'),
  };
  const keys = genre === 'rock' ? 'instrument.organ' : genre === 'hiphop' ? 'instrument.keys-ep' : 'instrument.keys-piano';
  const b: InstPick = {
    chords: firstKnown(keys === a.chords ? 'instrument.keys-piano' : keys, 'instrument.keys-piano')!, drums,
    bass: genre === 'electronic' ? firstKnown('instrument.bass-upright', bass ?? undefined) ?? null : bass,
    title: tx('With keys', 'Con teclado'), note: tx('Chords on keys; warmer and closer.', 'Los acordes en teclado; más cálido y cercano.'),
  };
  const pad = genre === 'rock' ? 'instrument.guitar-clean-60' : genre === 'hiphop' ? 'instrument.strings-ensemble' : 'instrument.pad-warm';
  const otherBass = genre === 'rock' ? firstKnown(entriesOf(g, 'bass')[1]?.instrument, 'instrument.bass-electric') : firstKnown('instrument.bass-synth', bass ?? undefined);
  const c: InstPick = {
    chords: firstKnown(pad === a.chords ? 'instrument.strings-ensemble' : pad, 'instrument.strings-ensemble')!, drums, bass: otherBass ?? bass,
    title: genre === 'rock' ? tx('Clean guitar', 'Guitarra limpia') : tx('With strings or a pad', 'Con cuerdas o colchón'),
    note: genre === 'rock' ? tx('Chords on a clean guitar; lighter.', 'Los acordes en guitarra limpia; más liviano.') : tx('Long chords that fill the space.', 'Acordes largos que llenan el espacio.'),
  };
  return [a, b, c];
}

export const instName = (key: string | null, lang: Lang): string => (key ? entryOf(key)?.title[lang] ?? catalogTitle({ key, version: '1.0.0' }, lang) : '');

/* ---------------------------------------------------------------- step 5: the groove */

export function groovePicks(idea: IdeaPick): GroovePick[] {
  const g = idea.group;
  const other = neighbours(g)[0] ?? g;
  const ot = groupTitle(other);
  return [
    { group: g, mode: 'song', title: tx('Like a song', 'Como canción'), note: tx('Soft in the intro, strong in the chorus, no drums in the break.', 'Suave en el intro, fuerte en el coro y sin batería en el quiebre.') },
    { group: g, mode: 'half', title: tx('Half time', 'Medio tiempo'), note: tx('The backbeat once a bar: heavier and slower.', 'La caja una vez por compás: más pesado y lento.') },
    { group: other, mode: 'song', title: tx(`${ot.en} groove`, `Groove de ${ot.es}`), note: tx('The same idea with the rhythm of a nearby style.', 'La misma idea con el ritmo de un estilo vecino.') },
  ];
}

/** How hard a part plays under a groove pick: null is no drums. */
export function feelFor(pick: GroovePick, part: FormPart, index: number): Feel | null {
  if (pick.fromForm && part.feel !== undefined) return part.feel;
  if (part.kind === 'break') return null;
  if (pick.noIntro && part.kind === 'intro' && index === 0) return null;
  switch (pick.mode) {
    case 'half': return 'half';
    case 'steady': return part.kind === 'intro' || part.kind === 'outro' ? 'soft' : 'normal';
    case 'soft': return 'soft';
    case 'strong': return part.kind === 'intro' ? 'normal' : 'strong';
    default: return part.kind === 'intro' || part.kind === 'outro' ? 'soft' : part.kind === 'chorus' || part.kind === 'solo' ? 'strong' : part.kind === 'bridge' ? 'half' : 'normal';
  }
}

/* ---------------------------------------------------------------- free text, step by step */

export interface Refined<P> { pick: P | null; understood: string[]; missed: boolean }
const said = (text: string, ...words: string[]) => words.some((w) => ` ${text} `.includes(` ${norm(w)} `));
const KIND_WORDS: [SectionKind, string[]][] = [
  ['intro', ['intro', 'introduccion']], ['verse', ['verso', 'versos', 'verse', 'verses', 'estrofa', 'estrofas']], ['chorus', ['coro', 'coros', 'chorus', 'estribillo']],
  ['bridge', ['puente', 'bridge']], ['solo', ['solo']], ['break', ['quiebre', 'break', 'pausa']], ['outro', ['outro', 'final', 'cierre']], ['prechorus', ['precoro', 'pre coro', 'prechorus']],
];
const kindIn = (text: string): SectionKind | null => KIND_WORDS.find(([, w]) => said(text, ...w))?.[0] ?? null;
const word = (lang: Lang, en: string, es: string) => (lang === 'es' ? es : en);
const kindWord = (k: SectionKind, lang: Lang) => kindLabel(k, lang).toLowerCase();

const NUMBER_WORDS: Record<string, number> = {
  uno: 1, una: 1, one: 1, dos: 2, two: 2, tres: 3, three: 3, cuatro: 4, four: 4, cinco: 5, five: 5, seis: 6, six: 6, siete: 7, seven: 7,
  ocho: 8, eight: 8, diez: 10, ten: 10, doce: 12, twelve: 12, dieciseis: 16, sixteen: 16, veinte: 20, twenty: 20, veinticuatro: 24, treinta: 30,
};
const DEFAULT_BARS: Partial<Record<SectionKind, number>> = { intro: 4, verse: 8, prechorus: 4, chorus: 8, bridge: 8, solo: 8, break: 4, outro: 4 };
const NEGATION = /\b(sin|nada mas|ni|ningun|ninguna|no mas|without|no more|nothing more|no)\b/;
const kindOfWord = (w: string): SectionKind | null => KIND_WORDS.find(([, words]) => words.some((x) => norm(x) === w))?.[0] ?? null;
const numberAt = (tokens: string[], i: number): number | null => {
  const t = tokens[i];
  if (t === undefined) return null;
  if (/^\d{1,2}$/.test(t)) return Number(t);
  return NUMBER_WORDS[t] ?? null;
};

/**
 * Parts listed in order ("intro de 4, verso de 8, coro de 4, puente de 4 y al outro"): the form is exactly that list.
 * A part named after "sin" or "nada más de" is left out; a part with no number gets its usual length. Needs three or
 * more parts, so a single change ("intro más largo") is read as a change, not as a whole form.
 */
export function formFromList(raw: string): { parts: FormPart[]; guessed: SectionKind[] } | null {
  const parts: FormPart[] = [];
  const guessed: SectionKind[] = [];
  for (const clause of raw.split(/[,.;:\n]+|\s+(?:y luego|luego|despues|then|and then)\s+/i)) {
    const tokens = norm(clause).split(' ').filter(Boolean);
    let negated = false;
    for (let i = 0; i < tokens.length; i++) {
      const two = `${tokens[i]} ${tokens[i + 1] ?? ''}`.trim();
      if (NEGATION.test(two) && (/^(nada mas|no mas|no more|nothing more)$/.test(two) || NEGATION.test(tokens[i]))) negated = true;
      const kind = kindOfWord(tokens[i]) ?? (two === 'pre coro' ? 'prechorus' : null);
      if (!kind || negated) continue;
      // "verso de 8", "verso 8", "verso de ocho compases", or "8 compases de verso" just before it.
      let bars = numberAt(tokens, i + 1) ?? (tokens[i + 1] === 'de' || tokens[i + 1] === 'of' ? numberAt(tokens, i + 2) : null);
      if (bars === null && (tokens[i - 1] === 'de' || tokens[i - 1] === 'of') && /^(compases|bars|compas|bar)$/.test(tokens[i - 2] ?? '')) bars = numberAt(tokens, i - 3);
      if (bars === null) guessed.push(kind);
      parts.push({ kind, bars: Math.max(1, Math.min(32, bars ?? DEFAULT_BARS[kind] ?? 8)), letter: '' });
    }
  }
  if (parts.length < 3) return null;
  // The same kind at the same length is the same part played again (its chords repeat); otherwise a new one.
  const seen = new Map<string, string>();
  parts.forEach((p, i) => { const key = `${p.kind}:${p.bars}`; p.letter = seen.get(key) ?? `w${i}`; seen.set(key, p.letter); });
  return { parts, guessed };
}

/** "Sin puente", "intro más largo", "versos de 16", "con solo", "más corta". */
export function refineForm(raw: string, base: FormPick, lang: Lang): Refined<FormPick> {
  const text = norm(raw);
  const listed = formFromList(raw);
  if (listed) {
    const total = listed.parts.reduce((n, p) => n + p.bars, 0);
    const kept = total > MAX_BARS ? listed.parts.slice(0, listed.parts.findIndex((_, i) => listed.parts.slice(0, i + 1).reduce((n, p) => n + p.bars, 0) > MAX_BARS)) : listed.parts;
    const said = kept.map((p) => `${kindWord(p.kind, lang)} ${p.bars}`);
    const guessed = [...new Set(listed.guessed)].map((k) => kindWord(k, lang));
    const understood = [said.join(', '), ...(guessed.length ? [word(lang, `${guessed.join(' and ')} at the usual length`, `${guessed.join(' y ')} con su largo habitual`)] : [])];
    return { pick: { ...base, parts: kept, title: tx('Your version', 'Tu versión'), note: tx(understood.join('; '), understood.join('; ')) }, understood, missed: false };
  }
  let parts = base.parts.map((p) => ({ ...p }));
  const understood: string[] = [];
  const without = text.match(/\bsin (el |la |los |las )?(intro|introduccion|puente|solo|quiebre|break|outro|final|precoro)\b|\bno (intro|bridge|solo|break|outro)\b|\bwithout (an |a |the )?(intro|bridge|solo|break|outro)\b/);
  if (without) {
    const k = kindIn(without[0]);
    if (k && parts.some((p) => p.kind === k)) { parts = parts.filter((p) => p.kind !== k); understood.push(word(lang, `no ${kindWord(k, lang)}`, `sin ${kindWord(k, lang)}`)); }
  }
  const withPart = text.match(/\b(con|agrega|agregar|suma|add|with) (un |una |a |an )?(puente|solo|quiebre|break|bridge|outro|precoro)\b/);
  if (withPart) {
    const k = kindIn(withPart[0]);
    if (k && !parts.some((p) => p.kind === k)) {
      const lastChorus = parts.map((p) => p.kind).lastIndexOf('chorus');
      const at = k === 'outro' ? parts.length : lastChorus >= 0 ? lastChorus : parts.length;
      parts.splice(at, 0, { kind: k, bars: k === 'prechorus' ? 4 : 8, letter: `x${k}` });
      understood.push(word(lang, `with a ${kindWord(k, lang)}`, `con ${kindWord(k, lang)}`));
    }
  }
  const sized = [...text.matchAll(/\b(intro|introduccion|verso|versos|verse|verses|estrofa|estrofas|coro|coros|chorus|estribillo|puente|bridge|solo|quiebre|break|outro)( de| of)? (\d{1,2})( compases| bars)?\b/g)];
  for (const m of sized) {
    const k = kindIn(m[1]);
    const n = Math.max(1, Math.min(32, Number(m[3])));
    if (k && parts.some((p) => p.kind === k)) { parts = parts.map((p) => (p.kind === k ? { ...p, bars: n } : p)); understood.push(`${kindWord(k, lang)} ${n}`); }
  }
  const longer = text.match(/\b(intro|introduccion|verso|versos|coro|coros|puente|outro|quiebre|solo)( mas)? (largo|larga|largos|largas|long|longer)\b|\b(longer) (intro|verses?|chorus|bridge|outro)\b/);
  const shorter = text.match(/\b(intro|introduccion|verso|versos|coro|coros|puente|outro|quiebre|solo)( mas)? (corto|corta|cortos|cortas|short|shorter)\b|\b(shorter) (intro|verses?|chorus|bridge|outro)\b/);
  for (const [m, f] of [[longer, 2], [shorter, 0.5]] as const) {
    if (!m) continue;
    const k = kindIn(m[0]);
    if (k && parts.some((p) => p.kind === k)) {
      parts = parts.map((p) => (p.kind === k ? { ...p, bars: Math.max(2, Math.min(32, Math.round(p.bars * f))) } : p));
      understood.push(word(lang, `${f > 1 ? 'longer' : 'shorter'} ${kindWord(k, lang)}`, `${kindWord(k, lang)} más ${f > 1 ? 'largo' : 'corto'}`));
    }
  }
  if (!longer && !shorter && said(text, 'mas larga', 'larga', 'longer', 'long')) {
    const v = parts.findIndex((p) => p.kind === 'verse');
    const c = parts.findIndex((p) => p.kind === 'chorus');
    if (v >= 0 && c >= 0) { const at = parts.map((p) => p.kind).lastIndexOf('chorus') + 1; parts.splice(at, 0, { ...parts[v] }, { ...parts[c] }); understood.push(word(lang, 'one more verse and chorus', 'un verso y un coro más')); }
  } else if (!longer && !shorter && said(text, 'mas corta', 'corta', 'shorter', 'short')) {
    const idx = parts.map((p) => p.kind).lastIndexOf('verse');
    if (parts.filter((p) => p.kind === 'verse').length > 1) { parts.splice(idx, 2); understood.push(word(lang, 'one verse and chorus fewer', 'un verso y un coro menos')); }
  }
  while (parts.reduce((n, p) => n + p.bars, 0) > MAX_BARS && parts.length > 1) parts.pop();
  if (!understood.length) return { pick: null, understood, missed: true };
  return { pick: { ...base, parts, title: tx('Your version', 'Tu versión'), note: tx(understood.join(', '), understood.join(', ')) }, understood, missed: false };
}

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];
/** "i VI III VII", "más tensión al final del coro", "un solo acorde". */
export function refineChords(raw: string, base: ChordPick, lang: Lang): Refined<ChordPick> {
  const text = norm(raw);
  const understood: string[] = [];
  let pick: ChordPick = { ...base, verse: [...base.verse], chorus: [...base.chorus], other: { ...base.other } };
  const tokens = text.split(' ');
  const romans = tokens.map((w) => ROMAN.indexOf(w.replace(/[^iv]/g, ''))).filter((d, i) => d >= 0 && tokens[i].replace(/[^iv]/g, '') === tokens[i]);
  if (romans.length >= 2) {
    const target = said(text, 'coro', 'chorus', 'estribillo') ? 'chorus' : 'verse';
    pick = { ...pick, [target]: romans.slice(0, 8) };
    understood.push(`${target === 'chorus' ? word(lang, 'chorus', 'coro') : word(lang, 'verse', 'verso')}: ${romans.map((d) => ROMAN[d].toUpperCase()).join(' ')}`);
  }
  if (said(text, 'tension', 'mas tension', 'tenso', 'tense', 'tension al final')) {
    pick = { ...pick, chorus: [...pick.chorus.slice(0, 3), 4] };
    understood.push(word(lang, 'the chorus ends on V, to ask for the return', 'el coro termina en V, para pedir la vuelta'));
  }
  if (said(text, 'un solo acorde', 'one chord', 'drone', 'pedal')) {
    pick = { ...pick, verse: [0], chorus: [0], other: {} };
    understood.push(word(lang, 'one chord all the way', 'un solo acorde todo el rato'));
  }
  if (!understood.length) return { pick: null, understood, missed: true };
  return { pick: { ...pick, fromForm: false, title: tx('Your version', 'Tu versión'), note: tx(understood.join(', '), understood.join(', ')) }, understood, missed: false };
}

/** "Con piano", "sin bajo", "bajo 808", "cuerdas". */
export function refineInst(raw: string, base: InstPick, lang: Lang): Refined<InstPick> {
  const text = norm(raw);
  const understood: string[] = [];
  let pick: InstPick = { ...base };
  const chordsBy: [string[], string, T][] = [
    [['piano'], 'instrument.keys-piano', tx('piano', 'piano')],
    [['teclado electrico', 'piano electrico', 'rhodes', 'electric piano'], 'instrument.keys-ep', tx('electric piano', 'teclado eléctrico')],
    [['organo', 'organ'], 'instrument.organ', tx('organ', 'órgano')],
    [['cuerdas', 'strings', 'orquesta', 'violines'], 'instrument.strings-ensemble', tx('strings', 'cuerdas')],
    [['guitarra', 'guitar'], 'instrument.guitar-clean-60', tx('clean guitar', 'guitarra limpia')],
    [['campanas', 'bells'], 'instrument.bells-fm', tx('bells', 'campanas')],
    [['pad', 'colchon', 'atmosfera'], 'instrument.pad-warm', tx('a warm pad', 'un colchón cálido')],
    [['coro de voces', 'choir', 'voces'], 'instrument.choir-aah', tx('choir', 'coro de voces')],
  ];
  for (const [words, key, name] of chordsBy) {
    if (said(text, ...words) && findByKey(key)) { pick = { ...pick, chords: key }; understood.push(word(lang, `chords on ${name.en}`, `acordes en ${name.es}`)); break; }
  }
  if (said(text, 'sin bajo', 'no bass', 'without bass')) { pick = { ...pick, bass: null }; understood.push(word(lang, 'no bass', 'sin bajo')); }
  else if (said(text, '808', 'bajo 808')) { pick = { ...pick, bass: 'instrument.bass-808' }; understood.push(word(lang, '808 bass', 'bajo 808')); }
  else if (said(text, 'contrabajo', 'upright', 'double bass')) { pick = { ...pick, bass: 'instrument.bass-upright' }; understood.push(word(lang, 'upright bass', 'contrabajo')); }
  if (said(text, 'sin bateria', 'no drums', 'without drums')) { pick = { ...pick, drums: null }; understood.push(word(lang, 'no drums', 'sin batería')); }
  if (!understood.length) return { pick: null, understood, missed: true };
  return { pick: { ...pick, title: tx('Your version', 'Tu versión'), note: tx(understood.join(', '), understood.join(', ')) }, understood, missed: false };
}

/** "Sin batería en el intro", "medio tiempo", "más suave", "más fuerte", "parejo". */
export function refineGroove(raw: string, base: GroovePick, lang: Lang): Refined<GroovePick> {
  const text = norm(raw);
  const understood: string[] = [];
  let pick: GroovePick = { ...base, fromForm: false };
  if (/\bsin bateria en (el )?intro\b|\bno drums in the intro\b|\bintro sin bateria\b/.test(text)) { pick = { ...pick, noIntro: true }; understood.push(word(lang, 'no drums in the intro', 'el intro va sin batería')); }
  if (said(text, 'medio tiempo', 'half time', 'halftime')) { pick = { ...pick, mode: 'half' }; understood.push(word(lang, 'half time', 'medio tiempo')); }
  else if (said(text, 'mas suave', 'suave', 'softer', 'soft')) { pick = { ...pick, mode: 'soft' }; understood.push(word(lang, 'softer all the way', 'más suave todo el rato')); }
  else if (said(text, 'mas fuerte', 'fuerte', 'harder', 'stronger', 'potente')) { pick = { ...pick, mode: 'strong' }; understood.push(word(lang, 'stronger', 'más fuerte')); }
  else if (said(text, 'parejo', 'steady', 'igual', 'loop')) { pick = { ...pick, mode: 'steady' }; understood.push(word(lang, 'the same all the way', 'parejo todo el rato')); }
  if (!understood.length) return { pick: null, understood, missed: true };
  return { pick: { ...pick, title: tx('Your version', 'Tu versión'), note: tx(understood.join(', '), understood.join(', ')) }, understood, missed: false };
}

/* ---------------------------------------------------------------- building the song */

const KIT_OF: Record<Genre, string> = { rock: 'kit.rock', electronic: 'kit.electronic', hiphop: 'kit.hiphop' };
const known = (key: string | null): CatalogRef | null => (key && findByKey(key) ? ref(key) : null);

/** The idea of a song from the choices: blocks in order (a letter repeated is the same block again). */
export function sketchFrom(song: Song, choice: WordsChoice): Sketch {
  const base = newSketch(song);
  const blocks: SketchBlock[] = [];
  const order: string[] = [];
  const byLetter = new Map<string, string>();
  const counts = new Map<SectionKind, number>();
  choice.form.parts.forEach((part, i) => {
    const existing = byLetter.get(part.letter);
    if (existing) { order.push(existing); return; }
    const n = (counts.get(part.kind) ?? 0) + 1;
    counts.set(part.kind, n);
    const feel = feelFor(choice.groove, part, i);
    const groove: SketchGroove | null = feel && choice.inst.drums ? { group: choice.groove.group, feel } : null;
    const b: SketchBlock = { id: newId(), kind: part.kind, n, bars: part.bars, chords: chordsFor(choice.chords, part), groove };
    blocks.push(b);
    order.push(b.id);
    byLetter.set(part.letter, b.id);
  });
  return {
    ...base, blocks, order,
    chords_instrument: known(choice.inst.chords) ?? base.chords_instrument,
    drums_instrument: known(choice.inst.drums),
    bass_instrument: known(choice.inst.bass),
    style_group: choice.groove.group,
    accepted_at: null,
    updated_at: now(),
  };
}

/** A new song holding the idea; accepted, its detail is written from the idea too. */
export function buildFromWords(choice: WordsChoice, owner: string, lang: Lang, title: string, accept: boolean): Song {
  const by = owner;
  let song = newSong(owner, title, 2, lang, KIT_OF[genreOf(choice.idea.group)], [], false);
  song = C.setTempo(song, choice.idea.tempo, by);
  song = C.setSwing(song, choice.idea.swing, by);
  song = C.setKey(song, choice.idea.tonic, choice.idea.mode, by);
  song = { ...song, sketch: sketchFrom(song, choice) };
  return accept ? applyIdea(song, lang, by) : song;
}

/** What to hear for a step: a short loop of the idea (one verse, or verse and chorus), or the whole form. */
export function previewFromWords(choice: WordsChoice, owner: string, lang: Lang, scope: 'loop' | 'pair' | 'full'): Song {
  const parts: FormPart[] = scope === 'full' ? choice.form.parts
    : scope === 'pair' ? [{ kind: 'verse', bars: 4, letter: 'v' }, { kind: 'chorus', bars: 4, letter: 'c' }]
      : [{ kind: 'verse', bars: 4, letter: 'v' }];
  const chords = choice.chords.fromForm && scope !== 'full'
    ? { ...choice.chords, fromForm: false }
    : choice.chords;
  const groove = scope === 'full' ? choice.groove : { ...choice.groove, fromForm: false, noIntro: false };
  const song = buildFromWords({ ...choice, form: { ...choice.form, parts }, chords, groove }, owner, lang, 'preview', false);
  return renderIdea(song, lang);
}

/* ---------------------------------------------------------------- Claude's song ideas (idea file, version 2) */

export interface SongIdeaPayload {
  style: string;
  tempo: number;
  key: { tonic: string; mode: 'minor' | 'major' };
  swing?: number;
  form: { kind: SectionKind; bars: number; same_as?: number; chords?: (number | null)[]; feel?: Feel | null; name?: string }[];
  instruments: { chords: CatalogRef; drums?: CatalogRef | null; bass?: CatalogRef | null };
}

/** Claude's song idea as the first choice of every step, marked as Claude's. */
export function choiceFromClaude(p: SongIdeaPayload, title: string): WordsChoice {
  const group = GROUPS.some((g) => g.id === p.style) ? p.style : 'hh-boombap';
  const name = tx(title, title);
  const from = tx('From Claude', 'De Claude');
  const parts: FormPart[] = p.form.map((x, i) => ({
    kind: x.kind, bars: Math.max(1, Math.min(32, Math.round(x.bars))),
    letter: x.same_as !== undefined && x.same_as >= 0 && x.same_as < i ? `c${x.same_as}` : `c${i}`,
    chords: x.chords, feel: x.feel,
  }));
  // A part that repeats an earlier one takes that one's letter, all the way down a chain of repeats.
  parts.forEach((pt, i) => { const m = pt.letter.match(/^c(\d+)$/); if (m && Number(m[1]) !== i) pt.letter = parts[Number(m[1])].letter; });
  return {
    idea: { group, tempo: Math.round(Math.min(220, Math.max(40, p.tempo))), tonic: p.key.tonic, mode: p.key.mode, swing: Math.min(0.75, Math.max(0, p.swing ?? 0)), title: name, note: from, claude: true },
    form: { parts, title: name, note: from, claude: true },
    chords: (() => {
      // The first verse and chorus Claude wrote also serve forms of other origins.
      const first = (k: SectionKind) => p.form.find((x) => x.kind === k && x.chords?.length)?.chords?.map((d) => d ?? 0);
      const verse = first('verse') ?? first('intro') ?? [0];
      const other: Partial<Record<SectionKind, number[]>> = {};
      for (const k of ['prechorus', 'bridge', 'solo', 'break', 'outro'] as SectionKind[]) { const c = first(k); if (c) other[k] = c; }
      return { verse, chorus: first('chorus') ?? verse, other, fromForm: true, title: name, note: from, claude: true };
    })(),
    inst: {
      chords: findByKey(p.instruments.chords.key) ? p.instruments.chords.key : 'instrument.keys-piano',
      drums: p.instruments.drums && findByKey(p.instruments.drums.key) ? p.instruments.drums.key : null,
      bass: p.instruments.bass && findByKey(p.instruments.bass.key) ? p.instruments.bass.key : null,
      title: name, note: from, claude: true,
    },
    groove: { group, mode: 'song', fromForm: true, title: name, note: from, claude: true },
  };
}

/** The request to paste in Claude's project: the person's words, the file format, and what the app can play. */
export function claudeRequest(words: string): string {
  const styles = GROUPS.filter((g) => hasDrums(g.id)).map((g) => `${g.id} (${g.title.en})`).join(', ');
  return `${words.trim()}

Write this as a song idea for my Music Studio app: a JSON file in exactly this format.

{
  "format": "music-studio.ideas",
  "version": 2,
  "song_title": "<a short title of your own>",
  "ideas": [
    {
      "kind": "song",
      "title": "Short name of this option",
      "prompt": "What I asked for",
      "payload": {
        "style": "el-triphop",
        "tempo": 80,
        "key": { "tonic": "A", "mode": "minor" },
        "swing": 0.2,
        "form": [
          { "kind": "intro", "bars": 8, "chords": [0, 0, 5, 5], "feel": "soft" },
          { "kind": "verse", "bars": 8, "chords": [0, 6, 5, 4], "feel": "normal" },
          { "kind": "chorus", "bars": 8, "chords": [5, 6, 0, 0], "feel": "strong" },
          { "kind": "verse", "bars": 8, "same_as": 1 }
        ],
        "instruments": {
          "chords": { "key": "instrument.syn-triphop-strings", "version": "1.0.0" },
          "drums": { "key": "instrument.drums-el-triphop", "version": "1.0.0" },
          "bass": { "key": "instrument.syn-triphop-bass", "version": "1.0.0" }
        }
      }
    }
  ]
}

Rules:
- If I name a song, find out its real form (sections in order and bars per section), tempo, key and kind of harmony, and use them. Never copy its melody, riffs, lyrics or samples; the chords are written as scale degrees, as any song in that style could use.
- "style" is one of: ${styles}.
- "kind" is one of: ${SECTION_KINDS.filter((k) => k !== 'other').join(', ')}. "bars" from 1 to 32; the whole song at most ${MAX_BARS} bars of 4/4.
- "chords" are scale degrees, 0 to 6 (0 = I), one per bar; a shorter list repeats over the bars; null is a bar with no chord.
- "feel" is how the drums play that part: soft, normal, strong, half (half time), or null for no drums.
- "same_as" is the index of an earlier part that plays again exactly the same; then leave out chords and feel.
- "key": tonic in letters (A, Bb, F#), mode minor or major. "swing" from 0 (straight) to 0.6.
- "instruments" (all version 1.0.0): ${INSTRUMENTS.map((i) => i.key).join(', ')}. Pick the ones closest to the sound of the reference.
- Give 2 or 3 options when it makes sense, each its own idea. Reply with the JSON file only.`;
}
