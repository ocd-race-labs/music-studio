import { describe, expect, it } from 'vitest';
import {
  copySection, deleteSectionBars, markSection, MAX_BARS, removeSection, renameSection, repeatSection, sectionAtBar,
  setSectionKind, setSongBars, unmarkedRanges,
} from './arrange';
import { toggleHit, toggleNote } from './commands';
import { newProfile, newSong, normalizeSong, songBars } from './factory';
import type { NotesContent, PatternContent, Song } from './types';
import { BAR_TICKS } from './types';

const me = newProfile('Test', 'graphite', '#74747A');
const kick = (s: Song) => (s.tracks[0].clips[0].content as PatternContent).rows[0].hits.map((h) => h.step);
const bass = (s: Song) => (s.tracks[1].clips[0].content as NotesContent).notes.map((n) => [n.tick / 240, n.dur / 240]);
const names = (s: Song) => s.sections.map((x) => `${x.name}@${x.start_tick / BAR_TICKS}+${x.length_ticks / BAR_TICKS}`);

/** 8 bars: intro bar 0-1, verse 2-5, chorus 6-7; one bass note per bar's first step. */
function song8(): Song {
  let s = setSongBars(newSong(me.id, 'x', 2), 8, me.id);
  for (let b = 0; b < 8; b++) s = toggleNote(s, s.tracks[1].id, 36 + b, b * 16, 4, me.id);
  s = markSection(s, 0, 1, 'intro', 'es', me.id);
  s = markSection(s, 2, 5, 'verse', 'es', me.id);
  s = markSection(s, 6, 7, 'chorus', 'es', me.id);
  return s;
}

describe('song form', () => {
  it('new songs have a length and no sections; old songs convert', () => {
    const s = newSong(me.id);
    expect(s.length_ticks).toBe(2 * BAR_TICKS);
    expect(s.sections).toEqual([]);
    const old = { ...s, length_ticks: undefined, sections: [{ id: 'a', position: 1, name: 'Loop', start_tick: 0, length_ticks: 2 * BAR_TICKS, key_tonic: null, key_mode: null, lyrics_lang: null }] };
    const fixed = normalizeSong(old as Song);
    expect(fixed.length_ticks).toBe(2 * BAR_TICKS);
    expect(fixed.sections).toEqual([]);
  });

  it('grows up to 96 bars', () => {
    const s = setSongBars(newSong(me.id), 200, me.id);
    expect(songBars(s)).toBe(MAX_BARS);
    expect((s.tracks[0].clips[0].content as PatternContent).steps).toBe(MAX_BARS * 16);
  });

  it('marks parts with automatic names and colors by kind', () => {
    let s = song8();
    expect(names(s)).toEqual(['Intro@0+2', 'Verso@2+4', 'Coro@6+2']);
    expect(sectionAtBar(s, 3)?.kind).toBe('verse');
    // A new mark over an old one takes its place.
    s = markSection(s, 4, 5, 'prechorus', 'es', me.id);
    expect(names(s)).toEqual(['Intro@0+2', 'Verso@2+2', 'Pre-coro@4+2', 'Coro@6+2']);
    s = renameSection(s, s.sections[3].id, 'Coro de la luz', 'es', me.id);
    s = setSectionKind(s, s.sections[0].id, 'verse', 'es', me.id);
    expect(names(s)).toEqual(['Verso 1@0+2', 'Verso 2@2+2', 'Pre-coro@4+2', 'Coro de la luz@6+2']);
    s = removeSection(s, s.sections[2].id, 'es', me.id);
    expect(unmarkedRanges(s)).toEqual([{ from: 4, to: 5 }]);
    expect(bass(s)).toHaveLength(8);
  });

  it('adds a chorus at a later bar, inserting room, with every track', () => {
    let s = song8();
    s = toggleHit(s, s.tracks[0].id, 0, 6 * 16 + 4, me.id);
    const chorus = s.sections[2].id;
    s = copySection(s, chorus, 2, 'insert', 'es', me.id);
    expect(songBars(s)).toBe(10);
    expect(names(s)).toEqual(['Intro@0+2', 'Coro 1@2+2', 'Verso@4+4', 'Coro 2@8+2']);
    // The chorus notes (bars 6 and 7 before) now play at bars 2-3 and, moved, at 8-9.
    expect(bass(s).map(([t]) => t / 16)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(kick(s)).toContain(2 * 16 + 4);
    expect(kick(s)).toContain(8 * 16 + 4);
  });

  it('replaces bars with a copy, or appends one past the end', () => {
    let s = song8();
    const intro = s.sections[0].id;
    s = copySection(s, intro, 6, 'replace', 'es', me.id);
    expect(songBars(s)).toBe(8);
    expect(names(s)).toEqual(['Intro 1@0+2', 'Verso@2+4', 'Intro 2@6+2']);
    s = copySection(s, s.sections[1].id, 8, 'insert', 'es', me.id);
    expect(songBars(s)).toBe(12);
    expect(names(s).at(-1)).toBe('Verso 2@8+4');
  });

  it('repeats a part right after itself and refuses to pass 96 bars', () => {
    let s = song8();
    s = repeatSection(s, s.sections[0].id, 3, 'es', me.id);
    expect(songBars(s)).toBe(14);
    expect(names(s).slice(0, 4)).toEqual(['Intro 1@0+2', 'Intro 2@2+2', 'Intro 3@4+2', 'Intro 4@6+2']);
    const big = setSongBars(s, 95, me.id);
    expect(copySection(big, big.sections[0].id, 95, 'insert', 'es', me.id)).toBe(big);
  });

  it('deletes a part with its bars and closes the gap', () => {
    let s = song8();
    s = deleteSectionBars(s, s.sections[1].id, 'es', me.id);
    expect(songBars(s)).toBe(4);
    expect(names(s)).toEqual(['Intro@0+2', 'Coro@2+2']);
    expect(bass(s).map(([t]) => t / 16)).toEqual([0, 1, 2, 3]);
  });

  it('a note crossing the insert point stops there', () => {
    let s = setSongBars(newSong(me.id), 4, me.id);
    s = toggleNote(s, s.tracks[1].id, 40, 8, 16, me.id); // bar 0 step 8, one bar long
    s = markSection(s, 1, 1, 'chorus', 'en', me.id);
    s = copySection(s, s.sections[0].id, 1, 'insert', 'en', me.id);
    expect(bass(s)[0]).toEqual([8, 8]);
  });
});
