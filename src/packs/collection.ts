// The Colección: instrument sounds by genre, in the producer's room. Each entry is a catalog instrument with a
// place (genre, family, group), a short description of the sound and a groove to hear it in context.
// Sounds are named by style and era, never by bands, drummers or brands.

import type { Lang } from '../domain/types';
import type { SampledKitSpec } from '../engine/sampled';
import DRUM_SPECS from './collection-drums.json';
import STRING_SPECS from './collection-strings.json';
import type { SamplerSpec } from '../engine/sampler';

export type Genre = 'rock' | 'electronic' | 'hiphop';
export type Family = 'drums' | 'guitar' | 'bass' | 'synth';
type Text = { en: string; es: string };

export interface Group { id: string; genre: Genre; title: Text }

export interface Groove {
  /** Sixteenth steps of one bar per voice; two bars when the list goes past 16. */
  steps: Partial<Record<string, number[]>>;
  /** Steps played softer (ghost notes, hats between beats). */
  soft?: Partial<Record<string, number[]>>;
  bars: number;
  /** Where the off sixteenths land: 0.5 is straight, about 0.56 to 0.62 is the swing of house and boom bap. */
  swing?: number;
}

/** A short phrase to hear a melodic sound: chords or notes at sixteenth steps, with their length in steps. */
export interface Phrase {
  bars: number;
  notes: { at: number; midi: number[]; len: number; vel?: number }[];
}

/** Studio gear an instrument is heard through, in order: [effect key, on, settings]. */
export type ChainSpec = [key: string, on: boolean, params?: Record<string, number>][];

export interface Entry {
  instrument: string;
  genre: Genre;
  family: Family;
  group: string;
  title: Text;
  era: Text;
  blurb: Text;
  tempo: number;
  /** Drums: a groove on the kit's pieces. */
  groove: Groove;
  /** Guitar and bass: a phrase, the recording it plays and the gear that makes its sound. */
  phrase?: Phrase;
  set?: 'guitar' | 'bass';
  chain?: ChainSpec;
  /** Synths: the synthesized voice it plays (see engine/voices). */
  voice?: string;
  /** Drum kits with the standard rows (kick, snare, clap, hats, rim, tom, crash) instead of a full rock kit. */
  rows?: 'standard';
  /** Lowest note shown when the grid opens. */
  low?: number;
}

export const GENRES: { id: Genre; title: Text }[] = [
  { id: 'rock', title: { en: 'Rock', es: 'Rock' } },
  { id: 'electronic', title: { en: 'Electronic', es: 'Electrónica' } },
  { id: 'hiphop', title: { en: 'Hip hop', es: 'Hip hop' } },
];

export const FAMILIES: { id: Family; title: Text }[] = [
  { id: 'drums', title: { en: 'Drums', es: 'Batería' } },
  { id: 'guitar', title: { en: 'Guitar', es: 'Guitarra' } },
  { id: 'bass', title: { en: 'Bass', es: 'Bajo' } },
  { id: 'synth', title: { en: 'Synths and keys', es: 'Sintes y teclados' } },
];

export const GROUPS: Group[] = [
  { id: 'rock-classic', genre: 'rock', title: { en: 'Classic rock', es: 'Rock clásico' } },
  { id: 'rock-modern', genre: 'rock', title: { en: 'Contemporary rock', es: 'Rock contemporáneo' } },
  { id: 'rock-metal', genre: 'rock', title: { en: 'Metal', es: 'Metal' } },
  { id: 'rock-punk', genre: 'rock', title: { en: 'Punk', es: 'Punk' } },
  { id: 'el-house', genre: 'electronic', title: { en: 'House', es: 'House' } },
  { id: 'el-deephouse', genre: 'electronic', title: { en: 'Deep house', es: 'Deep house' } },
  { id: 'el-techno', genre: 'electronic', title: { en: 'Techno', es: 'Techno' } },
  { id: 'el-edm', genre: 'electronic', title: { en: 'Dance / EDM', es: 'Dance / EDM' } },
  { id: 'el-triphop', genre: 'electronic', title: { en: 'Downtempo and trip hop', es: 'Downtempo y trip hop' } },
  { id: 'el-idm', genre: 'electronic', title: { en: 'IDM', es: 'IDM' } },
  { id: 'el-dnb', genre: 'electronic', title: { en: 'Drum and bass', es: 'Drum and bass' } },
  { id: 'el-jungle', genre: 'electronic', title: { en: 'Jungle', es: 'Jungle' } },
  { id: 'el-dubstep', genre: 'electronic', title: { en: 'Dubstep', es: 'Dubstep' } },
  { id: 'el-ambient', genre: 'electronic', title: { en: 'Ambient', es: 'Ambient' } },
  { id: 'hh-oldschool', genre: 'hiphop', title: { en: 'Old school', es: 'Old school' } },
  { id: 'hh-boombap', genre: 'hiphop', title: { en: 'Boom bap', es: 'Boom bap' } },
  { id: 'hh-trap', genre: 'hiphop', title: { en: 'Trap', es: 'Trap' } },
  { id: 'hh-lofi', genre: 'hiphop', title: { en: 'Lo-fi', es: 'Lo-fi' } },
  { id: 'hh-drill', genre: 'hiphop', title: { en: 'Drill', es: 'Drill' } },
  { id: 'hh-westcoast', genre: 'hiphop', title: { en: 'West coast', es: 'West coast' } },
];

/* ---------------------------------------------------------------- grooves */

const E = [0, 2, 4, 6, 8, 10, 12, 14];
const S = Array.from({ length: 16 }, (_, i) => i);
const twice = (steps: number[]) => [...steps, ...steps.map((s) => s + 16)];

export const GROOVES = {
  /** Straight eighths: kick on 1 and 3, snare on 2 and 4. */
  backbeat: { bars: 2, steps: { kick: twice([0, 8, 10]), snare: twice([4, 12]), hatClosed: twice(E) }, soft: { hatClosed: twice([2, 6, 10, 14]) } },
  /** Half time with a big room: the snare only on 3. */
  halfTime: { bars: 2, steps: { kick: twice([0, 3, 10]), snare: twice([8]), hatOpen: twice([0, 4, 12]), hatClosed: twice([2, 6, 14]) }, soft: { hatClosed: twice([2, 6, 14]) } },
  /** Eighths on the ride, a fill on the toms at the end. */
  rideFill: { bars: 2, steps: { kick: [0, 8, 10, 16, 24], snare: [4, 12, 20], ride: [...E, 16, 18, 20, 22], tom1: [24, 25, 26], tom2: [27, 28, 29, 30], crash: [0] }, soft: { ride: [2, 6, 10, 14, 18, 22] } },
  /** Fast and straight, cymbals open: punk. */
  punk: { bars: 2, steps: { kick: twice([0, 4, 8, 12]), snare: twice([2, 6, 10, 14]), hatOpen: twice(E), crash: [0, 16] } },
  /** Double kick sixteenths under a snare on 2 and 4: metal. */
  doubleKick: { bars: 2, steps: { kick: twice(S), snare: twice([4, 12]), china: twice([0, 8]), ride: twice([2, 6, 10, 14]) }, soft: { kick: twice([1, 3, 5, 7, 9, 11, 13, 15]) } },
  /** A gated snare and toms that roll down: the 80s. */
  gatedFill: { bars: 2, steps: { kick: [0, 8, 10, 16, 24], snare: [4, 12, 20], hatClosed: [...E, 16, 18, 20, 22], tom1: [24, 26], tom2: [28, 30], crash: [0] } },
  /** Swung shuffle-ish groove with ghost notes: classic studio. */
  ghosts: { bars: 2, steps: { kick: twice([0, 7, 8]), snare: twice([4, 12, 15]), hatClosed: twice(E), hatOpen: [14] }, soft: { snare: twice([15]) } },
} satisfies Record<string, Groove>;

/* ---------------------------------------------------------------- rock drums */

const rockKit = (id: string, group: string, title: Text, era: Text, blurb: Text, tempo: number, groove: Groove): Entry => ({
  instrument: `instrument.drums-${id}`, genre: 'rock', family: 'drums', group, title, era, blurb, tempo, groove,
});

