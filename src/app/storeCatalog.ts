// The instrument store's floor plan: every catalog instrument in one wing (acoustic or electric) and one aisle by
// how it is played; styles are shop windows that show a kit and the Colección's sounds for that style.

import type { Lang } from '../domain/types';
import { entryOf, GROUPS, type Genre } from '../packs/collection';
import { findByKey, INSTRUMENTS, KITS } from '../packs/core';
import type { ArtId } from './storeArt';

export type Wing = 'acoustic' | 'electric';
export type Aisle =
  | 'strings' | 'winds' | 'keys' | 'drums' | 'perc' | 'voices'
  | 'guitars' | 'basses' | 'ekeys' | 'synths' | 'synthbass' | 'machines';

export const AISLES: Record<Wing, Aisle[]> = {
  acoustic: ['strings', 'winds', 'keys', 'drums', 'perc', 'voices'],
  electric: ['guitars', 'basses', 'ekeys', 'synths', 'synthbass', 'machines'],
};

export const AISLE_TITLE: Record<Aisle, { en: string; es: string }> = {
  strings: { en: 'Strings', es: 'Cuerdas' },
  winds: { en: 'Winds', es: 'Vientos' },
  keys: { en: 'Keys and mallets', es: 'Teclados y láminas' },
  drums: { en: 'Drum kits', es: 'Baterías' },
  perc: { en: 'Percussion', es: 'Percusión' },
  voices: { en: 'Voices', es: 'Voces' },
  guitars: { en: 'Electric guitars', es: 'Guitarras eléctricas' },
  basses: { en: 'Electric basses', es: 'Bajos eléctricos' },
  ekeys: { en: 'Electric keys', es: 'Teclados eléctricos' },
  synths: { en: 'Synths', es: 'Sintes' },
  synthbass: { en: 'Synth basses', es: 'Bajos sintetizados' },
  machines: { en: 'Drum machines', es: 'Cajas de ritmo' },
};

export const WING_TITLE: Record<Wing, { en: string; es: string }> = {
  acoustic: { en: 'Acoustic', es: 'Acústicos' },
  electric: { en: 'Electric', es: 'Eléctricos' },
};

const AISLE_WING: Record<Aisle, Wing> = Object.fromEntries(
  (Object.entries(AISLES) as [Wing, Aisle[]][]).flatMap(([w, list]) => list.map((a) => [a, w])),
) as Record<Aisle, Wing>;

/** The aisle an instrument hangs in. */
export function aisleOf(key: string): Aisle {
  const e = entryOf(key);
  if (e) {
    if (e.family === 'drums') return e.rows === 'standard' ? 'machines' : 'drums';
    if (e.family === 'guitar') return 'guitars';
    if (e.family === 'bass') return e.voice ? 'synthbass' : 'basses';
    return 'synths';
  }
  const k = key.replace('instrument.', '');
  if (/^(violin|cello|bass-upright|strings-ensemble|guitar-nylon)$/.test(k)) return 'strings';
  if (/^(flute|trumpet|trumpet-mute|brass-section|sax)$/.test(k)) return 'winds';
  if (/^(keys-piano|vibes)$/.test(k)) return 'keys';
  if (/^drums-(pop|rock|jazz)$/.test(k)) return 'drums';
  if (/^(drums-latin|perc-latin|drums-orch)$/.test(k)) return 'perc';
  if (/^choir/.test(k)) return 'voices';
  if (/^guitar-/.test(k)) return 'guitars';
  if (/^bass-(electric|di)$/.test(k)) return 'basses';
  if (/^(keys-ep|organ)$/.test(k)) return 'ekeys';
  if (/^bass-/.test(k)) return 'synthbass';
  if (/^drums-/.test(k)) return 'machines';
  return 'synths';
}

export const wingOf = (key: string): Wing => AISLE_WING[aisleOf(key)];

/** A real recording (samples of a real instrument), or a sound synthesized in the app. */
export function isRecorded(key: string): boolean {
  const m = findByKey(key)?.manifest as { type?: string; kit?: string } | undefined;
  return m?.type === 'sampler' || (m?.type === 'drumkit' && m.kit === 'sampled');
}

/** The drawing that stands for an instrument. */
export function artOf(key: string): ArtId {
  const k = key.replace('instrument.', '');
  const e = entryOf(key);
  if (e) {
    if (e.family === 'drums') return e.rows === 'standard' ? 'i-machine' : 'i-drums';
    if (e.family === 'guitar') return 'i-eguitar';
    if (e.family === 'bass') return e.voice ? 'i-synth' : 'i-ebass';
    return 'i-synth';
  }
  const table: [RegExp, ArtId][] = [
    [/^violin$/, 'i-violin'], [/^(cello|bass-upright)$/, 'i-cello'], [/^strings/, 'i-section'], [/^guitar-nylon$/, 'i-guitar'],
    [/^flute$/, 'i-flute'], [/^trumpet-mute$/, 'i-tmute'], [/^trumpet$/, 'i-trumpet'], [/^brass/, 'i-horn'], [/^sax$/, 'i-sax'],
    [/^keys-piano$/, 'i-piano'], [/^(vibes|bells)/, 'i-vibes'], [/^keys-ep$/, 'i-epiano'], [/^organ$/, 'i-organ'], [/^choir/, 'i-mic'],
    [/^(drums-latin|perc-latin)$/, 'i-congas'], [/^drums-orch$/, 'i-timpani'], [/^drums-(909|trap|boom-bap)$/, 'i-machine'], [/^drums-/, 'i-drums'],
    [/^guitar-/, 'i-eguitar'], [/^bass-(electric|di)$/, 'i-ebass'],
  ];
  return table.find(([re]) => re.test(k))?.[1] ?? 'i-synth';
}

