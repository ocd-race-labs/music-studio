// The studio rack of the Colección: which gear a new chain starts with, and where a Colección sound goes in a song.

import { ENTRIES, entryOf } from '../packs/collection';
import type { Family } from '../packs/collection';
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

/** What a saved sound is built on: a drum kit as it is, or the guitar or bass recording before any gear. */
export const rackBase = (instrumentKey: string): string => {
  const e = entryOf(instrumentKey);
  if (e?.family === 'guitar') return 'instrument.guitar-di';
  if (e?.family === 'bass') return 'instrument.bass-di';
  return instrumentKey;
};

/** A chain to start shaping from: the entry's own gear (a guitar's amp and cabinet), or the family's starting rack. */
export function rackOf(instrumentKey: string): FxChain {
  const chain = entryOf(instrumentKey)?.chain;
  if (!chain) return rackFor(familyOf(instrumentKey));
  return {
    routing: 'series',
    slots: chain.map(([key, on, params]) => ({ effect: ref(key), bypass: !on, params: { ...defaultFxParams(key), ...params } })),
  };
}

/** The entry whose groove or phrase plays a sound: its own, or the first of its family. */
export const templateFor = (instrumentKey: string) => entryOf(instrumentKey) ?? ENTRIES.find((e) => e.family === familyOf(instrumentKey));

/** The track a Colección sound goes to: the selected one when it plays that family, else the first that does. */
export function targetTrack(song: Song, selectedId: string | null, family: Family): Track | undefined {
  const fits = (tr: Track) => family === 'drums'
    ? tr.kind === 'drums' && roleOf(tr) === 'drums'
    : tr.kind !== 'drums' && (family === 'bass' ? roleOf(tr) === 'bass' : roleOf(tr) !== 'bass');
  const sel = song.tracks.find((tr) => tr.id === selectedId);
  return sel && fits(sel) ? sel : song.tracks.find(fits);
}

