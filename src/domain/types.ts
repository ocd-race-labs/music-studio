// Domain types. They mirror the Data model tab of the brief (draft v0.1) so the
// browser store now and Supabase later hold exactly the same shapes.

export type Origin = 'person' | 'claude' | 'pack' | 'system';
export type Hat = 'musician' | 'producer';
export type Lang = 'en' | 'es';
export type Level = 'starter' | 'intermediate' | 'advanced';
export type ThemePreset = 'graphite' | 'midnight-jewel' | 'daylight';

/** A pinned reference to a catalog item: always a key plus a version. */
export interface CatalogRef {
  key: string;
  version: string;
}

export interface Avatar {
  kind: 'initial' | 'icon';
  icon?: string;
  ring?: string;
}

export interface Profile {
  id: string;
  name: string;
  avatar: Avatar;
  theme: { preset: ThemePreset; base: 'dark' | 'light' };
  default_hat: Hat;
  ui_lang: Lang;
  lyrics_lang: Lang;
  musician_level: Level;
  producer_level: Level;
  musician_styles: string[];
  producer_styles: string[];
  instruments: string[];
  status: 'active' | 'archived';
  settings_schema_version: 1;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  tick: number;
  dur: number;
  midi: number;
  spell: string; // ASCII spelling with octave, e.g. "Db4"
  vel: number; // 0 to 1
}

export interface NotesContent {
  notes: Note[];
}

export interface PatternRow {
  sound: CatalogRef;
  hits: { step: number; vel: number }[];
}

export interface PatternContent {
  steps: number; // sixteenth notes in the pattern
  rows: PatternRow[];
}

export interface ChordEvent {
  id: string;
  tick: number;
  dur: number;
  degree: number; // 0-based scale degree; the symbol comes from the key
}

export interface ChordsContent {
  chords: ChordEvent[];
}

export interface AudioContent {
  offset_ms: number;
  gain: number;
}

export type ClipKind = 'notes' | 'pattern' | 'chords' | 'audio';

export interface Clip {
  id: string;
  name: string | null;
  kind: ClipKind;
  start_tick: number;
  length_ticks: number;
  loop: boolean;
  content: NotesContent | PatternContent | ChordsContent | AudioContent;
  content_schema_version: 1;
  recording_id: string | null;
  idea_id: string | null;
  origin: Origin;
  created_at: string;
  updated_at: string;
}

export interface FxSlot {
  effect: CatalogRef;
  bypass: boolean;
  params: Record<string, number>;
}

export interface FxChain {
  routing: 'series' | 'parallel';
  slots: FxSlot[];
}

export type TrackKind = 'instrument' | 'drums' | 'audio';

export interface Track {
  id: string;
  position: number;
  name: string;
  kind: TrackKind;
  instrument: CatalogRef | null;
  color: string;
  muted: boolean;
  solo: boolean;
  gain: number; // linear
  pan: number; // -1 to 1
  fx_chain: FxChain;
  fx_schema_version: 1;
  origin: Origin;
  clips: Clip[];
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: string;
  position: number;
  name: string;
  start_tick: number;
  length_ticks: number;
  key_tonic: string | null;
  key_mode: string | null;
  lyrics_lang: Lang | null;
}

export interface Song {
  id: string;
  owner_profile_id: string;
  title: string;
  ppq: 960;
  tempo_bpm: number;
  tempo_map: { tick: number; bpm: number }[];
  swing: number; // 0 to 0.75
  time_sig_num: number;
  time_sig_den: number;
  key_tonic: string;
  key_mode: string;
  tuning_a4_hz: number;
  lyrics_lang: Lang;
  musician_style_key: string | null;
  producer_style_key: string | null;
  status: 'active' | 'archived';
  origin: Origin;
  schema_version: 1;
  sections: Section[];
  tracks: Track[];
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export type IdeaKind = 'clip' | 'pattern' | 'melody' | 'chords' | 'patch' | 'fx_chain' | 'lyrics';
export type IdeaStatus = 'proposed' | 'accepted' | 'dismissed' | 'invalid';

export interface Idea {
  id: string;
  song_id: string;
  section_id: string | null;
  track_id: string | null;
  kind: IdeaKind;
  title: string;
  prompt: string | null;
  target_instrument: CatalogRef | null;
  payload: Record<string, unknown>;
  payload_schema_version: number;
  status: IdeaStatus;
  validation: string[] | null;
  origin: Origin;
  requested_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Recording {
  id: string;
  profile_id: string;
  song_id: string | null;
  storage_path: string;
  mime_type: string;
  sample_rate: number;
  channels: number;
  duration_ms: number;
  bytes: number;
  source: 'mic' | 'line' | 'import' | 'render';
  origin: Origin;
  created_at: string;
}

export interface SongVersion {
  id: string;
  song_id: string;
  version_no: number;
  label: string | null;
  snapshot: Song;
  snapshot_schema_version: 1;
  created_by: string | null;
  created_at: string;
}

export const PPQ = 960;
export const STEP_TICKS = PPQ / 4; // one sixteenth note
export const BAR_TICKS = PPQ * 4; // 4/4 only in v1
