// Commands: the only way the song changes. Each returns a new song (immutable),
// which gives undo for free and one validated path for people and Claude's ideas alike.

import { noteNameAscii, spellInKey } from '../theory';
import type {
  CatalogRef, ChordEvent, ChordsContent, Clip, Idea, Note, NotesContent, PatternContent, Song, Track, CustomSound } from './types';
import { BAR_TICKS, STEP_TICKS } from './types';
import { DEFAULT_SWING, defaultFxParams, newId, now, retarget, roleOf, switchKit as switchKitOf } from './factory';
import { pedalRank, ref, rowFor } from '../packs/core';
import { setSongBars } from './arrange';
import type { KitSlot } from '../packs/core';
import type { Lang } from './types';

const touch = (song: Song, by: string | null): Song => ({ ...song, updated_at: now(), updated_by: by ?? song.updated_by });

function mapTrack(song: Song, trackId: string, fn: (t: Track) => Track, by: string | null): Song {
  return touch({ ...song, tracks: song.tracks.map((t) => (t.id === trackId ? { ...fn(t), updated_at: now() } : t)) }, by);
}

function mapMainClip(t: Track, fn: (c: Clip) => Clip): Track {
  const [first, ...rest] = t.clips;
  return { ...t, clips: [{ ...fn(first), updated_at: now() }, ...rest] };
}

export const spellNote = (song: Song, midi: number): string =>
  noteNameAscii(midi, spellInKey(midi, { tonic: song.key_tonic, mode: song.key_mode }));

export const setTitle = (song: Song, title: string, by: string | null): Song =>
  touch({ ...song, title: title.trim() || 'Untitled' }, by);

export const setTempo = (song: Song, bpm: number, by: string | null): Song => {
  const tempo = Math.min(200, Math.max(40, Math.round(bpm)));
  return touch({ ...song, tempo_bpm: tempo, tempo_map: [{ tick: 0, bpm: tempo }] }, by);
};

export const setSwing = (song: Song, swing: number, by: string | null): Song =>
  touch({ ...song, swing: Math.min(0.75, Math.max(0, swing)) }, by);

/** Changing key respells every stored note, so names always follow the key (G♭ in D♭ major). */
export function setKey(song: Song, tonic: string, mode: string, by: string | null): Song {
  const next = { ...song, key_tonic: tonic, key_mode: mode };
  return touch({
    ...next,
    tracks: next.tracks.map((t) => ({
      ...t,
      clips: t.clips.map((c) => (c.kind === 'notes'
        ? { ...c, content: { notes: (c.content as NotesContent).notes.map((n) => ({ ...n, spell: spellNote(next, n.midi) })) } }
        : c)),
    })),
  }, by);
}

/** Resize the song (see arrange.setSongBars): new bars start empty. */
export const setLoopBars = (song: Song, bars: number, by: string | null): Song => setSongBars(song, bars, by);

export function toggleHit(song: Song, trackId: string, row: number, step: number, by: string | null): Song {
  return mapTrack(song, trackId, (t) => mapMainClip(t, (c) => {
    const p = c.content as PatternContent;
    return {
      ...c,
      content: {
        ...p,
        rows: p.rows.map((r, i) => {
          if (i !== row) return r;
          const has = r.hits.some((h) => h.step === step);
          return { ...r, hits: has ? r.hits.filter((h) => h.step !== step) : [...r.hits, { step, vel: 1 }].sort((a, b) => a.step - b.step) };
        }),
      },
    };
  }), by);
}

/** Live recording from a pad: adds the hit if it isn't there (never removes). */
export function addHit(song: Song, trackId: string, row: number, step: number, by: string | null): Song {
  const track = song.tracks.find((t) => t.id === trackId);
  const p = track?.clips[0]?.content as PatternContent | undefined;
  if (!p || p.rows[row]?.hits.some((h) => h.step === step)) return song;
  return toggleHit(song, trackId, row, step, by);
}

/** Live recording from the keyboard: adds a note unless the same pitch already starts there. */
export function addNote(song: Song, trackId: string, midi: number, step: number, lengthSteps: number, by: string | null): Song {
  const track = song.tracks.find((t) => t.id === trackId);
  const c = track?.clips[0];
  if (!c || c.kind !== 'notes') return song;
  const tick = step * STEP_TICKS;
  if ((c.content as NotesContent).notes.some((n) => n.midi === midi && n.tick <= tick && tick < n.tick + n.dur)) return song;
  return toggleNote(song, trackId, midi, step, lengthSteps, by);
}

