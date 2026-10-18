import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  keepIdea, resetFx, resetSwing, setChord, setFxBypass, setFxParam, setKey, setLoopBars, setSwing, setTempo, toggleHit, toggleNote,
} from './commands';
import { loopSteps, newProfile, newSong } from './factory';
import { exportSongFile, parseIdeasFile, parseSongFile, withFreshIds } from './files';
import type { ChordsContent, NotesContent, PatternContent } from './types';
import { openBrowserStore } from '../store/store';

const me = newProfile('Test', 'midnight-jewel', '#F0509E');

describe('new song', () => {
  it('starts with a beat, a chord progression and six tracks', () => {
    const s = newSong(me.id);
    expect(s.tracks.map((t) => t.name)).toEqual(['Drums', '808', 'Chords', 'Keys', 'Lead', 'Strings']);
    expect(loopSteps(s)).toBe(32);
    const kick = (s.tracks[0].clips[0].content as PatternContent).rows[0];
    expect(kick.sound.key).toBe('sound.kick');
    expect(kick.hits.length).toBeGreaterThan(0);
  });
});

describe('commands', () => {
  it('toggles notes on and off and spells them for the key', () => {
    let s = setKey(newSong(me.id), 'Db', 'major', me.id);
    const lead = s.tracks[4].id;
    s = toggleNote(s, lead, 66, 0, 2, me.id);
    const notes = (s.tracks[4].clips[0].content as NotesContent).notes;
    expect(notes).toHaveLength(1);
    expect(notes[0].spell).toBe('Gb4');
    expect(notes[0].dur).toBe(480);
    s = toggleNote(s, lead, 66, 1, 2, me.id);
    expect((s.tracks[4].clips[0].content as NotesContent).notes).toHaveLength(0);
  });

  it('respells existing notes when the key changes', () => {
    let s = newSong(me.id);
    const lead = s.tracks[4].id;
    s = toggleNote(s, lead, 66, 0, 1, me.id);
    expect((s.tracks[4].clips[0].content as NotesContent).notes[0].spell).toBe('F#4');
    s = setKey(s, 'Db', 'major', me.id);
    expect((s.tracks[4].clips[0].content as NotesContent).notes[0].spell).toBe('Gb4');
  });

  it('grows the loop by repeating the beat and the chords', () => {
    let s = newSong(me.id, 'x', 1);
    s = toggleHit(s, s.tracks[0].id, 5, 3, me.id);
    s = setLoopBars(s, 4, me.id);
    const rim = (s.tracks[0].clips[0].content as PatternContent).rows[5].hits.map((h) => h.step);
    expect(rim).toEqual([3, 19, 35, 51]);
    expect((s.tracks[2].clips[0].content as ChordsContent).chords).toHaveLength(4);
    expect(loopSteps(s)).toBe(64);
  });

  it('sets and clears a chord in a bar', () => {
    let s = newSong(me.id);
    const chords = s.tracks[2].id;
    s = setChord(s, chords, 1, 3, me.id);
    expect((s.tracks[2].clips[0].content as ChordsContent).chords.find((c) => c.tick === 3840)?.degree).toBe(3);
    s = setChord(s, chords, 1, null, me.id);
    expect((s.tracks[2].clips[0].content as ChordsContent).chords.some((c) => c.tick === 3840)).toBe(false);
  });

  it('keeps tempo in a playable range', () => {
    expect(setTempo(newSong(me.id), 999, me.id).tempo_bpm).toBe(200);
  });

  it('resets swing and a pedal to where a new song starts, leaving on or off alone', () => {
    const fresh = newSong(me.id);
    const drums = fresh.tracks[0].id;
    let s = setSwing(fresh, 0.5, me.id);
    s = setFxBypass(s, drums, 1, false, me.id);
    s = setFxParam(s, drums, 1, 'feedback', 0.8, me.id);
    s = setFxParam(s, drums, 2, 'size', 7, me.id);
    s = resetSwing(resetFx(resetFx(s, drums, 1, me.id), drums, 2, me.id), me.id);
    expect(s.swing).toBe(fresh.swing);
    expect(s.tracks[0].fx_chain.slots[1].params).toEqual(fresh.tracks[0].fx_chain.slots[1].params);
    expect(s.tracks[0].fx_chain.slots[2].params).toEqual(fresh.tracks[0].fx_chain.slots[2].params);
    expect(s.tracks[0].fx_chain.slots[1].bypass).toBe(false);
  });
});

