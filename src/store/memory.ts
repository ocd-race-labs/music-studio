// An in-memory song store: same interface, nothing kept. Used for the Guest profile.

import { newId, now } from '../domain/factory';
import type { Idea, Profile, Recording, Song, SongVersion } from '../domain/types';
import type { SongStore } from './store';

export function memoryStore(): SongStore {
  const profiles = new Map<string, Profile>();
  const songs = new Map<string, Song>();
  const versions = new Map<string, SongVersion>();
  const ideas = new Map<string, Idea>();
  const recordings = new Map<string, Recording>();
  const audio = new Map<string, Blob>();
  const meta = new Map<string, unknown>();
  return {
    async listProfiles() { return [...profiles.values()]; },
    async saveProfile(p) { profiles.set(p.id, p); },
    async listSongs(profileId) {
      return [...songs.values()].filter((s) => s.owner_profile_id === profileId && s.status === 'active')
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    },
    async getSong(id) { return songs.get(id); },
    async saveSong(song) { songs.set(song.id, song); },
    async deleteSong(id) {
      const s = songs.get(id);
      if (s) songs.set(id, { ...s, status: 'archived' });
    },
    async saveVersion(song, label, by) {
      const n = [...versions.values()].filter((v) => v.song_id === song.id).length + 1;
      const v: SongVersion = { id: newId(), song_id: song.id, version_no: n, label, snapshot: song, snapshot_schema_version: 1, created_by: by, created_at: now() };
      versions.set(v.id, v);
      return v;
    },
    async listVersions(songId) {
      return [...versions.values()].filter((v) => v.song_id === songId).sort((a, b) => b.version_no - a.version_no);
    },
    async listIdeas(songId) { return [...ideas.values()].filter((i) => i.song_id === songId); },
    async saveIdea(idea) { ideas.set(idea.id, idea); },
    async saveRecording(rec, blob) { recordings.set(rec.id, rec); audio.set(rec.id, blob); },
    async getRecordingAudio(id) { return audio.get(id); },
    async listRecordings(profileId) { return [...recordings.values()].filter((r) => r.profile_id === profileId); },
    async getMeta<T>(key: string) { return meta.get(key) as T | undefined; },
    async setMeta(key, value) { meta.set(key, value); },
  };
}