const DRUM_ENTRIES: Entry[] = [
  rockKit('rock-studio-60', 'rock-classic', { en: '60s studio', es: 'Estudio 60' }, { en: '1960s · small room, damped toms', es: 'Años 60 · sala chica, toms apagados' },
    { en: 'A small kit with towels on the drums, two microphones and tape: dry, warm and close.', es: 'Un kit chico con toallas sobre los parches, dos micrófonos y cinta: seco, cálido y cercano.' }, 112, GROOVES.ghosts),
  rockKit('rock-stairwell-70', 'rock-classic', { en: 'Stone stairwell', es: 'Escalera de piedra' }, { en: '1970s · huge open kick, big hall', es: 'Años 70 · bombo enorme y abierto, sala gigante' },
    { en: 'A 26-inch kick and a deep snare recorded from far away in a stone stairwell: the biggest drums of the 70s.', es: 'Un bombo de 26 pulgadas y una caja profunda grabados desde lejos en una escalera de piedra: la batería más grande de los 70.' }, 84, GROOVES.halfTime),
  rockKit('rock-arena-80', 'rock-classic', { en: '80s arena, gated', es: 'Arena 80, compuerta' }, { en: '1980s · gated reverb, big toms', es: 'Años 80 · reverb con compuerta, toms grandes' },
    { en: 'A huge room that stops dead after each hit (gated reverb): the snare and tom fills of 80s stadium rock.', es: 'Una sala enorme que se corta en seco después de cada golpe (reverb con compuerta): la caja y los redobles del rock de estadio de los 80.' }, 116, GROOVES.gatedFill),
  rockKit('rock-grunge-90', 'rock-modern', { en: '90s grunge', es: 'Grunge 90' }, { en: '1990s · loud snare, live room', es: 'Años 90 · caja fuerte, sala viva' },
    { en: 'Hit hard in a live room: a cracking snare, a round kick and washy cymbals. Loud and raw, but clear.', es: 'Tocada fuerte en una sala viva: una caja que revienta, un bombo redondo y platillos amplios. Fuerte y crudo, pero claro.' }, 118, GROOVES.backbeat),
  rockKit('rock-alt-2000', 'rock-modern', { en: 'Modern alternative', es: 'Alternativo moderno' }, { en: '2000s · polished, punchy, controlled', es: 'Años 2000 · pulido, con golpe, controlado' },
    { en: 'The radio rock sound: tight kick, fat snare, parallel compression and a short bright room.', es: 'El sonido del rock de radio: bombo apretado, caja gorda, compresión en paralelo y una sala corta y brillante.' }, 128, GROOVES.rideFill),
  rockKit('rock-garage', 'rock-modern', { en: 'Garage revival', es: 'Garage revival' }, { en: '2000s · small, dry, squashed', es: 'Años 2000 · chico, seco, aplastado' },
    { en: 'A cheap kit in a small room, squashed by a compressor: trashy, dry and full of attitude.', es: 'Un kit barato en una pieza chica, aplastado por un compresor: sucio, seco y con actitud.' }, 132, GROOVES.backbeat),
  rockKit('metal-thrash-80', 'rock-metal', { en: '80s thrash', es: 'Thrash 80' }, { en: '1980s · clicky kick, ringing snare', es: 'Años 80 · bombo con clic, caja que suena' },
    { en: 'A kick with a hard click to cut through fast guitars, a high ringing snare and scooped mids.', es: 'Un bombo con un clic duro para atravesar guitarras rápidas, una caja aguda que resuena y medios recortados.' }, 168, GROOVES.doubleKick),
  rockKit('metal-modern', 'rock-metal', { en: 'Modern metal', es: 'Metal moderno' }, { en: '2010s · tight, triggered, huge toms', es: 'Años 2010 · apretado, preciso, toms enormes' },
    { en: 'Every hit identical and precise: a tight kick for double bass, a sharp snare, deep toms and a china for accents.', es: 'Cada golpe igual y preciso: un bombo apretado para doble pedal, una caja seca, toms profundos y un china para los acentos.' }, 150, GROOVES.doubleKick),
  rockKit('punk-77', 'rock-punk', { en: 'Punk 77', es: 'Punk 77' }, { en: '1977 · raw, fast, trashy cymbals', es: '1977 · crudo, rápido, platillos sucios' },
    { en: 'Recorded fast and loud with almost no polish: a boxy snare, a thin kick and cymbals that never stop.', es: 'Grabado rápido y fuerte, casi sin pulir: una caja de cartón, un bombo delgado y platillos que nunca paran.' }, 176, GROOVES.punk),
  rockKit('punk-pop-90', 'rock-punk', { en: '90s pop punk', es: 'Pop punk 90' }, { en: '1990s · bright, tight, fast', es: 'Años 90 · brillante, apretado, rápido' },
    { en: 'Fast and clean: a high, tight snare, a punchy kick and bright cymbals for skate and pop punk.', es: 'Rápido y limpio: una caja aguda y apretada, un bombo con golpe y platillos brillantes para el skate y el pop punk.' }, 190, GROOVES.punk),

];

/* ---------------------------------------------------------------- guitars and basses */

const E2 = 40, A2 = 45, D3 = 50, G2 = 43, B2 = 47, C3 = 48, F2 = 41, E1 = 28, A1 = 33, D2 = 38, G1 = 31, B1 = 35, C2 = 36;
const power = (root: number) => [root, root + 7, root + 12];
const NO_GROOVE: Groove = { bars: 0, steps: {} };

/** A phrase from [step, notes, length in steps, velocity?] items. */
const ph = (bars: number, items: [number, number[], number, number?][]): Phrase =>
  ({ bars, notes: items.map(([at, midi, len, vel]) => ({ at, midi, len, vel })) });

const PHRASES = {
  /** Open chords, picked one string at a time. */
  cleanArp: ph(2, [
    [0, [40], 2], [2, [47], 2], [4, [52], 2], [6, [55], 2], [8, [59], 2], [10, [55], 2], [12, [52], 2], [14, [47], 2],
    [16, [36], 2], [18, [43], 2], [20, [48], 2], [22, [52], 2], [24, [55], 4], [28, [52], 4],
  ]),
  /** A classic rock rhythm on power chords. */
  rockRiff: ph(2, [
    [0, power(A2), 3], [3, power(A2), 1, 0.7], [4, power(A2), 2], [6, power(C3), 2], [8, power(D3), 4], [12, power(C3), 2], [14, power(A2), 2],
    [16, power(G2), 3], [19, power(G2), 1, 0.7], [20, power(G2), 2], [22, power(A2), 2], [24, power(A2), 8],
  ]),
  /** Long chords left to ring and feed back a little. */
  wall: ph(2, [[0, power(E2), 8], [8, power(G2), 8], [16, power(A2), 8], [24, power(C3), 8]]),
  /** Tight sixteenth chugs on the low string with accents. */
  chug: ph(2, [
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((i): [number, number[], number, number?] => [i * 2, [E2, E2 + 7], 1, i % 4 === 0 ? 0.95 : 0.7]),
    [16, power(F2), 2], [18, [E2, E2 + 7], 1, 0.7], [19, [E2, E2 + 7], 1, 0.7], [20, power(G2), 2], [22, [E2, E2 + 7], 1, 0.7],
    [24, power(E2 + 6), 4], [28, power(E2 + 5), 4],
  ]),
  /** Fast down-strokes on three chords. */
  downstrokes: ph(2, [
    ...[0, 2, 4, 6, 8, 10, 12, 14].map((st): [number, number[], number, number?] => [st, power(E2), 2, 0.85]),
    ...[16, 18, 20, 22].map((st): [number, number[], number, number?] => [st, power(A2), 2, 0.85]),
    ...[24, 26, 28, 30].map((st): [number, number[], number, number?] => [st, power(B2), 2, 0.85]),
  ]),
  bassRoots: ph(2, [
    [0, [E1], 2], [2, [E1], 2], [4, [E1 + 12], 2], [6, [E1], 2], [8, [G1], 2], [10, [G1], 2], [12, [A1], 2], [14, [B1], 2],
    [16, [C2], 2], [18, [C2], 2], [20, [B1], 2], [22, [A1], 2], [24, [E1], 4], [28, [D2], 2], [30, [B1], 2],
  ]),
  bassEighths: ph(2, [
    ...[0, 2, 4, 6, 8, 10, 12, 14].map((st): [number, number[], number, number?] => [st, [E1], 2, st % 4 === 0 ? 0.9 : 0.75]),
    ...[16, 18, 20, 22].map((st): [number, number[], number, number?] => [st, [A1], 2, 0.85]),
    ...[24, 26, 28, 30].map((st): [number, number[], number, number?] => [st, [B1], 2, 0.85]),
  ]),
  bassWalk: ph(2, [
    [0, [A1], 4], [4, [C2 + 1], 4], [8, [D2], 4], [12, [D2 + 1], 4], [16, [E1 + 12], 4], [20, [D2], 4], [24, [B1], 4], [28, [G1 + 1], 4],
  ]),
} satisfies Record<string, Phrase>;

const melodic = (family: 'guitar' | 'bass', id: string, group: string, title: Text, era: Text, blurb: Text, tempo: number, phrase: Phrase, chain: ChainSpec): Entry => ({
  instrument: `instrument.${id}`, genre: 'rock', family, group, title, era, blurb, tempo, groove: NO_GROOVE, phrase, set: family, chain,
});

