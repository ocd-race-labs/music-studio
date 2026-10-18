// Song files (moving songs between devices, backups) and idea files (Claude's proposals during the MVP).

import { findItem } from '../packs/core';
import { newId, now, normalizeSong } from './factory';
import { errorsOf, validateIdeasFile, validateSongFile } from './schemas';
import type { CatalogRef, Idea, IdeaKind, Song } from './types';

export const SONG_FILE_EXT = '.mstudio.json';

export function exportSongFile(song: Song): string {
  return JSON.stringify({ format: 'music-studio.song', version: 1, exported_at: now(), song }, null, 2);
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function parseJson(text: string): Parsed<unknown> {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, errors: ['The file is not valid JSON.'] };
  }
}

/** Reads a song file. Unknown catalog items are reported, never guessed. */
export function parseSongFile(text: string): Parsed<Song> {
  const json = parseJson(text);
  if (!json.ok) return json;
  if (!validateSongFile(json.value)) return { ok: false, errors: errorsOf(validateSongFile) };
  const song = (json.value as { song: Song }).song;
  const missing = song.tracks
    .map((t) => t.instrument)
    .filter((r): r is CatalogRef => r !== null && !findItem(r))
    .map((r) => `This app doesn't have ${r.key}@${r.version} yet.`);
  if (missing.length) return { ok: false, errors: missing };
  return { ok: true, value: normalizeSong(song) };
}

interface IdeaInFile {
  kind: 'melody' | 'clip' | 'pattern' | 'chords';
  title: string;
  prompt?: string;
  target_instrument?: CatalogRef;
  payload: Record<string, unknown>;
}

/** Reads an idea file written by Claude and turns each entry into a proposed idea for this song. */
export function parseIdeasFile(text: string, songId: string, requestedBy: string | null): Parsed<Idea[]> {
  const json = parseJson(text);
  if (!json.ok) return json;
  if (!validateIdeasFile(json.value)) return { ok: false, errors: errorsOf(validateIdeasFile) };
  const t = now();
  const ideas = (json.value as { ideas: IdeaInFile[] }).ideas.map((i): Idea => {
    const target = i.target_instrument && findItem(i.target_instrument) ? i.target_instrument : null;
    const kind: IdeaKind = i.kind;
    return {
      id: newId(),
      song_id: songId,
      section_id: null,
      track_id: null,
      kind,
      title: i.title,
      prompt: i.prompt ?? null,
      target_instrument: target,
      payload: i.payload,
      payload_schema_version: 1,
      status: 'proposed',
      validation: i.target_instrument && !target ? [`Unknown instrument ${i.target_instrument.key}; pick a track by hand.`] : null,
      origin: 'claude',
      requested_by: requestedBy,
      decided_by: null,
      decided_at: null,
      created_at: t,
      updated_at: t,
    };
  });
  return { ok: true, value: ideas };
}

/** A copy of a song with fresh ids, for importing a song that already exists on this device. */
export function withFreshIds(song: Song, ownerProfileId: string): Song {
  return {
    ...song,
    id: newId(),
    owner_profile_id: ownerProfileId,
    title: `${song.title} (imported)`,
    sections: song.sections.map((s) => ({ ...s, id: newId() })),
    tracks: song.tracks.map((tr) => ({
      ...tr,
      id: newId(),
      clips: tr.clips.map((c) => ({ ...c, id: newId() })),
    })),
    updated_at: now(),
  };
}
