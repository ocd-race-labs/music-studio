import { describe, expect, it } from 'vitest';
import { autoZoom, cellWidth, visibleSteps } from './zoom';

describe('zoom', () => {
  it('fills the width with the chosen span', () => {
    // A 2-bar loop (32 steps) in an 820 px editor: the whole loop fits at about 20 px a step.
    expect(cellWidth('fit', 32, 820)).toBe(20);
    expect(cellWidth('bar', 32, 820)).toBe(43);
    expect(visibleSteps('half', 32)).toBe(8);
    expect(visibleSteps('bar', 16)).toBe(16);
  });

  it('never shrinks steps below a tappable floor or grows them without end', () => {
    expect(cellWidth('fit', 128, 400)).toBe(12);
    expect(cellWidth('half', 32, 3000)).toBe(96);
  });

  it('picks a comfortable start for each screen', () => {
    expect(autoZoom(32, 820, false)).toBe('fit');   // laptop
    expect(autoZoom(32, 620, true)).toBe('bar');    // iPad beside the panels
    expect(autoZoom(32, 358, true)).toBe('half');   // iPhone
  });
});
