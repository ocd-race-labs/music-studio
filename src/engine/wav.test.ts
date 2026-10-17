import { describe, expect, it } from 'vitest';
import { encodeWav } from './wav';

describe('WAV encoding', () => {
  it('writes a valid 16-bit mono header and samples', async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const wav = encodeWav(samples, 48000);
    const view = new DataView(await wav.arrayBuffer());
    const text = (o: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(o + i)));
    expect(text(0)).toBe('RIFF');
    expect(text(8)).toBe('WAVE');
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(10);
    expect(view.getInt16(44 + 2 * 3, true)).toBe(32767);
    expect(view.getInt16(44 + 2 * 4, true)).toBe(-32768);
    expect(wav.size).toBe(54);
  });
});
