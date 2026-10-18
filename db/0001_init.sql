-- Music Studio: migration 0001 (draft v0.1)
-- Status: DRAFT. Not applied. Run only on the new, dedicated Supabase project after the owner approves.
-- Classes of data (see the brief, Architecture):
--   catalog.*  master data: read-only mirror of the git packs, written only by the sync script
--   studio.*   family content: songs, sections, tracks, clips, lyrics, recordings, versions
--   studio.ideas  staging: Claude's proposals, kept apart until a person accepts them
-- Theory lives in code, derived data in a local cache: neither has tables here.
-- After applying: add "catalog" and "studio" to the API's exposed schemas (Project settings > API).

create schema if not exists catalog;
create schema if not exists studio;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function studio.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- A child row must belong to the same family account as its parent.
-- Trigger arguments: parent table, foreign key column.
create or replace function studio.ensure_same_account()
returns trigger
language plpgsql
as $$
declare
  v_parent_id      uuid;
  v_parent_account uuid;
begin
  v_parent_id := (to_jsonb(new) ->> tg_argv[1])::uuid;
  if v_parent_id is null then
    return new;
  end if;
  execute format('select account_id from %s where id = $1', tg_argv[0])
    into v_parent_account
    using v_parent_id;
  if v_parent_account is distinct from new.account_id then
    raise exception '%.% must point to a row of the same family', tg_table_name, tg_argv[1];
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- CATALOG: master data registry (golden record lives in git)
-- ---------------------------------------------------------------------------

