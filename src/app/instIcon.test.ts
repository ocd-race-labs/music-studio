import { describe, expect, it } from 'vitest';
import { INSTRUMENTS } from '../packs/core';
import { instIcon } from './instIcon';

describe('instrument icons', () => {
  it('every catalog instrument gets an icon of its own kind', () => {
    const missing = INSTRUMENTS.filter((i) => instIcon(i.key) === 'music').map((i) => i.key);
    expect(missing).toEqual([]);
  });

  it('reads what the sound is', () => {
    expect(instIcon('instrument.violin')).toBe('violin');
    expect(instIcon('instrument.keys-piano')).toBe('piano');
    expect(instIcon('instrument.drums-rock')).toBe('drums');
    expect(instIcon('instrument.drums-909')).toBe('drumpad');
    expect(instIcon('instrument.perc-latin')).toBe('conga');
    expect(instIcon('instrument.bass-808')).toBe('sub');
    expect(instIcon('instrument.bass-electric')).toBe('bass');
    expect(instIcon('instrument.guitar-nylon')).toBe('acoustic');
    expect(instIcon('instrument.guitar-clean-60')).toBe('guitar');
    expect(instIcon('instrument.drums-rock-studio-60')).toBe('drums');
    expect(instIcon('instrument.syn-trap-bells')).toBe('bells');
    expect(instIcon('instrument.syn-supersaw')).toBe('pad');
  });
});
