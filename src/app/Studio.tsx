import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as C from '../domain/commands';
import { loopBars, newSong } from '../domain/factory';
import { exportSongFile, parseIdeasFile, parseSongFile, SONG_FILE_EXT, withFreshIds } from '../domain/files';
import type { Hat, Idea, NotesContent, PatternContent, Profile, Song, SongVersion, ChordsContent } from '../domain/types';
import { PPQ, STEP_TICKS } from '../domain/types';
import { engine } from '../engine/engine';
import { findItem, title as catalogTitle } from '../packs/core';
import { chordMidi, diatonicTriads, scaleById, tonicDisplay } from '../theory';
import type { SongStore } from '../store/store';
import { ChordLane, DrumGrid, Keyboard, NoteGrid, Pads, songKey } from './editors';
import { autoZoom, ZOOMS } from './zoom';
import type { Zoom } from './zoom';
import { CLAUDE_INSTRUCTIONS, IdeasTray, MixerPanel, TheoryPanel } from './panels';
import { namingFor, t, tn } from './i18n';
import type { Mode } from './prefs';
import { Avatar, downloadText, Icon, Modal, ModeSwitch, pickFile, slug, useToast, useWidth } from './ui';
import type { Lang } from '../domain/types';

/* Zoom is remembered per device: the iPhone, the iPad and the laptop each keep their own. */
const ZOOM_KEY = 'music-studio.zoom';
const readZoom = (): Zoom | null => {
  try {
    const z = localStorage.getItem(ZOOM_KEY);
    return z && (ZOOMS as string[]).includes(z) ? (z as Zoom) : null;
  } catch { return null; }
};
const isTouch = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const ZOOM_LABEL = { fit: 'zoomFit', bar: 'zoomBar', half: 'zoomHalf' } as const;

const DEFAULT_LOW: Record<string, number> = {
  'instrument.bass-808': 36,
  'instrument.keys-ep': 60,
  'instrument.lead-bright': 60,
  'instrument.strings-ensemble': 55,
  'instrument.pad-warm': 55,
};

const LENGTHS = [
  { steps: 1, label: '1/16' },
  { steps: 2, label: '1/8' },
  { steps: 4, label: '1/4' },
  { steps: 8, label: '1/2' },
  { steps: 16, label: '1' },
];

