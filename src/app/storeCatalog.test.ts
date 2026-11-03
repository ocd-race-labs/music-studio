import { describe, expect, it } from 'vitest';
import { AISLES, aisleOf, isRecorded, matches, STORE_ITEMS, windowKit, windowsOf, windowStyles, WINDOWS, wingOf } from './storeCatalog';

describe('store floor plan', () => {
  it('puts every instrument in one aisle of one wing', () => {
    expect(STORE_ITEMS.length).toBeGreaterThan(80);
    for (const x of STORE_ITEMS) expect(AISLES[x.wing]).toContain(x.aisle);
  });
  it('keeps the guitar with the strings and the electric guitar in the electric wing', () => {
    expect(aisleOf('instrument.violin')).toBe('strings');
    expect(aisleOf('instrument.guitar-nylon')).toBe('strings');
    expect(wingOf('instrument.guitar-dist')).toBe('electric');
    expect(aisleOf('instrument.bass-808')).toBe('synthbass');
    expect(aisleOf('instrument.drums-909')).toBe('machines');
    expect(aisleOf('instrument.drums-jazz')).toBe('drums');
  });
  it('tells recordings from synthesized sounds', () => {
    expect(isRecorded('instrument.violin')).toBe(true);
    expect(isRecorded('instrument.guitar-di')).toBe(true);
    expect(isRecorded('instrument.guitar-nylon')).toBe(false);
    expect(isRecorded('instrument.lead-saw')).toBe(false);
  });
  it('has seven windows, each a full kit; rock, electronic and hip hop show their styles', () => {
    expect(WINDOWS.map((w) => w.id)).toEqual(['pop', 'rock', 'electronic', 'hiphop', 'jazz', 'classical', 'latin']);
    for (const w of WINDOWS) expect(windowKit(w.id).length).toBeGreaterThanOrEqual(6);
    expect(windowStyles('rock').map((s) => s.id)).toContain('rock-metal');
    expect(windowStyles('electronic').length).toBe(10);
    expect(windowStyles('jazz')).toEqual([]);
    expect(windowsOf('instrument.violin')).toEqual(['classical']);
  });
  it('finds by name, aisle or style, without accents', () => {
    expect(matches('instrument.violin', 'violin', 'es')).toBe(true);
    expect(matches('instrument.violin', 'clasica', 'es')).toBe(true);
    expect(matches('instrument.violin', 'trap', 'es')).toBe(false);
  });
});
