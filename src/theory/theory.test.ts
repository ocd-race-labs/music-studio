import { describe, expect, it } from 'vitest';
import {
  chordMidi,
  diatonicTriads,
  midiToHz,
  noteNameAscii,
  noteNameDisplay,
  scaleSpellings,
  spellInKey,
  spellingToAscii,
  tierOf,
} from './index';

const names = (key: { tonic: string; mode: string }) => scaleSpellings(key).map(spellingToAscii).join(' ');

describe('pitch', () => {
  it('tunes A4 to 440 Hz and follows the tuning setting', () => {
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(midiToHz(60)).toBeCloseTo(261.626, 2);
    expect(midiToHz(69, 442)).toBeCloseTo(442);
  });

  it('keeps the octave with the letter', () => {
    expect(noteNameAscii(71, { letter: 'C', accidental: -1 })).toBe('Cb5');
    expect(noteNameAscii(60, { letter: 'B', accidental: 1 })).toBe('B#3');
    expect(noteNameDisplay(61, { letter: 'D', accidental: -1 })).toBe('D♭4');
  });
});

describe('scales are spelled with the right letters', () => {
  it('D flat major', () => expect(names({ tonic: 'Db', mode: 'major' })).toBe('Db Eb F Gb Ab Bb C'));
  it('F sharp major', () => expect(names({ tonic: 'F#', mode: 'major' })).toBe('F# G# A# B C# D# E#'));
  it('A minor', () => expect(names({ tonic: 'A', mode: 'minor' })).toBe('A B C D E F G'));
  it('E harmonic minor', () => expect(names({ tonic: 'E', mode: 'harmonic-minor' })).toBe('E F# G A B C D#'));
  it('A blues', () => expect(names({ tonic: 'A', mode: 'blues' })).toBe('A C D Eb E G'));
  it('G major pentatonic', () => expect(names({ tonic: 'G', mode: 'major-pentatonic' })).toBe('G A B D E'));
});

describe('spelling any note in a key', () => {
  it('uses G flat, not F sharp, in D flat major', () => {
    expect(spellingToAscii(spellInKey(66, { tonic: 'Db', mode: 'major' }))).toBe('Gb');
  });
  it('spells outside notes with the key’s accidentals', () => {
    expect(spellingToAscii(spellInKey(67, { tonic: 'Db', mode: 'major' }))).toBe('G');
    expect(spellingToAscii(spellInKey(63, { tonic: 'E', mode: 'major' }))).toBe('D#');
    expect(spellingToAscii(spellInKey(70, { tonic: 'F', mode: 'major' }))).toBe('Bb');
    expect(spellingToAscii(spellInKey(61, { tonic: 'F', mode: 'major' }))).toBe('Db');
  });
});

describe('chords', () => {
  it('builds the diatonic triads of C major', () => {
    expect(diatonicTriads({ tonic: 'C', mode: 'major' }).map((c) => c.symbolAscii)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
    expect(diatonicTriads({ tonic: 'C', mode: 'major' }).map((c) => c.roman)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  });
  it('builds the triads of D flat major with flats', () => {
    expect(diatonicTriads({ tonic: 'Db', mode: 'major' }).map((c) => c.symbolAscii)).toEqual(['Db', 'Ebm', 'Fm', 'Gb', 'Ab', 'Bbm', 'Cdim']);
  });
  it('voices a chord upward', () => {
    const [i] = diatonicTriads({ tonic: 'Db', mode: 'major' });
    expect(chordMidi(i, 48)).toEqual([49, 53, 56]);
  });
});

describe('scale-color tiers', () => {
  const key = { tonic: 'Db', mode: 'major' };
  const tonicChord = diatonicTriads(key)[0];
  it('marks chord tones, scale notes and outside notes', () => {
    expect(tierOf(65, key, tonicChord)).toBe('chord'); // F
    expect(tierOf(70, key, tonicChord)).toBe('scale'); // Bb
    expect(tierOf(67, key, tonicChord)).toBe('outside'); // G natural
  });
  it('works without a chord', () => {
    expect(tierOf(65, key, null)).toBe('scale');
  });
});