/** Tap a cell: removes the note that covers it, or adds a new one of the chosen length. */
export function toggleNote(song: Song, trackId: string, midi: number, step: number, lengthSteps: number, by: string | null): Song {
  const tick = step * STEP_TICKS;
  return mapTrack(song, trackId, (t) => mapMainClip(t, (c) => {
    const notes = (c.content as NotesContent).notes;
    const covering = notes.find((n) => n.midi === midi && n.tick <= tick && tick < n.tick + n.dur);
    if (covering) return { ...c, content: { notes: notes.filter((n) => n.id !== covering.id) } };
    const dur = Math.min(lengthSteps * STEP_TICKS, c.length_ticks - tick);
    const note: Note = { id: newId(), tick, dur, midi, spell: spellNote(song, midi), vel: 0.8 };
    return { ...c, content: { notes: [...notes, note].sort((a, b) => a.tick - b.tick || a.midi - b.midi) } };
  }), by);
}

/** Empty one clip: no notes, no hits, no chords. Instrument, mix and pedals stay. */
const emptyClip = (c: Clip): Clip => {
  if (c.kind === 'notes') return { ...c, content: { notes: [] } };
  if (c.kind === 'chords') return { ...c, content: { chords: [] } };
  if (c.kind === 'pattern') {
    const p = c.content as PatternContent;
    return { ...c, content: { steps: p.steps, rows: p.rows.map((r) => ({ ...r, hits: [] })) } };
  }
  return c;
};

/** The trash button: clear what is written in one track, or in every track when no track is given. */
export function clearWritten(song: Song, trackId: string | null, by: string | null): Song {
  const at = now();
  return touch({
    ...song,
    tracks: song.tracks.map((t) => (trackId && t.id !== trackId ? t : { ...t, clips: t.clips.map((c) => ({ ...emptyClip(c), updated_at: at })), updated_at: at })),
  }, by);
}

/** True when a track (or the song) has notes, hits or chords. */
export function hasWritten(song: Song, trackId: string | null = null): boolean {
  return song.tracks.some((t) => (!trackId || t.id === trackId) && t.clips.some((c) => {
    const x = c.content as { notes?: unknown[]; chords?: unknown[]; rows?: { hits: unknown[] }[] };
    return (x.notes?.length ?? 0) > 0 || (x.chords?.length ?? 0) > 0 || (x.rows ?? []).some((r) => r.hits.length > 0);
  }));
}

/** Hold and drag: one sustained note across the cells, replacing what that pitch had there. */
export function setNoteSpan(song: Song, trackId: string, midi: number, fromStep: number, lengthSteps: number, by: string | null): Song {
  const tick = fromStep * STEP_TICKS;
  return mapTrack(song, trackId, (t) => mapMainClip(t, (c) => {
    if (c.kind !== 'notes' || tick >= c.length_ticks) return c;
    const dur = Math.min(Math.max(1, lengthSteps) * STEP_TICKS, c.length_ticks - tick);
    const kept = (c.content as NotesContent).notes.filter((n) => n.midi !== midi || n.tick + n.dur <= tick || n.tick >= tick + dur);
    const note: Note = { id: newId(), tick, dur, midi, spell: spellNote(song, midi), vel: 0.8 };
    return { ...c, content: { notes: [...kept, note].sort((a, b) => a.tick - b.tick || a.midi - b.midi) } };
  }), by);
}

export function setChord(song: Song, trackId: string, bar: number, degree: number | null, by: string | null): Song {
  const tick = bar * BAR_TICKS;
  return mapTrack(song, trackId, (t) => mapMainClip(t, (c) => {
    const others = (c.content as ChordsContent).chords.filter((ch) => ch.tick !== tick);
    const chords: ChordEvent[] = degree === null ? others : [...others, { id: newId(), tick, dur: BAR_TICKS, degree }];
    return { ...c, content: { chords: chords.sort((a, b) => a.tick - b.tick) } };
  }), by);
}

export const setGain = (song: Song, trackId: string, gain: number, by: string | null): Song =>
  mapTrack(song, trackId, (t) => ({ ...t, gain: Math.min(2, Math.max(0, gain)) }), by);

/** Pan: -1 left, 0 centre, 1 right. */
export const setPan = (song: Song, trackId: string, pan: number, by: string | null): Song =>
  mapTrack(song, trackId, (t) => ({ ...t, pan: Math.min(1, Math.max(-1, pan)) }), by);

export const toggleMute = (song: Song, trackId: string, by: string | null): Song =>
  mapTrack(song, trackId, (t) => ({ ...t, muted: !t.muted }), by);

export const toggleSolo = (song: Song, trackId: string, by: string | null): Song =>
  mapTrack(song, trackId, (t) => ({ ...t, solo: !t.solo }), by);

/** Another instrument for one track; drum rows follow by place, the role stays. */
export const setInstrument = (song: Song, trackId: string, instrument: CatalogRef, by: string | null): Song =>
  mapTrack(song, trackId, (t) => retarget(t, instrument.key, roleOf(t), t.name), by);

