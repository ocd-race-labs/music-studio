import { describe, expect, it } from 'vitest';
import { hasWritten, keepIdea, setInstrument, switchKit, toggleNote } from './commands';
import { newProfile, newSong, roleOf, slotsFor } from './factory';
import type { Idea, NotesContent, PatternContent, Song } from './types';
import {
  CATALOG, CUSTOM_KIT, findByKey, INSTRUMENTS, isDrumKit, KITS, kitSlots, ref, rowsOf, rowVoice, swapsFor,
} from '../packs/core';
import { DRUM_KITS, MELODIC_VOICES } from '../engine/voices';

const me = newProfile('Test', 'graphite', '#74747A');
const pattern = (s: Song, i: number) => s.tracks[i].clips[0].content as PatternContent;
const notes = (s: Song, i: number) => (s.tracks[i].clips[0].content as NotesContent).notes;

describe('catalog of kits', () => {
  it('every kit slot points to an instrument in the catalog', () => {
    for (const k of KITS) for (const slot of kitSlots(k.key)) expect(findByKey(slot.instrument), `${k.key} ${slot.instrument}`).toBeDefined();
  });

  it('every instrument has a voice the engine can build', () => {
    for (const i of INSTRUMENTS) {
      const m = i.manifest as { type: string; kit?: string; voice?: string };
      if (m.type === 'drumkit') expect(DRUM_KITS, i.key).toContain(m.kit);
      else expect(MELODIC_VOICES, i.key).toContain(m.voice);
    }
  });

  it('every drum row of every kit has a voice', () => {
    for (const i of INSTRUMENTS.filter((x) => isDrumKit(x.key))) {
      for (const row of rowsOf(i.key)) expect(rowVoice(i.key, row), `${i.key} ${row}`).toBeTruthy();
    }
  });

  it('keys are unique and versioned', () => {
    const keys = CATALOG.map((c) => `${c.key}@${c.version}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('each genre has drums, bass, chords and a melody', () => {
    for (const k of KITS) {
      const roles = kitSlots(k.key).map((s) => s.role);
      for (const r of ['drums', 'bass', 'chords', 'lead'] as const) expect(roles, k.key).toContain(r);
    }
  });

  it('latin has hand percussion and classical has orchestral percussion', () => {
    expect(kitSlots('kit.latin').map((s) => s.instrument)).toContain('instrument.perc-latin');
    expect(kitSlots('kit.classical')[0].instrument).toBe('instrument.drums-orch');
  });

  it('a drum kit swaps only with kits of the same rows', () => {
    expect(swapsFor('instrument.drums-rock').map((i) => i.key)).not.toContain('instrument.drums-orch');
    expect(swapsFor('instrument.drums-orch').map((i) => i.key)).toEqual(['instrument.drums-orch']);
  });
});

describe('new song per kit', () => {
  it('starts each genre with its instruments and a beat', () => {
    for (const k of KITS) {
      const s = newSong(me.id, k.key, 2, 'en', k.key);
      expect(s.kit_key).toBe(k.key);
      expect(s.tracks.map((t) => t.instrument?.key)).toEqual(kitSlots(k.key).map((x) => x.instrument));
      const drums = s.tracks.findIndex((t) => t.kind === 'drums');
      expect(pattern(s, drums).rows.some((r) => r.hits.length > 0), k.key).toBe(true);
    }
  });

  it('classical drums use the orchestral rows', () => {
    const s = newSong(me.id, 'x', 1, 'es', 'kit.classical');
    expect(pattern(s, 0).rows.map((r) => r.sound.key)[0]).toBe('sound.bass-drum');
  });

  it('builds the custom kit from the stars, grouped by role', () => {
    const starred = [
      { key: 'instrument.violin', role: 'lead' as const },
      { key: 'instrument.drums-rock', role: 'drums' as const },
      { key: 'instrument.bass-upright', role: 'bass' as const },
    ];
    const s = newSong(me.id, 'Mine', 2, 'es', CUSTOM_KIT, starred);
    expect(s.kit_key).toBe(CUSTOM_KIT);
    expect(s.tracks.map((t) => t.instrument?.key)).toEqual(['instrument.drums-rock', 'instrument.bass-upright', 'instrument.violin']);
    expect(s.tracks.map((t) => t.name)).toEqual(['Batería', 'Bajo', 'Melodía']);
  });

  it('an empty custom kit falls back to hip hop', () => {
    expect(slotsFor(CUSTOM_KIT, [])).toEqual(kitSlots('kit.hiphop'));
  });
});

describe('switching kit', () => {
  it('keeps the notes on the instrument with the same role', () => {
    let s = newSong(me.id, 'x', 2, 'en');
    const bassId = s.tracks[1].id;
    s = toggleNote(s, bassId, 36, 0, 4, me.id);
    const kickHits = pattern(s, 0).rows[0].hits.length;
    const next = switchKit(s, 'kit.rock', slotsFor('kit.rock'), 'en', me.id);
    expect(next.kit_key).toBe('kit.rock');
    expect(next.tracks[1].id).toBe(bassId);
    expect(next.tracks[1].instrument?.key).toBe('instrument.bass-electric');
    expect(notes(next, 1)).toHaveLength(1);
    expect(pattern(next, 0).rows[0].hits).toHaveLength(kickHits);
    expect(next.tracks[2].clips[0].kind).toBe('chords');
  });

  it('moves the beat by place onto orchestral percussion and back', () => {
    const s = newSong(me.id, 'x', 2, 'en');
    const snareHits = pattern(s, 0).rows[1].hits;
    const orch = switchKit(s, 'kit.classical', slotsFor('kit.classical'), 'en', me.id);
    expect(pattern(orch, 0).rows[1].sound.key).toBe('sound.snare-orch');
    expect(pattern(orch, 0).rows[1].hits).toEqual(snareHits);
    const back = switchKit(orch, 'kit.hiphop', slotsFor('kit.hiphop'), 'en', me.id);
    expect(pattern(back, 0).rows[1].sound.key).toBe('sound.snare');
    expect(pattern(back, 0).rows[1].hits).toEqual(snareHits);
  });

  it('adds empty tracks for new roles and keeps old tracks that have notes', () => {
    let latin = newSong(me.id, 'x', 2, 'en', 'kit.latin');
    expect(latin.tracks[1].instrument?.key).toBe('instrument.perc-latin');
    const toHiphop = switchKit(latin, 'kit.hiphop', slotsFor('kit.hiphop'), 'en', me.id);
    // The percussion has a beat, so it stays at the end.
    expect(toHiphop.tracks.at(-1)?.instrument?.key).toBe('instrument.perc-latin');
    latin = { ...latin, tracks: latin.tracks.map((t, i) => (i === 1 ? { ...t, clips: [{ ...t.clips[0], content: { steps: 32, rows: [] } }] } : t)) };
    const empty = switchKit(latin, 'kit.hiphop', slotsFor('kit.hiphop'), 'en', me.id);
    expect(empty.tracks.map((t) => t.instrument?.key)).not.toContain('instrument.perc-latin');
    const back = switchKit(newSong(me.id, 'y'), 'kit.latin', slotsFor('kit.latin'), 'en', me.id);
    expect(pattern(back, 1).rows.every((r) => r.hits.length === 0)).toBe(true);
  });

  it('renames tracks the app named and leaves typed names', () => {
    const s = newSong(me.id, 'x', 2, 'en');
    const typed = { ...s, tracks: s.tracks.map((t, i) => (i === 4 ? { ...t, name: 'Hook' } : t)) };
    const next = switchKit(typed, 'kit.jazz', slotsFor('kit.jazz'), 'es', me.id);
    expect(next.tracks.map((t) => t.name)).toEqual(['Batería', 'Bajo', 'Acordes', 'Acompañamiento', 'Hook', 'Contramelodía']);
  });

  it('gives songs made before kits a role from their instruments', () => {
    const s = newSong(me.id, 'x');
    const old = s.tracks.map(({ role: _r, ...t }) => t);
    expect(old.map((t) => roleOf(t))).toEqual(['drums', 'bass', 'chords', 'keys', 'lead', 'color']);
  });
});

describe('instrument swap and ideas', () => {
  it('swapping a track instrument keeps its notes and role', () => {
    let s = newSong(me.id, 'x');
    s = toggleNote(s, s.tracks[4].id, 72, 0, 2, me.id);
    const next = setInstrument(s, s.tracks[4].id, ref('instrument.flute'), me.id);
    expect(next.tracks[4].instrument?.key).toBe('instrument.flute');
    expect(next.tracks[4].role).toBe('lead');
    expect(notes(next, 4)).toHaveLength(1);
  });

  it('a drum idea lands on orchestral rows by place', () => {
    const s = newSong(me.id, 'x', 2, 'en', 'kit.classical');
    const idea = {
      id: 'i', song_id: s.id, section_id: null, track_id: null, kind: 'pattern', title: 'Beat', prompt: null, target_instrument: null,
      payload: { steps: 32, rows: [{ sound: { key: 'sound.kick', version: '1.0.0' }, hits: [{ step: 0, vel: 1 }, { step: 16, vel: 1 }] }] },
      payload_schema_version: 1, status: 'proposed', validation: null, origin: 'claude', requested_by: null, decided_by: null, decided_at: null,
      created_at: '', updated_at: '',
    } as Idea;
    const next = keepIdea(s, idea, s.tracks[0].id, me.id);
    const rows = pattern(next, 0).rows;
    expect(rows[0].sound.key).toBe('sound.bass-drum');
    expect(rows[0].hits.map((h) => h.step)).toEqual([0, 16]);
    expect(rows).toHaveLength(8);
  });
});

describe('long notes', () => {
  it('hold and drag writes one sustained note and replaces what that pitch had there', async () => {
    const { setNoteSpan } = await import('./commands');
    let s = newSong(me.id, 'x');
    const lead = s.tracks[4].id;
    s = toggleNote(s, lead, 60, 2, 1, me.id);
    s = toggleNote(s, lead, 60, 3, 1, me.id);
    s = toggleNote(s, lead, 64, 2, 1, me.id);
    s = setNoteSpan(s, lead, 60, 1, 4, me.id);
    const ns = notes(s, 4);
    expect(ns.filter((n) => n.midi === 60)).toEqual([expect.objectContaining({ tick: 240, dur: 960 })]);
    expect(ns.filter((n) => n.midi === 64)).toHaveLength(1);
    // Never past the end of the loop.
    s = setNoteSpan(s, lead, 67, 30, 8, me.id);
    expect(notes(s, 4).find((n) => n.midi === 67)?.dur).toBe(2 * 240);
  });
});

describe('starting a song', () => {
  it('the first song of a profile brings an example beat and chords', () => {
    expect(hasWritten(newSong(me.id, 'First', 2, 'es'))).toBe(true);
  });
  it('a new song, or starting blank in another kit, brings nothing', () => {
    for (const k of KITS) expect([k.key, hasWritten(newSong(me.id, 'Blank', 2, 'es', k.key, [], false))]).toEqual([k.key, false]);
    const blank = newSong(me.id, 'Blank', 4, 'es', 'kit.latin', [], false);
    expect(blank.tracks.length).toBe(newSong(me.id, 'x', 4, 'es', 'kit.latin').tracks.length);
  });
});
