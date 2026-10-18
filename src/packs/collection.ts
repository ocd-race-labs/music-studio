// The Colección: instrument sounds by genre, in the producer's room. Each entry is a catalog instrument with a
// place (genre, family, group), a short description of the sound and a groove to hear it in context.
// Sounds are named by style and era, never by bands, drummers or brands.

import type { Lang } from '../domain/types';
import type { SampledKitSpec } from '../engine/sampled';
import DRUM_SPECS from './collection-drums.json';

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

export interface Entry {
  instrument: string;
  genre: Genre;
  family: Family;
  group: string;
  title: Text;
  era: Text;
  blurb: Text;
  tempo: number;
  groove: Groove;
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

export const ENTRIES: Entry[] = [
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

/* ---------------------------------------------------------------- credits */

/** The recorded libraries behind the Colección. Every kit was edited, mixed and processed (EQ, compression, rooms) in the studio. */
export const SOURCES: { name: string; by: string; license: string; url: string }[] = [
  { name: 'SM Drums', by: 'Scott McLean, Tod Stillwell, Suleiman Ali', license: 'Public domain (free use)', url: 'https://github.com/sfzinstruments/SMDrums' },
  { name: 'Big Rusty Drums', by: 'Karoryfer Samples', license: 'CC0 1.0', url: 'https://github.com/sfzinstruments/karoryfer.big-rusty-drums' },
  { name: 'MuldjordKit', by: 'Lars Muldjord / DrumGizmo', license: 'CC BY 4.0', url: 'https://github.com/sfzinstruments/DrumGizmo.MuldjordKit' },
  { name: 'DRSKit', by: 'DrumGizmo (Lars Muldjord, Bent Bisballe Nyeng) and Jes Eiler / DRSDrums', license: 'CC BY 4.0', url: 'https://github.com/sfzinstruments/DrumGizmo.DRSKit' },
];

/* ---------------------------------------------------------------- lookups */

/** The recorded kit behind each Colección drum instrument (pieces, layers, loudness trim). */
export const SAMPLED_KITS: Record<string, SampledKitSpec> = DRUM_SPECS as Record<string, SampledKitSpec>;

export const entryOf = (instrumentKey: string): Entry | undefined => ENTRIES.find((e) => e.instrument === instrumentKey);
export const entriesIn = (genre: Genre, family: Family, group: string): Entry[] =>
  ENTRIES.filter((e) => e.genre === genre && e.family === family && e.group === group);
export const familiesIn = (genre: Genre): Family[] => FAMILIES.map((f) => f.id).filter((f) => ENTRIES.some((e) => e.genre === genre && e.family === f));
export const groupsIn = (genre: Genre, family: Family): Group[] => GROUPS.filter((g) => g.genre === genre && ENTRIES.some((e) => e.group === g.id && e.family === family));
export const textOf = (t: Text, lang: Lang): string => t[lang];
