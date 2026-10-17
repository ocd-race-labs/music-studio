// Pitch: MIDI numbers, pitch classes, spelled note names and frequencies.
// Pure functions only; no audio, no browser APIs.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Letter = (typeof LETTERS)[number];

/** Pitch class of each natural letter (C = 0). */
export const NATURAL_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** A spelled pitch class: a letter plus an accidental from -2 (double flat) to +2 (double sharp). */
export interface Spelling {
  letter: Letter;
  accidental: number;
}

export const mod12 = (n: number): number => ((n % 12) + 12) % 12;

export const pitchClass = (midi: number): number => mod12(midi);

/** Octave in scientific pitch notation: MIDI 60 = C4. */
export const octaveOf = (midi: number): number => Math.floor(midi / 12) - 1;

const ASCII_ACC: Record<number, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };
const DISPLAY_ACC: Record<number, string> = { [-2]: '\u{1D12B}', [-1]: '♭', 0: '', 1: '♯', 2: '\u{1D12A}' };

/** ASCII spelling used in stored data: Db, F#, Bbb. */
export const spellingToAscii = (s: Spelling): string => s.letter + ASCII_ACC[s.accidental];

/** Display spelling with real accidentals: D♭, F♯. */
export const spellingToDisplay = (s: Spelling): string => s.letter + DISPLAY_ACC[s.accidental];

export function parseSpelling(text: string): Spelling {
  const m = /^([A-G])(bb|b|##|#)?$/.exec(text.trim());
  if (!m) throw new Error(`Not a note name: ${text}`);
  const acc = m[2] ?? '';
  const accidental = acc === 'bb' ? -2 : acc === 'b' ? -1 : acc === '##' ? 2 : acc === '#' ? 1 : 0;
  return { letter: m[1] as Letter, accidental };
}

export const spellingPc = (s: Spelling): number => mod12(NATURAL_PC[s.letter] + s.accidental);

/** Frequency in Hz for a MIDI note, given the tuning of A4. */
export const midiToHz = (midi: number, a4 = 440): number => a4 * Math.pow(2, (midi - 69) / 12);

/** Name with octave, ASCII (stored form): Db4. The octave follows the letter, so B#3 sounds as C4. */
export function noteNameAscii(midi: number, s: Spelling): string {
  return spellingToAscii(s) + spelledOctave(midi, s);
}

export function noteNameDisplay(midi: number, s: Spelling): string {
  return spellingToDisplay(s) + spelledOctave(midi, s);
}

/** Octave number for a spelled note: Cb5 sounds as B4, B#3 sounds as C4. */
export function spelledOctave(midi: number, s: Spelling): number {
  const naturalMidi = midi - s.accidental;
  return octaveOf(naturalMidi);
}
