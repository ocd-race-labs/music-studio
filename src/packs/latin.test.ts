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

describe('the güiro', () => {
  it('scrapes short on off-beats and long on accents', async () => {
    const { pickLayer } = await import('../engine/sampled');
    const split = SAMPLED_KITS['latin-perc'].pieces.guiro.split;
    expect(pickLayer(0.75, 2, split).layer).toBe(0);
    expect(pickLayer(0.6, 2, split).layer).toBe(0);
    expect(pickLayer(0.9, 2, split).layer).toBe(1);
  });
});
