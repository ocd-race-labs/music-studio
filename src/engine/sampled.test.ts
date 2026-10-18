import { describe, expect, it } from 'vitest';
import { pickLayer } from './sampled';

describe('recorded kits', () => {
  it('picks soft, middle and hard layers like a drummer plays them', () => {
    expect(pickLayer(0.42, 3).layer).toBe(0);
    expect(pickLayer(0.75, 3).layer).toBe(1);
    expect(pickLayer(0.9, 3).layer).toBe(2);
    expect(pickLayer(1, 3)).toEqual({ layer: 2, gain: 1 });
    expect(pickLayer(1, 1).layer).toBe(0);
    expect(pickLayer(0.2, 3).gain).toBeGreaterThanOrEqual(0.3);
    expect(pickLayer(0.79, 3).gain).toBeLessThan(1);
  });
});
