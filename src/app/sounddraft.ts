// The sound being shaped in the studio, kept apart from the song until it is used: which instrument it plays, the
// chain it runs through, and where it goes (a track, as the musician's sound or the producer's version). Pure logic,
// so the studio screen stays about layout and the rules can be tested.

import { ENTRIES, entryOf } from '../packs/collection';
import type { Entry, Genre } from '../packs/collection';
import { findByKey, ref, ROLES } from '../packs/core';
import type { CustomSound, FxChain, Lang, Role, Song, Track } from '../domain/types';
import { defaultFxParams, roleOf } from '../domain/factory';
import * as C from '../domain/commands';
import { familyOf } from './rack';


/** The job a sound usually does in a kit, used when it is starred: drums, bass, chords or melody. */
export function defaultRole(instrumentKey: string): Role {
  const e = entryOf(instrumentKey);
  const fam = familyOf(instrumentKey);
  if (fam === 'drums') return 'drums';
  if (fam === 'bass') return 'bass';
  if (fam === 'guitar' && e) return 'chords';
  const m = findByKey(instrumentKey)?.manifest as { low?: number; set?: string } | undefined;
  if ((m?.low ?? 60) <= 40 || m?.set === 'bass') return 'bass';
  if (e?.phrase?.notes.some((n) => n.midi.length > 1)) return 'chords';
  return 'lead';
}

/** Roles a sound can take: a kit is drums or percussion; anything melodic can take any melodic job. */
export const rolesFor = (instrumentKey: string): Role[] => (familyOf(instrumentKey) === 'drums' ? ['drums', 'perc'] : ROLES.filter((r) => r !== 'drums' && r !== 'perc'));

export interface Draft {
  /** The instrument the sound plays. */
  base: string;
  /** The studio chain it runs through; it replaces the instrument's own gear. */
  chain: FxChain;
  /** The saved sound it was loaded from, if any. */
  soundId?: string;
  soundName?: string;
}

const EMPTY: FxChain = { routing: 'series', slots: [] };

/** The gear an instrument comes with (a Colección guitar's amp and cabinet), as a chain; most sounds come with none. */
export function ownGear(instrumentKey: string): FxChain {
  const spec = entryOf(instrumentKey)?.chain ?? (findByKey(instrumentKey)?.manifest as { chain?: Entry['chain'] } | undefined)?.chain;
  if (!spec) return { ...EMPTY, slots: [] };
  return { routing: 'series', slots: spec.map(([key, on, params]) => ({ effect: ref(key), bypass: !on, params: { ...defaultFxParams(key), ...params } })) };
}

/** What a track plays today: its instrument, and the saved sound's chain when it has one. */
export function currentOf(track: Track): Draft {
  const base = track.instrument?.key ?? '';
  return { base, chain: track.sound ? structuredClone(track.sound.chain) : ownGear(base), soundId: track.sound?.id, soundName: track.sound?.name };
}

/** Tracks a sound can go on, the ones whose job matches it first. */
export function fittingTracks(song: Song, instrumentKey: string): Track[] {
  const role = defaultRole(instrumentKey);
  const fits = song.tracks.filter((tr) => fitsTrack(instrumentKey, tr));
  return [...fits.filter((tr) => roleOf(tr) === role), ...fits.filter((tr) => roleOf(tr) !== role)];
}

const slotSig = (c: FxChain) => JSON.stringify(c.slots.map((s) => [s.effect.key, s.bypass,
  Object.keys(s.params).sort().map((k) => [k, Math.round(s.params[k] * 1e4) / 1e4])]));
export const sameChain = (a: FxChain, b: FxChain): boolean => slotSig(a) === slotSig(b);

/**
 * How a draft differs from what the track plays, which decides the bar at the bottom: nothing to do; a catalog sound
 * as it comes (use it); a saved sound as it was saved (use it); or a chain of your own (name it and save it).
 */
export type DraftKind = 'clean' | 'catalog' | 'mine' | 'custom';
export function draftKind(d: Draft, current: Draft, saved?: CustomSound): DraftKind {
  const same = d.base === current.base && sameChain(d.chain, current.chain) && (d.soundId ?? '') === (current.soundId ?? '');
  if (same) return 'clean';
  if (d.soundId && saved && saved.base.key === d.base && sameChain(d.chain, saved.chain)) return 'mine';
  if (!d.soundId && sameChain(d.chain, ownGear(d.base))) return 'catalog';
  return 'custom';
}

/** Whether a sound can go on a track: kits on drum tracks, basses on the bass, everything else on the melodic tracks. */
export function fitsTrack(instrumentKey: string, track: Track, loose = false): boolean {
  const drums = familyOf(instrumentKey) === 'drums';
  if (track.kind === 'drums' || roleOf(track) === 'drums' || roleOf(track) === 'perc') return drums;
  if (drums) return false;
  if (loose) return true;
  const bass = defaultRole(instrumentKey) === 'bass';
  return roleOf(track) === 'bass' ? bass : !bass;
}