export default function Studio({ store, profile, lang, mode, onToggleMode, onHome, onSettings }: {
  store: SongStore;
  profile: Profile;
  lang: Lang;
  mode: Mode;
  onToggleMode: () => void;
  onHome: () => void;
  onSettings: () => void;
}) {
  const naming = namingFor(lang);
  const langRef = useRef(lang);
  useLayoutEffect(() => { langRef.current = lang; }, [lang]);
  const by = profile.id;
  const [song, setSong] = useState<Song | null>(null);
  const past = useRef<Song[]>([]);
  const future = useRef<Song[]>([]);
  const songRef = useRef<Song | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [selected, setSelected] = useState<string | null>(null);
  const [hat, setHat] = useState<Hat>(profile.default_hat);
  const [step, setStep] = useState(-1);
  const stepRef = useRef(-1);
  const [playing, setPlaying] = useState(false);
  const [rec, setRec] = useState(false);
  const [noteLen, setNoteLen] = useState(2);
  const [lows, setLows] = useState<Record<string, number>>({});
  const [focusBar, setFocusBar] = useState(0);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [modal, setModal] = useState<null | 'songs' | 'versions'>(null);
  const [songList, setSongList] = useState<Song[]>([]);
  const [versions, setVersions] = useState<SongVersion[]>([]);
  const [audioReady, setAudioReady] = useState(engine.started);
  const [toast, showToast] = useToast();
  const [zoomPref, setZoomPref] = useState<Zoom | null>(readZoom);
  const [editorRef, editorWidth] = useWidth<HTMLElement>();
  const touch = useMemo(() => isTouch(), []);

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
      if (!alive) return;
      songRef.current = s;
      setSong(s);
      setSelected(s.tracks[0]?.id ?? null);
      await store.setMeta(`last_song:${profile.id}`, s.id);
      setIdeas(await store.listIdeas(s.id));
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
      const ok = await engine.play();
      setAudioReady(true);
      setPlaying(true);
      if (!ok) showToast(t('soundBlocked', lang));
    }
  }, [lang, showToast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, undo, redo]);

  /* ---------- stable handlers for the memoized grids */
  const selRef = useRef(selected);
  useLayoutEffect(() => { selRef.current = selected; }, [selected]);
  const onToggleHit = useCallback((row: number, s: number) => apply((x) => C.toggleHit(x, selRef.current!, row, s, by)), [apply, by]);
  const onPreviewDrum = useCallback((key: string) => { engine.previewDrum(selRef.current!, key); }, []);
  const lenRef = useRef(noteLen);
  useLayoutEffect(() => { lenRef.current = noteLen; }, [noteLen]);
  const onToggleNote = useCallback((midi: number, s: number) => {
    apply((x) => C.toggleNote(x, selRef.current!, midi, s, lenRef.current, by));
    setFocusBar(Math.floor(s / 16));
  }, [apply, by]);
  const onPreviewNote = useCallback((midi: number) => { engine.previewNote(selRef.current!, midi); }, []);

  const track = song?.tracks.find((tr) => tr.id === selected) ?? song?.tracks[0];
  const clipKind = track?.clips[0]?.kind;
  const low = track ? lows[track.id] ?? DEFAULT_LOW[track.instrument?.key ?? ''] ?? 60 : 60;

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
  const openSongs = async () => {
    setSongList(await store.listSongs(profile.id));
    setModal('songs');
  };
  const switchTo = async (s: Song) => {
    engine.stop();
    setPlaying(false);
    past.current = [];
    future.current = [];
    commit(s);
    setSelected(s.tracks[0]?.id ?? null);
    setFocusBar(0);
    await store.setMeta(`last_song:${profile.id}`, s.id);
    setIdeas(await store.listIdeas(s.id));
    setModal(null);
  };
  const createSong = async () => {
    const s = newSong(profile.id, t('songN', lang, { n: songList.length + 1 }), 2, lang);
    await store.saveSong(s);
    await switchTo(s);
  };
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
    showToast(t('versionSaved', lang, { n: v.version_no }));
  };
  const openVersions = async () => {
    if (!song) return;
    setVersions(await store.listVersions(song.id));
    setModal('versions');
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
  const zoom: Zoom = zoomPref ?? autoZoom(bars * 16, editorWidth, touch);
  const pickZoom = (z: Zoom) => {
    setZoomPref(z);
    try { localStorage.setItem(ZOOM_KEY, z); } catch { /* this browser keeps nothing; the choice lasts the visit */ }
  };
  const trackTitle = useMemo(() => (track?.instrument ? catalogTitle(track.instrument, lang) : ''), [track, lang]);

  if (!song || !track) return <div className="home"><p className="muted">{t('loading', lang)}</p></div>;

  return (
    <div className={`studio${wide ? ' wide' : ''}`}>
      <header className="topbar">
        <div className="tb-group tb-left">
        <button type="button" className="btn icon" onClick={onHome} aria-label={t('home', lang)}><Icon name="home" /></button>
        <Avatar profile={profile} onClick={onSettings} label={t('settings', lang)} />
        <input className="title-input" aria-label={t('songTitle', lang)} value={song.title}
          onChange={(e) => { if (songRef.current) { songRef.current = { ...songRef.current, title: e.target.value }; setSong(songRef.current); } }}
          onBlur={(e) => apply((x) => C.setTitle(x, e.target.value, by))} />
        <button type="button" className="btn" onClick={openSongs} aria-label={t('songs', lang)}><Icon name="menu" size={18} /> <span className="hide-sm">{t('songs', lang)}</span></button>
        <button type="button" className="btn icon" onClick={undo} disabled={!hist.past} aria-label={t('undo', lang)}><Icon name="undo" /></button>
        <button type="button" className="btn icon" onClick={redo} disabled={!hist.future} aria-label={t('redo', lang)}><Icon name="redo" /></button>
        <span className="small muted hide-sm" aria-live="polite" style={{ minWidth: 70 }}>{saveState === 'saving' ? t('saving', lang) : t('saved', lang)}</span>
        </div>
        <div className="tb-group tb-right">
        <ModeSwitch mode={mode} onToggle={onToggleMode} lang={lang} />
        <div className="seg" aria-label={t('hat', lang)}>
          <button type="button" aria-pressed={hat === 'musician'} onClick={() => setHat('musician')}>{t('musician', lang)}</button>
          <button type="button" aria-pressed={hat === 'producer'} onClick={() => setHat('producer')}>{t('producer', lang)}</button>
        </div>
        <label className="row small">
          <span className="muted">BPM</span>
          <input className="field mono" type="number" min={40} max={200} value={song.tempo_bpm} style={{ width: 76 }}
            onChange={(e) => apply((x) => C.setTempo(x, Number(e.target.value) || x.tempo_bpm, by))} />
        </label>
        <label className="row small">
          <span className="muted">{t('bars', lang)}</span>
          <select className="field" value={bars} onChange={(e) => apply((x) => C.setLoopBars(x, Number(e.target.value), by))}>
            {[1, 2, 4, 8].map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <button type="button" className="btn rec" aria-pressed={rec} onClick={() => setRec((r) => !r)} title={t('recordHint', lang)} aria-label={t('record', lang)}>
          <span className="dot" style={{ background: rec ? 'var(--highlight-ink)' : 'var(--highlight)' }} /> <span className="hide-sm">{t('record', lang)}</span>
        </button>
        <OutMeter label={t('soundOutput', lang)} />
        <button type="button" className={`play${playing ? ' on' : ''}`} onClick={togglePlay} aria-label={t(playing ? 'stop' : 'play', lang)}>
          <Icon name={playing ? 'stop' : 'play'} size={22} />
        </button>
        </div>
      </header>

      <div className="body">
        <nav className="tracks" aria-label={t('tracks', lang)}>
          {song.tracks.map((tr) => (
            <div key={tr.id} className="row" style={{ gap: 4 }}>
              <button type="button" className="track-btn grow" aria-current={tr.id === track.id} onClick={() => setSelected(tr.id)}>
                <span className="swatch" style={{ background: tr.color }} />
                <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                  <strong>{tr.name}</strong>
                  <span className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tr.instrument && findItem(tr.instrument) ? catalogTitle(tr.instrument, lang) : ''}</span>
                </span>
              </button>
              <button type="button" className="mini" aria-pressed={tr.muted} onClick={() => apply((x) => C.toggleMute(x, tr.id, by))} aria-label={t('muteTrack', lang, { name: tr.name })}>M</button>
            </div>
          ))}
        </nav>

        <main className="editor" ref={editorRef}>
          <div className="row wrap">
            <h2 className="display grow" style={{ fontSize: 22 }}>{track.name} <span className="muted small" style={{ fontFamily: "'Instrument Sans', system-ui, -apple-system, sans-serif" }}>{trackTitle}</span></h2>
            {clipKind === 'notes' && (
              <div className="seg" aria-label={t('noteLength', lang)}>
                {LENGTHS.map((l) => <button key={l.steps} type="button" aria-pressed={noteLen === l.steps} onClick={() => setNoteLen(l.steps)}>{l.label}</button>)}
              </div>
            )}
            {(clipKind === 'pattern' || clipKind === 'notes') && (
              <div className="seg" aria-label={t('zoom', lang)}>
                {ZOOMS.map((z) => <button key={z} type="button" aria-pressed={zoom === z} onClick={() => pickZoom(z)}>{t(ZOOM_LABEL[z], lang)}</button>)}
              </div>
            )}
            <button type="button" className="btn icon" aria-pressed={wide} onClick={toggleWide}
              aria-label={t(wide ? 'exitFullScreen' : 'fullScreen', lang)} title={t(wide ? 'exitFullScreen' : 'fullScreen', lang)}>
              <Icon name={wide ? 'shrink' : 'expand'} />
            </button>
          </div>

          {clipKind === 'pattern' && (
            <>
              <DrumGrid track={track} step={step} zoom={zoom} width={editorWidth} lang={lang} onToggle={onToggleHit} onPreview={onPreviewDrum} />
              <Pads track={track} lang={lang} onHit={padHit} />
            </>
          )}
          {clipKind === 'notes' && (
            <>
              <NoteGrid song={song} track={track} low={low} step={step} zoom={zoom} width={editorWidth} focusBar={focusBar} lang={lang}
                onToggle={onToggleNote} onPreview={onPreviewNote}
                onShift={(d) => setLows((m) => ({ ...m, [track.id]: Math.min(96, Math.max(24, low + d)) }))} />
              <Keyboard song={song} low={low} focusBar={focusBar} lang={lang} onPlay={keyPlay} />
            </>
          )}
          {clipKind === 'chords' && (
            <ChordLane song={song} track={track} step={step} lang={lang}
              onSet={(bar, degree) => { apply((x) => C.setChord(x, track.id, bar, degree, by)); setFocusBar(bar); }}
              onPreview={(midis) => engine.previewNotes(track.id, midis.map((m) => ({ midi: m, at: 0, dur: 0.9, vel: 0.6 })))} />
          )}
        </main>

        <aside className="side">
          {hat === 'producer' ? (
            <MixerPanel song={song} track={track} lang={lang}
              onGain={(g) => apply((x) => C.setGain(x, track.id, g, by))}
              onMute={() => apply((x) => C.toggleMute(x, track.id, by))}
              onSolo={() => apply((x) => C.toggleSolo(x, track.id, by))}
              onKit={(r) => apply((x) => C.setInstrument(x, track.id, r, by))}
              onBypass={(slot, b) => apply((x) => C.setFxBypass(x, track.id, slot, b, by))}
              onParam={(slot, name, v) => apply((x) => C.setFxParam(x, track.id, slot, name, v, by))}
              onSwing={(v) => apply((x) => C.setSwing(x, v, by))}
              onResetSwing={() => apply((x) => C.resetSwing(x, by))}
              onResetFx={(slot) => apply((x) => C.resetFx(x, track.id, slot, by))} />
          ) : (
            <TheoryPanel song={song} lang={lang} focusBar={focusBar} onKey={(tonic, mode) => apply((x) => C.setKey(x, tonic, mode, by))} />
          )}
          <IdeasTray ideas={ideas} tracks={song.tracks} lang={lang} onImport={importIdeas} onListen={listenIdea}
            onKeep={keepIdea} onDismiss={(i) => decide(i, 'dismissed')} onCopyHelp={copyHelp} />
        </aside>
      </div>

      {!audioReady && (
        <div className="start-overlay">
          <button type="button" className="btn primary" style={{ minHeight: 64, fontSize: 18, padding: '0 28px' }} onClick={startAudio}>
            <Icon name="play" /> {t('tapToStart', lang)}
          </button>
        </div>
      )}

      {modal === 'songs' && (
        <Modal title={t('songs', lang)} closeLabel={t('close', lang)} onClose={() => setModal(null)}>
          <div className="row wrap">
            <button type="button" className="btn primary" onClick={createSong}><Icon name="plus" size={18} /> {t('newSong', lang)}</button>
            <button type="button" className="btn" onClick={importSong}><Icon name="upload" size={18} /> {t('importSong', lang)}</button>
            <button type="button" className="btn" onClick={exportSong}><Icon name="download" size={18} /> {t('exportSong', lang)}</button>
            <button type="button" className="btn" onClick={saveVersion}>{t('saveVersion', lang)}</button>
            <button type="button" className="btn ghost" onClick={openVersions}>{t('versions', lang)}</button>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            {songList.map((s) => (
              <button key={s.id} type="button" className="track-btn" aria-current={s.id === song.id} onClick={() => switchTo(s)}>
                <span className="stack grow" style={{ gap: 0 }}>
                  <strong>{s.title}</strong>
                  <span className="small muted">{tonicDisplay(s.key_tonic, naming)} {scaleById(s.key_mode).name[lang].toLowerCase()} · {s.tempo_bpm} BPM · {new Date(s.updated_at).toLocaleString(lang === 'es' ? 'es-CL' : 'en-US')}</span>
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {modal === 'versions' && (
        <Modal title={t('versions', lang)} closeLabel={t('close', lang)} onClose={() => setModal(null)}>
          {versions.length === 0 && <p className="muted">{t('noVersions', lang)}</p>}
          {versions.map((v) => (
            <div key={v.id} className="row card" style={{ padding: 10 }}>
              <span className="grow">{t('versionN', lang, { n: v.version_no })} <span className="small muted">· {new Date(v.created_at).toLocaleString(lang === 'es' ? 'es-CL' : 'en-US')}</span></span>
              <button type="button" className="btn" onClick={() => { apply(() => ({ ...v.snapshot, updated_at: new Date().toISOString() })); setModal(null); showToast(t('versionRestored', lang, { n: v.version_no })); }}>{t('restore', lang)}</button>
            </div>
          ))}
        </Modal>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

/** A small level bar next to Play: if it moves and nothing is heard, the device volume or silent mode is the cause. */
function OutMeter({ label }: { label: string }) {
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let id = 0;
    let peak = 0;
    const tick = () => {
      const v = engine.outputLevel();
      peak = Math.max(peak * 0.97, v);
      const el = bar.current;
      if (el) {
        el.style.transform = `scaleX(${v.toFixed(3)})`;
        el.parentElement!.dataset.peak = peak.toFixed(2);
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
  return <span className="outmeter" title={label} aria-hidden="true"><span ref={bar} /></span>;
}