/** Put a saved sound on a track: its instrument (the beat or notes move as with any swap) plus its studio chain. */
export const applySound = (song: Song, trackId: string, sound: CustomSound, by: string | null): Song =>
  mapTrack(song, trackId, (t) => ({
    ...retarget(t, sound.base.key, roleOf(t), t.name),
    sound: { id: sound.id, name: sound.name, chain: structuredClone(sound.chain) },
  }), by);

/** Move the whole song to another kit, keeping what was written (see factory.switchKit). */
export const switchKit = (song: Song, kitKey: string, slots: KitSlot[], lang: Lang, by: string | null): Song =>
  switchKitOf(song, kitKey, slots, lang, by);

export const setFxBypass = (song: Song, trackId: string, slot: number, bypass: boolean, by: string | null): Song =>
  mapTrack(song, trackId, (t) => ({
    ...t,
    fx_chain: { ...t.fx_chain, slots: t.fx_chain.slots.map((s, i) => (i === slot ? { ...s, bypass } : s)) },
  }), by);

export const setFxParam = (song: Song, trackId: string, slot: number, name: string, value: number, by: string | null): Song =>
  mapTrack(song, trackId, (t) => ({
    ...t,
    fx_chain: { ...t.fx_chain, slots: t.fx_chain.slots.map((s, i) => (i === slot ? { ...s, params: { ...s.params, [name]: value } } : s)) },
  }), by);

/** Put a pedal's knobs back where a new track starts; on or off stays as it is. */
/** Add a pedal to a track, on, with its starting settings, at the end of its group (control, color, movement, space). */
export function addFx(song: Song, trackId: string, key: string, by: string | null): Song {
  return mapTrack(song, trackId, (t) => {
    const slots = t.fx_chain.slots;
    const rank = pedalRank(key);
    const after = slots.reduce((last, x, i) => (pedalRank(x.effect.key) <= rank ? i : last), -1);
    const slot = { effect: ref(key), bypass: false, params: defaultFxParams(key) };
    return { ...t, fx_chain: { ...t.fx_chain, slots: [...slots.slice(0, after + 1), slot, ...slots.slice(after + 1)] } };
  }, by);
}

/** Take a pedal off a track. */
export const removeFx = (song: Song, trackId: string, slot: number, by: string | null): Song =>
  mapTrack(song, trackId, (t) => ({ ...t, fx_chain: { ...t.fx_chain, slots: t.fx_chain.slots.filter((_, i) => i !== slot) } }), by);

export const resetFx = (song: Song, trackId: string, slot: number, by: string | null): Song =>
  mapTrack(song, trackId, (t) => ({
    ...t,
    fx_chain: { ...t.fx_chain, slots: t.fx_chain.slots.map((s, i) => (i === slot ? { ...s, params: defaultFxParams(s.effect.key) } : s)) },
  }), by);

export const resetSwing = (song: Song, by: string | null): Song => setSwing(song, DEFAULT_SWING, by);

/** Keep an idea: its content replaces the target track's clip content, stamped with the idea it came from. */
export function keepIdea(song: Song, idea: Idea, trackId: string, by: string | null): Song {
  return mapTrack(song, trackId, (t) => mapMainClip(t, (c) => {
    if (c.kind === 'notes' && Array.isArray((idea.payload as { notes?: unknown }).notes)) {
      const notes = ((idea.payload as unknown) as NotesContent).notes
        .filter((n) => n.tick < c.length_ticks)
        .map((n) => ({ ...n, id: newId(), spell: spellNote(song, n.midi), dur: Math.min(n.dur, c.length_ticks - n.tick) }));
      return { ...c, content: { notes }, idea_id: idea.id, origin: 'claude' };
    }
    if (c.kind === 'pattern' && Array.isArray((idea.payload as { rows?: unknown }).rows)) {
      const p = (idea.payload as unknown) as PatternContent;
      const own = c.content as PatternContent;
      const steps = own.steps;
      // The idea's rows land on this kit's rows by place, so an idea written for any kit fits.
      const kit = t.instrument?.key ?? '';
      const rows = own.rows.map((row) => {
        const from = p.rows.find((r) => rowFor(kit, r.sound.key) === row.sound.key);
        return { sound: ref(row.sound.key), hits: (from?.hits ?? []).filter((h) => h.step < steps).map((h) => ({ step: h.step, vel: h.vel ?? 1 })) };
      });
      return { ...c, content: { steps, rows }, idea_id: idea.id, origin: 'claude' };
    }
    if (c.kind === 'chords' && Array.isArray((idea.payload as { chords?: unknown }).chords)) {
      const chords = ((idea.payload as unknown) as ChordsContent).chords
        .filter((ch) => ch.tick < c.length_ticks)
        .map((ch) => ({ ...ch, id: newId() }));
      return { ...c, content: { chords }, idea_id: idea.id, origin: 'claude' };
    }
    return c;
  }), by);
}
