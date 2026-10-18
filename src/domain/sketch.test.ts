import { describe, expect, it } from 'vitest';
import { newSong, roleOf } from './factory';
import * as C from './commands';
import * as S from './sketch';
import type { ChordsContent, NotesContent, PatternContent, Song } from './types';
import { BAR_TICKS } from './types';

const withSketch = (song: Song, fn: (s: NonNullable<Song['sketch']>) => NonNullable<Song['sketch']> | null): Song => {
  const next = fn(song.sketch ?? S.newSketch(song));
  return next ? { ...song, sketch: next } : song;
};
const trackOf = (song: Song, role: string) => song.tracks.find((t) => roleOf(t) === role)!;

describe('the idea', () => {
  it('a template repeats the same block where the form says so', () => {
    const song = withSketch(newSong('p', 'T', 2, 'es', 'kit.rock'), (s) => S.applyTemplate(s, 'song', false));
    const sk = song.sketch!;
    expect(sk.order).toHaveLength(8);
    expect(sk.blocks).toHaveLength(7);
    expect(sk.order[2]).toBe(sk.order[4]); // Coro 1 twice
    const names = sk.order.map((id) => S.blockName(sk.blocks.find((b) => b.id === id)!, 'es'));
    expect(names).toEqual(['Intro 1', 'Verso 1', 'Coro 1', 'Verso 2', 'Coro 1', 'Puente 1', 'Coro 2', 'Outro 1']);
    expect(S.totalBars(sk)).toBe(56);
  });

  it('renders chords, drums and bass over the form, and leaves the detail alone', () => {
    let song = newSong('p', 'T', 2, 'es', 'kit.rock');
    song = withSketch(song, (s) => S.setIdeaInstruments(S.applyTemplate(s, 'beat', false), { bass_instrument: { key: 'instrument.bass-electric', version: '1.0.0' } }));
    const idea = S.renderIdea(song, 'es');
    expect(idea.length_ticks).toBe(S.totalBars(song.sketch!) * BAR_TICKS);
    const chords = (trackOf(idea, 'chords').clips[0].content as ChordsContent).chords;
    expect(chords.length).toBe(S.totalBars(song.sketch!));
    const hits = (trackOf(idea, 'drums').clips[0].content as PatternContent).rows.reduce((n, r) => n + r.hits.length, 0);
    expect(hits).toBeGreaterThan(50);
    const bass = (trackOf(idea, 'bass').clips[0].content as NotesContent).notes;
    expect(bass.length).toBeGreaterThan(20);
    expect(bass.every((n) => n.midi >= 36 && n.midi <= 47)).toBe(true);
    // the song itself is not touched by rendering
    expect(song.length_ticks).toBe(2 * BAR_TICKS);
  });

  it('accepting writes the detail; melody notes move with their part when the form changes', () => {
    let song = newSong('p', 'T', 2, 'es', 'kit.rock');
    song = withSketch(song, (s) => S.applyTemplate(s, 'short', false)); // intro 4, verso 8, coro 8, verso, coro, outro 4
    song = S.applyIdea(song, 'es', 'p');
    expect(song.sections.map((x) => x.name)).toEqual(['Intro 1', 'Verso 1', 'Coro 1', 'Verso 1', 'Coro 1', 'Outro 1']);
    expect(song.sketch!.accepted_at).not.toBeNull();
    // a melody note in the first chorus (bar 13, the first bar of Coro 1)
    const lead = trackOf(song, 'lead');
    song = C.toggleNote(song, lead.id, 72, 12 * 16, 4, 'p');
    // the detail never writes the idea
    expect(song.sketch!.order).toHaveLength(6);
    // make the intro longer in the idea, then write it again: the chorus note moves 4 bars later
    const introId = song.sketch!.order[0];
    song = withSketch(song, (s) => S.setBlockBars(s, introId, 8));
    song = S.applyIdea(song, 'es', 'p');
    const notes = (trackOf(song, 'lead').clips[0].content as NotesContent).notes;
    expect(notes.map((n) => n.tick)).toEqual([16 * BAR_TICKS]);
  });

  it('writes one block again without touching the others', () => {
    let song = newSong('p', 'T', 2, 'es', 'kit.rock');
    song = withSketch(song, (s) => S.applyTemplate(s, 'loop', false)); // verso 4, coro 4
    song = S.applyIdea(song, 'es', 'p');
    expect(S.detailFollowsForm(song)).toBe(true);
    const chordsId = trackOf(song, 'chords').id;
    // the musician changes bar 1 (verse) and bar 5 (chorus) in the detail
    song = C.setChord(song, chordsId, 0, 6, 'p');
    song = C.setChord(song, chordsId, 4, 6, 'p');
    const coro = song.sketch!.order[1];
    song = withSketch(song, (s) => S.setChordAt(s, coro, 0, 1));
    song = S.applyIdea(song, 'es', 'p', coro);
    const chords = (trackOf(song, 'chords').clips[0].content as ChordsContent).chords;
    expect(chords.find((c) => c.tick === 0)!.degree).toBe(6); // the verse keeps the detail
    expect(chords.find((c) => c.tick === 4 * BAR_TICKS)!.degree).toBe(1); // the chorus follows the idea again
  });

  it('two chords per bar and the bar limit', () => {
    let song = newSong('p', 'T', 2, 'es', 'kit.rock');
    song = withSketch(song, (s) => S.addBlock(s, 'verse', 4, false));
    const id = song.sketch!.order[0];
    song = withSketch(song, (s) => S.setSplit(s, id, true));
    expect(song.sketch!.blocks[0].chords).toHaveLength(8);
    const idea = S.renderIdea(song, 'es');
    expect((trackOf(idea, 'chords').clips[0].content as ChordsContent).chords.every((c) => c.dur === BAR_TICKS / 2)).toBe(true);
    let sk = song.sketch!;
    for (let i = 0; i < 30; i++) sk = S.repeatBlock(sk, id) ?? sk;
    expect(S.totalBars(sk)).toBeLessThanOrEqual(96);
  });
});
