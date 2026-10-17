// The song store: the one interface all saving goes through.
// MVP: browser storage (IndexedDB). Phase 4: a Supabase implementation of the same interface.

import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import { newId, now } from '../domain/factory';
import type { Idea, Profile, Recording, Song, SongVersion } from '../domain/types';

export interface SongStore {
  listProfiles(): Promise<Profile[]>;
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
  meta: { key: string; value: unknown };
}

export async function openBrowserStore(name = 'music-studio'): Promise<SongStore> {
  const db: IDBPDatabase<StudioDB> = await openDB<StudioDB>(name, 1, {
    upgrade(d) {
      d.createObjectStore('profiles', { keyPath: 'id' });
      d.createObjectStore('songs', { keyPath: 'id' }).createIndex('by_owner', 'owner_profile_id');
      d.createObjectStore('song_versions', { keyPath: 'id' }).createIndex('by_song', 'song_id');
      d.createObjectStore('ideas', { keyPath: 'id' }).createIndex('by_song', 'song_id');
      d.createObjectStore('recordings', { keyPath: 'id' }).createIndex('by_profile', 'profile_id');
      d.createObjectStore('audio');
      d.createObjectStore('meta');
    },
  });

  return {
    async listProfiles() {
      return (await db.getAll('profiles')).filter((p) => p.status === 'active').sort((a, b) => a.created_at.localeCompare(b.created_at));
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
