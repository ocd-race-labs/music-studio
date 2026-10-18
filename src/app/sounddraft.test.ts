import { describe, expect, it } from 'vitest';
import { newProfile, newSong, roleOf } from '../domain/factory';
import * as C from '../domain/commands';
import { ENTRIES } from '../packs/collection';
import { ref } from '../packs/core';
import type { CustomSound, Song } from '../domain/types';
import { auditionSong, currentOf, decadeOf, draftKind, fitsTrack, ownGear, suggestionsFor } from './sounddraft';

const me = newProfile('Test', 'graphite', '#74747A');
const KIT_60 = 'instrument.drums-rock-studio-60';
const GTR_60 = 'instrument.guitar-clean-60';
const GTR_90 = 'instrument.guitar-fuzz-90';

const rockSong = (): Song => newSong(me.id, 'T', 2, 'es', 'kit.rock');
const trackOf = (s: Song, role: string) => s.tracks.find((x) => roleOf(x) === role)!;
const mySound = (base: string, chain: CustomSound['chain']): CustomSound => ({
  id: 'mine-1', profile_id: me.id, name: 'Mi limpio', base: ref(base), chain, chain_schema_version: 1, status: 'active', origin: 'person',
  created_at: '2026-10-18T00:00:00Z', updated_at: '2026-10-18T00:00:00Z',
});

describe('the sound being shaped', () => {
  it('a guitar comes with its amp and cabinet; a drum kit comes with no gear', () => {
    expect(ownGear(GTR_60).slots.map((x) => x.effect.key)).toContain('effect.amp');
    expect(ownGear(KIT_60).slots).toHaveLength(0);
  });

  it('shows what the track plays, and the producer version starts from the musician sound', () => {
    let s = rockSong();
    const chords = trackOf(s, 'chords');
    s = C.setInstrument(s, chords.id, ref(GTR_60), me.id);
    const tr = s.tracks.find((x) => x.id === chords.id)!;
    const mus = currentOf(tr, 'musician');
    expect(mus.base).toBe(GTR_60);
    expect(mus.exists).toBe(true);
    const prod = currentOf(tr, 'producer');
    expect(prod.base).toBe(GTR_60);
    expect(prod.exists).toBe(false);
    const withProd = C.setProducerSound(s, chords.id, { instrument: ref(GTR_90) }, me.id).tracks.find((x) => x.id === chords.id)!;
    expect(currentOf(withProd, 'producer')).toMatchObject({ base: GTR_90, exists: true });
    expect(currentOf(withProd, 'musician').base).toBe(GTR_60);
  });

  it('knows what the bar should offer', () => {
    let s = rockSong();
    const chords = trackOf(s, 'chords');
    s = C.setInstrument(s, chords.id, ref(GTR_60), me.id);
    const tr = s.tracks.find((x) => x.id === chords.id)!;
    const cur = currentOf(tr, 'musician');
    expect(draftKind(cur, cur)).toBe('clean');
    expect(draftKind({ base: GTR_90, chain: ownGear(GTR_90) }, cur)).toBe('catalog');
    const changed = structuredClone(cur.chain);
    changed.slots[0].params.gain = 0.9;
    expect(draftKind({ base: GTR_60, chain: changed }, cur)).toBe('custom');
    const saved = mySound(GTR_60, changed);
    expect(draftKind({ base: GTR_60, chain: changed, soundId: saved.id }, cur, saved)).toBe('mine');
    // Once used, the track plays it and there is nothing left to do.
    const used = C.applySound(s, chords.id, saved, me.id).tracks.find((x) => x.id === chords.id)!;
    expect(draftKind({ base: GTR_60, chain: changed, soundId: saved.id }, currentOf(used, 'musician'), saved)).toBe('clean');
  });

  it('only offers what fits the track, unless asked for everything melodic', () => {
    const s = rockSong();
    const drums = trackOf(s, 'drums');
    const bass = trackOf(s, 'bass');
    const chords = trackOf(s, 'chords');
    expect(fitsTrack(KIT_60, drums)).toBe(true);
    expect(fitsTrack(GTR_60, drums)).toBe(false);
    expect(fitsTrack(KIT_60, chords)).toBe(false);
    expect(fitsTrack(GTR_60, chords)).toBe(true);
    expect(fitsTrack('instrument.bass-finger-70', bass)).toBe(true);
    expect(fitsTrack('instrument.bass-finger-70', chords)).toBe(false);
    expect(fitsTrack('instrument.bass-finger-70', chords, true)).toBe(true);
    expect(fitsTrack(GTR_60, bass)).toBe(false);
  });

  it('plays the draft in the song without touching the song', () => {
    let s = rockSong();
    const chords = trackOf(s, 'chords');
    s = C.setProducerSound(s, chords.id, { instrument: ref(GTR_90) }, me.id);
    const before = JSON.stringify(s);
    const chain = ownGear(GTR_60);
    const a = auditionSong(s, chords.id, GTR_60, chain, 'prueba');
    const tr = a.tracks.find((x) => x.id === chords.id)!;
    expect(tr.instrument?.key).toBe(GTR_60);
    expect(tr.sound?.chain.slots.length).toBe(chain.slots.length);
    expect(tr.producer).toBeUndefined();
    expect(a.tracks.filter((x) => x.id !== chords.id)).toEqual(s.tracks.filter((x) => x.id !== chords.id));
    expect(JSON.stringify(s)).toBe(before);
  });

  it('reads the decade of a sound', () => {
    const era = (en: string) => decadeOf({ ...ENTRIES[0], era: { en, es: en } });
    expect(era('1970s · huge open kick')).toBe(1970);
    expect(era('Early 1990s · sped-up break')).toBe(1990);
    expect(era('1977 · raw, fast')).toBe(1970);
    expect(era('2010s · tight')).toBe(2010);
    expect(era('Any era · sparse')).toBeNull();
  });

  it('suggests guitars of the same era as the drums, and says why', () => {
    let s = rockSong();
    s = C.setInstrument(s, trackOf(s, 'drums').id, ref(KIT_60), me.id);
    const chords = trackOf(s, 'chords');
    const sug = suggestionsFor(s, chords, 'es');
    expect(sug.length).toBeGreaterThan(0);
    const first = sug[0];
    expect(fitsTrack(first.entry.instrument, chords)).toBe(true);
    expect(decadeOf(first.entry)).toBe(1960);
    expect(first.reasons.some((r) => r.includes('años 60'))).toBe(true);
    expect(first.byGenreOnly).toBe(false);
  });
});