/** Amp, cabinet and the rest for each tone, from how studio software models them (research/studio.md, Part C4). */
function guitarAndBass(): Entry[] {
  const g = (id: string, group: string, title: Text, era: Text, blurb: Text, tempo: number, phrase: Phrase, chain: ChainSpec) =>
    melodic('guitar', id, group, title, era, blurb, tempo, phrase, chain);
  const b = (id: string, group: string, title: Text, era: Text, blurb: Text, tempo: number, phrase: Phrase, chain: ChainSpec) =>
    melodic('bass', id, group, title, era, blurb, tempo, phrase, chain);
  return [
    g('guitar-clean-60', 'rock-classic', { en: 'American clean', es: 'Limpio americano' }, { en: '1960s · clean, bright, spring reverb', es: 'Años 60 · limpio, brillante, reverb de resorte' },
      { en: 'A clean amp with lots of headroom, an open-back speaker and a splash of reverb: chords ring and every note is clear.', es: 'Un amplificador limpio con mucho aire, un parlante abierto y un toque de reverb: los acordes suenan y cada nota se escucha clara.' }, 96, PHRASES.cleanArp,
      [['effect.amp', true, { model: 0, gain: 0.3, bass: 2, mid: 2, treble: 2 }], ['effect.cab', true, { model: 0, mic: 0.2 }], ['effect.comp-studio', true, { style: 1, amount: 0.35, mix: 1 }],
        ['effect.tremolo', false], ['effect.reverb', true, { mix: 0.28, size: 2.2 }]]),
    g('guitar-chime-60', 'rock-classic', { en: 'Top boost chime', es: 'Brillo top boost' }, { en: '1960s · chiming, bright, light breakup', es: 'Años 60 · campanero, brillante, apenas saturado' },
      { en: 'A small British amp with its treble boosted: jangly chords that just start to break up when you dig in.', es: 'Un amplificador británico chico con los agudos realzados: acordes campaneros que apenas se ensucian cuando tocas fuerte.' }, 112, PHRASES.cleanArp,
      [['effect.amp', true, { model: 1, gain: 0.3, bass: -3, mid: 4, treble: 5 }], ['effect.cab', true, { model: 1, mic: 0.15 }], ['effect.delay', true, { mix: 0.12, feedback: 0.2 }],
        ['effect.reverb', true, { mix: 0.15, size: 1.6 }]]),
    g('guitar-crunch-70', 'rock-classic', { en: 'British crunch', es: 'Crunch británico' }, { en: '1970s · stack turned up, punchy mids', es: 'Años 70 · cabezal a todo volumen, medios con golpe' },
      { en: 'A British stack pushed until it growls, into a closed 4x12: the classic rock rhythm and solo sound.', es: 'Un cabezal británico empujado hasta que ruge, a un 4x12 cerrado: el sonido clásico de ritmo y solo del rock.' }, 120, PHRASES.rockRiff,
      [['effect.amp', true, { model: 1, gain: 0.6, bass: 2, mid: 3, treble: 2 }], ['effect.cab', true, { model: 2, mic: 0.35 }], ['effect.eq', true, { low: 1, mid: -2, high: 1 }],
        ['effect.reverb', true, { mix: 0.12, size: 1.5 }]]),
    g('guitar-fuzz-90', 'rock-modern', { en: 'Grunge fuzz', es: 'Fuzz grunge' }, { en: '1990s · thick fuzz, a wall of chords', es: 'Años 90 · fuzz grueso, un muro de acordes' },
      { en: 'A fuzz pedal into a crunchy amp: chords turn into a thick, buzzing wall that sustains.', es: 'Un pedal de fuzz a un amplificador con crunch: los acordes se vuelven un muro grueso y zumbante que se sostiene.' }, 116, PHRASES.wall,
      [['effect.drive', true, { amount: 0.85 }], ['effect.amp', true, { model: 1, gain: 0.5, bass: 3, mid: -3, treble: 1 }], ['effect.cab', true, { model: 2, mic: 0.45 }],
        ['effect.reverb', true, { mix: 0.1, size: 1.4 }]]),
    g('guitar-indie-2000', 'rock-modern', { en: 'Indie crunch', es: 'Crunch indie' }, { en: '2000s · small amp, bright and dry', es: 'Años 2000 · amplificador chico, brillante y seco' },
      { en: 'A small amp at the edge of breakup and a bit of tape: bright, scrappy and dry, made for fast strumming.', es: 'Un amplificador chico al borde de saturar y un poco de cinta: brillante, crudo y seco, hecho para rasguear rápido.' }, 130, PHRASES.downstrokes,
      [['effect.amp', true, { model: 1, gain: 0.4, bass: -1, mid: 3, treble: 3 }], ['effect.cab', true, { model: 1, mic: 0.3 }], ['effect.tape', true, { speed: 0, drive: 0.45, mix: 1 }]]),
    g('guitar-hg-80', 'rock-metal', { en: '80s high gain', es: 'Alta ganancia 80' }, { en: '1980s · hot-rodded stack, singing leads', es: 'Años 80 · cabezal modificado, solos que cantan' },
      { en: 'Lots of gain with the mids up: tight chugs for riffs and long notes that sing for solos.', es: 'Mucha ganancia con los medios arriba: golpes apretados para los riffs y notas largas que cantan en los solos.' }, 140, PHRASES.chug,
      [['effect.amp', true, { model: 2, gain: 0.7, bass: 2, mid: 4, treble: 2 }], ['effect.cab', true, { model: 2, mic: 0.3 }], ['effect.delay', true, { mix: 0.1, feedback: 0.25 }]]),
    g('guitar-hg-modern', 'rock-metal', { en: 'Modern high gain', es: 'Alta ganancia moderna' }, { en: '2010s · tight, heavy, scooped', es: 'Años 2010 · apretado, pesado, sin medios' },
      { en: 'A boost to tighten the lows, a modern high gain amp and a 4x12: heavy, precise palm-muted riffs.', es: 'Un realce que aprieta los graves, un amplificador moderno de alta ganancia y un 4x12: riffs pesados y precisos.' }, 150, PHRASES.chug,
      [['effect.preamp', true, { character: 0, drive: 0.4, lowcut: 140 }], ['effect.amp', true, { model: 2, gain: 0.85, bass: 3, mid: -2, treble: 3 }], ['effect.cab', true, { model: 2, mic: 0.25 }],
        ['effect.eq', true, { low: 1, mid: 0, high: -2 }]]),
    g('guitar-punk-77', 'rock-punk', { en: 'Punk 77', es: 'Punk 77' }, { en: '1977 · loud, mid-heavy, raw', es: '1977 · fuerte, con medios, crudo' },
      { en: 'An amp turned all the way up with the mids forward: raw, loud down-strokes with almost nothing added.', es: 'Un amplificador a todo volumen con los medios adelante: rasgueos crudos y fuertes, casi sin nada más.' }, 176, PHRASES.downstrokes,
      [['effect.amp', true, { model: 1, gain: 0.8, bass: 0, mid: 5, treble: 3 }], ['effect.cab', true, { model: 2, mic: 0.3 }]]),
    g('guitar-poppunk-90', 'rock-punk', { en: '90s pop punk', es: 'Pop punk 90' }, { en: '1990s · big, wide, saturated', es: 'Años 90 · grande, ancho, saturado' },
      { en: 'High gain with the mids scooped and the guitar doubled left and right: a big, wide wall for fast songs.', es: 'Alta ganancia con los medios recortados y la guitarra doblada a izquierda y derecha: un muro grande y ancho para canciones rápidas.' }, 190, PHRASES.downstrokes,
      [['effect.amp', true, { model: 2, gain: 0.6, bass: 3, mid: -4, treble: 3 }], ['effect.cab', true, { model: 2, mic: 0.3 }], ['effect.widener', true, { width: 0.7 }]]),

    b('bass-finger-70', 'rock-classic', { en: 'Fingered, warm', es: 'Con dedos, cálido' }, { en: '1970s · round and warm', es: 'Años 70 · redondo y cálido' },
      { en: 'A round tone with the highs rolled off, through a big single speaker: warm lows that sit under the band.', es: 'Un tono redondo con los agudos bajados, por un parlante grande: graves cálidos que se acomodan bajo la banda.' }, 100, PHRASES.bassWalk,
      [['effect.amp', true, { model: 3, gain: 0.25, bass: 2, mid: 1, treble: -4 }], ['effect.cab', true, { model: 4, mic: 0.4 }], ['effect.comp-studio', true, { style: 1, amount: 0.5, mix: 1 }]]),
    b('bass-pick-rock', 'rock-modern', { en: 'Picked rock bass', es: 'Bajo con púa' }, { en: '1990s-2000s · punchy attack, clear', es: 'Años 90 y 2000 · ataque con golpe, claro' },
      { en: 'Played with a pick through a 8x10: a clear attack on every note and a tight low end.', es: 'Tocado con púa por un 8x10: cada nota con un ataque claro y graves apretados.' }, 120, PHRASES.bassRoots,
      [['effect.amp', true, { model: 3, gain: 0.35, bass: 1, mid: 2, treble: 3 }], ['effect.cab', true, { model: 3, mic: 0.25 }], ['effect.comp-studio', true, { style: 0, amount: 0.5, mix: 1 }]]),
    b('bass-drive-90', 'rock-modern', { en: 'Driven 90s bass', es: 'Bajo saturado 90' }, { en: '1990s · growling, distorted', es: 'Años 90 · gruñón, distorsionado' },
      { en: 'The amp pushed into a growl and compressed: a bass you hear as much as you feel.', es: 'El amplificador empujado hasta gruñir y comprimido: un bajo que se escucha tanto como se siente.' }, 116, PHRASES.bassEighths,
      [['effect.drive', true, { amount: 0.4 }], ['effect.amp', true, { model: 3, gain: 0.6, bass: 2, mid: 3, treble: 1 }], ['effect.cab', true, { model: 3, mic: 0.35 }],
        ['effect.comp-studio', true, { style: 2, amount: 0.5, mix: 1 }]]),
    b('bass-metal', 'rock-metal', { en: 'Metal bass', es: 'Bajo metal' }, { en: '2000s-2010s · clanky top, tight lows', es: 'Años 2000 y 2010 · agudos metálicos, graves apretados' },
      { en: 'Bright clank on top and tight lows underneath, so every note cuts through the guitars at speed.', es: 'Agudos metálicos arriba y graves apretados abajo, para que cada nota atraviese las guitarras a toda velocidad.' }, 150, PHRASES.bassEighths,
      [['effect.preamp', true, { character: 0, drive: 0.5, lowcut: 40 }], ['effect.amp', true, { model: 3, gain: 0.5, bass: 2, mid: -3, treble: 5 }], ['effect.cab', true, { model: 3, mic: 0.2 }],
        ['effect.comp-studio', true, { style: 0, amount: 0.6, mix: 1 }]]),
    b('bass-punk', 'rock-punk', { en: 'Punk bass', es: 'Bajo punk' }, { en: '1977 onward · picked, gritty, mid-forward', es: 'Desde 1977 · con púa, áspero, medios adelante' },
      { en: 'Fast eighth notes with a pick, a little grit and the mids forward, locked to the kick.', es: 'Corcheas rápidas con púa, un poco de aspereza y los medios adelante, pegadas al bombo.' }, 176, PHRASES.bassEighths,
      [['effect.amp', true, { model: 3, gain: 0.5, bass: 1, mid: 4, treble: 2 }], ['effect.cab', true, { model: 3, mic: 0.3 }], ['effect.comp-studio', true, { style: 0, amount: 0.5, mix: 1 }]]),
  ];
}