/**
 * The song with one track playing the draft, to hear it in context. The other tracks, the mix and the notes stay as
 * they are; the notes move to the new instrument the way a real swap would move them.
 */
export function auditionSong(song: Song, trackId: string, base: string, chain: FxChain, name: string): Song {
  const tr = song.tracks.find((x) => x.id === trackId);
  if (!tr || !base) return song;
  const plain = song;
  const sound: CustomSound = {
    id: 'audition', profile_id: '', name, base: ref(base), chain, chain_schema_version: 1, status: 'active', origin: 'person',
    created_at: song.updated_at, updated_at: song.updated_at,
  };
  return C.applySound(plain, trackId, sound, null);
}

/* ---------------------------------------------------------------- suggestions */

const GENRE_OF_KIT: Record<string, Genre> = { 'kit.rock': 'rock', 'kit.electronic': 'electronic', 'kit.hiphop': 'hiphop' };

/** The decade a sound comes from, read from its era ("1970s", "Early 1990s", "1977"); null for "any era". */
export function decadeOf(e: Entry): number | null {
  const m = /(19|20)(\d)(\d)s?/.exec(e.era.en);
  if (!m) return null;
  return Number(`${m[1]}${m[2]}0`);
}

/** The genre a song is in: its kit's, or the one most of its sounds come from. */
export function songGenre(song: Song): Genre | null {
  if (song.kit_key && GENRE_OF_KIT[song.kit_key]) return GENRE_OF_KIT[song.kit_key];
  const count = new Map<Genre, number>();
  for (const tr of song.tracks) {
    const e = tr.instrument ? entryOf(tr.instrument.key) : undefined;
    if (e) count.set(e.genre, (count.get(e.genre) ?? 0) + 1);
  }
  let best: Genre | null = null;
  for (const [g, n] of count) if (!best || n > (count.get(best) ?? 0)) best = g;
  return best;
}

const GENRE_NAME: Record<Genre, { en: string; es: string }> = {
  rock: { en: 'Rock', es: 'Rock' }, electronic: { en: 'Electronic', es: 'Electrónica' }, hiphop: { en: 'Hip hop', es: 'Hip hop' },
};
const decadeName = (d: number, lang: Lang) => (lang === 'es' ? `años ${String(d).slice(d >= 2000 ? 0 : 2)}` : `${d >= 2000 ? d : String(d).slice(2)}s`);

export interface Suggestion { entry: Entry; reasons: string[]; score: number; byGenreOnly: boolean }

/**
 * Sounds that fit the track and go with the song: the same decade as the other tracks' sounds (what was chosen
 * weighs most), the song's genre, the same style as one of them. Plain rules, explained on each card.
 */
export function suggestionsFor(song: Song, track: Track, lang: Lang, max = 4): Suggestion[] {
  const genre = songGenre(song);
  const others = song.tracks.filter((x) => x.id !== track.id)
    .map((x) => ({ tr: x, e: x.instrument ? entryOf(x.instrument.key) : undefined }))
    .filter((x): x is { tr: Track; e: Entry } => !!x.e);
  const current = track.instrument?.key;
  const scored = ENTRIES.filter((e) => e.instrument !== current && fitsTrack(e.instrument, track)).map((e) => {
    let score = 0;
    const reasons: string[] = [];
    if (genre && e.genre === genre) { score += 2; reasons.push(lang === 'es' ? `De tu género: ${GENRE_NAME[genre].es}` : `Your genre: ${GENRE_NAME[genre].en}`); }
    const dec = decadeOf(e);
    const sameEra = dec !== null ? others.find((o) => decadeOf(o.e) === dec) : undefined;
    if (sameEra && dec !== null) { score += 3; reasons.push(lang === 'es' ? `Misma época que tu ${sameEra.tr.name.toLowerCase()} (${decadeName(dec, lang)})` : `Same era as your ${sameEra.tr.name.toLowerCase()} (${decadeName(dec, lang)})`); }
    const sameStyle = others.find((o) => o.e.group === e.group);
    if (sameStyle) { score += 1; reasons.push(lang === 'es' ? `Mismo estilo que tu ${sameStyle.tr.name.toLowerCase()}` : `Same style as your ${sameStyle.tr.name.toLowerCase()}`); }
    return { entry: e, reasons, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || ENTRIES.indexOf(a.entry) - ENTRIES.indexOf(b.entry));
  return scored.slice(0, max).map(({ entry, reasons, score }) => ({ entry, reasons, score, byGenreOnly: score === 2 && !!genre && entry.genre === genre }));
}
