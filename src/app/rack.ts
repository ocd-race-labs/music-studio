// The studio rack of the Colección: which gear a new chain starts with, and where a Colección sound goes in a song.

import { ENTRIES, entryOf } from '../packs/collection';
import type { Entry, Family, Groove } from '../packs/collection';
import { findByKey, ref } from '../packs/core';
import type { FxChain, Song, Track } from '../domain/types';
import { defaultFxParams, roleOf } from '../domain/factory';

type Rack = [key: string, on: boolean, params?: Record<string, number>][];

/** The gear a new chain starts with, by instrument family, in the order the sound flows through it. */
const RACKS: Record<Family, Rack> = {
  drums: [
    ['effect.preamp', false, { character: 2, drive: 0.35 }],
    ['effect.comp-studio', true, { style: 0, amount: 0.45, mix: 0.6 }],
    ['effect.eq', true],
    ['effect.tape', true, { speed: 0, drive: 0.3, mix: 1 }],
    ['effect.gated-room', false],
    ['effect.reverb', false, { mix: 0.18, size: 1.4 }],
  ],
  guitar: [
    ['effect.amp', true, { model: 1, gain: 0.55 }],
    ['effect.cab', true, { model: 2, mic: 0.3 }],
    ['effect.comp-studio', false, { style: 1, amount: 0.4, mix: 1 }],
    ['effect.eq', true],
    ['effect.chorus', false],
    ['effect.delay', false],
    ['effect.reverb', true, { mix: 0.15, size: 1.8 }],
  ],
  synth: [
    ['effect.preamp', false, { character: 1, drive: 0.3 }],
    ['effect.comp-studio', false, { style: 2, amount: 0.4, mix: 1 }],
    ['effect.eq', true],
    ['effect.lofi', false, { mix: 0.6, bits: 12, tone: 4000 }],
    ['effect.tape', false, { speed: 0, drive: 0.4, mix: 1 }],
    ['effect.chorus', false],
    ['effect.delay', false],
    ['effect.reverb', true, { mix: 0.2, size: 2 }],
  ],
  bass: [
    ['effect.amp', true, { model: 3, gain: 0.3 }],
    ['effect.cab', true, { model: 3, mic: 0.3 }],
    ['effect.comp-studio', true, { style: 1, amount: 0.5, mix: 1 }],
    ['effect.eq', true],
    ['effect.tape', false, { speed: 0, drive: 0.4, mix: 1 }],
  ],
};

export function rackFor(family: Family): FxChain {
  return {
    routing: 'series',
    slots: RACKS[family].map(([key, on, params]) => ({ effect: ref(key), bypass: !on, params: { ...defaultFxParams(key), ...params } })),
  };
}

export const familyOf = (instrumentKey: string): Family => {
  const e = entryOf(instrumentKey);
  if (e) return e.family;
  const m = findByKey(instrumentKey)?.manifest as { type?: string; set?: string } | undefined;
  if (m?.type === 'drumkit') return 'drums';
  if (m?.set === 'bass' || instrumentKey.includes('bass')) return 'bass';
  return 'guitar';
};

/** What a saved sound is built on: the Colección sound itself; the saved chain then replaces its own gear. */
export const rackBase = (instrumentKey: string): string => instrumentKey;

/** A chain to start shaping from: the entry's own gear (a guitar's amp and cabinet), or the family's starting rack. */
export function rackOf(instrumentKey: string): FxChain {
  const chain = entryOf(instrumentKey)?.chain;
  if (!chain) return rackFor(familyOf(instrumentKey));
  return {
    routing: 'series',
    slots: chain.map(([key, on, params]) => ({ effect: ref(key), bypass: !on, params: { ...defaultFxParams(key), ...params } })),
  };
}

/*
 * Sample rhythms for the two hand-percussion kits, written on the standard rows; each row lands on the kit's piece in
 * the same place (kick → low conga or bass drum, snare → conga or concert snare, and so on).
 */
const LATIN_GROOVE: Groove = {
  bars: 2,
  steps: {
    rim: [0, 6, 12, 20, 24], // son clave, 3-2
    kick: [6, 14, 22, 30], // low conga on the "and" of 2 and 4
    snare: [4, 12, 20, 28], // conga slaps
    clap: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30], // bongo, eighths
    hatClosed: [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31], // güiro: long, short-short
    crash: [0, 4, 8, 12, 16, 20, 24, 28], // cowbell on the beat
  },
  soft: { clap: [2, 6, 10, 14, 18, 22, 26, 30], hatClosed: [3, 7, 11, 15, 19, 23, 27, 31] },
};
const ORCH_GROOVE: Groove = {
  bars: 2,
  steps: {
    kick: [0, 8, 16, 24], // bass drum
    snare: [4, 12, 20, 25, 26, 27, 28], // concert snare, a short roll into beat 4 of bar 2
    tom: [0, 16], // timpani
    hatClosed: [6, 14, 22], // triangle
    clap: [2, 10, 18], // tambourine
    crash: [16], // cymbals
  },
  soft: { snare: [25, 26, 27], clap: [2, 10, 18], hatClosed: [6, 14, 22] },
};
const OWN_GROOVE: Record<string, { groove: Groove; tempo: number }> = {
  'instrument.perc-latin': { groove: LATIN_GROOVE, tempo: 104 },
  'instrument.drums-orch': { groove: ORCH_GROOVE, tempo: 96 },
};

/** The entry whose groove or phrase plays a sound: its own, a rhythm made for it, or the first of its family. */
export const templateFor = (instrumentKey: string): Entry | undefined => {
  const own = entryOf(instrumentKey);
  if (own) return own;
  const base = ENTRIES.find((e) => e.family === familyOf(instrumentKey));
  const made = OWN_GROOVE[instrumentKey];
  return made && base ? { ...base, instrument: instrumentKey, groove: made.groove, tempo: made.tempo } : base;
};

/** The track a Colección sound goes to: the selected one when it plays that family, else the first that does. */
export function targetTrack(song: Song, selectedId: string | null, family: Family): Track | undefined {
  const fits = (tr: Track) => family === 'drums'
    ? tr.kind === 'drums' && roleOf(tr) === 'drums'
    : tr.kind !== 'drums' && (family === 'bass' ? roleOf(tr) === 'bass' : roleOf(tr) !== 'bass');
  const sel = song.tracks.find((tr) => tr.id === selectedId);
  return sel && fits(sel) ? sel : song.tracks.find(fits);
}