/* ---------------------------------------------------------------- electronic and hip hop */

const Q4 = [0, 4, 8, 12];
const OFF = [2, 6, 10, 14];
const ODD = [1, 3, 5, 7, 9, 11, 13, 15];

/** Grooves on the standard rows: kick, snare, clap, hatClosed, hatOpen, rim, tom, crash. */
const BEATS = {
  house: { bars: 2, swing: 0.56, steps: { kick: twice(Q4), clap: twice([4, 12]), hatOpen: twice(OFF), hatClosed: twice(ODD) }, soft: { hatClosed: twice(ODD) } },
  deephouse: { bars: 2, swing: 0.58, steps: { kick: twice(Q4), rim: twice([3, 10]), hatClosed: twice([...OFF, ...ODD]), clap: [12, 28] },
    soft: { hatClosed: twice(ODD), clap: [12, 28] } },
  techno: { bars: 2, steps: { kick: twice(Q4), hatClosed: twice(S), hatOpen: twice(OFF), clap: twice([4, 12]), rim: twice([7, 13]) },
    soft: { hatClosed: twice([1, 3, 5, 7, 9, 11, 13, 15]) } },
  edm: { bars: 2, steps: { kick: twice(Q4), clap: twice([4, 12]), hatOpen: twice(OFF), snare: [24, 26, 28, 29, 30, 31], crash: [0] }, soft: { snare: [24, 26] } },
  triphop: { bars: 2, swing: 0.6, steps: { kick: [0, 7, 10, 16, 23, 26], snare: [4, 12, 20, 28], hatClosed: twice(E), rim: [15, 31] }, soft: { hatClosed: twice([2, 6, 10, 14]), rim: [15, 31] } },
  idm: { bars: 2, steps: { kick: [0, 3, 9, 16, 22, 25], snare: [4, 13, 20, 27, 30], hatClosed: [0, 1, 2, 5, 6, 8, 11, 12, 14, 17, 18, 21, 24, 26, 29, 31], rim: [7, 15, 23, 28], tom: [30, 31] },
    soft: { hatClosed: [1, 5, 11, 17, 21, 29], snare: [13, 27] } },
  dnb: { bars: 2, steps: { kick: [0, 10, 16, 26, 27], snare: [4, 12, 20, 28], hatClosed: twice(E), snare2: [] }, soft: { hatClosed: twice([2, 6, 10, 14]) } },
  jungle: { bars: 2, steps: { kick: [0, 10, 16, 19, 26], snare: [4, 7, 12, 14, 20, 23, 28, 30], hatClosed: twice(E), rim: [15, 31], hatOpen: [22] },
    soft: { snare: [7, 14, 23, 30], hatClosed: twice([2, 6, 10, 14]) } },
  dubstep: { bars: 2, steps: { kick: [0, 3, 16, 22], snare: [8, 24], hatClosed: twice(E), rim: [14, 30], hatOpen: [30] }, soft: { hatClosed: twice([2, 6, 10, 14]) } },
  ambient: { bars: 2, steps: { kick: [0], rim: [6, 11, 22], hatClosed: [4, 12, 20, 28], crash: [0] }, soft: { hatClosed: [4, 12, 20, 28], rim: [11] } },
  oldschool: { bars: 2, steps: { kick: twice([0, 7, 10]), snare: twice([4, 12]), hatClosed: twice(E), clap: [12, 28] } },
  boombap: { bars: 2, swing: 0.6, steps: { kick: [0, 7, 10, 16, 23, 25], snare: [4, 12, 20, 28], hatClosed: twice(E), rim: [30] }, soft: { hatClosed: twice([2, 6, 10, 14]), kick: [25] } },
  trap: { bars: 2, steps: { kick: [0, 7, 11, 16, 26], snare: [8, 24], hatClosed: [...E, 16, 18, 20, 22, 24, 25, 26, 27, 28, 29, 30, 31], hatOpen: [14] },
    soft: { hatClosed: [25, 27, 29, 31] } },
  lofi: { bars: 2, swing: 0.62, steps: { kick: [0, 10, 16, 26], rim: [4, 12, 20, 28], hatClosed: twice(E) }, soft: { hatClosed: twice([2, 6, 10, 14]) } },
  drill: { bars: 2, steps: { kick: [0, 11, 16, 27], snare: [8, 30], rim: [6, 22, 26], hatClosed: [0, 3, 6, 8, 11, 14, 16, 19, 22, 24, 27, 30], hatOpen: [14] },
    soft: { hatClosed: [3, 11, 19, 27] } },
  westcoast: { bars: 2, swing: 0.55, steps: { kick: [0, 6, 10, 16, 22, 26], snare: [4, 12, 20, 28], clap: [12, 28], hatClosed: twice(S) },
    soft: { hatClosed: twice(ODD) } },
} satisfies Record<string, Groove>;

/** Phrases in A minor for basses (A1 = 33) and synths. */
const P = {
  offbeatBass: ph(2, [[2, [A1 + 12], 2], [6, [A1 + 12], 2], [10, [A1 + 12], 2], [14, [A1 + 15], 2], [18, [A1 + 10], 2], [22, [A1 + 10], 2], [26, [A1 + 12], 2], [30, [A1 + 7], 2]]),
  acid: ph(2, [[0, [A1 + 12], 1], [1, [A1 + 24], 1, 0.9], [3, [A1 + 12], 1], [4, [A1 + 15], 2], [6, [A1 + 12], 1], [7, [A1 + 22], 1, 0.95], [8, [A1 + 12], 1], [10, [A1 + 19], 2],
    [12, [A1 + 12], 1], [13, [A1 + 24], 1, 0.95], [14, [A1 + 17], 2], [16, [A1 + 12], 1], [17, [A1 + 12], 1], [18, [A1 + 24], 2, 0.9], [20, [A1 + 15], 1], [22, [A1 + 12], 2], [24, [A1 + 10], 2], [26, [A1 + 22], 1, 0.95], [28, [A1 + 12], 4]]),
  rollingBass: ph(2, [[0, [A1 + 12], 3], [3, [A1 + 12], 1, 0.7], [6, [A1 + 15], 2], [8, [A1 + 12], 4], [12, [A1 + 10], 4], [16, [A1 + 12], 6], [22, [A1 + 17], 2], [24, [A1 + 15], 4], [28, [A1 + 10], 4]]),
  reese: ph(2, [[0, [A1 + 12], 8], [8, [A1 + 15], 6], [14, [A1 + 10], 2], [16, [A1 + 12], 8], [24, [A1 + 8], 8]]),
  sub: ph(2, [[0, [A1 + 12], 6], [6, [A1 + 12], 2], [10, [A1 + 7], 6], [16, [A1 + 12], 6], [22, [A1 + 15], 2], [26, [A1 + 10], 6]]),
  wobble: ph(2, [[0, [A1 + 12], 8], [8, [A1 + 12], 4], [12, [A1 + 15], 4], [16, [A1 + 10], 8], [24, [A1 + 7], 8]]),
  boom808: ph(2, [[0, [A1 + 12], 7], [7, [A1 + 12], 4], [11, [A1 + 15], 5], [16, [A1 + 12], 10], [26, [A1 + 7], 6]]),
  slide808: ph(2, [[0, [A1 + 12], 6], [5, [A1 + 15], 4], [8, [A1 + 19], 3], [11, [A1 + 17], 5], [16, [A1 + 12], 6], [21, [A1 + 10], 4], [24, [A1 + 12], 8]]),
  walkingUp: ph(2, [[0, [A1], 4], [4, [A1 + 3], 2], [6, [A1 + 5], 2], [8, [A1 + 7], 4], [12, [A1 + 10], 4], [16, [A1 + 5], 4], [20, [A1 + 7], 4], [24, [A1 + 3], 4], [28, [A1 + 2], 4]]),
  funkBass: ph(2, [[0, [A1 + 12], 2], [3, [A1 + 12], 1], [4, [A1 + 24], 1, 0.9], [6, [A1 + 15], 2], [10, [A1 + 12], 2], [12, [A1 + 10], 2], [14, [A1 + 7], 2],
    [16, [A1 + 5 + 12], 3], [19, [A1 + 5 + 12], 1], [22, [A1 + 7 + 12], 2], [24, [A1 + 12], 4], [28, [A1 + 10], 2], [30, [A1 + 7], 2]]),
  stabs: ph(2, [[2, [57, 60, 64, 67], 1], [6, [57, 60, 64, 67], 1], [10, [57, 60, 64, 67], 1], [13, [55, 59, 62, 65], 2], [18, [53, 57, 60, 64], 1], [22, [53, 57, 60, 64], 1], [26, [55, 59, 62, 65], 1], [29, [55, 59, 62, 65], 2]]),
  dubChord: ph(2, [[0, [57, 60, 64], 2], [6, [57, 60, 64], 2], [16, [55, 58, 62], 2], [22, [55, 58, 62], 2]]),
  ninths: ph(2, [[0, [57, 60, 64, 67, 71], 14], [16, [53, 57, 60, 64, 67], 14]]),
  supersaw: ph(2, [[0, [69, 72, 76], 6], [6, [67, 71, 74], 2], [8, [65, 69, 72], 8], [16, [64, 67, 71], 6], [22, [62, 65, 69], 2], [24, [64, 67, 71], 8]]),
  padLong: ph(2, [[0, [57, 60, 64, 71], 16], [16, [53, 57, 60, 67], 16]]),
  bells: ph(2, [[0, [76], 2], [3, [79], 2], [6, [74], 2], [8, [72], 4], [12, [71], 2], [16, [76], 2], [19, [72], 2], [22, [69], 6], [28, [71], 4]]),
  keysJazz: ph(2, [[0, [57, 60, 64, 67], 6], [7, [55, 59, 62, 65], 5], [12, [57, 60, 64, 67], 4], [16, [53, 57, 60, 64], 6], [23, [52, 56, 59, 62], 9]]),
  darkPiano: ph(2, [[0, [57, 60, 64], 4], [6, [69], 2], [8, [68], 4], [12, [64], 4], [16, [53, 57, 60], 4], [22, [65], 2], [24, [64], 4], [28, [60], 4]]),
  whine: ph(2, [[0, [81], 6], [6, [84], 2], [8, [83], 4], [12, [81], 4], [16, [79], 8], [24, [76], 4], [28, [79], 4]]),
  electro: ph(2, [[0, [57, 64], 1], [3, [57, 64], 1], [6, [60, 67], 2], [10, [57, 64], 1], [12, [55, 62], 2], [16, [57, 64], 1], [19, [57, 64], 1], [22, [62, 69], 2], [26, [60, 67], 2], [30, [55, 62], 2]]),
} satisfies Record<string, Phrase>;

