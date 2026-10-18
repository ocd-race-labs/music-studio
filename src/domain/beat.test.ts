import { describe, expect, it } from 'vitest';
import { buildBeat, parseRequest, planFor, toKey } from './beat';
import { roleOf } from './factory';
import type { ChordsContent, NotesContent, PatternContent } from './types';
import { scalePitchClasses } from '../theory';

describe('beat assistant: reading the request', () => {
  it('understands a style from words, a reference or both', () => {
    expect(parseRequest('acid jazz chill out beat como al estilo portishead').styles[0].group).toBe('el-triphop');
    expect(parseRequest('un boom bap noventero a 92 bpm').styles[0].group).toBe('hh-boombap');
    expect(parseRequest('punk rápido para saltar').styles[0].group).toBe('rock-punk');
    expect(parseRequest('techno acid oscuro').styles[0].group).toBe('el-techno');
    expect(parseRequest('algo tipo Metallica').styles[0].group).toBe('rock-metal');
    expect(parseRequest('drum and bass liquid').styles[0].group).toBe('el-dnb');
  });
  it('acid jazz is not acid techno', () => {
    const p = parseRequest('acid jazz');
    expect(p.styles[0].group).toBe('el-triphop');
    expect(p.styles.some((s) => s.group === 'el-techno')).toBe(false);
  });
  it('reads tempo, mood, pace, feel and instruments', () => {
    const p = parseRequest('house alegre a 126 bpm con piano y swing');
    expect(p.tempo).toBe(126);
    expect(p.mood).toBe('bright');
    expect(p.swing).toBe(true);
    expect(p.wants).toContain('piano');
    expect(parseRequest('lofi lento y triste').mood).toBe('dark');
    expect(parseRequest('lofi lento y triste').pace).toBe('slow');
  });
  it('never repeats a reference back', () => {
    expect(parseRequest('como portishead').understood.join(' ')).not.toContain('portishead');
  });
  it('nothing understood leaves the choice open', () => {
    expect(parseRequest('hola qué tal').styles).toEqual([]);
  });
});

describe('beat assistant: the plan and the song', () => {
  it('plans tempo in the style range, minor for dark, the chord sound asked for', () => {
    const plan = planFor(parseRequest('acid jazz chill out estilo portishead con piano'));
    expect(plan.group).toBe('el-triphop');
    expect(plan.tempo).toBeGreaterThanOrEqual(76);
    expect(plan.tempo).toBeLessThanOrEqual(100);
    expect(plan.mode).toBe('minor');
    expect(plan.chords).toMatch(/keys|piano/);
    expect(planFor(parseRequest('trap a 140')).tempo).toBe(140);
  });
  it('moves phrases into the key and onto its scale', () => {
    for (const tonic of ['C', 'F#', 'Bb']) {
      const scale = scalePitchClasses({ tonic, mode: 'major' });
      for (const m of [33, 36, 40, 45, 48]) expect(scale).toContain(((toKey(m, tonic, 'major') % 12) + 12) % 12);
    }
    expect(toKey(45, 'A', 'minor')).toBe(45);
  });
  it('builds a song with the kit, its groove, a bass line and chords', () => {
    for (const text of ['boom bap noventero', 'house para bailar', 'punk rápido', 'metal', 'dubstep oscuro']) {
      const plan = planFor(parseRequest(text));
      const song = buildBeat(plan, 'me', 'es', 'Beat');
      expect(song.tempo_bpm, text).toBe(plan.tempo);
      const drums = song.tracks.find((t) => roleOf(t) === 'drums')!;
      expect(drums.instrument?.key, text).toBe(plan.drums);
      const hits = (drums.clips[0].content as PatternContent).rows.reduce((n, r) => n + r.hits.length, 0);
      expect(hits, text).toBeGreaterThan(8);
      const bass = song.tracks.find((t) => roleOf(t) === 'bass')!;
      expect((bass.clips[0].content as NotesContent).notes.length, text).toBeGreaterThan(4);
      const chords = song.tracks.find((t) => roleOf(t) === 'chords')!;
      expect((chords.clips[0].content as ChordsContent).chords, text).toHaveLength(plan.bars);
    }
  });
});
