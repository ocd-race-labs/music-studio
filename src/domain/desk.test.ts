import { describe, expect, it } from 'vitest';
import { newProfile, newSong } from './factory';
import * as MX from './mix';
import { CONSOLES, compSettings, consoleOf, driveCurve, glueSettings, mixOf, qFor, snapFreq, snapGain, STRIP_FLAT, stripOf } from './mix';

const me = newProfile('Test', 'graphite', '#74747A');

describe('the desk', () => {
  it('a song made before the desk reads as a flat desk', () => {
    const s = newSong(me.id);
    expect(s.mix).toBeUndefined();
    expect(mixOf(s)).toEqual(MX.MIX_FLAT);
    for (const t of s.tracks) expect(stripOf(t)).toEqual(STRIP_FLAT);
  });

  it('flat values change nothing: compressor, glue and warmth are off', () => {
    for (const c of CONSOLES) {
      const comp = compSettings(c, 0);
      expect(comp.ratio).toBe(1);
      expect(comp.threshold).toBe(0);
      expect(comp.trimDb).toBe(0);
      const curve = driveCurve(c.drive, 0, 9);
      curve.forEach((y, i) => expect(y).toBeCloseTo((i / 8) * 2 - 1, 6));
    }
    for (const g of MX.GLUES) {
      const s = glueSettings(g.id, 0);
      expect(s.ratio).toBe(1);
      expect(s.trimDb).toBe(0);
    }
  });

  it('warmth keeps the level near zero and never clips', () => {
    for (const c of CONSOLES) {
      const curve = driveCurve(c.drive, 1, 2049);
      expect(Math.abs(curve[1024])).toBeLessThan(0.02);
      for (const y of curve) expect(Math.abs(y)).toBeLessThanOrEqual(1);
      // Small signals pass at about the same level.
      const small = curve[1024 + 10] - curve[1024];
      expect(small).toBeGreaterThan(0);
    }
  });

  it('the compressor cancels the browser makeup and gives back a measured amount', () => {
    const c = consoleOf('british');
    const half = compSettings(c, 0.5);
    expect(half.threshold).toBe(-17);
    expect(half.ratio).toBe(2.5);
    expect(half.attack).toBe(c.comp.attack);
    expect(half.trimDb).toBeCloseTo(-0.6 * 17 * (1 - 1 / 2.5) + 3.5, 6);
  });

  it('stepped consoles snap frequencies and gains like their switches', () => {
    const american = consoleOf('american');
    expect(snapFreq(american.bands.low, 130)).toBe(100);
    expect(snapGain(american, 5)).toBe(4);
    expect(snapGain(american, 40)).toBe(12);
    const inductor = consoleOf('inductor');
    expect(snapFreq(inductor.bands.high, 5000)).toBe(12000);
    const clean = consoleOf('clean');
    expect(snapFreq(clean.bands.low, 5)).toBe(clean.bands.low.min);
  });

  it('proportional peaks narrow as the boost grows', () => {
    const c = consoleOf('british');
    expect(qFor(c, 2)).toBeLessThan(qFor(c, 12));
    expect(qFor(consoleOf('clean'), 2)).toBe(qFor(consoleOf('clean'), 12));
  });

  it('switching console keeps every knob, moved to what the new desk allows', () => {
    let s = newSong(me.id);
    const id = s.tracks[0].id;
    s = MX.setStrip(s, id, { low_hz: 130, low_db: 5, comp: 0.4, send_room: 0.3 }, me.id);
    const moved = MX.setConsole(s, 'american', me.id);
    const strip = stripOf(moved.tracks[0]);
    expect(strip.low_hz).toBe(100);
    expect(strip.low_db).toBe(4);
    expect(strip.comp).toBe(0.4);
    expect(strip.send_room).toBe(0.3);
    expect(mixOf(moved).console).toBe('american');
    expect(mixOf(moved).glue_model).toBe('american');
    // Untouched strips stay absent, so they keep reading as flat.
    expect(moved.tracks[1].strip).toBeUndefined();
  });

  it('flat brings a channel back and leaves the others alone', () => {
    let s = newSong(me.id);
    s = MX.setStrip(s, s.tracks[0].id, { high_db: 3 }, me.id);
    s = MX.setStrip(s, s.tracks[1].id, { comp: 0.2 }, me.id);
    const back = MX.resetStrip(s, s.tracks[0].id, me.id);
    expect(back.tracks[0].strip).toBeUndefined();
    expect(stripOf(back.tracks[1]).comp).toBe(0.2);
  });

  it('echo follows the tempo', () => {
    expect(MX.echoSeconds('1/4', 120)).toBeCloseTo(0.5);
    expect(MX.echoSeconds('1/8', 120)).toBeCloseTo(0.25);
    expect(MX.echoSeconds('3/8', 100)).toBeCloseTo(0.9);
  });
});
