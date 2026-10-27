// Which icon stands for an instrument, a track or a stage of the chain. Read from what the sound is (a kit, a guitar,
// the synth voice it plays), so a new catalog sound gets a fitting icon without a list to keep.

import type { Role, Track } from '../domain/types';
import { entryOf } from '../packs/collection';
import { findByKey } from '../packs/core';
import { roleOf } from '../domain/factory';
import type { IconName } from './ui';

const BY_VOICE: [RegExp, IconName][] = [
  [/piano|keysEp|keys/i, 'piano'],
  [/organ/i, 'organ'],
  [/pad|drone|supersaw/i, 'pad'],
  [/strings|violin|cello/i, 'violin'],
  [/bell|vibes|mallet/i, 'bells'],
  [/choir|voice|aah/i, 'choir'],
  [/brass|trumpet/i, 'trumpet'],
  [/sax/i, 'sax'],
  [/flute/i, 'flute'],
  [/lead|whine|saw/i, 'lead'],
];

const BY_KEY: [RegExp, IconName][] = [
  [/perc-latin|drums-latin|conga/, 'conga'],
  [/drums-orch/, 'timpani'],
  [/drums-(909|trap|boom-bap)/, 'drumpad'],
  [/violin|cello|strings|bass-upright/, 'violin'],
  [/choir/, 'choir'],
  [/trumpet|brass/, 'trumpet'],
  [/sax/, 'sax'],
  [/flute/, 'flute'],
  [/vibes|bells/, 'bells'],
  [/organ/, 'organ'],
  [/keys-|piano/, 'piano'],
  [/pad-/, 'pad'],
  [/lead-/, 'lead'],
  [/pluck/, 'synth'],
  [/guitar-nylon|acoustic/, 'acoustic'],
  [/guitar/, 'guitar'],
  [/bass-808|bass-synth|sub/, 'sub'],
  [/bass/, 'bass'],
];

const ROLE_ICON: Record<Role, IconName> = { drums: 'drums', perc: 'conga', bass: 'bass', chords: 'piano', keys: 'piano', lead: 'synth', color: 'pad' };

/** The icon for an instrument by its catalog key. */
export function instIcon(key: string | undefined, fallback: IconName = 'music'): IconName {
  if (!key) return fallback;
  const e = entryOf(key);
  if (e) {
    if (e.family === 'drums') return e.rows === 'standard' ? 'drumpad' : 'drums';
    if (e.family === 'guitar') return 'guitar';
    if (e.family === 'bass') return e.set === 'bass' ? 'bass' : e.voice && /organ/i.test(e.voice) ? 'organ' : 'sub';
    if (e.voice) return BY_VOICE.find(([re]) => re.test(e.voice!))?.[1] ?? 'synth';
    return 'synth';
  }
  const hit = BY_KEY.find(([re]) => re.test(key));
  if (hit) return hit[1];
  const m = findByKey(key)?.manifest as { type?: string } | undefined;
  if (m?.type === 'drumkit') return 'drums';
  return fallback;
}

/** The icon for a track: what it plays, or its job when it plays nothing yet. */
export const trackIcon = (track: Track): IconName => {
  const key = track.instrument?.key;
  return instIcon(key, ROLE_ICON[roleOf(track)]);
};

export const roleIcon = (r: Role): IconName => ROLE_ICON[r];
