// The Colección: instrument sounds by genre, in the producer's room. Each entry is a catalog instrument with a
// place (genre, family, group), a short description of the sound and a groove to hear it in context.
// Sounds are named by style and era, never by bands, drummers or brands.

import type { Lang } from '../domain/types';
import type { SampledKitSpec } from '../engine/sampled';
import DRUM_SPECS from './collection-drums.json';
import STRING_SPECS from './collection-strings.json';
import type { SamplerSpec } from '../engine/sampler';

export type Genre = 'rock' | 'electronic' | 'hiphop';
export type Family = 'drums' | 'guitar' | 'bass';
type Text = { en: string; es: string };

export interface Group { id: string; genre: Genre; title: Text }

export interface Groove {
  /** Sixteenth steps of one bar per voice; two bars when the list goes past 16. */
  steps: Partial<Record<string, number[]>>;
  /** Steps played softer (ghost notes, hats between beats). */
  soft?: Partial<Record<string, number[]>>;
  bars: number;
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
}

export const GENRES: { id: Genre; title: Text }[] = [
  { id: 'rock', title: { en: 'Rock', es: 'Rock' } },
];

export const FAMILIES: { id: Family; title: Text }[] = [
  { id: 'drums', title: { en: 'Drums', es: 'Batería' } },
  { id: 'guitar', title: { en: 'Guitar', es: 'Guitarra' } },
  { id: 'bass', title: { en: 'Bass', es: 'Bajo' } },
];

export const GROUPS: Group[] = [
  { id: 'rock-classic', genre: 'rock', title: { en: 'Classic rock', es: 'Rock clásico' } },
  { id: 'rock-modern', genre: 'rock', title: { en: 'Contemporary rock', es: 'Rock contemporáneo' } },
  { id: 'rock-metal', genre: 'rock', title: { en: 'Metal', es: 'Metal' } },
  { id: 'rock-punk', genre: 'rock', title: { en: 'Punk', es: 'Punk' } },
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

export const ENTRIES: Entry[] = [...DRUM_ENTRIES, ...guitarAndBass()];

/** Loudness trims (dB) for the guitars and basses through their gear, measured so each plays at the app's level. */
export const TRIMS: Record<string, number> = {
  'instrument.bass-di': 2.7,
  'instrument.bass-drive-90': -5.2,
  'instrument.bass-finger-70': -0.2,
  'instrument.bass-metal': -1.5,
  'instrument.bass-pick-rock': -0.8,
  'instrument.bass-punk': -0.9,
  'instrument.guitar-chime-60': -1.9,
  'instrument.guitar-clean-60': -0.4,
  'instrument.guitar-crunch-70': -3.3,
  'instrument.guitar-di': 0.1,
  'instrument.guitar-fuzz-90': -5.1,
  'instrument.guitar-hg-80': -3.2,
  'instrument.guitar-hg-modern': -2.1,
  'instrument.guitar-indie-2000': -3.4,
  'instrument.guitar-poppunk-90': -1.1,
  'instrument.guitar-punk-77': -2.7,
};

/* ---------------------------------------------------------------- credits */

/** The recorded libraries behind the Colección. Kits were edited, mixed and processed in the studio; guitar and bass are heard through modelled gear. */
export const SOURCES: { name: string; by: string; license: string; url: string }[] = [
  { name: 'SM Drums', by: 'Scott McLean, Tod Stillwell, Suleiman Ali', license: 'Public domain (free use)', url: 'https://github.com/sfzinstruments/SMDrums' },
  { name: 'Big Rusty Drums', by: 'Karoryfer Samples', license: 'CC0 1.0', url: 'https://github.com/sfzinstruments/karoryfer.big-rusty-drums' },
  { name: 'MuldjordKit', by: 'Lars Muldjord / DrumGizmo', license: 'CC BY 4.0', url: 'https://github.com/sfzinstruments/DrumGizmo.MuldjordKit' },
  { name: 'DRSKit', by: 'DrumGizmo (Lars Muldjord, Bent Bisballe Nyeng) and Jes Eiler / DRSDrums', license: 'CC BY 4.0', url: 'https://github.com/sfzinstruments/DrumGizmo.DRSKit' },
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