create table catalog.items (
  key                      text        not null,
  version                  text        not null,
  kind                     text        not null,
  pack                     text        not null,
  status                   text        not null default 'active',
  title                    jsonb       not null,               -- {"en": "...", "es": "..."}
  license                  text        not null,
  source                   text        not null,
  manifest                 jsonb       not null,
  manifest_schema_version  integer     not null default 1,
  published_at             timestamptz not null default now(),
  synced_at                timestamptz not null default now(),
  primary key (key, version),
  constraint items_key_format     check (key ~ '^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$'),
  constraint items_key_matches_kind check (key like kind || '.%'),
  constraint items_version_semver check (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  constraint items_kind           check (kind in ('instrument', 'sound', 'kit', 'style', 'effect', 'drill', 'explanation')),
  constraint items_status         check (status in ('draft', 'active', 'deprecated')),
  constraint items_title_object   check (jsonb_typeof(title) = 'object'),
  constraint items_manifest_object check (jsonb_typeof(manifest) = 'object')
);

create index items_kind_status_idx on catalog.items (kind, status);

-- A published version never changes: only its status (for example, to deprecated) and sync time may move.
create or replace function catalog.guard_published_version()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'catalog item %@% cannot be deleted; deprecate it instead', old.key, old.version;
  end if;
  if new.key is distinct from old.key
     or new.version is distinct from old.version
     or new.kind is distinct from old.kind
     or new.manifest is distinct from old.manifest
     or new.license is distinct from old.license then
    raise exception 'catalog item %@% is published; publish a new version instead', old.key, old.version;
  end if;
  return new;
end;
$$;

create trigger items_guard_update
  before update on catalog.items
  for each row execute function catalog.guard_published_version();

create trigger items_guard_delete
  before delete on catalog.items
  for each row execute function catalog.guard_published_version();

-- ---------------------------------------------------------------------------
-- STUDIO: family content
-- ---------------------------------------------------------------------------

create table studio.profiles (
  id                       uuid        primary key default gen_random_uuid(),
  account_id               uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  name                     text        not null,
  avatar                   jsonb       not null default '{"kind": "initial"}',
  theme                    jsonb       not null default '{"preset": "daylight", "base": "light"}',
  default_hat              text        not null default 'musician',
  ui_lang                  text        not null default 'en',
  lyrics_lang              text        not null default 'es',
  musician_level           text        not null default 'starter',
  producer_level           text        not null default 'starter',
  musician_styles          text[]      not null default '{}',   -- catalog style keys
  producer_styles          text[]      not null default '{}',   -- catalog style keys
  instruments              text[]      not null default '{}',   -- what the person plays: violin, drums, beats...
  position                 smallint    not null default 0,      -- place on the home screen (app field: order)
  starred                  jsonb       not null default '[]',   -- custom kit: [{"key": "instrument.violin", "role": "lead"}]
  last_kit                 text,                                -- kit new songs start with: a catalog kit key or 'custom'
  status                   text        not null default 'active',
  settings_schema_version  integer     not null default 1,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint profiles_name_length   check (char_length(name) between 1 and 40),
  constraint profiles_unique_name   unique (account_id, name),
  constraint profiles_default_hat   check (default_hat in ('musician', 'producer')),
  constraint profiles_ui_lang       check (ui_lang in ('en', 'es')),
  constraint profiles_lyrics_lang   check (lyrics_lang in ('en', 'es')),
  constraint profiles_musician_lvl  check (musician_level in ('starter', 'intermediate', 'advanced')),
  constraint profiles_producer_lvl  check (producer_level in ('starter', 'intermediate', 'advanced')),
  constraint profiles_status        check (status in ('active', 'archived')),
  constraint profiles_avatar_object check (jsonb_typeof(avatar) = 'object'),
  constraint profiles_theme_object  check (jsonb_typeof(theme) = 'object'),
  constraint profiles_starred_array check (jsonb_typeof(starred) = 'array'),
  constraint profiles_last_kit      check (last_kit is null or last_kit = 'custom' or last_kit ~ '^kit\.[a-z0-9-]+$')
);

create table studio.songs (
  id                  uuid          primary key default gen_random_uuid(),
  account_id          uuid          not null default auth.uid() references auth.users (id) on delete cascade,
  owner_profile_id    uuid          not null references studio.profiles (id) on delete restrict,
  title               text          not null default 'Untitled',
  ppq                 integer       not null default 960,
  tempo_bpm           numeric(6, 2) not null default 90,
  tempo_map           jsonb         not null default '[]',        -- [{"tick": 0, "bpm": 90}]
  swing               numeric(4, 3) not null default 0,           -- 0 straight, 0.75 max; applies to sixteenths
  time_sig_num        smallint      not null default 4,
  time_sig_den        smallint      not null default 4,
  key_tonic           text          not null default 'C',         -- ASCII spelling: C, Db, F#, Bbb
  key_mode            text          not null default 'major',     -- id from the theory library
  tuning_a4_hz        numeric(6, 2) not null default 440,
  lyrics_lang         text          not null default 'es',
  musician_style_key  text,                                        -- catalog style key, unpinned
  producer_style_key  text,                                        -- catalog style key, unpinned
  kit_key             text,                                        -- genre kit: catalog kit key, unpinned, or 'custom'
  status              text          not null default 'active',
  origin              text          not null default 'person',
  schema_version      integer       not null default 1,
  created_by          uuid          references studio.profiles (id) on delete set null,
  updated_by          uuid          references studio.profiles (id) on delete set null,
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now(),
  constraint songs_ppq_canonical check (ppq = 960),
  constraint songs_tempo         check (tempo_bpm between 20 and 400),
  constraint songs_tempo_map     check (jsonb_typeof(tempo_map) = 'array'),
  constraint songs_swing         check (swing between 0 and 0.75),
  constraint songs_time_sig_num  check (time_sig_num between 1 and 32),
  constraint songs_time_sig_den  check (time_sig_den in (1, 2, 4, 8, 16, 32)),
  constraint songs_key_tonic     check (key_tonic ~ '^[A-G](bb|b|##|#)?$'),
  constraint songs_key_mode      check (key_mode ~ '^[a-z][a-z0-9-]*$'),
  constraint songs_tuning        check (tuning_a4_hz between 400 and 480),
  constraint songs_lyrics_lang   check (lyrics_lang in ('en', 'es')),
  constraint songs_kit_key       check (kit_key is null or kit_key = 'custom' or kit_key ~ '^kit\.[a-z0-9-]+$'),
  constraint songs_status        check (status in ('active', 'archived')),
  constraint songs_origin        check (origin in ('person', 'claude', 'pack', 'system'))
);

create index songs_owner_idx on studio.songs (owner_profile_id);

create table studio.sections (
  id            uuid        primary key default gen_random_uuid(),
  account_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  song_id       uuid        not null references studio.songs (id) on delete cascade,
  position      smallint    not null,
  name          text        not null,
  start_tick    bigint      not null,
  length_ticks  bigint      not null,
  key_tonic     text,                    -- null = song key
  key_mode      text,                    -- null = song mode
  lyrics_lang   text,                    -- null = song language
  origin        text        not null default 'person',
  created_by    uuid        references studio.profiles (id) on delete set null,
  updated_by    uuid        references studio.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint sections_position_unique unique (song_id, position) deferrable initially deferred,
  constraint sections_start      check (start_tick >= 0),
  constraint sections_length     check (length_ticks > 0),
  constraint sections_key_tonic  check (key_tonic is null or key_tonic ~ '^[A-G](bb|b|##|#)?$'),
  constraint sections_key_mode   check (key_mode is null or key_mode ~ '^[a-z][a-z0-9-]*$'),
  constraint sections_lyrics_lang check (lyrics_lang is null or lyrics_lang in ('en', 'es')),
  constraint sections_origin     check (origin in ('person', 'claude', 'pack', 'system'))
);

create table studio.tracks (
  id                  uuid          primary key default gen_random_uuid(),
  account_id          uuid          not null default auth.uid() references auth.users (id) on delete cascade,
  song_id             uuid          not null references studio.songs (id) on delete cascade,
  position            smallint      not null,
  name                text          not null,
  kind                text          not null,
  instrument_key      text,
  instrument_version  text,
  role                text,                                -- the job in its kit; switching kit keeps notes by role
  color               text,
  muted               boolean       not null default false,
  solo                boolean       not null default false,
  gain                numeric(8, 6) not null default 1,     -- linear; the UI shows dB
  pan                 numeric(4, 3) not null default 0,     -- -1 left, 0 centre, 1 right
  fx_chain            jsonb         not null default '{"routing": "series", "slots": []}',
  fx_schema_version   integer       not null default 1,
  origin              text          not null default 'person',
  created_by          uuid          references studio.profiles (id) on delete set null,
  updated_by          uuid          references studio.profiles (id) on delete set null,
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now(),
  constraint tracks_position_unique unique (song_id, position) deferrable initially deferred,
  constraint tracks_instrument_fk foreign key (instrument_key, instrument_version)
    references catalog.items (key, version) on delete restrict,
  constraint tracks_kind        check (kind in ('instrument', 'drums', 'audio')),
  constraint tracks_role        check (role is null or role in ('drums', 'perc', 'bass', 'chords', 'keys', 'lead', 'color')),
  constraint tracks_instrument_by_kind check (
    (kind = 'audio' and instrument_key is null and instrument_version is null)
    or (kind <> 'audio' and instrument_key is not null and instrument_version is not null)
  ),
  constraint tracks_color       check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint tracks_gain        check (gain between 0 and 4),
  constraint tracks_pan         check (pan between -1 and 1),
  constraint tracks_fx_object   check (jsonb_typeof(fx_chain) = 'object'),
  constraint tracks_origin      check (origin in ('person', 'claude', 'pack', 'system'))
);

create index tracks_instrument_idx on studio.tracks (instrument_key, instrument_version);

create table studio.recordings (
  id            uuid        primary key default gen_random_uuid(),
  account_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id    uuid        not null references studio.profiles (id) on delete restrict,
  song_id       uuid        references studio.songs (id) on delete set null,
  storage_path  text        not null unique,   -- recordings/<account_id>/<profile_id>/<id>.<ext>
  mime_type     text        not null,          -- kept as recorded: audio/webm, audio/mp4, ...
  sample_rate   integer,
  channels      smallint,
  duration_ms   integer,
  bytes         bigint,
  source        text        not null default 'mic',
  origin        text        not null default 'person',
  created_at    timestamptz not null default now(),
  constraint recordings_mime     check (mime_type ~ '^audio/'),
  constraint recordings_rate     check (sample_rate is null or sample_rate between 8000 and 192000),
  constraint recordings_channels check (channels is null or channels in (1, 2)),
  constraint recordings_duration check (duration_ms is null or duration_ms > 0),
  constraint recordings_source   check (source in ('mic', 'line', 'import', 'render')),
  constraint recordings_origin   check (origin in ('person', 'claude', 'pack', 'system'))
);

create index recordings_song_idx on studio.recordings (song_id);

create table studio.ideas (
  id                      uuid        primary key default gen_random_uuid(),
  account_id              uuid        not null references auth.users (id) on delete cascade,
  song_id                 uuid        not null references studio.songs (id) on delete cascade,
  section_id              uuid        references studio.sections (id) on delete set null,
  track_id                uuid        references studio.tracks (id) on delete set null,
  target_instrument_key     text,                    -- the sound Claude had in mind; pinned like tracks
  target_instrument_version text,
  kind                    text        not null,
  title                   text        not null,
  prompt                  text,                      -- what was asked, in the person's words
  payload                 jsonb       not null,
  payload_schema_version  integer     not null default 1,
  status                  text        not null default 'proposed',
  validation              jsonb,                     -- validator errors when status = invalid
  origin                  text        not null default 'claude',
  requested_by            uuid        references studio.profiles (id) on delete set null,
  decided_by              uuid        references studio.profiles (id) on delete set null,
  decided_at              timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint ideas_kind     check (kind in ('clip', 'pattern', 'melody', 'chords', 'patch', 'fx_chain', 'lyrics')),
  constraint ideas_target_fk foreign key (target_instrument_key, target_instrument_version)
    references catalog.items (key, version) on delete restrict,
  constraint ideas_target_pair check ((target_instrument_key is null) = (target_instrument_version is null)),
  constraint ideas_status   check (status in ('proposed', 'accepted', 'dismissed', 'invalid')),
  constraint ideas_decided  check (status not in ('accepted', 'dismissed') or decided_at is not null),
  constraint ideas_payload  check (jsonb_typeof(payload) = 'object'),
  constraint ideas_origin   check (origin in ('person', 'claude', 'pack', 'system'))
);

create index ideas_song_status_idx on studio.ideas (song_id, status);

create table studio.clips (
  id                      uuid        primary key default gen_random_uuid(),
  account_id              uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  track_id                uuid        not null references studio.tracks (id) on delete cascade,
  name                    text,
  kind                    text        not null,
  start_tick              bigint      not null,
  length_ticks            bigint      not null,
  loop                    boolean     not null default false,
  content                 jsonb       not null,
  content_schema_version  integer     not null default 1,
  recording_id            uuid        references studio.recordings (id) on delete restrict,
  idea_id                 uuid        references studio.ideas (id) on delete set null,  -- set when it came from an accepted idea
  origin                  text        not null default 'person',
  created_by              uuid        references studio.profiles (id) on delete set null,
  updated_by              uuid        references studio.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint clips_kind      check (kind in ('notes', 'pattern', 'chords', 'audio')),
  constraint clips_start     check (start_tick >= 0),
  constraint clips_length    check (length_ticks > 0),
  constraint clips_audio_ref check ((kind = 'audio') = (recording_id is not null)),
  constraint clips_content   check (jsonb_typeof(content) = 'object'),
  constraint clips_origin    check (origin in ('person', 'claude', 'pack', 'system'))
);

create index clips_track_idx on studio.clips (track_id);
create index clips_recording_idx on studio.clips (recording_id);

create table studio.lyric_lines (
  id                        uuid        primary key default gen_random_uuid(),
  account_id                uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  section_id                uuid        not null references studio.sections (id) on delete cascade,
  position                  smallint    not null,
  lang                      text        not null default 'es',
  text                      text        not null,
  syllables                 jsonb       not null default '[]',   -- [{"t": "Bai", "stress": true, "note": "n1"}]
  syllables_schema_version  integer     not null default 1,
  origin                    text        not null default 'person',
  created_by                uuid        references studio.profiles (id) on delete set null,
  updated_by                uuid        references studio.profiles (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint lyric_lines_position_unique unique (section_id, position) deferrable initially deferred,
  constraint lyric_lines_lang      check (lang in ('en', 'es')),
  constraint lyric_lines_length    check (char_length(text) <= 200),
  constraint lyric_lines_syllables check (jsonb_typeof(syllables) = 'array'),
  constraint lyric_lines_origin    check (origin in ('person', 'claude', 'pack', 'system'))
);

create table studio.song_versions (
  id                       uuid        primary key default gen_random_uuid(),
  account_id               uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  song_id                  uuid        not null references studio.songs (id) on delete cascade,
  version_no               integer     not null,
  label                    text,
  snapshot                 jsonb       not null,   -- the whole song: sections, tracks, clips, lyrics
  snapshot_schema_version  integer     not null default 1,
  created_by               uuid        references studio.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  constraint song_versions_unique   unique (song_id, version_no),
  constraint song_versions_positive check (version_no > 0),
  constraint song_versions_snapshot check (jsonb_typeof(snapshot) = 'object')
);

-- updated_at on every table that has it
create trigger profiles_touch    before update on studio.profiles    for each row execute function studio.touch_updated_at();
create trigger songs_touch       before update on studio.songs       for each row execute function studio.touch_updated_at();
create trigger sections_touch    before update on studio.sections    for each row execute function studio.touch_updated_at();
create trigger tracks_touch      before update on studio.tracks      for each row execute function studio.touch_updated_at();
create trigger ideas_touch       before update on studio.ideas       for each row execute function studio.touch_updated_at();
create trigger clips_touch       before update on studio.clips       for each row execute function studio.touch_updated_at();
create trigger lyric_lines_touch before update on studio.lyric_lines for each row execute function studio.touch_updated_at();

-- same family on every parent link
create trigger songs_same_account_owner       before insert or update on studio.songs         for each row execute function studio.ensure_same_account('studio.profiles', 'owner_profile_id');
create trigger sections_same_account_song     before insert or update on studio.sections      for each row execute function studio.ensure_same_account('studio.songs', 'song_id');
create trigger tracks_same_account_song       before insert or update on studio.tracks        for each row execute function studio.ensure_same_account('studio.songs', 'song_id');
create trigger recordings_same_account_owner  before insert or update on studio.recordings    for each row execute function studio.ensure_same_account('studio.profiles', 'profile_id');
create trigger recordings_same_account_song   before insert or update on studio.recordings    for each row execute function studio.ensure_same_account('studio.songs', 'song_id');
create trigger ideas_same_account_song        before insert or update on studio.ideas         for each row execute function studio.ensure_same_account('studio.songs', 'song_id');
create trigger clips_same_account_track       before insert or update on studio.clips         for each row execute function studio.ensure_same_account('studio.tracks', 'track_id');
create trigger clips_same_account_recording   before insert or update on studio.clips         for each row execute function studio.ensure_same_account('studio.recordings', 'recording_id');
create trigger lyric_lines_same_account_sect  before insert or update on studio.lyric_lines   for each row execute function studio.ensure_same_account('studio.sections', 'section_id');
create trigger song_versions_same_account     before insert or update on studio.song_versions for each row execute function studio.ensure_same_account('studio.songs', 'song_id');

-- ---------------------------------------------------------------------------
-- Claude's write path: ideas go in through this function, never straight into songs
-- ---------------------------------------------------------------------------

create or replace function studio.propose_idea(
  p_song_id        uuid,
  p_kind           text,
  p_title          text,
  p_payload        jsonb,
  p_section_id     uuid default null,
  p_track_id       uuid default null,
  p_prompt         text default null,
  p_requested_by   uuid default null,
  p_schema_version integer default 1,
  p_target_instrument_key     text default null,
  p_target_instrument_version text default null
)
returns uuid
language plpgsql
as $$
declare
  v_account uuid;
  v_id      uuid;
begin
  select account_id into v_account from studio.songs where id = p_song_id;
  if v_account is null then
    raise exception 'song % not found', p_song_id;
  end if;
  if p_section_id is not null
     and not exists (select 1 from studio.sections where id = p_section_id and song_id = p_song_id) then
    raise exception 'section % is not part of song %', p_section_id, p_song_id;
  end if;
  if p_track_id is not null
     and not exists (select 1 from studio.tracks where id = p_track_id and song_id = p_song_id) then
    raise exception 'track % is not part of song %', p_track_id, p_song_id;
  end if;
  if p_requested_by is not null
     and not exists (select 1 from studio.profiles where id = p_requested_by and account_id = v_account) then
    raise exception 'profile % does not belong to this family', p_requested_by;
  end if;
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'payload must be a JSON object';
  end if;

  insert into studio.ideas (
    account_id, song_id, section_id, track_id, kind, title, prompt,
    payload, payload_schema_version, origin, requested_by,
    target_instrument_key, target_instrument_version
  ) values (
    v_account, p_song_id, p_section_id, p_track_id, p_kind, p_title, p_prompt,
    p_payload, p_schema_version, 'claude', p_requested_by,
    p_target_instrument_key, p_target_instrument_version
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function studio.propose_idea(uuid, text, text, jsonb, uuid, uuid, text, uuid, integer, text, text) from public;

-- ---------------------------------------------------------------------------
-- Security: family-only access through row level security
-- ---------------------------------------------------------------------------

alter table catalog.items       enable row level security;
alter table studio.profiles     enable row level security;
alter table studio.songs        enable row level security;
alter table studio.sections     enable row level security;
alter table studio.tracks       enable row level security;
alter table studio.recordings   enable row level security;
alter table studio.ideas        enable row level security;
alter table studio.clips        enable row level security;
alter table studio.lyric_lines  enable row level security;
alter table studio.song_versions enable row level security;

create policy catalog_read on catalog.items
  for select to authenticated using (true);

create policy family_rows on studio.profiles
  for all to authenticated
  using (account_id = (select auth.uid())) with check (account_id = (select auth.uid()));
create policy family_rows on studio.songs
  for all to authenticated
  using (account_id = (select auth.uid())) with check (account_id = (select auth.uid()));
create policy family_rows on studio.sections
  for all to authenticated
  using (account_id = (select auth.uid())) with check (account_id = (select auth.uid()));
create policy family_rows on studio.tracks
  for all to authenticated
  using (account_id = (select auth.uid())) with check (account_id = (select auth.uid()));
create policy family_rows on studio.recordings
  for all to authenticated
  using (account_id = (select auth.uid())) with check (account_id = (select auth.uid()));
create policy family_rows on studio.ideas
  for all to authenticated
  using (account_id = (select auth.uid())) with check (account_id = (select auth.uid()));
create policy family_rows on studio.clips
  for all to authenticated
  using (account_id = (select auth.uid())) with check (account_id = (select auth.uid()));
create policy family_rows on studio.lyric_lines
  for all to authenticated
  using (account_id = (select auth.uid())) with check (account_id = (select auth.uid()));
create policy family_rows on studio.song_versions
  for all to authenticated
  using (account_id = (select auth.uid())) with check (account_id = (select auth.uid()));

grant usage on schema catalog to authenticated, service_role;
grant usage on schema studio to authenticated, service_role;
grant select on all tables in schema catalog to authenticated;
grant all on all tables in schema catalog to service_role;
grant select, insert, update, delete on all tables in schema studio to authenticated;
grant all on all tables in schema studio to service_role;

-- ---------------------------------------------------------------------------
-- Storage: private buckets, one folder per family account
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false), ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy family_files_read on storage.objects
  for select to authenticated
  using (bucket_id in ('recordings', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy family_files_insert on storage.objects
  for insert to authenticated
  with check (bucket_id in ('recordings', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy family_files_update on storage.objects
  for update to authenticated
  using (bucket_id in ('recordings', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy family_files_delete on storage.objects
  for delete to authenticated
  using (bucket_id in ('recordings', 'avatars') and (storage.foldername(name))[1] = (select auth.uid())::text);