const kit = (genre: Genre, id: string, title: Text, era: Text, blurb: Text, tempo: number, groove: Groove): Entry => ({
  instrument: `instrument.drums-${id}`, genre, family: 'drums', group: id, title, era, blurb, tempo, groove, rows: 'standard',
});
const syn = (genre: Genre, family: 'bass' | 'synth', group: string, id: string, voice: string, low: number, title: Text, era: Text, blurb: Text,
  tempo: number, phrase: Phrase, chain: ChainSpec): Entry => ({
  instrument: `instrument.${id}`, genre, family, group, title, era, blurb, tempo, groove: NO_GROOVE, phrase, voice, low, chain,
});

function beatsEntries(): Entry[] {
  const E_ = 'electronic' as const;
  const H = 'hiphop' as const;
  return [
    /* House */
    kit(E_, 'el-house', { en: 'House machine', es: 'Caja de ritmos house' }, { en: 'Late 1980s onward · four on the floor, 124 BPM', es: 'Desde fines de los 80 · cuatro en el piso, 124 BPM' },
      { en: 'An analog drum machine: a round kick on every beat, a clap on 2 and 4, open hats on the off-beats with a little swing.', es: 'Una caja de ritmos análoga: un bombo redondo en cada tiempo, palmas en 2 y 4, hi-hats abiertos a contratiempo con un poco de swing.' }, 124, BEATS.house),
    syn(E_, 'bass', 'el-house', 'syn-house-bass', 'organBass', 36, { en: 'Off-beat organ bass', es: 'Bajo de órgano a contratiempo' }, { en: 'House · bouncy, between the kicks', es: 'House · saltarín, entre los bombos' },
      { en: 'A short organ-like bass that answers the kick on every off-beat.', es: 'Un bajo corto como de órgano que le responde al bombo en cada contratiempo.' }, 124, P.offbeatBass,
      [['effect.comp-studio', true, { style: 0, amount: 0.4, mix: 1 }], ['effect.pump', true, { depth: 0.35, release: 0.5 }]]),
    syn(E_, 'synth', 'el-house', 'syn-house-stab', 'stab', 55, { en: 'Chord stabs', es: 'Acordes cortos (stabs)' }, { en: 'House · seventh chords on the off-beat', es: 'House · acordes de séptima a contratiempo' },
      { en: 'Short, bright seventh chords on the off-beats, with an echo and a room.', es: 'Acordes de séptima cortos y brillantes a contratiempo, con eco y sala.' }, 124, P.stabs,
      [['effect.delay', true, { mix: 0.18, feedback: 0.3 }], ['effect.reverb', true, { mix: 0.22, size: 1.8 }]]),
    /* Deep house */
    kit(E_, 'el-deephouse', { en: 'Deep house machine', es: 'Caja de ritmos deep house' }, { en: '1990s onward · round, swung, warm', es: 'Desde los 90 · redondo, con swing, cálido' },
      { en: 'A softer, rounder kick, rim shots and swung hats, warmed up and rounded off like an old tape.', es: 'Un bombo más suave y redondo, golpes de aro y hi-hats con swing, entibiados como una cinta antigua.' }, 120, BEATS.deephouse),
    syn(E_, 'bass', 'el-deephouse', 'syn-deephouse-bass', 'sub', 33, { en: 'Warm sub', es: 'Sub cálido' }, { en: 'Deep house · deep and rounded', es: 'Deep house · profundo y redondo' },
      { en: 'A deep, round bass with a touch of tape, felt more than heard.', es: 'Un bajo profundo y redondo con un toque de cinta, que se siente más de lo que se escucha.' }, 120, P.sub,
      [['effect.tape', true, { speed: 0, drive: 0.4, mix: 1 }]]),
    syn(E_, 'synth', 'el-deephouse', 'syn-deephouse-keys', 'keysEp', 55, { en: 'Electric piano ninths', es: 'Piano eléctrico en novenas' }, { en: 'Deep house · minor 7ths and 9ths', es: 'Deep house · séptimas y novenas menores' },
      { en: 'An electric piano playing long minor ninth chords through chorus and tape.', es: 'Un piano eléctrico tocando acordes largos de novena menor con chorus y cinta.' }, 120, P.ninths,
      [['effect.chorus', true, { mix: 0.35, rate: 0.8, depth: 0.5 }], ['effect.tape', true, { speed: 0, drive: 0.35, mix: 1 }], ['effect.reverb', true, { mix: 0.2, size: 2 }]]),
    /* Techno */
    kit(E_, 'el-techno', { en: 'Techno machine', es: 'Caja de ritmos techno' }, { en: '1990s onward · heavy kick and rumble, 130 BPM', es: 'Desde los 90 · bombo pesado con retumbe, 130 BPM' },
      { en: 'A long, saturated kick with a dark rumble behind it and metallic sixteenth hats that drive.', es: 'Un bombo largo y saturado con un retumbe oscuro detrás y hi-hats metálicos en semicorcheas que empujan.' }, 130, BEATS.techno),
    syn(E_, 'bass', 'el-techno', 'syn-acid', 'acid', 36, { en: 'Acid line', es: 'Línea acid' }, { en: 'Acid house and techno · squelchy, gliding', es: 'Acid house y techno · chirriante, deslizante' },
      { en: 'A saw through a resonant filter that snaps shut, sliding between notes, a bit of drive and an echo.', es: 'Una onda de sierra por un filtro resonante que se cierra de golpe, deslizándose entre notas, con algo de saturación y un eco.' }, 130, P.acid,
      [['effect.drive', true, { amount: 0.35 }], ['effect.delay', true, { mix: 0.15, feedback: 0.35 }]]),
    syn(E_, 'synth', 'el-techno', 'syn-dubchord', 'stab', 48, { en: 'Dub chord', es: 'Acorde dub' }, { en: 'Dub techno · a chord lost in echoes', es: 'Dub techno · un acorde perdido en ecos' },
      { en: 'One minor chord sent into long, filtered echoes that keep repeating.', es: 'Un acorde menor mandado a ecos largos y filtrados que se siguen repitiendo.' }, 124, P.dubChord,
      [['effect.filter-sweep', true, { mix: 1, rate: 0.12, depth: 0.5 }], ['effect.delay', true, { mix: 0.45, feedback: 0.6 }], ['effect.reverb', true, { mix: 0.25, size: 3 }]]),
    /* Dance / EDM */
    kit(E_, 'el-edm', { en: 'Big room EDM', es: 'EDM de estadio' }, { en: '2010s · layered kick, stacked claps, 128 BPM', es: 'Años 2010 · bombo en capas, palmas apiladas, 128 BPM' },
      { en: 'A punchy kick with a sub under it, stacked claps in a big room, snare rolls for the build.', es: 'Un bombo con golpe y un sub debajo, palmas apiladas en una sala grande, redobles de caja para la subida.' }, 128, BEATS.edm),
    syn(E_, 'bass', 'el-edm', 'syn-edm-bass', 'bassSynth', 36, { en: 'Pumping bass', es: 'Bajo que bombea' }, { en: 'EDM · sidechained to the kick', es: 'EDM · con sidechain al bombo' },
      { en: 'A synth bass that ducks on every kick and swells back.', es: 'Un bajo sintetizado que baja en cada bombo y vuelve a subir.' }, 128, P.offbeatBass,
      [['effect.drive', true, { amount: 0.25 }], ['effect.pump', true, { depth: 0.7, release: 0.6 }]]),
    syn(E_, 'synth', 'el-edm', 'syn-supersaw', 'padSupersaw', 55, { en: 'Supersaw', es: 'Supersaw' }, { en: 'EDM · huge stacked saws', es: 'EDM · sierras enormes apiladas' },
      { en: 'Many detuned saws stacked into one wide chord, pumping with the kick in a big reverb.', es: 'Muchas sierras desafinadas apiladas en un acorde ancho, bombeando con el bombo en una reverb grande.' }, 128, P.supersaw,
      [['effect.pump', true, { depth: 0.6, release: 0.6 }], ['effect.widener', true, { width: 0.8 }], ['effect.reverb', true, { mix: 0.3, size: 3 }]]),
    /* Downtempo and trip hop */
    kit(E_, 'el-triphop', { en: 'Dusty trip hop break', es: 'Break polvoriento trip hop' }, { en: 'Mid 1990s · slow, heavy, through an old sampler', es: 'Mediados de los 90 · lento, pesado, por un sampler antiguo' },
      { en: 'A heavy, slow break played on a vintage kit and squeezed through a 12-bit sampler and tape.', es: 'Un break lento y pesado tocado en un kit antiguo y pasado por un sampler de 12 bits y cinta.' }, 88, BEATS.triphop),
    syn(E_, 'bass', 'el-triphop', 'syn-triphop-bass', 'bassUpright', 36, { en: 'Upright through tape', es: 'Contrabajo por cinta' }, { en: 'Trip hop · deep and dark', es: 'Trip hop · profundo y oscuro' },
      { en: 'A deep upright bass, darkened and saturated on tape.', es: 'Un contrabajo profundo, oscurecido y saturado en cinta.' }, 88, P.walkingUp,
      [['effect.tape', true, { speed: 0, drive: 0.6, mix: 1 }], ['effect.eq', true, { low: 2, mid: 0, high: -6 }]]),
    syn(E_, 'synth', 'el-triphop', 'syn-triphop-strings', 'strings', 55, { en: 'Cinematic strings', es: 'Cuerdas de película' }, { en: 'Trip hop · orchestral, lo-fi', es: 'Trip hop · orquestal, lo-fi' },
      { en: 'Slow string chords as if sampled from an old record: fewer bits, tape and a big room.', es: 'Acordes lentos de cuerdas como sampleados de un disco antiguo: menos bits, cinta y una sala grande.' }, 88, P.padLong,
      [['effect.lofi', true, { mix: 0.6, bits: 10, tone: 4500 }], ['effect.tape', true, { speed: 0, drive: 0.4, mix: 1 }], ['effect.reverb', true, { mix: 0.3, size: 3.5 }]]),
    /* IDM */
    kit(E_, 'el-idm', { en: 'Glitch kit', es: 'Kit glitch' }, { en: '1990s-2000s · broken, crunchy, detailed', es: 'Años 90 y 2000 · roto, crujiente, detallado' },
      { en: 'Tiny electronic hits crushed to few bits and placed in broken, unexpected patterns.', es: 'Pequeños golpes electrónicos triturados a pocos bits y ubicados en patrones rotos e inesperados.' }, 110, BEATS.idm),
    syn(E_, 'bass', 'el-idm', 'syn-idm-bass', 'fmBass', 36, { en: 'Rubbery FM bass', es: 'Bajo FM elástico' }, { en: 'IDM · metallic and bouncy', es: 'IDM · metálico y saltarín' },
      { en: 'An FM bass with a metallic, rubbery edge, slightly crushed.', es: 'Un bajo FM con un borde metálico y elástico, un poco triturado.' }, 110, P.rollingBass,
      [['effect.lofi', true, { mix: 0.5, bits: 8, tone: 6000 }]]),
    syn(E_, 'synth', 'el-idm', 'syn-idm-bells', 'bellsFm', 60, { en: 'Glass bells', es: 'Campanas de vidrio' }, { en: 'IDM · cold, detailed, bouncing echoes', es: 'IDM · frío, detallado, ecos que rebotan' },
      { en: 'Bright FM bells bouncing left and right in echoes.', es: 'Campanas FM brillantes rebotando de izquierda a derecha en ecos.' }, 110, P.bells,
      [['effect.pingpong', true, { mix: 0.4, feedback: 0.45 }], ['effect.reverb', true, { mix: 0.25, size: 2.5 }]]),
    /* Drum and bass */
    kit(E_, 'el-dnb', { en: 'Drum and bass break', es: 'Break drum and bass' }, { en: '1990s onward · tight, bright, 174 BPM', es: 'Desde los 90 · apretado, brillante, 174 BPM' },
      { en: 'A tight acoustic break at 174: a snare tuned up and cracking, a sub under the kick.', es: 'Un break acústico apretado a 174: una caja afinada arriba que revienta, un sub bajo el bombo.' }, 174, BEATS.dnb),
    syn(E_, 'bass', 'el-dnb', 'syn-reese', 'reese', 33, { en: 'Reese bass', es: 'Bajo reese' }, { en: 'Drum and bass · growling, detuned', es: 'Drum and bass · gruñón, desafinado' },
      { en: 'Detuned saws beating against each other into a low growl, with a bit of drive.', es: 'Sierras desafinadas que chocan entre sí en un gruñido grave, con algo de saturación.' }, 174, P.reese,
      [['effect.drive', true, { amount: 0.3 }], ['effect.chorus', true, { mix: 0.25, rate: 0.3, depth: 0.6 }]]),
    syn(E_, 'synth', 'el-dnb', 'syn-liquid-pad', 'padWarm', 55, { en: 'Liquid pad', es: 'Pad liquid' }, { en: 'Liquid drum and bass · warm, jazzy chords', es: 'Liquid drum and bass · acordes cálidos y jazzeros' },
      { en: 'Warm, wide pad chords that float above the fast drums.', es: 'Acordes de pad cálidos y anchos que flotan sobre la batería rápida.' }, 174, P.ninths,
      [['effect.chorus', true, { mix: 0.3, rate: 0.5, depth: 0.6 }], ['effect.reverb', true, { mix: 0.3, size: 3 }]]),
    /* Jungle */
    kit(E_, 'el-jungle', { en: 'Jungle break', es: 'Break jungle' }, { en: 'Early 1990s · sped-up break, 12-bit crunch', es: 'Comienzos de los 90 · break acelerado, crujido de 12 bits' },
      { en: 'An old break sped up and crunched in a 12-bit sampler, all pitched up, chopped into rolls.', es: 'Un break antiguo acelerado y triturado en un sampler de 12 bits, todo afinado hacia arriba, cortado en redobles.' }, 168, BEATS.jungle),
    syn(E_, 'bass', 'el-jungle', 'syn-jungle-sub', 'sub', 28, { en: 'Rolling sub', es: 'Sub rodante' }, { en: 'Jungle · deep sub, dub style', es: 'Jungle · sub profundo, estilo dub' },
      { en: 'A deep sine sub that rolls under the break, dub style.', es: 'Un sub sinusoidal profundo que rueda bajo el break, estilo dub.' }, 168, P.sub, []),
    syn(E_, 'synth', 'el-jungle', 'syn-jungle-pad', 'strings', 55, { en: 'Dub strings', es: 'Cuerdas dub' }, { en: 'Jungle · strings with long echoes', es: 'Jungle · cuerdas con ecos largos' },
      { en: 'String chords thrown into long echoes and a big reverb.', es: 'Acordes de cuerdas lanzados a ecos largos y una reverb grande.' }, 168, P.padLong,
      [['effect.delay', true, { mix: 0.3, feedback: 0.5 }], ['effect.reverb', true, { mix: 0.3, size: 3.5 }]]),
    /* Dubstep */
    kit(E_, 'el-dubstep', { en: 'Half-time dubstep', es: 'Dubstep a medio tiempo' }, { en: 'Late 2000s · half time, 140 BPM', es: 'Fines de los 2000 · medio tiempo, 140 BPM' },
      { en: 'Kick on 1 and a huge snare on 3, with sparse hats and lots of space.', es: 'Bombo en el 1 y una caja enorme en el 3, con pocos hi-hats y mucho espacio.' }, 140, BEATS.dubstep),
    syn(E_, 'bass', 'el-dubstep', 'syn-wobble', 'wobble', 33, { en: 'Wobble bass', es: 'Bajo wobble' }, { en: 'Dubstep · a filter that wobbles', es: 'Dubstep · un filtro que tambalea' },
      { en: 'A thick bass whose filter opens and closes in time, with drive for growl.', es: 'Un bajo grueso cuyo filtro se abre y se cierra a tiempo, con saturación para que gruña.' }, 140, P.wobble,
      [['effect.filter-sweep', true, { mix: 1, rate: 4.67, depth: 0.8 }], ['effect.drive', true, { amount: 0.4 }]]),
    syn(E_, 'synth', 'el-dubstep', 'syn-dark-pad', 'drone', 48, { en: 'Dark pad', es: 'Pad oscuro' }, { en: 'Dubstep · dark and wide', es: 'Dubstep · oscuro y ancho' },
      { en: 'A slow, dark pad that fills the space between the drums.', es: 'Un pad lento y oscuro que llena el espacio entre la batería.' }, 140, P.padLong,
      [['effect.reverb', true, { mix: 0.35, size: 4 }]]),
    /* Ambient */
    kit(E_, 'el-ambient', { en: 'Soft ambient kit', es: 'Kit ambient suave' }, { en: 'Any era · sparse, distant', es: 'Cualquier época · escaso, lejano' },
      { en: 'Soft, sparse sounds far away in a very long room. Optional: ambient often has no drums at all.', es: 'Sonidos suaves y escasos, lejos en una sala muy larga. Opcional: el ambient muchas veces no lleva batería.' }, 70, BEATS.ambient),
    syn(E_, 'synth', 'el-ambient', 'syn-drone', 'drone', 45, { en: 'Evolving drone', es: 'Drone que evoluciona' }, { en: 'Ambient · slow, endless', es: 'Ambient · lento, sin fin' },
      { en: 'A wide pad that blooms slowly and moves inside a huge reverb.', es: 'Un pad ancho que se abre lentamente y se mueve dentro de una reverb enorme.' }, 70, P.padLong,
      [['effect.chorus', true, { mix: 0.3, rate: 0.2, depth: 0.8 }], ['effect.reverb', true, { mix: 0.5, size: 8 }]]),
    syn(E_, 'synth', 'el-ambient', 'syn-ambient-bells', 'bellsFm', 60, { en: 'Bells in the distance', es: 'Campanas a lo lejos' }, { en: 'Ambient · echoes and space', es: 'Ambient · ecos y espacio' },
      { en: 'Soft bells that echo into a long room.', es: 'Campanas suaves que hacen eco en una sala larga.' }, 70, P.bells,
      [['effect.delay', true, { mix: 0.35, feedback: 0.55 }], ['effect.reverb', true, { mix: 0.45, size: 6 }]]),

    /* Old school */
    kit(H, 'hh-oldschool', { en: 'Old school machine', es: 'Caja de ritmos old school' }, { en: '1979-1986 · analog machine, dry and punchy', es: '1979 a 1986 · máquina análoga, seca y con golpe' },
      { en: 'The analog drum machine of early hip hop and electro: booming kick, snappy snare, crisp hats.', es: 'La caja de ritmos análoga del primer hip hop y el electro: bombo retumbante, caja chasqueante, hi-hats nítidos.' }, 110, BEATS.oldschool),
    syn(H, 'bass', 'hh-oldschool', 'syn-electro-bass', 'bassSynth', 36, { en: 'Electro bass', es: 'Bajo electro' }, { en: 'Old school · tight synth bass', es: 'Old school · bajo sintetizado apretado' },
      { en: 'A short, punchy synth bass locked to the kick.', es: 'Un bajo sintetizado corto y con golpe, pegado al bombo.' }, 110, P.funkBass, []),
    syn(H, 'synth', 'hh-oldschool', 'syn-electro-stab', 'stab', 55, { en: 'Electro stabs', es: 'Golpes electro' }, { en: 'Old school · bright synth hits', es: 'Old school · golpes de sinte brillantes' },
      { en: 'Bright synth hits with a short echo, straight from the early electro records.', es: 'Golpes de sinte brillantes con un eco corto, como los primeros discos de electro.' }, 110, P.electro,
      [['effect.delay', true, { mix: 0.15, feedback: 0.25 }]]),
    /* Boom bap */
    kit(H, 'hh-boombap', { en: 'Boom bap sampler', es: 'Sampler boom bap' }, { en: '1988-1996 · 12-bit sampler, 90 BPM', es: '1988 a 1996 · sampler de 12 bits, 90 BPM' },
      { en: 'A dusty kit chopped into a 12-bit sampler: a low boom kick, a cracking bap snare, swung hats.', es: 'Un kit polvoriento cortado en un sampler de 12 bits: un bombo grave (boom), una caja que revienta (bap), hi-hats con swing.' }, 90, BEATS.boombap),
    syn(H, 'bass', 'hh-boombap', 'syn-boombap-bass', 'bassUpright', 36, { en: 'Filtered upright', es: 'Contrabajo filtrado' }, { en: 'Boom bap · jazzy, filtered', es: 'Boom bap · jazzero, filtrado' },
      { en: 'An upright bass line darkened as if sampled from a jazz record.', es: 'Una línea de contrabajo oscurecida como sampleada de un disco de jazz.' }, 90, P.walkingUp,
      [['effect.eq', true, { low: 3, mid: 0, high: -8 }], ['effect.lofi', true, { mix: 0.5, bits: 12, tone: 3000 }]]),
    syn(H, 'synth', 'hh-boombap', 'syn-boombap-keys', 'keysEp', 55, { en: 'Dusty electric piano', es: 'Piano eléctrico polvoriento' }, { en: 'Boom bap · jazzy chords, sampled feel', es: 'Boom bap · acordes jazzeros, sonido sampleado' },
      { en: 'Jazz chords on an electric piano through fewer bits and tape, like an old record chopped into the sampler.', es: 'Acordes de jazz en piano eléctrico con menos bits y cinta, como un disco viejo cortado en el sampler.' }, 90, P.keysJazz,
      [['effect.lofi', true, { mix: 0.6, bits: 12, tone: 4000 }], ['effect.tape', true, { speed: 0, drive: 0.4, mix: 1 }]]),
    /* Trap */
    kit(H, 'hh-trap', { en: 'Trap kit', es: 'Kit trap' }, { en: '2010s · long 808, hat rolls, 140 BPM half time', es: 'Años 2010 · 808 largo, redobles de hi-hat, 140 BPM a medio tiempo' },
      { en: 'A long tuned 808 boom, a snappy clap-snare on 3 and fast hi-hat rolls.', es: 'Un 808 largo y afinado, una caja con palmas en el 3 y redobles rápidos de hi-hat.' }, 140, BEATS.trap),
    syn(H, 'bass', 'hh-trap', 'syn-808', 'bass808long', 28, { en: 'Tuned 808', es: '808 afinado' }, { en: 'Trap · long, booming, distorted', es: 'Trap · largo, retumbante, saturado' },
      { en: 'The 808 as a bass: a long boom tuned to the song, pushed into a little distortion so phones hear it.', es: 'El 808 como bajo: un retumbe largo afinado a la canción, empujado a un poco de distorsión para que se escuche en un celular.' }, 140, P.boom808,
      [['effect.drive', true, { amount: 0.35 }]]),
    syn(H, 'synth', 'hh-trap', 'syn-trap-bells', 'bellsFm', 60, { en: 'Dark bells', es: 'Campanas oscuras' }, { en: 'Trap · bell melody in a reverb', es: 'Trap · melodía de campanas en una reverb' },
      { en: 'A simple bell melody in a minor key with reverb.', es: 'Una melodía simple de campanas en tonalidad menor, con reverb.' }, 140, P.bells,
      [['effect.reverb', true, { mix: 0.3, size: 2.5 }]]),
    /* Lo-fi */
    kit(H, 'hh-lofi', { en: 'Lo-fi kit', es: 'Kit lo-fi' }, { en: '2010s · soft, swung, worn, 80 BPM', es: 'Años 2010 · suave, con swing, gastado, 80 BPM' },
      { en: 'Soft kicks, side-stick instead of a snare, very swung hats, all worn down by tape and a dark filter.', es: 'Bombos suaves, aro en vez de caja, hi-hats con mucho swing, todo gastado por cinta y un filtro oscuro.' }, 80, BEATS.lofi),
    syn(H, 'bass', 'hh-lofi', 'syn-lofi-bass', 'sub', 33, { en: 'Warm round bass', es: 'Bajo redondo y cálido' }, { en: 'Lo-fi · soft and warm', es: 'Lo-fi · suave y cálido' },
      { en: 'A soft, warm bass with tape on it.', es: 'Un bajo suave y cálido con cinta.' }, 80, P.walkingUp,
      [['effect.tape', true, { speed: 0, drive: 0.5, mix: 1 }]]),
    syn(H, 'synth', 'hh-lofi', 'syn-lofi-keys', 'keysEp', 55, { en: 'Lo-fi keys', es: 'Teclado lo-fi' }, { en: 'Lo-fi · seventh chords, wobbly tape', es: 'Lo-fi · acordes de séptima, cinta que ondula' },
      { en: 'Seventh and ninth chords on an electric piano, worn down by bits, tape and a slow tremble.', es: 'Acordes de séptima y novena en piano eléctrico, gastados por bits, cinta y un temblor lento.' }, 80, P.keysJazz,
      [['effect.lofi', true, { mix: 0.7, bits: 10, tone: 3200 }], ['effect.tape', true, { speed: 0, drive: 0.5, mix: 1 }], ['effect.chorus', true, { mix: 0.25, rate: 0.4, depth: 0.5 }]]),
    /* Drill */
    kit(H, 'hh-drill', { en: 'Drill kit', es: 'Kit drill' }, { en: '2010s · off-beat snares, sliding 808, 142 BPM', es: 'Años 2010 · cajas desplazadas, 808 deslizante, 142 BPM' },
      { en: 'Snares and rims placed slightly off the beat, sparse hats and a short kick that leaves room for the 808.', es: 'Cajas y aros ubicados un poco fuera del tiempo, pocos hi-hats y un bombo corto que deja espacio al 808.' }, 142, BEATS.drill),
    syn(H, 'bass', 'hh-drill', 'syn-808-slide', 'bass808slide', 28, { en: 'Sliding 808', es: '808 deslizante' }, { en: 'Drill · the 808 slides between notes', es: 'Drill · el 808 se desliza entre notas' },
      { en: 'An 808 that glides from note to note: the melodic center of drill.', es: 'Un 808 que se desliza de nota en nota: el centro melódico del drill.' }, 142, P.slide808,
      [['effect.drive', true, { amount: 0.3 }]]),
    syn(H, 'synth', 'hh-drill', 'syn-drill-piano', 'keysPiano', 48, { en: 'Dark piano', es: 'Piano oscuro' }, { en: 'Drill · minimal minor piano', es: 'Drill · piano menor minimalista' },
      { en: 'A sparse, dark piano line in a minor key.', es: 'Una línea de piano escasa y oscura en tonalidad menor.' }, 142, P.darkPiano,
      [['effect.reverb', true, { mix: 0.3, size: 2.5 }]]),
    /* West coast */
    kit(H, 'hh-westcoast', { en: 'West coast machine', es: 'Caja de ritmos west coast' }, { en: 'Early 1990s · laid-back, heavy snare', es: 'Comienzos de los 90 · relajado, caja pesada' },
      { en: 'A drum machine with a heavy snare in reverb and a relaxed groove.', es: 'Una caja de ritmos con una caja pesada en reverb y un groove relajado.' }, 94, BEATS.westcoast),
    syn(H, 'bass', 'hh-westcoast', 'syn-gfunk-bass', 'bassSynth', 33, { en: 'Deep synth bass', es: 'Bajo sintetizado profundo' }, { en: 'West coast · deep and funky', es: 'West coast · profundo y funky' },
      { en: 'A deep, round synth bass playing a funky line.', es: 'Un bajo sintetizado profundo y redondo tocando una línea funky.' }, 94, P.funkBass,
      [['effect.eq', true, { low: 3, mid: 0, high: -4 }]]),
    syn(H, 'synth', 'hh-westcoast', 'syn-whine', 'whine', 60, { en: 'High whine lead', es: 'Lead agudo deslizante' }, { en: 'West coast · gliding high saw', es: 'West coast · sierra aguda que se desliza' },
      { en: 'A high saw lead that slides between notes with a slow vibrato and chorus.', es: 'Un lead agudo de sierra que se desliza entre notas con vibrato lento y chorus.' }, 94, P.whine,
      [['effect.chorus', true, { mix: 0.35, rate: 0.6, depth: 0.5 }], ['effect.reverb', true, { mix: 0.2, size: 2 }]]),
  ];
}

