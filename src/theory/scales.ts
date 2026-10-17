import { LETTERS, NATURAL_PC, mod12, parseSpelling, spellingPc } from './pitch';
import type { Letter, Spelling } from './pitch';

/** One scale degree: semitones above the tonic and how many letters above the tonic letter. */
type Degree = readonly [semitones: number, letterOffset: number];

export interface ScaleDef {
  id: string;
  name: { en: string; es: string };
  degrees: readonly Degree[];
}

const hepta = (semis: number[]): Degree[] => semis.map((s, i) => [s, i] as const);

export const SCALES: readonly ScaleDef[] = [
  { id: 'major', name: { en: 'Major', es: 'Mayor' }, degrees: hepta([0, 2, 4, 5, 7, 9, 11]) },
  { id: 'minor', name: { en: 'Minor', es: 'Menor' }, degrees: hepta([0, 2, 3, 5, 7, 8, 10]) },
  { id: 'harmonic-minor', name: { en: 'Harmonic minor', es: 'Menor armónica' }, degrees: hepta([0, 2, 3, 5, 7, 8, 11]) },
  { id: 'dorian', name: { en: 'Dorian', es: 'Dórico' }, degrees: hepta([0, 2, 3, 5, 7, 9, 10]) },
  { id: 'mixolydian', name: { en: 'Mixolydian', es: 'Mixolidio' }, degrees: hepta([0, 2, 4, 5, 7, 9, 10]) },
  { id: 'major-pentatonic', name: { en: 'Major pentatonic', es: 'Pentatónica mayor' }, degrees: [[0, 0], [2, 1], [4, 2], [7, 4], [9, 5]] },
  { id: 'minor-pentatonic', name: { en: 'Minor pentatonic', es: 'Pentatónica menor' }, degrees: [[0, 0], [3, 2], [5, 3], [7, 4], [10, 6]] },
  { id: 'blues', name: { en: 'Blues', es: 'Blues' }, degrees: [[0, 0], [3, 2], [5, 3], [6, 4], [7, 4], [10, 6]] },
];

export const scaleById = (id: string): ScaleDef => {
  const s = SCALES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scale: ${id}`);
  return s;
};

export interface Key {
  tonic: string; // ASCII spelling, e.g. "Db"
  mode: string; // scale id, e.g. "major"
}

/** The tonics offered in the key picker, spelled the way musicians write them. */
export const TONICS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

function letterAt(tonic: Letter, offset: number): Letter {
  return LETTERS[(LETTERS.indexOf(tonic) + offset) % 7];
}

function accidentalFor(letter: Letter, pc: number): number {
  let acc = mod12(pc - NATURAL_PC[letter]);
  if (acc > 6) acc -= 12;
  return acc;
}

/** Spelled scale: each degree with its correct letter, so D♭ major reads D♭ E♭ F G♭ A♭ B♭ C. */
export function scaleSpellings(key: Key): Spelling[] {
  const tonic = parseSpelling(key.tonic);
  const tonicPc = spellingPc(tonic);
  return scaleById(key.mode).degrees.map(([semis, offset]) => {
    const letter = letterAt(tonic.letter, offset);
    return { letter, accidental: accidentalFor(letter, tonicPc + semis) };
  });
}

/** Pitch classes in the scale. */
export function scalePitchClasses(key: Key): number[] {
  const tonicPc = spellingPc(parseSpelling(key.tonic));
  return scaleById(key.mode).degrees.map(([semis]) => mod12(tonicPc + semis));
}

/** True when the key's own spelling uses flats (decides how notes outside the scale are spelled). */
export function keyPrefersFlats(key: Key): boolean {
  const sp = scaleSpellings(key);
  const flats = sp.filter((s) => s.accidental < 0).length;
  const sharps = sp.filter((s) => s.accidental > 0).length;
  if (flats !== sharps) return flats > sharps;
  return parseSpelling(key.tonic).accidental < 0 || key.tonic === 'F';
}

/** Spell any MIDI note for a key: scale notes use the scale's letters; others follow the key's flats or sharps. */
export function spellInKey(midi: number, key: Key): Spelling {
  const pc = mod12(midi);
  const inScale = scaleSpellings(key).find((s) => spellingPc(s) === pc);
  if (inScale) return inScale;
  const natural = LETTERS.find((l) => NATURAL_PC[l] === pc);
  if (natural) return { letter: natural, accidental: 0 };
  if (keyPrefersFlats(key)) {
    const letter = LETTERS.find((l) => mod12(NATURAL_PC[l] - 1) === pc)!;
    return { letter, accidental: -1 };
  }
  const letter = LETTERS.find((l) => mod12(NATURAL_PC[l] + 1) === pc)!;
  return { letter, accidental: 1 };
}
