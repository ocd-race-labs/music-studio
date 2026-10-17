import { mod12, spellingPc, spellingToAscii, spellingToDisplay } from './pitch';
import type { Spelling } from './pitch';
import { scaleById, scaleSpellings, spellInKey } from './scales';
import type { Key } from './scales';

export type Quality = 'major' | 'minor' | 'diminished' | 'augmented';

export interface Chord {
  degree: number; // 0-based scale degree
  root: Spelling;
  tones: Spelling[]; // root, third, fifth
  quality: Quality;
  roman: string; // I, ii, vii°
  symbolAscii: string; // Db, Ebm, Cdim
  symbolDisplay: string; // D♭, E♭m, Cdim
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

function qualityOf(third: number, fifth: number): Quality {
  if (third === 4 && fifth === 7) return 'major';
  if (third === 3 && fifth === 7) return 'minor';
  if (third === 3 && fifth === 6) return 'diminished';
  return 'augmented';
}

const SUFFIX: Record<Quality, string> = { major: '', minor: 'm', diminished: 'dim', augmented: 'aug' };

/** Diatonic triads, one per degree, for seven-note scales. Pentatonic and blues keys borrow the parent major or minor. */
export function diatonicTriads(key: Key): Chord[] {
  const parent: Key = scaleById(key.mode).degrees.length === 7
    ? key
    : { tonic: key.tonic, mode: key.mode === 'major-pentatonic' ? 'major' : 'minor' };
  const sp = scaleSpellings(parent);
  return sp.map((root, i) => {
    const third = sp[(i + 2) % 7];
    const fifth = sp[(i + 4) % 7];
    const q = qualityOf(mod12(spellingPc(third) - spellingPc(root)), mod12(spellingPc(fifth) - spellingPc(root)));
    const numeral = q === 'major' || q === 'augmented' ? ROMAN[i] : ROMAN[i].toLowerCase();
    const mark = q === 'diminished' ? '°' : q === 'augmented' ? '+' : '';
    return {
      degree: i,
      root,
      tones: [root, third, fifth],
      quality: q,
      roman: numeral + mark,
      symbolAscii: spellingToAscii(root) + SUFFIX[q],
      symbolDisplay: spellingToDisplay(root) + SUFFIX[q],
    };
  });
}

/** MIDI notes for a chord voiced upward from a base octave (root position). */
export function chordMidi(chord: Chord, baseMidi = 48): number[] {
  const rootPc = spellingPc(chord.root);
  const root = baseMidi + mod12(rootPc - mod12(baseMidi));
  const notes = [root];
  for (const t of chord.tones.slice(1)) {
    let n = root + mod12(spellingPc(t) - rootPc);
    if (n <= notes[notes.length - 1]) n += 12;
    notes.push(n);
  }
  return notes;
}

export type Tier = 'chord' | 'scale' | 'outside';

/** Scale-color tier of a note: a tone of the current chord, a note of the key, or outside (tension). */
export function tierOf(midi: number, key: Key, chord: Chord | null): Tier {
  const pc = mod12(midi);
  if (chord && chord.tones.some((t) => spellingPc(t) === pc)) return 'chord';
  const spelled = spellInKey(midi, key);
  const inScale = scaleSpellings(key).some((s) => spellingPc(s) === pc && s.letter === spelled.letter);
  return inScale ? 'scale' : 'outside';
}