export const ENTRIES: Entry[] = [...DRUM_ENTRIES, ...guitarAndBass(), ...beatsEntries()];

/** Loudness trims (dB) for the guitars and basses through their gear, measured so each plays at the app's level. */
export const TRIMS: Record<string, number> = {
  'instrument.bass-di': 2.7,
  'instrument.bass-drive-90': -5.2,
  'instrument.bass-finger-70': -0.2,
  'instrument.bass-metal': -1.5,
  'instrument.bass-pick-rock': -0.8,
  'instrument.bass-punk': -0.9,
  'instrument.guitar-chime-60': -1.9,
  'instrument.guitar-clean-60': -0.7,
  'instrument.guitar-crunch-70': -3.4,
  'instrument.guitar-di': 0.1,
  'instrument.guitar-fuzz-90': -5.1,
  'instrument.guitar-hg-80': -3.2,
  'instrument.guitar-hg-modern': -2.1,
  'instrument.guitar-indie-2000': -3.4,
  'instrument.guitar-poppunk-90': -1.1,
  'instrument.guitar-punk-77': -2.7,
  'instrument.syn-808': -4,
  'instrument.syn-808-slide': -3.4,
  'instrument.syn-acid': -3,
  'instrument.syn-ambient-bells': 2,
  'instrument.syn-boombap-bass': -6.8,
  'instrument.syn-boombap-keys': -3.1,
  'instrument.syn-dark-pad': 6,
  'instrument.syn-deephouse-bass': -0.7,
  'instrument.syn-deephouse-keys': 0,
  'instrument.syn-drill-piano': 0.1,
  'instrument.syn-drone': 6,
  'instrument.syn-dubchord': 6,
  'instrument.syn-edm-bass': -4,
  'instrument.syn-electro-bass': -1,
  'instrument.syn-electro-stab': 6,
  'instrument.syn-gfunk-bass': -3.8,
  'instrument.syn-house-bass': -1.4,
  'instrument.syn-house-stab': 6,
  'instrument.syn-idm-bass': -1.6,
  'instrument.syn-idm-bells': 0.5,
  'instrument.syn-jungle-pad': 0.3,
  'instrument.syn-jungle-sub': 2,
  'instrument.syn-liquid-pad': 1,
  'instrument.syn-lofi-bass': -0.8,
  'instrument.syn-lofi-keys': -2.4,
  'instrument.syn-reese': -1.7,
  'instrument.syn-supersaw': 1,
  'instrument.syn-trap-bells': 1.8,
  'instrument.syn-triphop-bass': -2.2,
  'instrument.syn-triphop-strings': -1.9,
  'instrument.syn-whine': -0.8,
  'instrument.syn-wobble': -3.6,
};

