import { describe, expect, it } from 'vitest';
import { clearWritten, foldVersions, hasWritten, setInstrument, swapPartner, toggleHit } from './commands';
import { newSong, retarget, roleOf } from './factory';
import type { PatternContent, Song } from './types';

// A song with its drums written and a second, empty drum track on the Latin kit.
function twoKits(): { song: Song; drums: string; latin: string } {
  let song = newSong('p1');
  const drums = song.tracks.find((t) => roleOf(t) === 'drums')!;
  const latin = { ...retarget(structuredClone(drums), 'instrument.drums-latin', 'drums', 'Batería 6'), id: 'latin-track' };
  song = { ...song, tracks: [...song.tracks, latin] };
  song = clearWritten(song, latin.id, null);
  return { song, drums: drums.id, latin: latin.id };
}

describe('changing a track to an instrument another track already has', () => {
  it('swaps with an empty twin: nothing repeated, the beat kept', () => {
    const { song, drums, latin } = twoKits();
    const before = song.tracks.find((t) => t.id === drums)!.instrument!.key;
    expect(swapPartner(song, drums, 'instrument.drums-latin')?.id).toBe(latin);
    const after = setInstrument(song, drums, { key: 'instrument.drums-latin', version: '1.0.0' }, null);
    const d = after.tracks.find((t) => t.id === drums)!;
    const l = after.tracks.find((t) => t.id === latin)!;
    expect(d.instrument!.key).toBe('instrument.drums-latin');
    expect(l.instrument!.key).toBe(before);
    expect(l.name).toBe('Batería 6');
    expect(hasWritten(after, drums)).toBe(true);
    const hits = (x: Song, id: string) => (x.tracks.find((t) => t.id === id)!.clips[0].content as PatternContent).rows.reduce((n, r) => n + r.hits.length, 0);
    expect(hits(after, drums)).toBe(hits(song, drums));
  });

  it('leaves a twin with something written alone', () => {
    let { song, drums, latin } = twoKits();
    song = toggleHit(song, latin, 0, 0, null);
    expect(swapPartner(song, drums, 'instrument.drums-latin')).toBeUndefined();
    const after = setInstrument(song, drums, { key: 'instrument.drums-latin', version: '1.0.0' }, null);
    expect(after.tracks.find((t) => t.id === latin)!.instrument!.key).toBe('instrument.drums-latin');
  });

  it('does nothing extra when no other track has the instrument', () => {
    const { song, drums } = twoKits();
    expect(swapPartner(song, drums, 'instrument.drums-jazz')).toBeUndefined();
  });
});

describe('one sound per track', () => {
  it('keeps the version that plays and saves the other as a sound', () => {
    let song = newSong('p1');
    const t = song.tracks[0];
    const chain = { routing: 'series' as const, slots: [] };
    song = { ...song, tracks: song.tracks.map((x) => (x.id === t.id
      ? { ...x, sound: { id: 'mine', name: 'Mi sonido', chain }, producer: { instrument: x.instrument, sound: { id: 'prod', name: 'Producida', chain }, by: null, updated_at: '' }, voice_from: 'producer' as const }
      : x)) };
    const { song: out, sounds } = foldVersions(song, 'p1');
    const o = out.tracks.find((x) => x.id === t.id)!;
    expect(o.sound?.id).toBe('prod');
    expect('producer' in o || 'voice_from' in o).toBe(false);
    expect(sounds.map((x) => x.id)).toEqual(['mine']);
    expect(foldVersions(out, 'p1').sounds).toEqual([]);
  });
});
