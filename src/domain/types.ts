// Domain types. They mirror the Data model tab of the brief (draft v0.1) so the
// browser store now and Supabase later hold exactly the same shapes.

export type Origin = 'person' | 'claude' | 'pack' | 'system';
export type Hat = 'musician' | 'producer';
export type Lang = 'en' | 'es';
export type Level = 'starter' | 'intermediate' | 'advanced';
export type ThemePreset = 'graphite' | 'midnight-jewel' | 'daylight';
/** The job a track does in a kit. Switching kits keeps the notes by role: the bass part goes to the new bass. */
export type Role = 'drums' | 'perc' | 'bass' | 'chords' | 'keys' | 'lead' | 'color';

/** An instrument marked with a star for the custom kit: which instrument, and the job it does there. */
export interface StarredInstrument {
  key: string;
  role: Role;
  /** A saved sound starred into the kit: a copy of its chain, so the kit sounds the same on any device. */
  sound?: TrackSound;
}

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
  /** Place on the home screen, left to right. */
  order?: number;
  /** Instruments starred from any kit; together they make the custom kit. */
  starred?: StarredInstrument[];
  /** The kit new songs start with. */
  last_kit?: string;
  /** Shows Music Studio Classroom (video lessons and Clave, the music-only helper) in this profile. */
  classroom?: boolean;
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

/**
 * A sound a person made in the Colección: a catalog instrument heard through a studio chain (preamp, compressor,
 * amp, cabinet, tape, room…), kept in their profile. Using it on a track copies it into the track, so the song
 * sounds the same on any device and later edits to the saved sound never change a finished song.
 */
export interface CustomSound {
  id: string;
  profile_id: string;
  name: string;
  base: CatalogRef;
  chain: FxChain;
  chain_schema_version: 1;
  status: 'active' | 'archived';
  origin: Origin;
  created_at: string;
  updated_at: string;
}

/** The copy of a saved sound a track plays: its chain runs between the instrument and the track's pedals. */
export interface TrackSound {
  id: string;
  name: string;
  chain: FxChain;
}

/**
 * The producer's version of a track's sound: another instrument or the same one through another chain. The track
 * keeps both; `voice_from` says which one plays.
 */
export interface TrackVariant {
  instrument: CatalogRef | null;
  sound?: TrackSound;
  by: string | null;
  updated_at: string;
}

/** The six desk characters a song can be mixed on; names describe a style and an era, never a brand. */
export type ConsoleModel = 'clean' | 'british' | 'inductor' | 'american' | 'modern' | 'compact';

/**
 * One channel of the producer's desk, after the track's sound: input gain, low cut, compressor, four-band EQ,
 * warmth (saturation), and sends to the shared room and echo. Part of the mix, saved with the song.
 */
export interface ChannelStrip {
  trim_db: number;
  /** Low cut frequency in Hz; 0 is off. */
  hpf_hz: number;
  low_db: number; low_hz: number;
  lmid_db: number; lmid_hz: number;
  hmid_db: number; hmid_hz: number;
  high_db: number; high_hz: number;
  /** One-knob compressor, 0 to 1. */
  comp: number;
  /** Warmth: how hard the desk's own circuit is pushed, 0 to 1. */
  drive: number;
  /** Post-fader sends to the shared returns, 0 to 1. */
  send_room: number;
  send_echo: number;
}

/** The desk of a song: its character, the shared room and echo, and the master bus. */
export interface MixSettings {
  console: ConsoleModel;
  /** Bus compressor that glues the whole song, 0 to 1, and its style. */
  glue: number;
  glue_model: 'british' | 'diode' | 'american';
  /** Master tone: body (lows) and air (highs), in dB. */
  body_db: number;
  air_db: number;
  /** The limiter's ceiling in dB below full scale. */
  ceiling_db: number;
  room_kind: 'room' | 'plate' | 'hall';
  room_level: number;
  echo_time: '1/8' | '1/4' | '3/8' | '1/2';
  echo_feedback: number;
  echo_level: number;
  schema_version: 1;
}

export interface Track {
  id: string;
  position: number;
  name: string;
  kind: TrackKind;
  /** The musician's instrument. */
  instrument: CatalogRef | null;
  /** A saved sound from the Colección on top of the instrument; changing the instrument removes it. */
  sound?: TrackSound;
  /** The producer's proposal for this track's sound, kept beside the musician's. */
  producer?: TrackVariant;
  /** Which sound plays: the musician's (the default) or the producer's. */
  voice_from?: 'musician' | 'producer';
  /** The channel on the producer's desk. Absent: a flat channel that changes nothing. */
  strip?: ChannelStrip;
  /** The job this track does in its kit. Older songs have none; it is inferred from the instrument. */
  role?: Role;
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

/** What a part of the song is; its color and its name ("Coro 2") come from it. */
export type SectionKind = 'intro' | 'verse' | 'prechorus' | 'chorus' | 'bridge' | 'break' | 'solo' | 'outro' | 'other';

export interface Section {
  id: string;
  position: number;
  name: string;
  kind?: SectionKind;
  start_tick: number;
  length_ticks: number;
  key_tonic: string | null;
  key_mode: string | null;
  lyrics_lang: Lang | null;
}

/** How a block of the idea is played: a rhythm style (a Colección group) and how hard. */
export interface SketchGroove {
  group: string;
  feel: 'soft' | 'normal' | 'strong' | 'half';
}

/** One part of the song's form in the idea ("Coro 1"): bars, chords bar by bar, and its rhythm. */
export interface SketchBlock {
  id: string;
  kind: SectionKind;
  /** Tells blocks of the same kind apart ("Verso 2"); a block repeated in the form keeps its number. */
  n: number;
  /** A name the person typed; otherwise it comes from the kind and number. */
  name?: string;
  bars: number;
  /** Chords as scale degrees (0 = I) or null for none: one per bar, or two per bar when `split`. */
  chords: (number | null)[];
  split?: boolean;
  /** Null: no drums in this block. */
  groove: SketchGroove | null;
}

/**
 * The musician's idea of the song before the detail: the form (blocks in order, repeats allowed), chords and rhythm
 * per block, and the instruments that play it. Accepting it writes the detail; the detail never writes back, so
 * the idea stays as the reference to come back to.
 */
export interface Sketch {
  blocks: SketchBlock[];
  /** Block ids in the order they play; the same id twice is the same part played again. */
  order: string[];
  chords_instrument: CatalogRef;
  drums_instrument: CatalogRef | null;
  /** Null: the idea has no bass line. */
  bass_instrument: CatalogRef | null;
  /** The rhythm style new blocks start with. */
  style_group: string;
  /** When the idea was last written into the detail; null while it is a draft. */
  accepted_at: string | null;
  schema_version: 1;
  updated_at: string;
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
  /** The kit the song uses: a catalog kit key, or "custom". Older songs have none and count as hip hop. */
  kit_key?: string;
  /** How long the song is. Older songs kept it in a single "Loop" section; see normalizeSong. */
  length_ticks?: number;
  /** The musician's idea (form, chords, rhythm), kept apart from the detail. */
  sketch?: Sketch;
  /** The producer's desk: character, returns and master. Absent: a clean desk that changes nothing. */
  mix?: MixSettings;
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