/* ---------------------------------------------------------------- credits */

/** The recorded libraries behind the Colección. Kits were edited, mixed and processed in the studio; guitar and bass are heard through modelled gear. */
export const SOURCES: { name: string; by: string; license: string; url: string }[] = [
  { name: 'SM Drums', by: 'Scott McLean, Tod Stillwell, Suleiman Ali', license: 'Public domain (free use)', url: 'https://github.com/sfzinstruments/SMDrums' },
  { name: 'Big Rusty Drums', by: 'Karoryfer Samples', license: 'CC0 1.0', url: 'https://github.com/sfzinstruments/karoryfer.big-rusty-drums' },
  { name: 'MuldjordKit', by: 'Lars Muldjord / DrumGizmo', license: 'CC BY 4.0', url: 'https://github.com/sfzinstruments/DrumGizmo.MuldjordKit' },
  { name: 'DRSKit', by: 'DrumGizmo (Lars Muldjord, Bent Bisballe Nyeng) and Jes Eiler / DRSDrums', license: 'CC BY 4.0', url: 'https://github.com/sfzinstruments/DrumGizmo.DRSKit' },
  { name: 'Gogodze Phu Vol II', by: 'Karoryfer Samples', license: 'CC0 1.0', url: 'https://github.com/sfzinstruments/karoryfer.gogodze-phu-vol-ii' },
  { name: 'TR-707 samples', by: 'Francois Dion (packaged by fluid-music)', license: 'Public domain', url: 'https://www.npmjs.com/package/@fluid-music/tr-707' },
  { name: 'Analog-style drum machines', by: 'Music Studio (original synthesis)', license: 'Original', url: 'https://github.com/ocd-race-labs/music-studio/tree/main/tools/collection' },
  { name: 'Emilyguitar', by: 'Karoryfer Samples', license: 'CC0 1.0', url: 'https://github.com/sfzinstruments/karoryfer.emilyguitar' },
  { name: 'Growlybass', by: 'Karoryfer Samples', license: 'CC0 1.0', url: 'https://github.com/sfzinstruments/karoryfer.growlybass' },
];

/* ---------------------------------------------------------------- lookups */

/** The recorded kit behind each Colección drum instrument (pieces, layers, loudness trim). */
export const SAMPLED_KITS: Record<string, SampledKitSpec> = DRUM_SPECS as Record<string, SampledKitSpec>;
/** The recorded guitar and bass (direct, no amp) behind the Colección's guitars and basses. */
export const SAMPLERS: Record<string, SamplerSpec> = STRING_SPECS as Record<string, SamplerSpec>;

export const entryOf = (instrumentKey: string): Entry | undefined => ENTRIES.find((e) => e.instrument === instrumentKey);
export const entriesIn = (genre: Genre, family: Family, group: string): Entry[] =>
  ENTRIES.filter((e) => e.genre === genre && e.family === family && e.group === group);
export const familiesIn = (genre: Genre): Family[] => FAMILIES.map((f) => f.id).filter((f) => ENTRIES.some((e) => e.genre === genre && e.family === f));
export const groupsIn = (genre: Genre, family: Family): Group[] => GROUPS.filter((g) => g.genre === genre && ENTRIES.some((e) => e.group === g.id && e.family === family));
export const textOf = (t: Text, lang: Lang): string => t[lang];