describe('files', () => {
  it('round-trips a song file', () => {
    const s = newSong(me.id, 'Round trip');
    const parsed = parseSongFile(exportSongFile(s));
    expect(parsed.ok && parsed.value.title).toBe('Round trip');
    const copy = withFreshIds(s, me.id);
    expect(copy.id).not.toBe(s.id);
    expect(copy.tracks[0].id).not.toBe(s.tracks[0].id);
  });

  it('rejects a song that needs an instrument this app does not have', () => {
    const s = newSong(me.id);
    s.tracks[1].instrument = { key: 'instrument.theremin', version: '1.0.0' };
    const parsed = parseSongFile(exportSongFile(s));
    expect(parsed.ok).toBe(false);
  });

  it('reads a valid idea file from Claude', () => {
    const file = JSON.stringify({
      format: 'music-studio.ideas',
      version: 1,
      ideas: [{
        kind: 'melody',
        title: 'Calmer melody',
        target_instrument: { key: 'instrument.lead-bright', version: '1.0.0' },
        payload: { notes: [{ tick: 0, dur: 480, midi: 65, vel: 0.8 }] },
      }],
    });
    const parsed = parseIdeasFile(file, 'song-1', me.id);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value[0].status).toBe('proposed');
      expect(parsed.value[0].origin).toBe('claude');
    }
  });

  it('refuses an idea file with a broken payload', () => {
    const file = JSON.stringify({
      format: 'music-studio.ideas', version: 1,
      ideas: [{ kind: 'melody', title: 'Broken', payload: { notes: [{ tick: -5, dur: 0, midi: 200 }] } }],
    });
    const parsed = parseIdeasFile(file, 'song-1', me.id);
    expect(parsed.ok).toBe(false);
  });

  it('keeps an idea into a track, stamped with where it came from', () => {
    const s = newSong(me.id);
    const parsed = parseIdeasFile(JSON.stringify({
      format: 'music-studio.ideas', version: 1,
      ideas: [{ kind: 'melody', title: 'x', payload: { notes: [{ tick: 0, dur: 960, midi: 64, vel: 0.7 }, { tick: 99999, dur: 960, midi: 64 }] } }],
    }), s.id, me.id);
    if (!parsed.ok) throw new Error('should parse');
    const kept = keepIdea(s, parsed.value[0], s.tracks[4].id, me.id);
    const clip = kept.tracks[4].clips[0];
    expect((clip.content as NotesContent).notes).toHaveLength(1);
    expect(clip.idea_id).toBe(parsed.value[0].id);
    expect(clip.origin).toBe('claude');
  });
});

describe('browser song store', () => {
  it('saves profiles, songs and versions', async () => {
    const store = await openBrowserStore(`test-${Math.random()}`);
    await store.saveProfile(me);
    expect((await store.listProfiles()).map((p) => p.name)).toEqual(['Test']);
    const s = newSong(me.id, 'Stored');
    await store.saveSong(s);
    expect((await store.listSongs(me.id))[0].title).toBe('Stored');
    await store.saveVersion(s, 'first', me.id);
    await store.saveVersion(s, 'second', me.id);
    expect((await store.listVersions(s.id)).map((v) => v.version_no)).toEqual([2, 1]);
    await store.deleteSong(s.id);
    expect(await store.listSongs(me.id)).toHaveLength(0);
    await store.setMeta('last_profile', me.id);
    expect(await store.getMeta('last_profile')).toBe(me.id);
  });

  it('keeps the home order people were set up in, and can start over', async () => {
    const store = await openBrowserStore(`test-${Math.random()}`);
    const second = { ...newProfile('Second', 'graphite', '#74747A'), order: 1, created_at: '2026-01-01T00:00:00.000Z' };
    const first = { ...newProfile('First', 'midnight-jewel', '#F0509E'), order: 0, created_at: '2026-01-02T00:00:00.000Z' };
    await store.saveProfile(second);
    await store.saveProfile(first);
    expect((await store.listProfiles()).map((p) => p.name)).toEqual(['First', 'Second']);
    await store.saveSong(newSong(first.id, 'Mine'));
    await store.clearAll();
    expect(await store.listProfiles()).toHaveLength(0);
    expect(await store.listSongs(first.id)).toHaveLength(0);
  });

  it('names the tracks of a new song in Spanish when asked', () => {
    expect(newSong(me.id, 'Canción', 2, 'es').tracks.map((t) => t.name)).toEqual(['Batería', '808', 'Acordes', 'Teclado', 'Melodía', 'Cuerdas']);
  });
});
