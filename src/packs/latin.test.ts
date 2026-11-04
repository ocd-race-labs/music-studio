import { describe, expect, it } from 'vitest';
import { SAMPLED_KITS } from './collection';
import { findByKey, LATIN_ROWS, resolveRow, rowsOf } from './core';

describe('real latin percussion and the unplugged kit', () => {
  it('plays recordings, one piece per row', () => {
    for (const [key, set] of [['instrument.perc-latin', 'latin-perc'], ['instrument.drums-latin', 'unplugged']]) {
      expect(findByKey(key)?.manifest).toMatchObject({ kit: 'sampled', set });
      const voices = rowsOf(key).map((r) => findByKey(r)?.manifest.voice as string);
      expect(Object.keys(SAMPLED_KITS[set].pieces).sort()).toEqual([...voices].sort());
    }
  });
  it('keeps songs that used the old timbal row', () => {
    expect(resolveRow(LATIN_ROWS, 'sound.timbale')).toBe('sound.agogo');
  });
});