export interface StoreItem { key: string; aisle: Aisle; wing: Wing; recorded: boolean; art: ArtId }

/** How the app's own instruments line up on their shelf, as an orchestra seats them; the Colección follows. */
const SHELF_ORDER = [
  'violin', 'cello', 'bass-upright', 'strings-ensemble', 'guitar-nylon',
  'flute', 'sax', 'trumpet', 'trumpet-mute', 'brass-section', 'keys-piano', 'vibes',
  'drums-pop', 'drums-rock', 'drums-jazz', 'drums-latin', 'perc-latin', 'drums-orch',
  'guitar-clean', 'guitar-dist', 'guitar-lead', 'guitar-di', 'bass-electric', 'bass-di', 'keys-ep', 'organ',
].map((k) => `instrument.${k}`);
const shelfRank = (key: string) => { const i = SHELF_ORDER.indexOf(key); return i < 0 ? SHELF_ORDER.length : i; };

/** Everything on sale: the app's instruments in shelf order, then the Colección in catalog order. */
export const STORE_ITEMS: StoreItem[] = INSTRUMENTS.filter((x) => x.kind === 'instrument')
  .map((x, i) => ({ x, i }))
  .sort((a, b) => shelfRank(a.x.key) - shelfRank(b.x.key) || a.i - b.i)
  .map(({ x }) => ({ key: x.key, aisle: aisleOf(x.key), wing: wingOf(x.key), recorded: isRecorded(x.key), art: artOf(x.key) }));

/** The style windows, one per kit, in this order; with the Colección's styles under it when it has them. */
export type WindowId = 'pop' | 'rock' | 'electronic' | 'hiphop' | 'jazz' | 'classical' | 'latin';
export const WINDOWS: { id: WindowId; glow: string; art: ArtId[] }[] = [
  { id: 'pop', glow: '240,80,158', art: ['i-drums', 'i-synth'] },
  { id: 'rock', glow: '230,60,40', art: ['i-eguitar', 'i-drums'] },
  { id: 'electronic', glow: '59,201,240', art: ['i-synth', 'i-machine'] },
  { id: 'hiphop', glow: '240,162,59', art: ['i-machine', 'i-violin'] },
  { id: 'jazz', glow: '70,120,230', art: ['i-sax', 'i-piano'] },
  { id: 'classical', glow: '243,215,162', art: ['i-violin', 'i-cello', 'i-timpani'] },
  { id: 'latin', glow: '255,120,60', art: ['i-congas', 'i-trumpet'] },
];

export const windowTitle = (id: WindowId, lang: Lang): string => findByKey(`kit.${id}`)?.title[lang] ?? id;

/** The kit a window shows: its roles and instruments. */
export const windowKit = (id: WindowId): { role: string; instrument: string }[] =>
  ((KITS.find((k) => k.key === `kit.${id}`)?.manifest.slots as { role: string; instrument: string }[] | undefined) ?? []);

/** The Colección's styles under a window, each with its instruments. */
export function windowStyles(id: WindowId): { id: string; title: { en: string; es: string }; keys: string[] }[] {
  const genre = id as Genre;
  return GROUPS.filter((g) => g.genre === genre).map((g) => ({
    id: g.id, title: g.title,
    keys: STORE_ITEMS.filter((x) => entryOf(x.key)?.group === g.id).map((x) => x.key),
  })).filter((g) => g.keys.length > 0);
}

/** The windows an instrument is in: its kit, or a Colección style of that genre. */
export const windowsOf = (key: string): WindowId[] =>
  WINDOWS.map((w) => w.id).filter((id) => windowKit(id).some((s) => s.instrument === key) || entryOf(key)?.genre === id);

/** Does an instrument match what was typed in the search box (its name, its aisle, its style)? */
export function matches(key: string, query: string, lang: Lang): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  const e = entryOf(key);
  const hay = [
    findByKey(key)?.title[lang], findByKey(key)?.title.en, AISLE_TITLE[aisleOf(key)][lang],
    e && GROUPS.find((g) => g.id === e.group)?.title[lang], e?.era[lang],
    ...windowsOf(key).map((w) => windowTitle(w, lang)),
  ].filter(Boolean).map((s) => fold(s as string)).join(' ');
  return q.split(/\s+/).every((w) => hay.includes(w));
}

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
