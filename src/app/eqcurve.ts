// The response of a channel's EQ, worked out from the same filter formulas the browser uses (RBJ cookbook), to
// draw the curve the producer is shaping.

import type { ChannelStrip } from '../domain/types';
import type { ConsoleSpec } from '../domain/mix';
import { qFor } from '../domain/mix';

const FS = 48000;
type Coef = [number, number, number, number, number, number];

function peaking(f0: number, db: number, q: number): Coef {
  const A = 10 ** (db / 40), w = (2 * Math.PI * f0) / FS, al = Math.sin(w) / (2 * q), cw = Math.cos(w);
  return [1 + al * A, -2 * cw, 1 - al * A, 1 + al / A, -2 * cw, 1 - al / A];
}
function shelf(f0: number, db: number, high: boolean): Coef {
  const A = 10 ** (db / 40), w = (2 * Math.PI * f0) / FS, cw = Math.cos(w), al = (Math.sin(w) / 2) * Math.SQRT2, s = 2 * Math.sqrt(A) * al;
  return high
    ? [A * ((A + 1) + (A - 1) * cw + s), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - s), (A + 1) - (A - 1) * cw + s, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - s]
    : [A * ((A + 1) - (A - 1) * cw + s), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - s), (A + 1) + (A - 1) * cw + s, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - s];
}
function magDb([b0, b1, b2, a0, a1, a2]: Coef, f: number): number {
  const w = (2 * Math.PI * f) / FS;
  const re = (c0: number, c1: number, c2: number) => c0 + c1 * Math.cos(w) + c2 * Math.cos(2 * w);
  const im = (c1: number, c2: number) => -(c1 * Math.sin(w) + c2 * Math.sin(2 * w));
  const num = Math.hypot(re(b0, b1, b2), im(b1, b2));
  const den = Math.hypot(re(a0, a1, a2), im(a1, a2));
  return 20 * Math.log10(num / den);
}

/** dB at each frequency: the four bands, the shelf bumps, and the low cut (24 dB per octave). */
export function eqResponse(s: ChannelStrip, c: ConsoleSpec, freqs: number[]): number[] {
  const bands: Coef[] = [
    shelf(s.low_hz, s.low_db, false),
    ...(c.bands.lmid.hidden ? [] : [peaking(s.lmid_hz, s.lmid_db, qFor(c, s.lmid_db))]),
    peaking(s.hmid_hz, s.hmid_db, qFor(c, s.hmid_db)),
    shelf(s.high_hz, s.high_db, true),
  ];
  if (c.shelfBump) bands.push(peaking(Math.min(2000, s.low_hz * 2), -s.low_db / 6, 1), peaking(Math.max(500, s.high_hz / 2), -s.high_db / 6, 1));
  return freqs.map((f) => {
    let db = bands.reduce((sum, b) => sum + magDb(b, f), 0);
    if (s.hpf_hz > 0) db += -10 * Math.log10(1 + (s.hpf_hz / f) ** 8);
    return db;
  });
}

export const LOG_FREQS = (n = 120): number[] => Array.from({ length: n }, (_, i) => 20 * Math.pow(1000, i / (n - 1)));
