import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as C from '../domain/commands';
import { loopBars, newSong, normalizeSong, ROLE_NAMES, roleOf, slotsFor, songSteps } from '../domain/factory';
import * as A from '../domain/arrange';
import type { CopyMode } from '../domain/arrange';
import { SongTimeline, StructureBar } from './Arrange';
import type { GridFrame } from './editors';
import type { Jump, MarkSel, View } from './timegrid';
import { exportSongFile, parseIdeasFile, parseSongFile, SONG_FILE_EXT, withFreshIds } from '../domain/files';
import type { CustomSound, Idea, NotesContent, PatternContent, Profile, Role, SectionKind, Song, SongVersion, ChordsContent, StarredInstrument } from '../domain/types';
import { BAR_TICKS, PPQ, STEP_TICKS } from '../domain/types';
import { engine } from '../engine/engine';
import { CUSTOM_KIT, DEFAULT_KIT, findItem, KITS, kitSlots, kitTitle, lowOf, title as catalogTitle } from '../packs/core';
import { chordMidi, diatonicTriads } from '../theory';
import type { SongStore } from '../store/store';
import { ChordLane, DrumGrid, Keyboard, NoteGrid, Pads, songKey } from './editors';
import { autoZoom, ZOOMS } from './zoom';
import type { Zoom } from './zoom';
import { CLAUDE_INSTRUCTIONS, IdeasTray, MixerPanel, TheoryPanel } from './panels';
import MixerBoard from './MixerBoard';
import Collection from './Collection';
import BeatAssistant from './BeatAssistant';
import Hub from './Hub';
import SongsRoom, { soundName } from './SongsRoom';
import { OutMeter, Transport } from './Transport';
import { t, tn } from './i18n';
import type { StringKey } from './i18n';
import type { Mode } from './prefs';
import { Avatar, downloadText, Icon, LangToggle, Modal, ModeSwitch, pickFile, slug, useToast, useWidth } from './ui';
import type { Lang } from '../domain/types';
import { ROOMS } from './rooms';
import type { Room } from './rooms';

/* Zoom is remembered per device: the iPhone, the iPad and the laptop each keep their own. */
const ZOOM_KEY = 'music-studio.zoom';
const readZoom = (): Zoom | null => {
  try {
    const z = localStorage.getItem(ZOOM_KEY);
    return z && (ZOOMS as string[]).includes(z) ? (z as Zoom) : null;
  } catch { return null; }
};
/* Note length is remembered per device too; one square, one note by default. */
const LEN_KEY = 'music-studio.note-length';
const readLen = (): number => {
  try {
    const n = Number(localStorage.getItem(LEN_KEY));
    return [1, 2, 4, 8, 16].includes(n) ? n : 1;
  } catch { return 1; }
};
const isTouch = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const ZOOM_LABEL = { fit: 'zoomFit', two: 'zoomTwo', bar: 'zoomBar', half: 'zoomHalf' } as const;
const ROOM_ICON = { sounds: 'amp', musician: 'music', producer: 'sliders', songs: 'disc' } as const;
const ROOM_LABEL: Record<Exclude<Room, 'hub'>, StringKey> = { sounds: 'roomSounds', musician: 'roomMusician', producer: 'roomProducer', songs: 'roomSongs' };

const LENGTHS = [
  { steps: 1, label: '1/16' },
  { steps: 2, label: '1/8' },
  { steps: 4, label: '1/4' },
  { steps: 8, label: '1/2' },
  { steps: 16, label: '1' },
];

const kitName = (key: string, lang: Lang) => (key === CUSTOM_KIT ? t('kitCustom', lang) : kitTitle(key, lang));
const sameSlots = (a: { role: Role; instrument: string }[], b: { role: Role; instrument: string }[]) =>
  a.length === b.length && a.every((x, i) => x.role === b[i].role && x.instrument === b[i].instrument);

