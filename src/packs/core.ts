// The v1 catalog ("core" pack). Every sound is synthesized in the browser:
// nothing to download, nothing to license, instant loading on the iPad.
// Keys and versions follow the catalog rules: kind.name@x.y.z, never edited once published.

import type { CatalogRef } from '../domain/types';

export interface CatalogItem {
  key: string;
  version: string;
  kind: 'instrument' | 'sound' | 'effect';
  pack: 'core';
  status: 'active' | 'deprecated';
  title: { en: string; es: string };
  license: string;
  source: string;
  manifest: Record<string, unknown>;
}

const LICENSE = 'Original, synthesized in the app';
const SOURCE = 'music-studio core pack';

const item = (
  kind: CatalogItem['kind'],
  key: string,
  en: string,
  es: string,
  manifest: Record<string, unknown>,
): CatalogItem => ({ kind, key, version: '1.0.0', pack: 'core', status: 'active', title: { en, es }, license: LICENSE, source: SOURCE, manifest });

/** The eight drum voices every kit plays. Patterns reference these, so changing kit keeps the beat. */
export const DRUM_VOICES = [
  item('sound', 'sound.kick', 'Kick', 'Bombo', { voice: 'kick' }),
  item('sound', 'sound.snare', 'Snare', 'Caja', { voice: 'snare' }),
  item('sound', 'sound.clap', 'Clap', 'Palmas', { voice: 'clap' }),
  item('sound', 'sound.hat-closed', 'Closed hat', 'Hi-hat cerrado', { voice: 'hatClosed' }),
  item('sound', 'sound.hat-open', 'Open hat', 'Hi-hat abierto', { voice: 'hatOpen' }),
  item('sound', 'sound.rim', 'Rim', 'Aro', { voice: 'rim' }),
  item('sound', 'sound.tom', 'Tom', 'Tom', { voice: 'tom' }),
  item('sound', 'sound.crash', 'Crash', 'Platillo', { voice: 'crash' }),
];

export const INSTRUMENTS = [
  item('instrument', 'instrument.drums-boom-bap', 'Drums: boom bap', 'Batería: boom bap', { type: 'drumkit', kit: 'boomBap' }),
  item('instrument', 'instrument.drums-trap', 'Drums: trap', 'Batería: trap', { type: 'drumkit', kit: 'trap' }),
  item('instrument', 'instrument.bass-808', '808 bass', 'Bajo 808', { type: 'synth', voice: 'bass808', range: [28, 55] }),
  item('instrument', 'instrument.keys-ep', 'Electric piano', 'Piano eléctrico', { type: 'synth', voice: 'keysEp', range: [48, 84] }),
  item('instrument', 'instrument.pad-warm', 'Warm pad', 'Pad cálido', { type: 'synth', voice: 'padWarm', range: [48, 84] }),
  item('instrument', 'instrument.lead-bright', 'Bright lead', 'Lead brillante', { type: 'synth', voice: 'leadBright', range: [60, 96] }),
  item('instrument', 'instrument.strings-ensemble', 'String ensemble', 'Cuerdas', { type: 'synth', voice: 'strings', range: [43, 88] }),
];

export interface ParamDef {
  name: string;
  label: { en: string; es: string };
  unit: string;
  min: number;
  max: number;
  default: number;
}

export const EFFECTS = [
  item('effect', 'effect.drive', 'Drive', 'Saturación', {
    params: [{ name: 'amount', label: { en: 'Amount', es: 'Cantidad' }, unit: 'ratio', min: 0, max: 1, default: 0.35 }],
  }),
  item('effect', 'effect.delay', 'Delay', 'Eco', {
    params: [
      { name: 'mix', label: { en: 'Mix', es: 'Mezcla' }, unit: 'ratio', min: 0, max: 1, default: 0.25 },
      { name: 'feedback', label: { en: 'Repeats', es: 'Repeticiones' }, unit: 'ratio', min: 0, max: 0.9, default: 0.35 },
    ],
  }),
  item('effect', 'effect.reverb', 'Reverb', 'Reverberación', {
    params: [
      { name: 'mix', label: { en: 'Mix', es: 'Mezcla' }, unit: 'ratio', min: 0, max: 1, default: 0.3 },
      { name: 'size', label: { en: 'Size', es: 'Tamaño' }, unit: 's', min: 0.5, max: 8, default: 2.5 },
    ],
  }),
];

export const CATALOG: CatalogItem[] = [...DRUM_VOICES, ...INSTRUMENTS, ...EFFECTS];

export const ref = (key: string): CatalogRef => {
  const found = CATALOG.find((c) => c.key === key);
  if (!found) throw new Error(`Not in the catalog: ${key}`);
  return { key: found.key, version: found.version };
};

export const findItem = (r: CatalogRef): CatalogItem | undefined =>
  CATALOG.find((c) => c.key === r.key && c.version === r.version);

export const effectParams = (r: CatalogRef): ParamDef[] =>
  ((findItem(r)?.manifest.params as ParamDef[] | undefined) ?? []);

export const title = (r: CatalogRef | null, lang: 'en' | 'es' = 'en'): string =>
  (r && findItem(r)?.title[lang]) || '';
