import { memo, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { title as catalogTitle } from '../packs/core';
import { chordMidi, chordSymbol, diatonicTriads, noteNameDisplay, parseSpelling, spellingPc, spellInKey, tierOf } from '../theory';
import type { Chord, Key, Naming, Tier } from '../theory';
import type { ChordsContent, Lang, NotesContent, PatternContent, Section, Song, Track } from '../domain/types';
import { BAR_TICKS, STEP_TICKS } from '../domain/types';
import { sectionAtBar, sectionColor } from '../domain/arrange';
import { namingFor, t, tierWord } from './i18n';
import { cellWidth, DRUM_LABEL, GAP, NOTE_LABEL } from './zoom';
import { RULER_H, Ruler, tailRoom, useScrollControl, useStepWindow } from './timegrid';
import type { Jump, MarkSel, View } from './timegrid';
import type { Zoom } from './zoom';

const ROW_H = 30;

/** A stored spelling ("Db4") as shown on screen, falling back to the stored text. */
function spellTitle(midi: number, spell: string | undefined, naming: Naming): string {
  const m = /^([A-G](?:bb|b|##|#)?)/.exec(spell ?? '');
  try { return m ? noteNameDisplay(midi, parseSpelling(m[1]), naming) : spell ?? ''; } catch { return spell ?? ''; }
}

export const songKey = (song: Song): Key => ({ tonic: song.key_tonic, mode: song.key_mode });

/** True for the tonic in any octave: home, the note the key is named after. */
export const isHome = (midi: number, key: Key): boolean => {
  try { return ((midi % 12) + 12) % 12 === spellingPc(parseSpelling(key.tonic)); } catch { return false; }
};

/** The chord playing in a bar, from the Chords track. */
export function chordAtBar(song: Song, bar: number): Chord | null {
  const chordsTrack = song.tracks.find((tr) => tr.clips[0]?.kind === 'chords');
  const ev = (chordsTrack?.clips[0].content as ChordsContent | undefined)?.chords.find((c) => c.tick === bar * BAR_TICKS);
  return ev ? diatonicTriads(songKey(song))[ev.degree] ?? null : null;
}

const Playhead = ({ local, offset, pitch, cell, top, height }: { local: number; offset: number; pitch: number; cell: number; top: number; height: number }) =>
  local < 0 ? null : (
    <div aria-hidden="true" style={{
      position: 'absolute', top, height, left: offset + local * pitch, width: cell,
      background: 'var(--playhead)', borderRadius: 6, pointerEvents: 'none', zIndex: 3,
      boxShadow: 'inset 0 0 0 2px var(--main)',
    }} />
  );

/** What every step grid needs to know about the song's form and the editor around it. */
export interface GridFrame {
  view: View;
  sections: Section[];
  marking: boolean;
  sel: MarkSel;
  cursorBar: number | null;
  jump?: Jump;
  onBarTap: (bar: number) => void;
  onFirstBar?: (bar: number, bars: number) => void;
}

/* ---------------------------------------------------------------- drums */

const DRUM_H = 38;

const DrumCells = memo(function DrumCells({ pattern, view, from, to, cell, lang, onToggle }: {
  pattern: PatternContent;
  view: View;
  from: number;
  to: number;
  cell: number;
  lang: Lang;
  onToggle: (row: number, step: number) => void;
}) {
  const n = Math.max(0, to - from);
  return (
    <div className="grid" style={{ position: 'absolute', left: DRUM_LABEL + from * (cell + GAP), top: RULER_H + GAP, gridTemplateColumns: `repeat(${n}, ${cell}px)`, gridAutoRows: `${DRUM_H}px`, padding: 0 }}>
      {pattern.rows.map((row, r) => {
        const on = new Set(row.hits.map((h) => h.step));
        return Array.from({ length: n }, (_, i) => {
          const s = view.start + from + i;
          const hit = on.has(s);
          return (
            <button
              key={`${r}-${s}`}
              type="button"
              className={`cell${hit ? ' on' : ''}${Math.floor(s / 4) % 2 === 0 ? ' beat' : ''}${s % 16 === 0 && s > 0 ? ' barline' : ''}`}
              aria-label={t('stepN', lang, { row: catalogTitle(row.sound, lang), n: s + 1 }) + (hit ? t('stepOn', lang) : '')}
              aria-pressed={hit}
              onClick={() => onToggle(r, s)}
            />
          );
        });
      })}
    </div>
  );
});

export function DrumGrid({ track, step, zoom, width, lang, frame, onToggle, onPreview }: {
  track: Track;
  step: number;
  zoom: Zoom;
  width: number;
  lang: Lang;
  frame: GridFrame;
  onToggle: (row: number, step: number) => void;
  onPreview: (soundKey: string) => void;
}) {
  const pattern = track.clips[0].content as PatternContent;
  const { view } = frame;
  const cell = cellWidth(zoom, view.length, width, DRUM_LABEL);
  const pitch = cell + GAP;
  const scroller = useRef<HTMLDivElement>(null);
  const { win } = useStepWindow(scroller, view, pitch, DRUM_LABEL, frame.onFirstBar);
  useScrollControl(scroller, view, pitch, DRUM_LABEL, step, frame.jump);
  const rowsH = pattern.rows.length * (DRUM_H + GAP);
  return (
    <div className="scroll-x" ref={scroller}>
      <div style={{ position: 'relative', width: DRUM_LABEL + view.length * pitch + tailRoom(width, DRUM_LABEL, pitch, view.length), height: RULER_H + GAP + rowsH }}
        onMouseDown={(e) => { if ((e.target as HTMLElement).closest('.cell, .rbar')) e.preventDefault(); }}>
        <div className="tg-labels" style={{ width: DRUM_LABEL - GAP }}>
          <span className="rlabel">{t('bar', lang)}</span>
          {pattern.rows.map((row) => (
            <button key={row.sound.key} type="button" className="rowlabel" onPointerDown={() => onPreview(row.sound.key)}>
              {catalogTitle(row.sound, lang)}
            </button>
          ))}
        </div>
        <Ruler view={view} win={win} pitch={pitch} label={DRUM_LABEL} sections={frame.sections} lang={lang}
          marking={frame.marking} sel={frame.sel} cursorBar={frame.cursorBar} onBarTap={frame.onBarTap} />
        <DrumCells pattern={pattern} view={view} from={win.from} to={win.to} cell={cell} lang={lang} onToggle={onToggle} />
        <Playhead local={step >= view.start && step < view.start + view.length ? step - view.start : -1} offset={DRUM_LABEL} pitch={pitch} cell={cell} top={RULER_H + GAP} height={rowsH - GAP} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- notes */

const NoteCells = memo(function NoteCells({ pitches, view, from, to, cell, keyName, focusChord, lang, onToggle }: {
  pitches: number[];
  view: View;
  from: number;
  to: number;
  cell: number;
  lang: Lang;
  keyName: Key;
  focusChord: Chord | null;
  onToggle: (midi: number, step: number) => void;
}) {
  const n = Math.max(0, to - from);
  return (
    <div className="grid" style={{ position: 'absolute', left: NOTE_LABEL + from * (cell + GAP), top: RULER_H + GAP, gridTemplateColumns: `repeat(${n}, ${cell}px)`, gridAutoRows: `${ROW_H}px`, padding: 0 }}>
      {pitches.map((m) => {
        const tier = tierOf(m, keyName, focusChord);
        const name = noteNameDisplay(m, spellInKey(m, keyName), namingFor(lang));
        return Array.from({ length: n }, (_, i) => {
          const s = view.start + from + i;
          return (
            <button
              key={`${m}-${s}`}
              type="button"
              className={`ncell${Math.floor(s / 4) % 2 === 0 ? ' beat' : ''}${s % 16 === 0 && s > 0 ? ' barline' : ''}${isHome(m, keyName) ? ' homerow' : tier === 'chord' ? ' chordrow' : tier === 'scale' ? ' inscale' : ''}`}
              aria-label={t('stepN', lang, { row: name, n: s + 1 })}
              data-m={m}
              data-s={s}
              // Taps and drags come through the pointer handlers of the grid; this click is the keyboard path.
              onClick={(e) => { if (e.detail === 0) onToggle(m, s); }}
            />
          );
        });
      })}
    </div>
  );
});

/** How long a finger rests on a square before sliding draws a long note instead of scrolling. */
const HOLD_MS = 280;

interface NoteDrag {
  id: number;
  touch: boolean;
  midi: number;
  cell: number;
  anchor: number;
  cur: number;
  painting: boolean;
  x0: number;
  y0: number;
  timer: number | null;
}

export function NoteGrid({ song, track, low, step, zoom, width, focusBar, lang, frame, onToggle, onSpan, onPreview, onShift }: {
  lang: Lang;
  song: Song;
  track: Track;
  low: number;
  step: number;
  zoom: Zoom;
  width: number;
  focusBar: number;
  frame: GridFrame;
  onToggle: (midi: number, step: number) => void;
  onSpan: (midi: number, fromStep: number, lengthSteps: number) => void;
  onPreview: (midi: number) => void;
  onShift: (delta: number) => void;
}) {
  const key = songKey(song);
  const { view } = frame;
  const pitches = Array.from({ length: 24 }, (_, i) => low + 23 - i);
  const notes = (track.clips[0].content as NotesContent).notes;
  const above = notes.filter((n) => n.midi > low + 23).length;
  const below = notes.filter((n) => n.midi < low).length;
  const focusChord = chordAtBar(song, focusBar);
  const cell = cellWidth(zoom, view.length, width, NOTE_LABEL);
  const pitch = cell + GAP;
  const scroller = useRef<HTMLDivElement>(null);
  const { win } = useStepWindow(scroller, view, pitch, NOTE_LABEL, frame.onFirstBar);
  useScrollControl(scroller, view, pitch, NOTE_LABEL, step, frame.jump);
  const winStart = (view.start + win.from) * STEP_TICKS;
  const winEnd = (view.start + win.to) * STEP_TICKS;
  const visible = notes.filter((n) => n.midi >= low && n.midi <= low + 23 && n.tick < winEnd && n.tick + n.dur > winStart);
  const top = RULER_H + GAP;

  /* Tap a square: one note of the chosen length. Hold and drag across squares: one long note.
     With a mouse the drag starts right away; with a finger it starts after a short hold, so a quick swipe still scrolls.
     Starting on a note that is already there stretches or shortens it. */
  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<NoteDrag | null>(null);
  const [ghost, setGhost] = useState<{ midi: number; from: number; to: number } | null>(null);
  const stepAt = (clientX: number) => {
    const r = area.current?.getBoundingClientRect();
    if (!r) return view.start;
    return view.start + Math.min(view.length - 1, Math.max(0, Math.floor((clientX - r.left - NOTE_LABEL) / pitch)));
  };
  const span = (d: NoteDrag) => ({ midi: d.midi, from: Math.min(d.anchor, d.cur), to: Math.max(d.anchor, d.cur) });
  const endDrag = () => {
    const d = drag.current;
    if (d?.timer) window.clearTimeout(d.timer);
    drag.current = null;
    setGhost(null);
  };
  // A finger that is drawing must not scroll the grid; only a non-passive listener can stop it.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const stop = (e: TouchEvent) => { if (drag.current?.painting) e.preventDefault(); };
    el.addEventListener('touchmove', stop, { passive: false });
    return () => el.removeEventListener('touchmove', stop);
  }, []);
  useEffect(() => () => { if (drag.current?.timer) window.clearTimeout(drag.current.timer); }, []);
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('.ncell');
    if (!target || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const m = Number(target.dataset.m);
    const s = Number(target.dataset.s);
    const covering = notes.find((n) => n.midi === m && n.tick <= s * STEP_TICKS && s * STEP_TICKS < n.tick + n.dur);
    const touch = e.pointerType === 'touch';
    const d: NoteDrag = {
      id: e.pointerId, touch, midi: m, cell: s, anchor: covering ? Math.round(covering.tick / STEP_TICKS) : s, cur: s,
      painting: !touch && !frame.marking, x0: e.clientX, y0: e.clientY, timer: null,
    };
    if (touch && !frame.marking) {
      d.timer = window.setTimeout(() => {
        d.painting = true;
        d.timer = null;
        setGhost(span(d));
      }, HOLD_MS);
    } else if (!touch) {
      e.preventDefault();
      area.current?.setPointerCapture?.(e.pointerId);
    }
    drag.current = d;
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.painting) {
      // A finger that moves before the hold is a swipe: let the grid scroll.
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 8) endDrag();
      return;
    }
    const cur = stepAt(e.clientX);
    if (cur === d.cur) return;
    d.cur = cur;
    setGhost(span(d));
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    endDrag();
    if (d.painting && d.cur !== d.cell) {
      const { midi, from, to } = span(d);
      onSpan(midi, from, to - from + 1);
    } else {
      onToggle(d.midi, d.cell);
    }
  };
  const noteBox = (midi: number, fromStep: number, steps: number): CSSProperties => ({
    position: 'absolute',
    top: top + (low + 23 - midi) * (ROW_H + GAP) + 3,
    height: ROW_H - 6,
    left: NOTE_LABEL + (fromStep - view.start) * pitch + 1,
    width: Math.max(4, steps * pitch - GAP - 2),
  });
  const rowsH = 24 * (ROW_H + GAP);

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row small muted">
        <button type="button" className="btn ghost" onClick={() => onShift(12)} aria-label={t('octaveUp', lang)}>▲ {t('octave', lang)}{above ? ` (${t('nAbove', lang, { n: above })})` : ''}</button>
        <button type="button" className="btn ghost" onClick={() => onShift(-12)} aria-label={t('octaveDown', lang)}>▼ {t('octave', lang)}{below ? ` (${t('nBelow', lang, { n: below })})` : ''}</button>
        <span className="hide-sm" style={{ marginLeft: 'auto' }}>{t('dragHint', lang)}</span>
      </div>
      <div className="scroll-x" ref={scroller} style={{ maxHeight: 560, overflowY: 'auto' }}>
        <div ref={area} className="note-area" style={{ position: 'relative', width: NOTE_LABEL + view.length * pitch + tailRoom(width, NOTE_LABEL, pitch, view.length), height: top + rowsH }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={endDrag}
          onContextMenu={(e) => { if (drag.current) e.preventDefault(); }}>
          <div className="tg-labels" style={{ width: NOTE_LABEL - GAP }}>
            <span className="rlabel">{t('bar', lang)}</span>
            {pitches.map((m) => {
              const tier = tierOf(m, key, focusChord);
              const name = noteNameDisplay(m, spellInKey(m, key), namingFor(lang));
              return (
                <button key={m} type="button" className="plabel" onPointerDown={() => onPreview(m)} aria-label={`${name}, ${tierWord(tier, lang)}`}>
                  <span className={`dot ${tier}${isHome(m, key) ? ' tonic' : ''}`} aria-hidden="true" />{name}
                </button>
              );
            })}
          </div>
          <Ruler view={view} win={win} pitch={pitch} label={NOTE_LABEL} sections={frame.sections} lang={lang}
            marking={frame.marking} sel={frame.sel} cursorBar={frame.cursorBar} onBarTap={frame.onBarTap} />
          <NoteCells pitches={pitches} view={view} from={win.from} to={win.to} cell={cell} keyName={key} lang={lang} focusChord={focusChord} onToggle={onToggle} />
          {visible.map((n) => {
            const bar = Math.floor(n.tick / BAR_TICKS);
            const tier = tierOf(n.midi, key, chordAtBar(song, bar));
            return <div key={n.id} className={`note ${tier}${isHome(n.midi, key) ? ' tonic' : ''}`} style={noteBox(n.midi, n.tick / STEP_TICKS, n.dur / STEP_TICKS)} title={spellTitle(n.midi, n.spell, namingFor(lang))} />;
          })}
          {ghost && <div className="note ghost" style={noteBox(ghost.midi, ghost.from, ghost.to - ghost.from + 1)} aria-hidden="true" />}
          <Playhead local={step >= view.start && step < view.start + view.length ? step - view.start : -1} offset={NOTE_LABEL} pitch={pitch} cell={cell} top={top} height={rowsH - GAP} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- chords */

/**
 * Chords sideways, like the grid: one square per bar with its chord, under the same bar ruler and sections, so a
 * 96-bar song scrolls left and right instead of growing down. One picker below writes the chord of the chosen bar
 * and moves on to the next bar, so a progression goes in with a tap per bar.
 */
export function ChordLane({ song, track, step, lang, width, frame, onSet, onPreview }: {
  song: Song;
  track: Track;
  step: number;
  lang: Lang;
  width: number;
  frame: GridFrame;
  onSet: (bar: number, degree: number | null) => void;
  onPreview: (midis: number[]) => void;
}) {
  const { view } = frame;
  const naming = namingFor(lang);
  const triads = diatonicTriads(songKey(song));
  const chords = (track.clips[0].content as ChordsContent).chords;
  const firstBar = Math.floor(view.start / 16);
  const viewBars = Math.max(1, Math.round(view.length / 16));
  const lastBar = firstBar + viewBars - 1;
  // A bar is as wide as fits 8 on screen, between a tap-friendly minimum and a comfortable maximum.
  const barW = Math.max(84, Math.min(180, Math.floor((width - DRUM_LABEL) / Math.min(viewBars, 8))));
  const pitch = barW / 16;
  const scroller = useRef<HTMLDivElement>(null);
  const { win } = useStepWindow(scroller, view, pitch, DRUM_LABEL, frame.onFirstBar);
  useScrollControl(scroller, view, pitch, DRUM_LABEL, step, frame.jump);
  const [picked, setPicked] = useState(firstBar);
  const sel = Math.min(lastBar, Math.max(firstBar, picked));
  const playingBar = step >= 0 ? Math.floor(step / 16) : -1;
  const chordAt = (bar: number) => chords.find((c) => c.tick === bar * BAR_TICKS);
  const current = chordAt(sel);
  const fromBar = Math.floor((view.start + win.from) / 16);
  const toBar = Math.min(lastBar + 1, Math.ceil((view.start + win.to) / 16));
  const top = RULER_H + GAP;
  const choose = (degree: number) => {
    onSet(sel, degree);
    onPreview(chordMidi(triads[degree], 52));
    if (sel < lastBar) setPicked(sel + 1);
  };
  const tapBar = (bar: number) => {
    if (frame.marking) { frame.onBarTap(bar); return; }
    setPicked(bar);
    const c = chordAt(bar);
    if (c && triads[c.degree]) onPreview(chordMidi(triads[c.degree], 52));
  };
  const cells = [];
  for (let bar = fromBar; bar < toBar; bar++) {
    const c = chordAt(bar);
    const triad = c ? triads[c.degree] : null;
    cells.push(
      <button key={bar} type="button" className={`chordcell${bar === sel ? ' sel' : ''}${bar === playingBar ? ' playing' : ''}${triad ? '' : ' empty'}`}
        style={{ left: DRUM_LABEL + (bar * 16 - view.start) * pitch, top, width: barW - GAP }}
        onClick={() => tapBar(bar)} onMouseDown={(e) => e.preventDefault()}
        aria-pressed={bar === sel} aria-label={`${t('bar', lang)} ${bar + 1}: ${triad ? chordSymbol(triad, naming) : t('noChord', lang)}`}>
        {triad ? <><strong>{chordSymbol(triad, naming)}</strong><small>{triad.roman}</small></> : <small>·</small>}
      </button>,
    );
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="scroll-x" ref={scroller}>
        <div style={{ position: 'relative', width: DRUM_LABEL + view.length * pitch + tailRoom(width, DRUM_LABEL, pitch, view.length), height: top + 64 }}>
          <div className="tg-labels" style={{ width: DRUM_LABEL - GAP }}>
            <span className="rlabel">{t('bar', lang)}</span>
            <span className="rowlabel" style={{ height: 64, display: 'flex', alignItems: 'center' }}>{t('chordsRow', lang)}</span>
          </div>
          <Ruler view={view} win={win} pitch={pitch} label={DRUM_LABEL} sections={frame.sections} lang={lang}
            marking={frame.marking} sel={frame.sel} cursorBar={frame.cursorBar} onBarTap={frame.onBarTap} />
          {cells}
        </div>
      </div>
      <section className="card stack chord-picker" style={{ padding: 12, gap: 8 }} aria-label={`${t('bar', lang)} ${sel + 1}`}>
        <div className="row wrap" style={{ gap: 8 }}>
          <strong className="grow">{t('bar', lang)} {sel + 1}{(() => { const sec = sectionAtBar(song, sel); return sec ? <span className="sec-chip" style={{ ['--sec' as string]: sectionColor(sec) }}>{sec.name}</span> : null; })()}</strong>
          <button type="button" className="btn ghost small-btn" onClick={() => setPicked(Math.max(firstBar, sel - 1))} disabled={sel <= firstBar} aria-label={t('prevBar', lang)}>←</button>
          <button type="button" className="btn ghost small-btn" onClick={() => setPicked(Math.min(lastBar, sel + 1))} disabled={sel >= lastBar} aria-label={t('nextBar', lang)}>→</button>
          <button type="button" className="btn ghost small-btn" onClick={() => onSet(sel, null)} disabled={!current}>{t('clear', lang)}</button>
        </div>
        <div className="chordbar">
          {triads.map((c) => (
            <button key={c.degree} type="button" className="chordbtn" aria-pressed={current?.degree === c.degree} onClick={() => choose(c.degree)}>
              <span>{chordSymbol(c, naming)}</span>
              <small>{c.roman}</small>
            </button>
          ))}
        </div>
        <span className="small muted">{t('chordPickHint', lang)}</span>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- pads and keyboard */

export function Pads({ track, lang, onHit }: { track: Track; lang: Lang; onHit: (row: number, soundKey: string) => void }) {
  const rows = (track.clips[0].content as PatternContent).rows;
  return (
    <div className="pads">
      {rows.map((r, i) => (
        <button
          key={r.sound.key}
          type="button"
          className="pad"
          onPointerDown={(e) => { e.preventDefault(); onHit(i, r.sound.key); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onHit(i, r.sound.key); }}
        >
          {catalogTitle(r.sound, lang)}
        </button>
      ))}
    </div>
  );
}

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];

export function Keyboard({ song, low, focusBar, lang, onPlay }: { song: Song; low: number; focusBar: number; lang: Lang; onPlay: (midi: number) => void }) {
  const key = songKey(song);
  const naming = namingFor(lang);
  const chord = chordAtBar(song, focusBar);
  const start = low - (((low % 12) + 12) % 12); // start at a C
  const midis = Array.from({ length: 24 }, (_, i) => start + i);
  const whites = midis.filter((m) => WHITE_PCS.includes(m % 12));
  const markColor = (tier: Tier, m: number) => (isHome(m, key) ? 'var(--note-home)' : tier === 'outside' ? 'var(--note-bitter)' : 'var(--note-sweet)');
  return (
    <div className="keyboard" aria-label={t('keyboardColored', lang)}>
      {whites.map((m) => {
        const tier = tierOf(m, key, chord);
        const name = noteNameDisplay(m, spellInKey(m, key), naming);
        return (
          <button key={m} type="button" className={`wkey${tier === 'outside' ? ' out' : ''}`} aria-label={`${name}, ${tierWord(tier, lang)}`}
            onPointerDown={(e) => { e.preventDefault(); onPlay(m); }}>
            <span className="kmark" style={{ background: markColor(tier, m) }} />
            <span className="kname">{name}</span>
          </button>
        );
      })}
      {midis.filter((m) => !WHITE_PCS.includes(m % 12)).map((m) => {
        const whitesBefore = whites.filter((w) => w < m).length;
        const left = `calc(${(whitesBefore / whites.length) * 100}% - 22px)`;
        const tier = tierOf(m, key, chord);
        const name = noteNameDisplay(m, spellInKey(m, key), naming).replace(/\d+$/, '');
        return (
          <button key={m} type="button" className="bkey" style={{ left, width: 44 }} aria-label={`${name}, ${tierWord(tier, lang)}`}
            onPointerDown={(e) => { e.preventDefault(); onPlay(m); }}>
            <span className="kname" style={{ fontSize: 10 }}>{name}</span>
            <span className="kmark" style={{ background: markColor(tier, m) }} />
          </button>
        );
      })}
    </div>
  );
}

/** What the note colors mean: home, sweet, bitter, and the ring of the bar's chord. */
export function TierLegend({ lang, tonic }: { lang: Lang; tonic?: string }) {
  return (
    <div className="row wrap small" style={{ gap: 14 }}>
      <span className="row" style={{ gap: 6 }}><span className="dot tonic" />{t('homeNote', lang, { note: tonic ?? '' })}</span>
      <span className="row" style={{ gap: 6 }}><span className="dot scale" />{t('sweetNote', lang)}</span>
      <span className="row" style={{ gap: 6 }}><span className="dot outside" />{t('bitterNote', lang)}</span>
      <span className="row" style={{ gap: 6 }}><span className="dot ring" />{t('chordTone', lang)}</span>
    </div>
  );
}
