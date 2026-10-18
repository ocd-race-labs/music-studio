// The song store: the one interface all saving goes through.
// MVP: browser storage (IndexedDB). Phase 4: a Supabase implementation of the same interface.

import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import { newId, now } from '../domain/factory';
import type { CustomSound, Idea, Profile, Recording, Song, SongVersion } from '../domain/types';

export interface SongStore {
  listProfiles(): Promise<Profile[]>;
  /** Start over on this device: profiles, songs, versions, ideas and recordings are removed. */
  clearAll(): Promise<void>;
  saveProfile(p: Profile): Promise<void>;
  listSongs(profileId: string): Promise<Song[]>;
  getSong(id: string): Promise<Song | undefined>;
  saveSong(song: Song): Promise<void>;
  deleteSong(id: string): Promise<void>;
  saveVersion(song: Song, label: string | null, by: string | null): Promise<SongVersion>;
  listVersions(songId: string): Promise<SongVersion[]>;
  listIdeas(songId: string): Promise<Idea[]>;
  saveIdea(idea: Idea): Promise<void>;
  saveRecording(rec: Recording, audio: Blob): Promise<void>;
  getRecordingAudio(id: string): Promise<Blob | undefined>;
  listRecordings(profileId: string): Promise<Recording[]>;
  /** Sounds a profile made in the Colección (newest first). */
  listSounds(profileId: string): Promise<CustomSound[]>;
  saveSound(sound: CustomSound): Promise<void>;
  /** Removed from the profile's Colección; songs that use it keep their copy. */
  deleteSound(id: string): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta<T>(key: string, value: T): Promise<void>;
}

interface StudioDB extends DBSchema {
  profiles: { key: string; value: Profile };
  songs: { key: string; value: Song; indexes: { by_owner: string } };
  song_versions: { key: string; value: SongVersion; indexes: { by_song: string } };
  ideas: { key: string; value: Idea; indexes: { by_song: string } };
  recordings: { key: string; value: Recording; indexes: { by_profile: string } };
  audio: { key: string; value: Blob };
  sounds: { key: string; value: CustomSound; indexes: { by_profile: string } };
  meta: { key: string; value: unknown };
}

/** Home order: the order people were set up in, then creation time. */
export const byOrder = (list: Profile[]): Profile[] =>
  [...list].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.created_at.localeCompare(b.created_at));

export async function openBrowserStore(name = 'music-studio'): Promise<SongStore> {
  // Version 2 adds the Colección's saved sounds; a device on version 1 keeps everything and gains the new store.
  const db: IDBPDatabase<StudioDB> = await openDB<StudioDB>(name, 2, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('profiles', { keyPath: 'id' });
        d.createObjectStore('songs', { keyPath: 'id' }).createIndex('by_owner', 'owner_profile_id');
        d.createObjectStore('song_versions', { keyPath: 'id' }).createIndex('by_song', 'song_id');
        d.createObjectStore('ideas', { keyPath: 'id' }).createIndex('by_song', 'song_id');
        d.createObjectStore('recordings', { keyPath: 'id' }).createIndex('by_profile', 'profile_id');
        d.createObjectStore('audio');
        d.createObjectStore('meta');
      }
      if (oldVersion < 2) d.createObjectStore('sounds', { keyPath: 'id' }).createIndex('by_profile', 'profile_id');
    },
  });

  return {
    async listProfiles() {
      return byOrder((await db.getAll('profiles')).filter((p) => p.status === 'active'));
    },
    async clearAll() {
      for (const name of ['profiles', 'songs', 'song_versions', 'ideas', 'recordings', 'audio', 'sounds', 'meta'] as const) await db.clear(name);
    },
    async saveProfile(p) {
      await db.put('profiles', { ...p, updated_at: now() });
    },
    async listSongs(profileId) {
      return (await db.getAllFromIndex('songs', 'by_owner', profileId))
        .filter((s) => s.status === 'active')
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },
    getSong: (id) => db.get('songs', id),
    async saveSong(song) {
      await db.put('songs', song);
    },
    async deleteSong(id) {
      const song = await db.get('songs', id);
      if (song) await db.put('songs', { ...song, status: 'archived', updated_at: now() });
    },
    async saveVersion(song, label, by) {
      const existing = await db.getAllFromIndex('song_versions', 'by_song', song.id);
      const v: SongVersion = {
        id: newId(),
        song_id: song.id,
        version_no: existing.length + 1,
        label,
        snapshot: song,
        snapshot_schema_version: 1,
        created_by: by,
        created_at: now(),
      };
      await db.put('song_versions', v);
      return v;
    },
    async listVersions(songId) {
      return (await db.getAllFromIndex('song_versions', 'by_song', songId)).sort((a, b) => b.version_no - a.version_no);
    },
    async listIdeas(songId) {
      return (await db.getAllFromIndex('ideas', 'by_song', songId)).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async saveIdea(idea) {
      await db.put('ideas', { ...idea, updated_at: now() });
    },
    async saveRecording(rec, audio) {
      const tx = db.transaction(['recordings', 'audio'], 'readwrite');
      await tx.objectStore('recordings').put(rec);
      await tx.objectStore('audio').put(audio, rec.id);
      await tx.done;
    },
    getRecordingAudio: (id) => db.get('audio', id),
    async listRecordings(profileId) {
      return (await db.getAllFromIndex('recordings', 'by_profile', profileId)).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async listSounds(profileId) {
      return (await db.getAllFromIndex('sounds', 'by_profile', profileId))
        .filter((x) => x.status === 'active')
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },
    async saveSound(sound) {
      await db.put('sounds', { ...sound, updated_at: now() });
    },
    async deleteSound(id) {
      const x = await db.get('sounds', id);
      if (x) await db.put('sounds', { ...x, status: 'archived', updated_at: now() });
    },
    async getMeta<T>(key: string) {
      return (await db.get('meta', key)) as T | undefined;
    },
    async setMeta(key, value) {
      await db.put('meta', value, key);
    },
  };
}

/** Ask the browser to keep our data even when space runs low (and protect it from automatic clearing). */
export async function requestPersistence(): Promise<{ persisted: boolean; usage?: number; quota?: number }> {
  const storage = navigator.storage;
  if (!storage) return { persisted: false };
  let persisted = (await storage.persisted?.()) ?? false;
  if (!persisted && storage.persist) persisted = await storage.persist();
  const est = await storage.estimate?.();
  return { persisted, usage: est?.usage, quota: est?.quota };
}
