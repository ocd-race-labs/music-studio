// The core pack. Every sound is synthesized in the browser: nothing to download, nothing to license,
// instant loading on the iPad. Real recordings replace the main instruments in a later pack.
// Keys and versions follow the catalog rules: kind.name@x.y.z, never edited once published.

import type { CatalogRef, Role, TrackSound } from '../domain/types';
import { ENTRIES, SAMPLED_KITS, SAMPLERS, TRIMS } from './collection';

export interface CatalogItem {
  key: string;
  version: string;
  kind: 'instrument' | 'sound' | 'effect' | 'kit';
  pack: 'core' | 'collection';
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

/* ---------------------------------------------------------------- drum rows */

/** The eight rows of a standard kit. Patterns reference these, so changing kit keeps the beat. */
export const DRUM_VOICES = [
  item('sound', 'sound.kick', 'Kick', 'Bombo', { voice: 'kick' }),
  item('sound', 'sound.snare', 'Snare', 'Caja', { voice: 'snare' }),
  item('sound', 'sound.clap', 'Clap', 'Palmas', { voice: 'clap' }),
  item('sound', 'sound.hat-closed', 'Closed hat', 'Hi-hat cerrado', { voice: 'hatClosed' }),
  item('sound', 'sound.hat-open', 'Open hat', 'Hi-hat abierto', { voice: 'hatOpen' }),
  item('sound', 'sound.rim', 'Rim', 'Aro', { voice: 'rim' }),
  item('sound', 'sound.tom', 'Tom', 'Tom', { voice: 'tom' }),
  item('sound', 'sound.crash', 'Crash', 'Crash', { voice: 'crash' }),
];

/** Orchestral percussion, row by row in the same places as a standard kit (kick → bass drum, and so on). */
export const ORCH_VOICES = [
  item('sound', 'sound.bass-drum', 'Bass drum', 'Gran casa', { voice: 'bassDrum' }),
  item('sound', 'sound.snare-orch', 'Concert snare', 'Caja sinfónica', { voice: 'snareOrch' }),
  item('sound', 'sound.tambourine', 'Tambourine', 'Pandereta', { voice: 'tambourine' }),
  item('sound', 'sound.triangle', 'Triangle', 'Triángulo', { voice: 'triangle' }),
  item('sound', 'sound.suspended-cymbal', 'Suspended cymbal', 'Platillo suspendido', { voice: 'suspendedCymbal' }),
  item('sound', 'sound.woodblock', 'Woodblock', 'Bloque de madera', { voice: 'woodblock' }),
  item('sound', 'sound.timpani', 'Timpani', 'Timbal sinfónico', { voice: 'timpani' }),
  item('sound', 'sound.cymbals', 'Cymbals', 'Platillos', { voice: 'cymbals' }),
];

/** Latin hand percussion, row by row in the same places as a standard kit. */
export const LATIN_VOICES = [
  item('sound', 'sound.conga-low', 'Low conga', 'Tumba', { voice: 'congaLow' }),
  item('sound', 'sound.conga-high', 'High conga', 'Conga', { voice: 'congaHigh' }),
  item('sound', 'sound.bongo', 'Bongo', 'Bongó', { voice: 'bongo' }),
  item('sound', 'sound.guiro', 'Güiro', 'Güiro', { voice: 'guiro' }),
  item('sound', 'sound.maracas', 'Maracas', 'Maracas', { voice: 'maracas' }),
  item('sound', 'sound.clave', 'Clave', 'Clave', { voice: 'clave' }),
  item('sound', 'sound.timbale', 'Timbale', 'Timbal', { voice: 'timbale' }),
  item('sound', 'sound.cowbell', 'Cowbell', 'Cencerro', { voice: 'cowbell' }),
];

/** The extra rows of a full rock kit: two toms, a ride and a china. Kick, snare, hats and crash are shared. */
export const FULL_KIT_VOICES = [
  item('sound', 'sound.tom-1', 'Tom 1', 'Tom 1', { voice: 'tom1' }),
  item('sound', 'sound.tom-2', 'Tom 2', 'Tom 2', { voice: 'tom2' }),
  item('sound', 'sound.ride', 'Ride', 'Ride', { voice: 'ride' }),
  item('sound', 'sound.china', 'China', 'China', { voice: 'china' }),
];

const keysOf = (list: CatalogItem[]) => list.map((i) => i.key);
export const STANDARD_ROWS = keysOf(DRUM_VOICES);
export const ORCH_ROWS = keysOf(ORCH_VOICES);
export const LATIN_ROWS = keysOf(LATIN_VOICES);
/** A full kit as a drummer sets it up: kick, snare, two toms, hi-hat closed and open, ride, crash, china. */
export const FULL_ROWS = [
  'sound.kick', 'sound.snare', 'sound.tom-1', 'sound.tom-2', 'sound.hat-closed', 'sound.hat-open', 'sound.ride', 'sound.crash', 'sound.china',
];

/* ---------------------------------------------------------------- instruments */

const kit = (key: string, en: string, es: string, kitId: string, rows: string[] = STANDARD_ROWS) =>
  item('instrument', key, en, es, { type: 'drumkit', kit: kitId, rows });
/** low: the lowest note shown when the 2-octave grid opens. */
const synth = (key: string, en: string, es: string, voice: string, low: number) =>
  item('instrument', key, en, es, { type: 'synth', voice, low });

const CORE_INSTRUMENTS = [
  kit('instrument.drums-boom-bap', 'Drums: boom bap', 'Batería: boom bap', 'boomBap'),
  kit('instrument.drums-trap', 'Drums: trap', 'Batería: trap', 'trap'),
  kit('instrument.drums-pop', 'Drums: pop', 'Batería: pop', 'pop'),
  kit('instrument.drums-rock', 'Drums: rock', 'Batería: rock', 'rock'),
  kit('instrument.drums-909', 'Drum machine', 'Caja de ritmos', 'electro'),
  kit('instrument.drums-jazz', 'Drums: brushes', 'Batería: escobillas', 'jazz'),
  kit('instrument.drums-latin', 'Drums: latin', 'Batería: latina', 'latin'),
  kit('instrument.drums-orch', 'Orchestral percussion', 'Percusión orquestal', 'orch', ORCH_ROWS),
  kit('instrument.perc-latin', 'Latin percussion', 'Percusión latina', 'latinPerc', LATIN_ROWS),

  synth('instrument.bass-808', '808 bass', 'Bajo 808', 'bass808', 36),
  synth('instrument.bass-synth', 'Synth bass', 'Bajo sintetizado', 'bassSynth', 36),
  synth('instrument.bass-electric', 'Electric bass', 'Bajo eléctrico', 'bassElectric', 36),
  synth('instrument.bass-upright', 'Upright bass', 'Contrabajo', 'bassUpright', 36),
  synth('instrument.cello', 'Cello', 'Chelo', 'cello', 36),

  synth('instrument.keys-ep', 'Electric piano', 'Piano eléctrico', 'keysEp', 60),
  synth('instrument.keys-piano', 'Piano', 'Piano', 'keysPiano', 48),
  synth('instrument.organ', 'Organ', 'Órgano', 'organ', 48),
  synth('instrument.pluck', 'Pluck', 'Pluck', 'pluck', 60),
  synth('instrument.vibes', 'Vibraphone', 'Vibráfono', 'vibes', 60),
  synth('instrument.bells-fm', 'Bells', 'Campanas', 'bellsFm', 60),

  synth('instrument.pad-warm', 'Warm pad', 'Pad cálido', 'padWarm', 55),
  synth('instrument.pad-supersaw', 'Supersaw pad', 'Pad supersaw', 'padSupersaw', 55),
  synth('instrument.strings-ensemble', 'String ensemble', 'Cuerdas', 'strings', 55),
  synth('instrument.brass-section', 'Brass section', 'Metales', 'brassSection', 48),

  synth('instrument.lead-bright', 'Bright lead', 'Lead brillante', 'leadBright', 60),
  synth('instrument.lead-saw', 'Saw lead', 'Lead sierra', 'leadSaw', 60),
  synth('instrument.violin', 'Violin', 'Violín', 'violin', 55),
  synth('instrument.flute', 'Flute', 'Flauta', 'flute', 60),
  synth('instrument.sax', 'Saxophone', 'Saxofón', 'sax', 55),
  synth('instrument.trumpet', 'Trumpet', 'Trompeta', 'trumpet', 55),
  synth('instrument.trumpet-mute', 'Muted trumpet', 'Trompeta con sordina', 'trumpetMute', 55),

  synth('instrument.guitar-clean', 'Clean guitar', 'Guitarra limpia', 'guitarClean', 48),
  synth('instrument.guitar-dist', 'Distorted guitar', 'Guitarra distorsionada', 'guitarDist', 40),
  synth('instrument.guitar-lead', 'Lead guitar', 'Guitarra solista', 'guitarLead', 52),
  synth('instrument.guitar-nylon', 'Nylon guitar', 'Guitarra acústica', 'guitarNylon', 48),
];

/**
 * Colección instruments. Drum kits: recorded kits processed into the sound of a style and era. Guitars and basses:
 * a guitar or bass recorded direct, heard through the gear that makes each tone (amp, cabinet, compressor…).
 */
const collectionItem = (key: string, en: string, es: string, manifest: Record<string, unknown>, license: string, source: string): CatalogItem => ({
  kind: 'instrument', key, version: '1.0.0', pack: 'collection', status: 'active', title: { en, es }, license, source, manifest,
});
const FAMILY_TITLE = { drums: { en: 'Drums', es: 'Batería' }, guitar: { en: 'Guitar', es: 'Guitarra' }, bass: { en: 'Bass', es: 'Bajo' }, synth: { en: 'Synth', es: 'Sinte' } };

export const COLLECTION_INSTRUMENTS: CatalogItem[] = [
  // The recordings themselves, with no gear: what a saved guitar or bass sound starts from.
  collectionItem('instrument.guitar-di', 'Electric guitar (direct)', 'Guitarra eléctrica (directa)', { type: 'sampler', set: 'guitar', low: 40, trimDb: TRIMS['instrument.guitar-di'] ?? 0 },
    SAMPLERS.guitar?.license ?? 'CC0 1.0', 'Emilyguitar by Karoryfer Samples'),
  collectionItem('instrument.bass-di', 'Electric bass (direct)', 'Bajo eléctrico (directo)', { type: 'sampler', set: 'bass', low: 28, mono: true, trimDb: TRIMS['instrument.bass-di'] ?? 0 },
    SAMPLERS.bass?.license ?? 'CC0 1.0', 'Growlybass by Karoryfer Samples'),
  ...ENTRIES.map((e) => {
    const f = FAMILY_TITLE[e.family];
    if (e.family === 'drums') {
      const set = e.instrument.replace('instrument.drums-', '');
      const spec = SAMPLED_KITS[set] as { license?: string; source?: string } | undefined;
      return collectionItem(e.instrument, `${f.en}: ${e.title.en}`, `${f.es}: ${e.title.es}`,
        { type: 'drumkit', kit: 'sampled', set, rows: e.rows === 'standard' ? STANDARD_ROWS : FULL_ROWS },
        spec?.license ?? 'CC0 1.0', spec?.source ?? 'music-studio collection');
    }
    if (e.voice) {
      // A synthesized voice heard through its gear.
      return collectionItem(e.instrument, `${f.en}: ${e.title.en}`, `${f.es}: ${e.title.es}`,
        { type: 'synth', voice: e.voice, low: e.low ?? 48, chain: e.chain, trimDb: TRIMS[e.instrument] ?? 0 }, 'Original, synthesized in the app', 'music-studio collection');
    }
    return collectionItem(e.instrument, `${f.en}: ${e.title.en}`, `${f.es}: ${e.title.es}`,
      { type: 'sampler', set: e.set, low: e.family === 'bass' ? 28 : 40, mono: e.family === 'bass', chain: e.chain, trimDb: TRIMS[e.instrument] ?? 0 },
      'CC0 1.0', e.family === 'bass' ? 'Growlybass by Karoryfer Samples' : 'Emilyguitar by Karoryfer Samples');
  }),
];
export const INSTRUMENTS: CatalogItem[] = [...CORE_INSTRUMENTS, ...COLLECTION_INSTRUMENTS];

/* ---------------------------------------------------------------- kits by genre */

/** One place in a kit: the job, the instrument, and for Mi kit a saved sound on top of it. */
export interface KitSlot { role: Role; instrument: string; sound?: TrackSound }

const genre = (id: string, en: string, es: string, slots: [Role, string][]) =>
  item('kit', `kit.${id}`, en, es, { slots: slots.map(([role, instrument]) => ({ role, instrument: `instrument.${instrument}` })) });

/** Each genre fills the same roles, so a song can move between genres and keep its notes. */
export const KITS = [
  genre('hiphop', 'Hip hop', 'Hip hop', [['drums', 'drums-boom-bap'], ['bass', 'bass-808'], ['chords', 'pad-warm'], ['keys', 'keys-ep'], ['lead', 'lead-bright'], ['color', 'strings-ensemble']]),
  genre('pop', 'Pop', 'Pop', [['drums', 'drums-pop'], ['bass', 'bass-synth'], ['chords', 'keys-piano'], ['keys', 'pluck'], ['lead', 'lead-bright'], ['color', 'strings-ensemble']]),
  genre('rock', 'Rock', 'Rock', [['drums', 'drums-rock'], ['bass', 'bass-electric'], ['chords', 'guitar-dist'], ['keys', 'organ'], ['lead', 'guitar-lead'], ['color', 'guitar-clean']]),
  genre('electronic', 'Electronic', 'Electrónica', [['drums', 'drums-909'], ['bass', 'bass-synth'], ['chords', 'pad-supersaw'], ['keys', 'pluck'], ['lead', 'lead-saw'], ['color', 'bells-fm']]),
  genre('jazz', 'Jazz', 'Jazz', [['drums', 'drums-jazz'], ['bass', 'bass-upright'], ['chords', 'keys-piano'], ['keys', 'vibes'], ['lead', 'sax'], ['color', 'trumpet-mute']]),
  genre('classical', 'Classical', 'Clásica', [['drums', 'drums-orch'], ['bass', 'cello'], ['chords', 'strings-ensemble'], ['keys', 'keys-piano'], ['lead', 'violin'], ['color', 'flute']]),
  genre('latin', 'Latin', 'Latina', [['drums', 'drums-latin'], ['perc', 'perc-latin'], ['bass', 'bass-electric'], ['chords', 'keys-piano'], ['keys', 'guitar-nylon'], ['lead', 'trumpet'], ['color', 'brass-section']]),
];

export const DEFAULT_KIT = 'kit.hiphop';
export const CUSTOM_KIT = 'custom';

export const kitSlots = (kitKey: string): KitSlot[] =>
  ((KITS.find((k) => k.key === kitKey)?.manifest.slots as KitSlot[] | undefined) ?? []);

/* ---------------------------------------------------------------- effects */

export interface ParamDef {
  name: string;
  label: { en: string; es: string };
  /** ratio (shown as %), s, Hz, dB, st (semitones) or bits. */
  unit: string;
  min: number;
  max: number;
  default: number;
  /** Slider step; whole numbers for semitones and bits. */
  step?: number;
  /** For unit "choice": the name of each value 0, 1, 2… shown as buttons. */
  choices?: { en: string; es: string }[];
}

const P = (name: string, en: string, es: string, unit: string, min: number, max: number, def: number, step?: number): ParamDef =>
  ({ name, label: { en, es }, unit, min, max, default: def, ...(step ? { step } : {}) });
const MIX = (def: number) => P('mix', 'Mix', 'Mezcla', 'ratio', 0, 1, def);
const CHOICE = (name: string, en: string, es: string, choices: [string, string][], def: number): ParamDef =>
  ({ ...P(name, en, es, 'choice', 0, choices.length - 1, def, 1), choices: choices.map(([e, s]) => ({ en: e, es: s })) });

/** Pedals. The first three come on every new track; the rest are added from the pedal list. */
export const EFFECTS = [
  item('effect', 'effect.drive', 'Drive', 'Saturación', { params: [P('amount', 'Amount', 'Cantidad', 'ratio', 0, 1, 0.35)] }),
  item('effect', 'effect.delay', 'Delay', 'Eco', {
    params: [MIX(0.25), P('feedback', 'Repeats', 'Repeticiones', 'ratio', 0, 0.9, 0.35)],
  }),
  item('effect', 'effect.reverb', 'Reverb', 'Reverberación', {
    params: [MIX(0.3), P('size', 'Size', 'Tamaño', 's', 0.5, 8, 2.5)],
  }),
  item('effect', 'effect.chorus', 'Chorus', 'Chorus', {
    params: [MIX(0.5), P('rate', 'Speed', 'Velocidad', 'Hz', 0.1, 8, 1.5), P('depth', 'Depth', 'Profundidad', 'ratio', 0, 1, 0.7)],
  }),
  item('effect', 'effect.phaser', 'Phaser', 'Phaser', {
    params: [MIX(0.5), P('rate', 'Speed', 'Velocidad', 'Hz', 0.05, 6, 0.5), P('depth', 'Depth', 'Profundidad', 'ratio', 0, 1, 0.5)],
  }),
  item('effect', 'effect.filter-sweep', 'Filter sweep', 'Barrido de filtro', {
    params: [MIX(1), P('rate', 'Speed', 'Velocidad', 'Hz', 0.05, 8, 0.5), P('depth', 'Depth', 'Profundidad', 'ratio', 0, 1, 0.6)],
  }),
  item('effect', 'effect.pump', 'Sidechain pump', 'Bombeo (sidechain)', {
    params: [P('depth', 'Depth', 'Profundidad', 'ratio', 0, 1, 0.6), P('release', 'Swell', 'Regreso', 'ratio', 0.1, 1, 0.6)],
  }),
  item('effect', 'effect.pingpong', 'Ping-pong delay', 'Eco ping-pong', {
    params: [MIX(0.3), P('feedback', 'Repeats', 'Repeticiones', 'ratio', 0, 0.9, 0.35)],
  }),
  item('effect', 'effect.lofi', 'Lo-fi', 'Lo-fi', {
    params: [MIX(1), P('bits', 'Bits', 'Bits', 'bits', 2, 12, 6, 1), P('tone', 'Tone', 'Tono', 'Hz', 800, 8000, 3500)],
  }),
  item('effect', 'effect.radio', 'Radio', 'Radio', {
    params: [MIX(1), P('focus', 'Focus', 'Foco', 'Hz', 400, 3000, 1200)],
  }),
  item('effect', 'effect.octave', 'Octave', 'Octavador', {
    params: [MIX(0.4), P('pitch', 'Shift', 'Desplazamiento', 'st', -12, 12, 12, 1)],
  }),
  item('effect', 'effect.tremolo', 'Tremolo', 'Trémolo', {
    params: [P('rate', 'Speed', 'Velocidad', 'Hz', 0.5, 16, 6), P('depth', 'Depth', 'Profundidad', 'ratio', 0, 1, 0.6)],
  }),
  item('effect', 'effect.compressor', 'Compressor', 'Compresor', { params: [P('amount', 'Amount', 'Cantidad', 'ratio', 0, 1, 0.5)] }),
  item('effect', 'effect.eq', 'EQ', 'Ecualizador', {
    params: [P('low', 'Lows', 'Graves', 'dB', -12, 12, 0, 0.5), P('mid', 'Mids', 'Medios', 'dB', -12, 12, 0, 0.5), P('high', 'Highs', 'Agudos', 'dB', -12, 12, 0, 0.5)],
  }),
  item('effect', 'effect.widener', 'Stereo width', 'Estéreo ancho', { params: [P('width', 'Width', 'Ancho', 'ratio', 0, 1, 0.7)] }),

  /* Studio gear, as recording software models it: preamp, compressor styles, amp, speaker cabinet, tape, gated room. */
  item('effect', 'effect.preamp', 'Preamp', 'Preamplificador', {
    params: [
      CHOICE('character', 'Character', 'Carácter', [['Clean', 'Limpio'], ['Transformer', 'Transformador'], ['Tube', 'Válvula']], 2),
      P('drive', 'Drive', 'Ganancia', 'ratio', 0, 1, 0.3),
      P('lowcut', 'Low cut', 'Corte de graves', 'Hz', 20, 300, 30),
    ],
  }),
  item('effect', 'effect.comp-studio', 'Studio compressor', 'Compresor de estudio', {
    params: [
      CHOICE('style', 'Style', 'Estilo', [['Fast (FET)', 'Rápido (FET)'], ['Smooth (opto)', 'Suave (óptico)'], ['Glue (bus)', 'Pegamento (bus)']], 0),
      P('amount', 'Amount', 'Cantidad', 'ratio', 0, 1, 0.5),
      MIX(1),
    ],
  }),
  item('effect', 'effect.amp', 'Amp', 'Amplificador', {
    params: [
      CHOICE('model', 'Model', 'Modelo', [['Clean', 'Limpio'], ['Crunch', 'Crunch'], ['High gain', 'Alta ganancia'], ['Bass', 'Bajo']], 1),
      P('gain', 'Gain', 'Ganancia', 'ratio', 0, 1, 0.5),
      P('bass', 'Bass', 'Graves', 'dB', -12, 12, 0, 0.5),
      P('mid', 'Middle', 'Medios', 'dB', -12, 12, 0, 0.5),
      P('treble', 'Treble', 'Agudos', 'dB', -12, 12, 0, 0.5),
      P('level', 'Level', 'Volumen', 'dB', -12, 6, 0, 0.5),
    ],
  }),
  item('effect', 'effect.cab', 'Cabinet', 'Gabinete', {
    params: [
      CHOICE('model', 'Speakers', 'Parlantes', [['1x12 open', '1x12 abierto'], ['2x12', '2x12'], ['4x12 closed', '4x12 cerrado'], ['Bass 8x10', 'Bajo 8x10'], ['Bass 1x15', 'Bajo 1x15']], 2),
      P('mic', 'Mic: center to edge', 'Micrófono: del centro al borde', 'ratio', 0, 1, 0.3),
    ],
  }),
  item('effect', 'effect.tape', 'Tape', 'Cinta', {
    params: [
      CHOICE('speed', 'Speed', 'Velocidad', [['15 ips', '15 ips'], ['30 ips', '30 ips']], 0),
      P('drive', 'Saturation', 'Saturación', 'ratio', 0, 1, 0.4),
      MIX(1),
    ],
  }),
  item('effect', 'effect.gated-room', 'Gated room', 'Sala con compuerta', {
    params: [MIX(0.35), P('length', 'Length', 'Largo', 's', 0.12, 0.8, 0.32)],
  }),
];

/** Pedals that make echoes and rooms go last in a chain; new pedals go before them. */
export const SPACE_EFFECTS = ['effect.delay', 'effect.pingpong', 'effect.reverb', 'effect.gated-room'];

/** Pedals by what they do, in the order sound flows through them: shape it, color it, move it, place it in a room. */
export type PedalGroup = 'control' | 'color' | 'movement' | 'space';
export const PEDAL_GROUPS: PedalGroup[] = ['control', 'color', 'movement', 'space'];
const GROUP_OF: Record<string, PedalGroup> = {
  'effect.eq': 'control', 'effect.compressor': 'control',
  'effect.drive': 'color', 'effect.lofi': 'color', 'effect.radio': 'color',
  'effect.chorus': 'movement', 'effect.phaser': 'movement', 'effect.filter-sweep': 'movement', 'effect.tremolo': 'movement',
  'effect.pump': 'movement', 'effect.octave': 'movement',
  'effect.delay': 'space', 'effect.pingpong': 'space', 'effect.reverb': 'space', 'effect.widener': 'space',
  'effect.preamp': 'color', 'effect.amp': 'color', 'effect.cab': 'color', 'effect.tape': 'color',
  'effect.comp-studio': 'control', 'effect.gated-room': 'space',
};
export const pedalGroup = (key: string): PedalGroup => GROUP_OF[key] ?? 'color';
export const pedalRank = (key: string): number => PEDAL_GROUPS.indexOf(pedalGroup(key));

export const CATALOG: CatalogItem[] = [...DRUM_VOICES, ...ORCH_VOICES, ...LATIN_VOICES, ...FULL_KIT_VOICES, ...INSTRUMENTS, ...KITS, ...EFFECTS];

export const ref = (key: string): CatalogRef => {
  const found = CATALOG.find((c) => c.key === key);
  if (!found) throw new Error(`Not in the catalog: ${key}`);
  return { key: found.key, version: found.version };
};

export const findItem = (r: CatalogRef): CatalogItem | undefined =>
  CATALOG.find((c) => c.key === r.key && c.version === r.version);

export const findByKey = (key: string): CatalogItem | undefined => CATALOG.find((c) => c.key === key);

export const effectParams = (r: CatalogRef): ParamDef[] =>
  ((findItem(r)?.manifest.params as ParamDef[] | undefined) ?? []);

export const title = (r: CatalogRef | null, lang: 'en' | 'es' = 'en'): string =>
  (r && findItem(r)?.title[lang]) || '';

export const kitTitle = (kitKey: string, lang: 'en' | 'es'): string => findByKey(kitKey)?.title[lang] ?? kitKey;

/** Drum rows of a kit instrument, standard unless the kit says otherwise. */
export const rowsOf = (instrumentKey: string): string[] =>
  ((findByKey(instrumentKey)?.manifest.rows as string[] | undefined) ?? STANDARD_ROWS);

export const isDrumKit = (instrumentKey: string): boolean => findByKey(instrumentKey)?.manifest.type === 'drumkit';

/** Lowest note shown when an instrument's grid opens. */
export const lowOf = (instrumentKey: string): number => (findByKey(instrumentKey)?.manifest.low as number | undefined) ?? 60;

const ROW_FAMILIES = [STANDARD_ROWS, ORCH_ROWS, LATIN_ROWS];

/** Place of a drum row in its kit (kick and bass drum and tumba are all row 0). */
export const rowIndex = (soundKey: string): number => {
  for (const rows of ROW_FAMILIES) {
    const i = rows.indexOf(soundKey);
    if (i >= 0) return i;
  }
  return -1;
};

/** Rows that can play a row a kit lacks, nearest first: a floor tom plays on the one tom, a china on the crash. */
const STAND_IN: Record<string, string[]> = {
  'sound.tom': ['sound.tom-1', 'sound.tom-2'],
  'sound.tom-1': ['sound.tom', 'sound.tom-2'],
  'sound.tom-2': ['sound.tom', 'sound.tom-1'],
  'sound.ride': ['sound.hat-closed'],
  'sound.china': ['sound.crash'],
  'sound.clap': ['sound.snare'],
  'sound.rim': ['sound.snare'],
};

/**
 * Where a row of any kit plays in a kit with these rows. Kits of the same shape match by place (kick, bass drum
 * and tumba are all row 0); otherwise the row goes through its standard name and its stand-ins. Undefined when
 * nothing fits.
 */
export function resolveRow(rows: string[], soundKey: string): string | undefined {
  if (rows.includes(soundKey)) return soundKey;
  const shape = rows.join();
  const family = ROW_FAMILIES.some((f) => f.join() === shape);
  const place = rowIndex(soundKey);
  if (family && place >= 0) return rows[place];
  const standard = place >= 0 ? STANDARD_ROWS[place] : soundKey;
  for (const key of [standard, ...(STAND_IN[standard] ?? [])]) {
    if (rows.includes(key)) return key;
    const at = STANDARD_ROWS.indexOf(key);
    if (family && at >= 0) return rows[at];
  }
  return undefined;
}

/** The row of this kit that plays a row of any other kit. */
export const rowFor = (instrumentKey: string, soundKey: string): string =>
  resolveRow(rowsOf(instrumentKey), soundKey) ?? soundKey;

/** The synth voice that plays a drum row on a given kit; any kit's pattern plays on any other kit. */
export const rowVoice = (instrumentKey: string, soundKey: string): string | undefined =>
  findByKey(rowFor(instrumentKey, soundKey))?.manifest.voice as string | undefined;

export const ROLES: Role[] = ['drums', 'perc', 'bass', 'chords', 'keys', 'lead', 'color'];

/** The job an instrument does in the first kit that has it; drum kits are drums, the rest default to lead. */
export const roleOfInstrument = (instrumentKey: string): Role => {
  for (const k of KITS) {
    const slot = (k.manifest.slots as KitSlot[]).find((s) => s.instrument === instrumentKey);
    if (slot) return slot.role;
  }
  return isDrumKit(instrumentKey) ? 'drums' : 'lead';
};

/** Instruments a track can switch to without losing its notes: drum kits with the same rows, or any melodic instrument. */
export const swapsFor = (instrumentKey: string): CatalogItem[] => {
  if (isDrumKit(instrumentKey)) {
    const rows = rowsOf(instrumentKey).join();
    return INSTRUMENTS.filter((i) => i.manifest.type === 'drumkit' && (i.manifest.rows as string[]).join() === rows);
  }
  return INSTRUMENTS.filter((i) => i.manifest.type !== 'drumkit');
};
