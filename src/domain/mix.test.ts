import { SAMPLED_KITS } from '../packs/collection';
import { describe, expect, it } from 'vitest';
import { addFx, clearWritten, hasWritten, removeFx, setGain, setPan, toggleNote } from './commands';
import { newProfile, newSong } from './factory';
import type { PatternContent } from './types';
import { EFFECTS, INSTRUMENTS } from '../packs/core';
import { LOUDNESS_TRIMS } from '../engine/voices';
import { PEDAL_KEYS } from '../engine/pedals';
import { dbOfGain, gainOfDb, FADER_MIN_DB } from '../app/levels';

const me = newProfile('Test', 'graphite', '#74747A');

describe('trash button', () => {
  it('clears every track, or only one, and keeps instruments and mix', () => {
    let s = newSong(me.id);
    s = toggleNote(s, s.tracks[1].id, 36, 0, 2, me.id);
    expect(hasWritten(s)).toBe(true);
    const onlyBass = clearWritten(s, s.tracks[1].id, me.id);
    expect(hasWritten(onlyBass, s.tracks[1].id)).toBe(false);
    expect(hasWritten(onlyBass, s.tracks[0].id)).toBe(true);
    const all = clearWritten(s, null, me.id);
    expect(hasWritten(all)).toBe(false);
    expect((all.tracks[0].clips[0].content as PatternContent).rows).toHaveLength(8);
    expect(all.tracks.map((t) => t.instrument?.key)).toEqual(s.tracks.map((t) => t.instrument?.key));
  });
});

describe('pedals', () => {
  it('every pedal in the catalog has a processor', () => {
    for (const e of EFFECTS) expect(PEDAL_KEYS, e.key).toContain(e.key);
  });

  it('a new pedal goes before the echoes and the room, on, with its settings', () => {
    let s = newSong(me.id);
    const id = s.tracks[4].id;
    s = addFx(s, id, 'effect.chorus', me.id);
    expect(s.tracks[4].fx_chain.slots.map((x) => x.effect.key)).toEqual(['effect.drive', 'effect.chorus', 'effect.delay', 'effect.reverb']);
    expect(s.tracks[4].fx_chain.slots[1]).toMatchObject({ bypass: false, params: { mix: 0.5, rate: 1.5, depth: 0.7 } });
    s = addFx(s, id, 'effect.pingpong', me.id);
    expect(s.tracks[4].fx_chain.slots.at(-1)?.effect.key).toBe('effect.pingpong');
    s = removeFx(s, id, 1, me.id);
    expect(s.tracks[4].fx_chain.slots.map((x) => x.effect.key)).toEqual(['effect.drive', 'effect.delay', 'effect.reverb', 'effect.pingpong']);
  });
});

describe('mixer', () => {
  it('faders work in dB with silence at the bottom; up to +6 dB', () => {
    expect(dbOfGain(1)).toBe(0);
    expect(gainOfDb(FADER_MIN_DB)).toBe(0);
    expect(gainOfDb(6)).toBeCloseTo(1.995, 2);
    let s = newSong(me.id);
    s = setGain(s, s.tracks[0].id, 3, me.id);
    expect(s.tracks[0].gain).toBe(2);
    s = setPan(s, s.tracks[0].id, -5, me.id);
    expect(s.tracks[0].pan).toBe(-1);
  });

  it('every instrument and kit has a loudness trim', () => {
    for (const i of INSTRUMENTS) {
      const m = i.manifest as { type: string; kit?: string; voice?: string; set?: string };
      // Recorded Colección kits carry their own trim, measured when they are processed.
      if (m.kit === 'sampled') { expect(SAMPLED_KITS[m.set!]?.trimDb, i.key).toBeTypeOf('number'); continue; }
      if (m.type === 'sampler') { expect((i.manifest as { trimDb?: number }).trimDb, i.key).toBeTypeOf('number'); continue; }
      const id = m.type === 'drumkit' ? `kit:${m.kit}` : m.voice!;
      expect(LOUDNESS_TRIMS[id], i.key).toBeTypeOf('number');
    }
  });
});