export default function Studio({ store, profile, room, onRoom, lang, onLang, mode, onToggleMode, onProfiles, onSettings, onClassroom, onProfile }: {
  store: SongStore;
  profile: Profile;
  /** Which room is open; the song, its undo history and the sound stay the same from room to room. */
  room: Room;
  onRoom: (room: Room) => void;
  onProfile: (p: Profile) => void;
  lang: Lang;
  onLang: (l: Lang) => void;
  mode: Mode;
  onToggleMode: () => void;
  /** Back to the profile picker. */
  onProfiles: () => void;
  onSettings?: () => void;
  /** Opens Music Studio Classroom; absent where Classroom is off. */
  onClassroom?: () => void;
}) {
  const langRef = useRef(lang);
  useLayoutEffect(() => { langRef.current = lang; }, [lang]);
  const by = profile.id;
  const [song, setSong] = useState<Song | null>(null);
  const past = useRef<Song[]>([]);
  const future = useRef<Song[]>([]);
  const songRef = useRef<Song | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [selected, setSelected] = useState<string | null>(null);
  const [step, setStep] = useState(-1);
  const stepRef = useRef(-1);
  const [playing, setPlaying] = useState(false);
  const [rec, setRec] = useState(false);
  const [noteLen, setNoteLenState] = useState(readLen);
  const setNoteLen = (n: number) => {
    setNoteLenState(n);
    try { localStorage.setItem(LEN_KEY, String(n)); } catch { /* lasts this visit */ }
  };
  const [lows, setLows] = useState<Record<string, number>>({});
  const [focusBar, setFocusBar] = useState(0);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [modal, setModal] = useState<null | 'kit' | 'builder' | 'clear' | 'beat'>(null);
  const [pendingKit, setPendingKit] = useState<string | null>(null);
  const [songList, setSongList] = useState<Song[]>([]);
  const [versions, setVersions] = useState<SongVersion[]>([]);
  const [audioReady, setAudioReady] = useState(engine.started);
  const [toast, showToast] = useToast();
  const [zoomPref, setZoomPref] = useState<Zoom | null>(readZoom);
  const [editorRef, editorWidth] = useWidth<HTMLElement>();
  const touch = useMemo(() => isTouch(), []);
  // The side panel (key and ideas, or the channel) slides in on narrow screens and sits beside the work on wide ones.
  const [sideOpen, setSideOpen] = useState(false);

  // Listen to the selected track alone. Not saved in the song: mute and solo stay as they were.
  const [alone, setAlone] = useState(false);
  // The musician's mixer takes the editor's place while it is open.
  const [board, setBoard] = useState(false);
  const [sounds, setSounds] = useState<CustomSound[]>([]);
  useEffect(() => { store.listSounds(profile.id).then(setSounds).catch(() => setSounds([])); }, [store, profile.id]);
  useEffect(() => { store.listSongs(profile.id).then(setSongList).catch(() => undefined); }, [store, profile.id, room]);
  // Each room keeps its own tools: leaving the musician closes its mixer and stops recording taps.
  useEffect(() => { setBoard(false); setSideOpen(false); if (room !== 'musician') setRec(false); }, [room]);

  /* Song form: one part in view (and on repeat), mark mode, where play starts, what the grid shows. */
  const [focusId, setFocusId] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [sel, setSel] = useState<MarkSel>({ a: null, b: null });
  const [cursorBar, setCursorBar] = useState(0);
  const [onScreen, setOnScreen] = useState({ bar: 0, bars: 8 });
  const [jump, setJump] = useState<Jump>({ step: 0, n: 0 });
  const jumpTo = useCallback((step: number) => setJump((j) => ({ step, n: j.n + 1 })), []);
  const playFrom = useRef(0);
  const onScreenRef = useRef(onScreen);
  const onFirstBar = useCallback((bar: number, bars: number) => { onScreenRef.current = { bar, bars }; setOnScreen({ bar, bars }); }, []);

  // Full screen: the grid takes the whole width; the browser goes full screen too where it allows it.
  const [wide, setWide] = useState(false);
  const enteredFs = useRef(false);
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && enteredFs.current) { enteredFs.current = false; setWide(false); }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleWide = () => {
    const next = !wide;
    setWide(next);
    const root = document.documentElement;
    if (next && typeof root.requestFullscreen === 'function' && !document.fullscreenElement) {
      root.requestFullscreen().then(() => { enteredFs.current = true; }).catch(() => undefined);
    } else if (!next && document.fullscreenElement) {
      enteredFs.current = false;
      document.exitFullscreen().catch(() => undefined);
    }
  };

  /* ---------- load the last song, or start one */
  useEffect(() => {
    let alive = true;
    (async () => {
      const lastId = await store.getMeta<string>(`last_song:${profile.id}`);
      let s = lastId ? await store.getSong(lastId) : undefined;
      if (!s || s.status !== 'active') s = (await store.listSongs(profile.id))[0];
      if (!s) {
        s = newSong(profile.id, t(profile.id === 'guest' ? 'guestJam' : 'firstSong', langRef.current), 2, langRef.current);
        await store.saveSong(s);
      }
      s = normalizeSong(s);
      if (!alive) return;
      songRef.current = s;
      setSong(s);
      setSelected(s.tracks[0]?.id ?? null);
      await store.setMeta(`last_song:${profile.id}`, s.id);
      setIdeas(await store.listIdeas(s.id));
      setVersions(await store.listVersions(s.id));
      setSongList(await store.listSongs(profile.id));
    })();
    return () => { alive = false; };
  }, [store, profile.id]);

  /* ---------- engine follows the song; autosave a moment after each change */
  useEffect(() => {
    if (!song) return;
    engine.setSong(song);
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      store.saveSong(song).then(() => setSaveState('saved'));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [song, store]);

  useEffect(() => engine.onStep((s) => {
    stepRef.current = s;
    setStep(s);
    if (s >= 0 && s % 16 === 0) setFocusBar(Math.floor(s / 16));
  }), []);

  useEffect(() => () => engine.stop(), []);

  /* ---------- commands with undo (no side effects inside state updaters) */
  const [hist, setHist] = useState({ past: 0, future: 0 });
  const commit = useCallback((next: Song) => {
    songRef.current = next;
    setSong(next);
    setHist({ past: past.current.length, future: future.current.length });
  }, []);
  const apply = useCallback((fn: (s: Song) => Song) => {
    const prev = songRef.current;
    if (!prev) return;
    const next = fn(prev);
    if (next === prev) return;
    past.current.push(prev);
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    commit(next);
  }, [commit]);
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev || !songRef.current) return;
    future.current.push(songRef.current);
    commit(prev);
  }, [commit]);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next || !songRef.current) return;
    past.current.push(songRef.current);
    commit(next);
  }, [commit]);

  const togglePlay = useCallback(async () => {
    if (engine.playing) {
      engine.stop();
      setPlaying(false);
    } else {
      const ok = await engine.play(playFrom.current);
      setAudioReady(true);
      setPlaying(true);
      if (!ok) showToast(t('soundBlocked', lang));
    }
  }, [lang, showToast]);
  // A room that does not play the song (the sound studio, the hub) stops it on the way in.
  useEffect(() => { if ((room === 'sounds' || room === 'hub') && engine.playing) { engine.stop(); setPlaying(false); } }, [room]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space' && (room === 'musician' || room === 'producer')) { e.preventDefault(); togglePlay(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, undo, redo, room]);

  /* ---------- stable handlers for the memoized grids */
  const selRef = useRef(selected);
  useLayoutEffect(() => { selRef.current = selected; }, [selected]);
  const markRef = useRef(false);
  const barTapRef = useRef<(bar: number) => void>(() => undefined);
  const onToggleHit = useCallback((row: number, s: number) => {
    if (markRef.current) { barTapRef.current(Math.floor(s / 16)); return; }
    apply((x) => C.toggleHit(x, selRef.current!, row, s, by));
  }, [apply, by]);
  const onPreviewDrum = useCallback((key: string) => { engine.previewDrum(selRef.current!, key); }, []);
  const lenRef = useRef(noteLen);
  useLayoutEffect(() => { lenRef.current = noteLen; }, [noteLen]);
  const onToggleNote = useCallback((midi: number, s: number) => {
    if (markRef.current) { barTapRef.current(Math.floor(s / 16)); return; }
    apply((x) => C.toggleNote(x, selRef.current!, midi, s, lenRef.current, by));
    setFocusBar(Math.floor(s / 16));
  }, [apply, by]);
  const onPreviewNote = useCallback((midi: number) => { engine.previewNote(selRef.current!, midi); }, []);
  // A long note drawn by holding and dragging: written, then heard once at its full length.
  const onSpanNote = useCallback((midi: number, from: number, len: number) => {
    apply((x) => C.setNoteSpan(x, selRef.current!, midi, from, len, by));
    setFocusBar(Math.floor(from / 16));
    const bpm = songRef.current?.tempo_bpm ?? 90;
    engine.previewNotes(selRef.current!, [{ midi, at: 0, dur: len * (60 / bpm / 4), vel: 0.8 }]);
  }, [apply, by]);

  const track = song?.tracks.find((tr) => tr.id === selected) ?? song?.tracks[0];
  const clipKind = track?.clips[0]?.kind;
  const low = track ? lows[track.id] ?? lowOf(track.instrument?.key ?? '') : 60;

  const startAudio = async () => {
    const ok = await engine.start();
    setAudioReady(true);
    if (ok) engine.previewClick();
    else showToast(`${t('soundBlocked', lang)} (${engine.latencyInfo().state})`);
  };

  /* ---------- live input */
  const padHit = (row: number, soundKey: string) => {
    if (!track) return;
    engine.previewDrum(track.id, soundKey);
    setAudioReady(true);
    if (rec && engine.playing && stepRef.current >= 0) apply((x) => C.addHit(x, track.id, row, stepRef.current, by));
  };
  const keyPlay = (midi: number) => {
    if (!track) return;
    engine.previewNote(track.id, midi);
    setAudioReady(true);
    if (rec && engine.playing && stepRef.current >= 0) apply((x) => C.addNote(x, track.id, midi, stepRef.current, noteLen, by));
  };

  /* ---------- songs */
  const refreshSongs = async () => setSongList(await store.listSongs(profile.id));
  const switchTo = async (raw: Song) => {
    const s = normalizeSong(raw);
    engine.stop();
    setPlaying(false);
    past.current = [];
    future.current = [];
    setFocusId(null);
    setMarking(false);
    setSel({ a: null, b: null });
    setCursorBar(0);
    commit(s);
    setSelected(s.tracks[0]?.id ?? null);
    setFocusBar(0);
    await store.setMeta(`last_song:${profile.id}`, s.id);
    setIdeas(await store.listIdeas(s.id));
    setVersions(await store.listVersions(s.id));
    await refreshSongs();
  };
  const createSong = async () => {
    const count = (await store.listSongs(profile.id)).length;
    const s = newSong(profile.id, t('songN', lang, { n: count + 1 }), 2, lang, song?.kit_key ?? profile.last_kit ?? DEFAULT_KIT, profile.starred ?? [], false);
    await store.saveSong(s);
    await switchTo(s);
  };

  /* ---------- kits by genre and the custom kit */
  const starred = profile.starred ?? [];
  const currentKit = song?.kit_key ?? DEFAULT_KIT;
  const isStarred = (key: string | undefined, role: Role) => !!key && starred.some((x) => x.key === key && x.role === role && !x.sound);
  const toggleStar = (key: string, role: Role) => {
    const next: StarredInstrument[] = isStarred(key, role) ? starred.filter((x) => !(x.key === key && x.role === role && !x.sound)) : [...starred, { key, role }];
    onProfile({ ...profile, starred: next, updated_at: new Date().toISOString() });
  };
  const pickKit = (key: string) => {
    if (key === CUSTOM_KIT) { setModal('builder'); return; }
    if (key === currentKit) return;
    setPendingKit(key);
    setModal('kit');
  };
  const closeBuilder = () => { engine.disposePreviews(); setModal(null); };
  const rememberKit = (key: string) => {
    if (profile.last_kit !== key) onProfile({ ...profile, last_kit: key, updated_at: new Date().toISOString() });
  };
  const keepNotesIn = (key: string) => {
    const selectedRole = track ? roleOf(track) : null;
    apply((x) => C.switchKit(x, key, slotsFor(key, starred), lang, by));
    const next = songRef.current;
    if (next && !next.tracks.some((tr) => tr.id === selected)) setSelected(next.tracks.find((tr) => roleOf(tr) === selectedRole)?.id ?? next.tracks[0]?.id ?? null);
    rememberKit(key);
    setModal(null);
    setPendingKit(null);
    showToast(t('kitSwitched', lang, { kit: kitName(key, lang) }));
  };
  const startBlankIn = async (key: string) => {
    const count = (await store.listSongs(profile.id)).length;
    const s = newSong(profile.id, t('songN', lang, { n: count + 1 }), song ? loopBars(song) : 2, lang, key, starred, false);
    await store.saveSong(s);
    rememberKit(key);
    setPendingKit(null);
    await switchTo(s);
    showToast(t('kitSwitched', lang, { kit: kitName(key, lang) }));
  };
  // In the custom kit, stars changed since the song was built: offer to rebuild it.
  const customStale = currentKit === CUSTOM_KIT && !!song && starred.length > 0 &&
    !sameSlots(slotsFor(CUSTOM_KIT, starred), song.tracks.filter((tr) => tr.instrument).map((tr) => ({ role: roleOf(tr), instrument: tr.instrument!.key })));
  const exportSong = () => {
    if (!song) return;
    downloadText(`${slug(song.title)}${SONG_FILE_EXT}`, exportSongFile(song));
  };
  const importSong = async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    const parsed = parseSongFile(await file.text());
    if (!parsed.ok) { showToast(parsed.errors[0]); return; }
    const exists = await store.getSong(parsed.value.id);
    const s = exists ? withFreshIds(parsed.value, profile.id) : { ...parsed.value, owner_profile_id: profile.id };
    await store.saveSong(s);
    await switchTo(s);
    showToast(t('imported', lang, { title: s.title }));
  };
  const saveVersion = async () => {
    if (!song) return;
    const v = await store.saveVersion(song, null, by);
    setVersions(await store.listVersions(song.id));
    showToast(t('versionSaved', lang, { n: v.version_no }));
  };

  /* ---------- ideas */
  const importIdeas = async () => {
    if (!song) return;
    const file = await pickFile('.json,application/json');
    if (!file) return;
    const parsed = parseIdeasFile(await file.text(), song.id, by);
    if (!parsed.ok) { showToast(t('ideaRefused', lang, { error: parsed.errors[0] })); return; }
    for (const i of parsed.value) await store.saveIdea(i);
    setIdeas(await store.listIdeas(song.id));
    showToast(tn('ideasReadyOne', 'ideasReadyMany', parsed.value.length, lang));
  };
  const listenIdea = (idea: Idea) => {
    if (!song) return;
    const sec = (ticks: number) => (ticks / PPQ) * (60 / song.tempo_bpm);
    const p = idea.payload as Record<string, unknown>;
    if (Array.isArray(p.notes)) {
      const target = song.tracks.find((tr) => tr.instrument?.key === idea.target_instrument?.key && tr.clips[0].kind === 'notes')
        ?? song.tracks.find((tr) => tr.clips[0].kind === 'notes');
      if (target) engine.previewNotes(target.id, (p as unknown as NotesContent).notes.map((n) => ({ midi: n.midi, at: sec(n.tick), dur: sec(n.dur), vel: n.vel ?? 0.8 })));
    } else if (Array.isArray(p.rows)) {
      const target = song.tracks.find((tr) => tr.kind === 'drums');
      if (target) engine.previewHits(target.id, (p as unknown as PatternContent).rows.flatMap((r) => r.hits.map((h) => ({ soundKey: r.sound.key, at: sec(h.step * STEP_TICKS), vel: h.vel ?? 1 }))));
    } else if (Array.isArray(p.chords)) {
      const target = song.tracks.find((tr) => tr.clips[0].kind === 'chords');
      const triads = diatonicTriads(songKey(song));
      if (target) engine.previewNotes(target.id, (p as unknown as ChordsContent).chords.flatMap((c) =>
        triads[c.degree] ? chordMidi(triads[c.degree], 52).map((m) => ({ midi: m, at: sec(c.tick), dur: sec(c.dur), vel: 0.6 })) : []));
    }
  };
  const decide = async (idea: Idea, status: 'accepted' | 'dismissed') => {
    const updated = { ...idea, status, decided_by: by, decided_at: new Date().toISOString() };
    await store.saveIdea(updated);
    setIdeas((list) => list.map((i) => (i.id === idea.id ? updated : i)));
  };
  const keepIdea = async (idea: Idea, trackId: string) => {
    apply((x) => C.keepIdea(x, idea, trackId, by));
    await decide(idea, 'accepted');
    setSelected(trackId);
    showToast(t('keptIdea', lang, { title: idea.title }));
  };

  const copyHelp = async () => {
    try {
      await navigator.clipboard.writeText(CLAUDE_INSTRUCTIONS);
      showToast(t('copiedFormat', lang));
    } catch {
      downloadText('claude-idea-format.txt', CLAUDE_INSTRUCTIONS, 'text/plain');
    }
  };

  const bars = song ? loopBars(song) : 2;
  const songTotal = song ? songSteps(song) : 32;
  const focusSection = song?.sections.find((x) => x.id === focusId) ?? null;
  const fStart = focusSection?.start_tick ?? -1;
  const fLen = focusSection?.length_ticks ?? 0;
  const view: View = useMemo(() => (fStart >= 0 && fLen > 0
    ? { start: fStart / STEP_TICKS, length: fLen / STEP_TICKS }
    : { start: 0, length: songTotal }), [fStart, fLen, songTotal]);
  const focused = fStart >= 0;
  useEffect(() => { engine.setRange(focused ? view : null); }, [focused, view]);
  useEffect(() => () => engine.setRange(null), []);
  useEffect(() => { if (focusId && song && !song.sections.some((x) => x.id === focusId)) setFocusId(null); }, [focusId, song]);
  useEffect(() => { if (cursorBar > bars - 1) setCursorBar(Math.max(0, bars - 1)); }, [cursorBar, bars]);
  useLayoutEffect(() => { playFrom.current = focused ? view.start : Math.min(cursorBar, bars - 1) * 16; }, [focused, view, cursorBar, bars]);
  useLayoutEffect(() => { markRef.current = marking; }, [marking]);
  // Changing track keeps the same bars in view.
  useEffect(() => { jumpTo(onScreenRef.current.bar * 16); }, [selected, jumpTo]);

  const onBarTap = useCallback((bar: number) => {
    if (markRef.current) {
      setSel((cur) => (cur.a === null || cur.b !== null ? { a: bar, b: null } : { a: cur.a, b: bar }));
      return;
    }
    setCursorBar(bar);
    if (engine.playing) engine.seek(bar * 16);
  }, []);
  useLayoutEffect(() => { barTapRef.current = onBarTap; }, [onBarTap]);

  const pickKind = (kind: SectionKind) => {
    if (sel.a === null || sel.b === null || !song) return;
    const lo = Math.min(sel.a, sel.b), hi = Math.max(sel.a, sel.b);
    apply((x) => A.markSection(x, lo, hi, kind, lang, by));
    // The next part starts right after this one.
    setSel({ a: hi + 1 < bars ? hi + 1 : null, b: null });
  };
  const toggleMarking = (on: boolean) => {
    setMarking(on);
    if (on && song) {
      setFocusId(null);
      setSel({ a: A.unmarkedRanges(song)[0]?.from ?? null, b: null });
    } else {
      setSel({ a: null, b: null });
    }
  };
  const focusOn = (id: string | null) => {
    setFocusId(id);
    const sec = song?.sections.find((x) => x.id === id);
    const step = sec ? sec.start_tick / STEP_TICKS : cursorBar * 16;
    jumpTo(step);
    if (engine.playing) engine.seek(step);
  };
  const tryApply = (fn: (x: Song) => Song, ok: () => void) => {
    const cur = songRef.current;
    if (!cur) return;
    const next = fn(cur);
    if (next === cur) { showToast(t('tooLong', lang, { max: A.MAX_BARS })); return; }
    apply(() => next);
    ok();
  };
  const copyPart = (id: string, atBar: number, mode: CopyMode) => {
    const name = song?.sections.find((x) => x.id === id)?.name ?? '';
    tryApply((x) => A.copySection(x, id, atBar, mode, lang, by), () => { showToast(t('copied', lang, { name, bar: atBar + 1 })); });
  };
  const repeatPart = (id: string, times: number, extend: boolean) => {
    const name = song?.sections.find((x) => x.id === id)?.name ?? '';
    tryApply((x) => A.repeatSection(x, id, times, lang, by, extend), () => { showToast(t(times === 1 ? 'repeatedOnce' : 'repeated', lang, { name, n: times })); });
  };
  const deletePartBars = (id: string) => {
    const name = song?.sections.find((x) => x.id === id)?.name ?? '';
    apply((x) => A.deleteSectionBars(x, id, lang, by));
    setFocusId(null);
    showToast(t('barsDeleted', lang, { name }));
  };
  const scrub = (bar: number) => {
    if (focusSection && (bar < fStart / BAR_TICKS || bar >= (fStart + fLen) / BAR_TICKS)) setFocusId(null);
    setCursorBar(bar);
    jumpTo(bar * 16);
    if (engine.playing) engine.seek(bar * 16);
  };

  const zoom: Zoom = zoomPref ?? autoZoom(view.length, editorWidth, touch);
  const frame: GridFrame = {
    view, sections: song?.sections ?? [], marking, sel, cursorBar: focused ? null : cursorBar, jump, onBarTap, onFirstBar,
  };
  const pickZoom = (z: Zoom) => {
    setZoomPref(z);
    try { localStorage.setItem(ZOOM_KEY, z); } catch { /* this browser keeps nothing; the choice lasts the visit */ }
  };
  useEffect(() => { engine.setFocus(alone && track ? track.id : null); }, [alone, track]);
  useEffect(() => () => engine.setFocus(null), []);
  const trackTitle = useMemo(() => (track ? soundName(track.instrument, track.sound, lang) : ''), [track, lang]);

  if (!song || !track) return <div className="home"><p className="muted">{t('loading', lang)}</p></div>;

  /* ---------- the trash: what it clears depends on where you stand */
  const clearScope = focusSection
    ? { from: focusSection.start_tick, to: focusSection.start_tick + focusSection.length_ticks, label: t('clearInPart', lang, { name: focusSection.name, from: A.sectionStartBar(focusSection) + 1, to: A.sectionStartBar(focusSection) + A.sectionBars(focusSection) }) }
    : { from: 0, to: bars * BAR_TICKS, label: t('clearInSong', lang, { n: bars }) };
  const clearCount = C.countWritten(song, track.id, clearScope.from, clearScope.to);
  const clearCountSong = C.countWritten(song, track.id, 0, bars * BAR_TICKS);
  const unit = (n: number) => t(clipKind === 'pattern' ? (n === 1 ? 'nHitsOne' : 'nHits') : clipKind === 'chords' ? (n === 1 ? 'nChordsOne' : 'nChords') : (n === 1 ? 'nNotesOne' : 'nNotes'), lang, { n });

  /* ---------- the parts of the screen */
  const transport = (extra?: React.ReactNode) => (
    <Transport song={song} lang={lang} playing={playing} step={step} cursorBar={cursorBar}
      rec={room === 'musician' ? rec : undefined} onRec={room === 'musician' ? () => setRec((r) => !r) : undefined}
      onPlay={togglePlay} onTempo={(bpm) => apply((x) => C.setTempo(x, bpm, by))} onBars={(n) => apply((x) => A.setSongBars(x, n, by))}>
      {extra}
      <button type="button" className="btn icon side-toggle" aria-pressed={sideOpen} onClick={() => setSideOpen((o) => !o)}
        aria-label={t(room === 'producer' ? 'sideChannel' : 'sideKey', lang)} title={t(room === 'producer' ? 'sideChannel' : 'sideKey', lang)}>
        <Icon name="panel" />
      </button>
    </Transport>
  );

  const structure = (
    <StructureBar song={song} lang={lang} focusId={focusId} marking={marking} sel={sel} compact
      onFocus={focusOn} onMarking={toggleMarking} onPick={pickKind} onClearSel={() => setSel({ a: null, b: null })}
      onRename={(id, name) => apply((x) => A.renameSection(x, id, name, lang, by))}
      onKind={(id, kind) => apply((x) => A.setSectionKind(x, id, kind, lang, by))}
      onCopy={copyPart} onRepeat={repeatPart}
      onUnmark={(id) => { apply((x) => A.removeSection(x, id, lang, by)); setFocusId(null); }}
      onDeleteBars={deletePartBars} />
  );
  const timeline = (firstBar: number, onScreenBars: number) => (
    <SongTimeline song={song} lang={lang} step={step} firstBar={focused ? Math.floor(view.start / 16) : firstBar}
      barsOnScreen={focused ? Math.round(view.length / 16) : onScreenBars} focusId={focusId} cursorBar={cursorBar}
      marking={marking} sel={sel} onBarTap={onBarTap} onScrub={scrub} />
  );
  const mixer = (
    <MixerBoard song={song} selected={track.id} lang={lang} onSelect={setSelected}
      onGain={(id, g) => apply((x) => C.setGain(x, id, g, by))}
      onPan={(id, v) => apply((x) => C.setPan(x, id, v, by))}
      onMute={(id) => apply((x) => C.toggleMute(x, id, by))}
      onSolo={(id) => apply((x) => C.toggleSolo(x, id, by))} />
  );
  const aloneBtn = (
    <button type="button" className="btn alone" aria-pressed={alone} onClick={() => setAlone((a) => !a)}
      aria-label={t('onlyThis', lang)} title={t('onlyThisHint', lang)}>
      <Icon name="headphones" size={18} /> <span className="hide-md">{t('onlyThis', lang)}</span>
    </button>
  );

  const trackList = (
    <nav className="tracks" aria-label={t('tracks', lang)}>
      <div className="kit-picker">
        <label className="lbl" htmlFor="kit-select">{t('genre', lang)}</label>
        <div className="row" style={{ gap: 6 }}>
          <select id="kit-select" className="field grow" value={currentKit} onChange={(e) => pickKit(e.target.value)}>
            {KITS.map((k) => <option key={k.key} value={k.key}>{k.title[lang]}</option>)}
            <option value={CUSTOM_KIT}>{t('kitCustom', lang)}{starred.length ? ` (★ ${starred.length})` : ''}</option>
          </select>
          <button type="button" className="btn icon" onClick={() => setModal('builder')} aria-label={t('buildKit', lang)} title={t('buildKit', lang)}>
            <Icon name={starred.length ? 'starFill' : 'star'} size={18} />
          </button>
        </div>
        {customStale && (
          <button type="button" className="btn small-btn" onClick={() => { setPendingKit(CUSTOM_KIT); setModal('kit'); }} title={t('updateKitHint', lang)}>
            <Icon name="starFill" size={16} /> {t('updateKit', lang)}
          </button>
        )}
      </div>
      {song.tracks.map((tr) => (
        <div key={tr.id} className={`row track-line${alone && tr.id !== track.id ? ' quiet' : ''}`} style={{ gap: 4 }}>
          <button type="button" className="track-btn grow" aria-current={tr.id === track.id} onClick={() => setSelected(tr.id)}>
            <span className="swatch" style={{ background: tr.color }} />
            <span className="stack" style={{ gap: 0, minWidth: 0 }}>
              <strong>{tr.name}</strong>
              <span className="small muted ellipsis">{tr.producer && tr.voice_from === 'producer' ? soundName(tr.producer.instrument, tr.producer.sound, lang) : soundName(tr.instrument, tr.sound, lang)}</span>
            </span>
          </button>
          {tr.instrument && (
            <button type="button" className={`mini star${isStarred(tr.instrument.key, roleOf(tr)) ? ' on' : ''}`}
              aria-pressed={isStarred(tr.instrument.key, roleOf(tr))}
              onClick={() => toggleStar(tr.instrument!.key, roleOf(tr))}
              aria-label={t(isStarred(tr.instrument.key, roleOf(tr)) ? 'unstar' : 'star', lang, { name: catalogTitle(tr.instrument, lang) })}
              title={t(isStarred(tr.instrument.key, roleOf(tr)) ? 'unstar' : 'star', lang, { name: catalogTitle(tr.instrument, lang) })}>
              <Icon name={isStarred(tr.instrument.key, roleOf(tr)) ? 'starFill' : 'star'} size={16} />
            </button>
          )}
          <button type="button" className="mini" aria-pressed={tr.muted} onClick={() => apply((x) => C.toggleMute(x, tr.id, by))} aria-label={t('muteTrack', lang, { name: tr.name })} title={t('muteHint', lang)}>M</button>
        </div>
      ))}
    </nav>
  );

  const zoomTools = (clipKind === 'pattern' || clipKind === 'notes') && (
    <div className="row grid-view" style={{ gap: 6 }}>
      <div className="seg" aria-label={t('zoom', lang)}>
        {ZOOMS.map((z) => <button key={z} type="button" aria-pressed={zoom === z} onClick={() => pickZoom(z)}>{t(ZOOM_LABEL[z], lang)}</button>)}
      </div>
      <button type="button" className="btn icon" aria-pressed={wide} onClick={toggleWide}
        aria-label={t(wide ? 'exitFullScreen' : 'fullScreen', lang)} title={t(wide ? 'exitFullScreen' : 'fullScreen', lang)}>
        <Icon name={wide ? 'shrink' : 'expand'} />
      </button>
    </div>
  );

  const musicianWork = (
    <main className="work" ref={editorRef}>
      {transport()}
      {board ? (
        <section className="stack board-wrap" aria-label={t('mixerBoard', lang)}>
          <div className="row wrap">
            <h2 className="display grow" style={{ fontSize: 20 }}>{t('mixerBoard', lang)} <span className="muted small ui-font">{t('mixerBoardHint', lang)}</span></h2>
            <button type="button" className="btn" onClick={() => setBoard(false)}><Icon name="back" size={18} /> {t('backToEditor', lang)}</button>
          </div>
          {mixer}
        </section>
      ) : (<>
        <div className="inst-head">
          <span className="swatch big" style={{ background: track.color }} />
          <h2 className="display inst-name">{track.name} <span className="muted small ui-font">{trackTitle}</span></h2>
          {/* The trash belongs to this instrument: it clears what is written here, in the part in view. */}
          <button type="button" className="btn icon clear-btn" onClick={() => setModal('clear')} disabled={!C.hasWritten(song, track.id)}
            aria-label={t('clearInstrument', lang, { name: track.name })} title={t('clearInstrument', lang, { name: track.name })}><Icon name="trash" /></button>
          <span className="grow" />
          {clipKind === 'notes' && (
            <div className="row" style={{ gap: 6 }}>
              <span className="small muted hide-lg">{t('noteLength', lang)}</span>
              <div className="seg" aria-label={t('noteLength', lang)}>
                {LENGTHS.map((l) => <button key={l.steps} type="button" aria-pressed={noteLen === l.steps} onClick={() => setNoteLen(l.steps)}>{l.label}</button>)}
              </div>
            </div>
          )}
          {aloneBtn}
          <button type="button" className="btn" onClick={() => setBoard(true)} title={t('mixerBoardHint', lang)} aria-label={t('mixerBoard', lang)}>
            <Icon name="sliders" size={18} /> <span className="hide-lg">{t('mixerBoard', lang)}</span>
          </button>
        </div>

        <div className="songmap">
          {structure}
          {timeline(onScreen.bar, onScreen.bars)}
        </div>

        <div className={`grid-area kind-${clipKind}`}>
          {clipKind === 'pattern' && (
            <>
              <div className="row small muted grid-tools">
                <span className="hide-md">{t('drumTapHint', lang)}</span>
                <span className="grow" />
                {zoomTools}
              </div>
              <DrumGrid track={track} step={step} zoom={zoom} width={editorWidth} lang={lang} frame={frame} onToggle={onToggleHit} onPreview={onPreviewDrum} />
            </>
          )}
          {clipKind === 'notes' && (
            <NoteGrid song={song} track={track} low={low} step={step} zoom={zoom} width={editorWidth} focusBar={focusBar} lang={lang} frame={frame}
              onToggle={onToggleNote} onSpan={onSpanNote} onPreview={onPreviewNote} tools={zoomTools}
              onShift={(d) => setLows((m) => ({ ...m, [track.id]: Math.min(96, Math.max(24, low + d)) }))} />
          )}
          {clipKind === 'chords' && (
            <ChordLane song={song} track={track} step={step} lang={lang} width={editorWidth} frame={frame}
              onSet={(bar, degree) => { apply((x) => C.setChord(x, track.id, bar, degree, by)); setFocusBar(bar); }}
              onPreview={(midis) => engine.previewNotes(track.id, midis.map((m) => ({ midi: m, at: 0, dur: 0.9, vel: 0.6 })))} />
          )}
        </div>

        {(clipKind === 'pattern' || clipKind === 'notes') && (
          <div className="dock">
            {clipKind === 'pattern' && <Pads track={track} lang={lang} onHit={padHit} />}
            {clipKind === 'notes' && <Keyboard song={song} low={low} focusBar={focusBar} lang={lang} onPlay={keyPlay} />}
          </div>
        )}
      </>)}
    </main>
  );

  const producerWork = (
    <main className="work" ref={editorRef}>
      {transport(aloneBtn)}
      <section className="stack board-wrap" aria-label={t('console', lang)}>
        <div className="row wrap">
          <h2 className="display grow" style={{ fontSize: 20 }}>{t('console', lang)} <span className="muted small ui-font">{t('consoleHint', lang)}</span></h2>
          <button type="button" className="btn small-btn collection-btn" onClick={() => onRoom('sounds')} title={t('collectionOpen', lang)}>
            <Icon name="amp" size={16} /> {t('roomSounds', lang)}
          </button>
        </div>
        {mixer}
      </section>
      <div className="songmap">
        {structure}
        {timeline(0, bars)}
      </div>
    </main>
  );

  const side = (
    <aside className={`side${sideOpen ? ' open' : ''}`} aria-label={t(room === 'producer' ? 'sideChannel' : 'sideKey', lang)}>
      <div className="side-close"><button type="button" className="btn icon ghost" onClick={() => setSideOpen(false)} aria-label={t('close', lang)}><Icon name="close" /></button></div>
      {room === 'producer' ? (
        <MixerPanel song={song} track={track} lang={lang}
          onGain={(g) => apply((x) => C.setGain(x, track.id, g, by))}
          onMute={() => apply((x) => C.toggleMute(x, track.id, by))}
          onSolo={() => apply((x) => C.toggleSolo(x, track.id, by))}
          onKit={(r) => apply((x) => C.setInstrument(x, track.id, r, by))}
          onBypass={(slot, b) => apply((x) => C.setFxBypass(x, track.id, slot, b, by))}
          onParam={(slot, name, v) => apply((x) => C.setFxParam(x, track.id, slot, name, v, by))}
          onSwing={(v) => apply((x) => C.setSwing(x, v, by))}
          onResetSwing={() => apply((x) => C.resetSwing(x, by))}
          onResetFx={(slot) => apply((x) => C.resetFx(x, track.id, slot, by))}
          onAddFx={(key) => apply((x) => C.addFx(x, track.id, key, by))}
          onRemoveFx={(slot) => apply((x) => C.removeFx(x, track.id, slot, by))} />
      ) : (
        <TheoryPanel song={song} lang={lang} focusBar={focusBar} onKey={(tonic, mode) => apply((x) => C.setKey(x, tonic, mode, by))} />
      )}
      <IdeasTray ideas={ideas} tracks={song.tracks} lang={lang} onImport={importIdeas} onListen={listenIdea}
        onKeep={keepIdea} onDismiss={(i) => decide(i, 'dismissed')} onCopyHelp={copyHelp} />
    </aside>
  );

  const roomBody = (() => {
    if (room === 'sounds') {
      return (
        <div className="body room-sounds">
          <Collection song={song} selectedId={track.id} profileId={profile.id} lang={lang} sounds={sounds} onClose={() => onRoom('musician')} onBeat={() => setModal('beat')}
            onUse={(trackId, key) => {
              const ref = { key, version: '1.0.0' };
              apply((x) => C.setInstrument(x, trackId, ref, by));
              setSelected(trackId);
              const tr = song.tracks.find((x) => x.id === trackId);
              showToast(t('collectionUsed', lang, { name: catalogTitle(ref, lang), track: tr?.name ?? '' }));
            }}
            onUseSound={(trackId, sound) => {
              apply((x) => C.applySound(x, trackId, sound, by));
              setSelected(trackId);
              const tr = song.tracks.find((x) => x.id === trackId);
              showToast(t('collectionUsed', lang, { name: sound.name, track: tr?.name ?? '' }));
            }}
            onSaveSound={async (sound) => {
              await store.saveSound(sound);
              setSounds(await store.listSounds(profile.id));
              showToast(t('mySoundSaved', lang, { name: sound.name }));
            }}
            onDeleteSound={async (id) => {
              await store.deleteSound(id);
              setSounds(await store.listSounds(profile.id));
            }} />
        </div>
      );
    }
    if (room === 'songs') {
      return (
        <div className="body room-songs">
          <SongsRoom song={song} songs={songList} versions={versions} lang={lang}
            onOpen={(s) => { if (s.id !== song.id) switchTo(s); }} onRoom={onRoom} onNew={createSong} onBeat={() => setModal('beat')}
            onImport={importSong} onExport={exportSong} onSaveVersion={saveVersion}
            onRestore={(v) => { apply(() => ({ ...normalizeSong(v.snapshot), updated_at: new Date().toISOString() })); showToast(t('versionRestored', lang, { n: v.version_no })); }}
            onVoice={(id, from) => apply((x) => C.setVoiceFrom(x, id, from, by))} />
        </div>
      );
    }
    if (room === 'producer') return <div className="body room-producer">{producerWork}{side}</div>;
    return <div className="body room-musician">{trackList}{musicianWork}{side}</div>;
  })();

  return (
    <div className={`studio room-${room}${wide ? ' wide' : ''}`}>
      {room === 'hub' ? (
        <Hub profile={profile} song={song} lang={lang} mode={mode} onLang={onLang} onToggleMode={onToggleMode} onRoom={onRoom}
          onProfiles={onProfiles} onSettings={onSettings} onClassroom={onClassroom}
          stats={{ kit: starred.length, sounds: sounds.length, songs: songList.length }} />
      ) : (<>
        <header className="topbar">
          <div className="tb-group tb-left">
            <button type="button" className="btn icon" onClick={() => onRoom('hub')} aria-label={t('hubOpen', lang)} title={t('hubOpen', lang)}><Icon name="home" /></button>
            <Avatar profile={profile} onClick={onSettings} label={t('settings', lang)} />
            <nav className="rooms" aria-label={t('rooms', lang)}>
              {ROOMS.map((r) => (
                <button key={r} type="button" aria-current={room === r ? 'page' : undefined} onClick={() => onRoom(r)} aria-label={t(ROOM_LABEL[r], lang)} title={t(ROOM_LABEL[r], lang)}>
                  <Icon name={ROOM_ICON[r]} size={18} /> <span className="room-label">{t(ROOM_LABEL[r], lang)}</span>
                </button>
              ))}
            </nav>
          </div>
          <div className="tb-group tb-song">
            <input className="title-input" aria-label={t('songTitle', lang)} value={song.title}
              onChange={(e) => { if (songRef.current) { songRef.current = { ...songRef.current, title: e.target.value }; setSong(songRef.current); } }}
              onBlur={(e) => apply((x) => C.setTitle(x, e.target.value, by))} />
            <span className="small muted hide-sm save-state" aria-live="polite">{saveState === 'saving' ? t('saving', lang) : t('saved', lang)}</span>
          </div>
          <div className="tb-group tb-right">
            {room === 'sounds' && <OutMeter label={t('soundOutput', lang)} />}
            <button type="button" className="btn icon" onClick={undo} disabled={!hist.past} aria-label={t('undo', lang)} title={t('undo', lang)}><Icon name="undo" /></button>
            <button type="button" className="btn icon" onClick={redo} disabled={!hist.future} aria-label={t('redo', lang)} title={t('redo', lang)}><Icon name="redo" /></button>
            {onClassroom && (
              <button type="button" className="btn icon classroom-btn" onClick={onClassroom} aria-label={t('clOpen', lang)} title={t('clOpen', lang)}>
                <Icon name="classroom" size={20} />
              </button>
            )}
            <LangToggle lang={lang} onLang={onLang} />
            <ModeSwitch mode={mode} onToggle={onToggleMode} lang={lang} />
          </div>
        </header>
        {roomBody}
      </>)}

      {!audioReady && room !== 'hub' && room !== 'songs' && (
        <div className="start-overlay">
          <button type="button" className="btn primary" style={{ minHeight: 64, fontSize: 18, padding: '0 28px' }} onClick={startAudio}>
            <Icon name="play" /> {t('tapToStart', lang)}
          </button>
        </div>
      )}

      {modal === 'clear' && (
        <Modal title={t('clearTitleTrack', lang, { name: track.name })} closeLabel={t('close', lang)} onClose={() => setModal(null)}>
          <div className="row warn-box" role="alert">
            <Icon name="warning" size={28} />
            <p style={{ margin: 0 }}>
              {clearCount > 0
                ? <>{t('clearWhat', lang, { name: track.name, where: clearScope.label })} <strong>{unit(clearCount)}</strong>.</>
                : t('clearNothingHere', lang, { name: track.name, where: clearScope.label })}
            </p>
          </div>
          <p className="muted" style={{ margin: 0 }}>{t('clearKeepsTrack', lang)}</p>
          <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost" onClick={() => setModal(null)}>{t('cancel', lang)}</button>
            {focusSection && clearCountSong > clearCount && (
              <button type="button" className="btn" onClick={() => { apply((x) => C.clearRange(x, track.id, 0, bars * BAR_TICKS, by)); setModal(null); showToast(t('clearedWhere', lang, { name: track.name, where: t('clearInSong', lang, { n: bars }) })); }}>
                {t('clearWholeSong', lang, { n: unit(clearCountSong) })}
              </button>
            )}
            <button type="button" className="btn danger" disabled={clearCount === 0}
              onClick={() => { apply((x) => C.clearRange(x, track.id, clearScope.from, clearScope.to, by)); setModal(null); showToast(t('clearedWhere', lang, { name: track.name, where: clearScope.label })); }}>
              <Icon name="trash" size={18} /> {t('clearDo', lang, { name: track.name })}
            </button>
          </div>
        </Modal>
      )}

      {modal === 'kit' && pendingKit && (
        <Modal title={t('switchKitTitle', lang, { kit: kitName(pendingKit, lang) })} closeLabel={t('close', lang)} onClose={() => { setModal(null); setPendingKit(null); }}>
          <p className="muted" style={{ margin: 0 }}>{t('switchKitQ', lang)}</p>
          <button type="button" className="choice" onClick={() => keepNotesIn(pendingKit)}>
            <strong>{t('keepNotes', lang)}</strong>
            <span className="small muted">{t('keepNotesHint', lang, { kit: kitName(pendingKit, lang) })}</span>
          </button>
          <button type="button" className="choice" onClick={() => startBlankIn(pendingKit)}>
            <strong>{t('startBlank', lang)}</strong>
            <span className="small muted">{t('startBlankHint', lang, { kit: kitName(pendingKit, lang) })}</span>
          </button>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn ghost" onClick={() => { setModal(null); setPendingKit(null); }}>{t('cancel', lang)}</button>
          </div>
        </Modal>
      )}

      {modal === 'builder' && (
        <Modal title={t('buildKit', lang)} closeLabel={t('close', lang)} onClose={closeBuilder}>
          <p className="muted small" style={{ margin: 0 }}>{t('buildKitHint', lang)}</p>
          {KITS.map((k) => (
            <section key={k.key} className="stack" style={{ gap: 4 }} aria-label={k.title[lang]}>
              <h3 style={{ fontSize: 15 }}>{k.title[lang]}</h3>
              {kitSlots(k.key).map((slot) => {
                const item = findItem({ key: slot.instrument, version: '1.0.0' });
                const name = item?.title[lang] ?? slot.instrument;
                const on = isStarred(slot.instrument, slot.role);
                return (
                  <div key={`${slot.role}-${slot.instrument}`} className="row kit-row">
                    <button type="button" className="mini" onClick={() => engine.previewInstrument(slot.instrument)} aria-label={t('listenTo', lang, { name })} title={t('listenTo', lang, { name })}>
                      <Icon name="play" size={14} />
                    </button>
                    <span className="grow stack" style={{ gap: 0, minWidth: 0 }}>
                      <span>{name}</span>
                      <span className="small muted">{ROLE_NAMES[lang][slot.role]}</span>
                    </span>
                    <button type="button" className={`mini star${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggleStar(slot.instrument, slot.role)}
                      aria-label={t(on ? 'unstar' : 'star', lang, { name })} title={t(on ? 'unstar' : 'star', lang, { name })}>
                      <Icon name={on ? 'starFill' : 'star'} size={16} />
                    </button>
                  </div>
                );
              })}
            </section>
          ))}
          <div className="row builder-foot">
            <span className="grow small muted">{t('starredCount', lang, { n: starred.length })}</span>
            <button type="button" className="btn primary" disabled={!starred.length}
              onClick={() => { engine.disposePreviews(); setPendingKit(CUSTOM_KIT); setModal('kit'); }}>
              {t('useCustomKit', lang)}
            </button>
          </div>
        </Modal>
      )}

      {modal === 'beat' && (
        <BeatAssistant lang={lang} owner={profile.id} onClose={() => setModal(null)}
          onCreate={async (s) => {
            await store.saveSong(s);
            await switchTo(s);
            onRoom('musician');
            showToast(t('beatCreated', lang, { style: s.title.replace(/^Beat |\s*beat$/i, '') }));
          }} />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
