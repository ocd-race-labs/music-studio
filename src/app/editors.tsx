import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { title as catalogTitle } from '../packs/core';
import { chordMidi, diatonicTriads, noteNameDisplay, spellInKey, tierOf } from '../theory';
import type { Chord, Key, Tier } from '../theory';
import type { ChordsContent, Lang, NotesContent, PatternContent, Song, Track } from '../domain/types';
import { BAR_TICKS, STEP_TICKS } from '../domain/types';
import { loopBars } from '../domain/factory';
import { t } from './i18n';
import { cellWidth, DRUM_LABEL, GAP, NOTE_LABEL, visibleSteps } from './zoom';
import type { Zoom } from './zoom';

const ROW_H = 30;

/** Room after the last step so the last page can line up with the left edge, like the others. */
const pageTail = (width: number, label: number, visible: number, total: number, cell: number) =>
  visible < total ? Math.max(0, width - label - visible * (cell + GAP)) : 0;

/**
 * When zoomed in, turn the page as the playhead moves on, like a score.
 * A new zoom keeps the same part of the loop in view, snapped to a page edge.
 */
function useFollow(el: RefObject<HTMLDivElement | null>, step: number, visible: number, total: number, pitch: number) {
  const page = step >= 0 && visible < total ? Math.floor(step / visible) : -1;
  const firstStep = useRef(0);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const onScroll = () => { firstStep.current = Math.round(node.scrollLeft / pitch); };
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, [el, pitch]);
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const startPage = Math.floor(Math.min(firstStep.current, total - 1) / visible);
    node.scrollLeft = startPage * visible * pitch;
  }, [el, visible, pitch, total]);
  useEffect(() => {
    if (page >= 0 && el.current) el.current.scrollTo({ left: page * visible * pitch });
  }, [el, page, visible, pitch]);
}

export const songKey = (song: Song): Key => ({ tonic: song.key_tonic, mode: song.key_mode });

/** The chord playing in a bar, from the Chords track. */
export function chordAtBar(song: Song, bar: number): Chord | null {
  const chordsTrack = song.tracks.find((tr) => tr.clips[0]?.kind === 'chords');
  const ev = (chordsTrack?.clips[0].content as ChordsContent | undefined)?.chords.find((c) => c.tick === bar * BAR_TICKS);
  return ev ? diatonicTriads(songKey(song))[ev.degree] ?? null : null;
}

const Playhead = ({ step, offset, cell, height }: { step: number; offset: number; cell: number; height?: number }) =>
  step < 0 ? null : (
    <div aria-hidden="true" style={{
      position: 'absolute', top: 0, height: height ?? '100%', left: offset + step * (cell + GAP), width: cell,
      background: 'var(--playhead)', borderRadius: 6, pointerEvents: 'none', zIndex: 3,
      boxShadow: 'inset 0 0 0 2px var(--main)',
    }} />
  );

/* ---------------------------------------------------------------- drums */

const DrumCells = memo(function DrumCells({ pattern, cell, lang, onToggle, onPreview }: {
  pattern: PatternContent;
  cell: number;
  lang: Lang;
  onToggle: (row: number, step: number) => void;
  onPreview: (soundKey: string) => void;
}) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `${DRUM_LABEL - GAP}px repeat(${pattern.steps}, ${cell}px)`, padding: 0 }}>
      {pattern.rows.map((row, r) => (
        <div key={row.sound.key} style={{ display: 'contents' }}>
          <button type="button" className="rowlabel" onPointerDown={() => onPreview(row.sound.key)}>
            {catalogTitle(row.sound, lang)}
          </button>
          {Array.from({ length: pattern.steps }, (_, s) => {
            const on = row.hits.some((h) => h.step === s);
            return (
              <button
                key={s}
                type="button"
                className={`cell${on ? ' on' : ''}${Math.floor(s / 4) % 2 === 0 ? ' beat' : ''}${s % 16 === 0 && s > 0 ? ' barline' : ''}`}
                aria-label={`${catalogTitle(row.sound, lang)}, step ${s + 1}${on ? ', on' : ''}`}
                aria-pressed={on}
                onClick={() => onToggle(r, s)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
});

export function DrumGrid({ track, step, zoom, width, lang, onToggle, onPreview }: {
  track: Track;
  step: number;
  zoom: Zoom;
  width: number;
  lang: Lang;
  onToggle: (row: number, step: number) => void;
  onPreview: (soundKey: string) => void;
}) {
  const pattern = track.clips[0].content as PatternContent;
  const cell = cellWidth(zoom, pattern.steps, width, DRUM_LABEL);
  const visible = visibleSteps(zoom, pattern.steps);
  const scroller = useRef<HTMLDivElement>(null);
  useFollow(scroller, step, visible, pattern.steps, cell + GAP);
  return (
    <div className="scroll-x" ref={scroller}>
      <div style={{ position: 'relative', width: DRUM_LABEL + pattern.steps * (cell + GAP) + pageTail(width, DRUM_LABEL, visible, pattern.steps, cell) }}>
        <DrumCells pattern={pattern} cell={cell} lang={lang} onToggle={onToggle} onPreview={onPreview} />
        <Playhead step={step} offset={DRUM_LABEL} cell={cell} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- notes */

const tierClass = (tier: Tier) => tier;

const NoteCells = memo(function NoteCells({ pitches, steps, cell, keyName, focusChord, onToggle, onPreview }: {
  pitches: number[];
  steps: number;
  cell: number;
  keyName: Key;
  focusChord: Chord | null;
  onToggle: (midi: number, step: number) => void;
  onPreview: (midi: number) => void;
}) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `${NOTE_LABEL - GAP}px repeat(${steps}, ${cell}px)`, padding: 0 }}>
      {pitches.map((m) => {
        const tier = tierOf(m, keyName, focusChord);
        const name = noteNameDisplay(m, spellInKey(m, keyName));
        return (
          <div key={m} style={{ display: 'contents' }}>
            <button type="button" className="plabel" onPointerDown={() => onPreview(m)} aria-label={`${name}, ${tier}`}>
              <span className={`dot ${tierClass(tier)}`} aria-hidden="true" />{name}
            </button>
            {Array.from({ length: steps }, (_, s) => (
              <button
                key={s}
                type="button"
                className={`ncell${Math.floor(s / 4) % 2 === 0 ? ' beat' : ''}${s % 16 === 0 && s > 0 ? ' barline' : ''}${tier === 'chord' ? ' chordrow' : tier === 'scale' ? ' inscale' : ''}`}
                aria-label={`${name}, step ${s + 1}`}
                onClick={() => onToggle(m, s)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
});

export function NoteGrid({ song, track, low, step, zoom, width, focusBar, onToggle, onPreview, onShift }: {
  song: Song;
  track: Track;
  low: number;
  step: number;
  zoom: Zoom;
  width: number;
  focusBar: number;
  onToggle: (midi: number, step: number) => void;
  onPreview: (midi: number) => void;
  onShift: (delta: number) => void;
}) {
  const key = songKey(song);
  const steps = track.clips[0].length_ticks / STEP_TICKS;
  const pitches = Array.from({ length: 24 }, (_, i) => low + 23 - i);
  const notes = (track.clips[0].content as NotesContent).notes;
  const visible = notes.filter((n) => n.midi >= low && n.midi <= low + 23);
  const above = notes.filter((n) => n.midi > low + 23).length;
  const below = notes.filter((n) => n.midi < low).length;
  const focusChord = chordAtBar(song, focusBar);
  const cell = cellWidth(zoom, steps, width, NOTE_LABEL);
  const pitch = cell + GAP;
  const visibleCount = visibleSteps(zoom, steps);
  const scroller = useRef<HTMLDivElement>(null);
  useFollow(scroller, step, visibleCount, steps, pitch);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row small muted">
        <button type="button" className="btn ghost" onClick={() => onShift(12)} aria-label="Octave up">▲ Octave{above ? ` (${above} above)` : ''}</button>
        <button type="button" className="btn ghost" onClick={() => onShift(-12)} aria-label="Octave down">▼ Octave{below ? ` (${below} below)` : ''}</button>
      </div>
      <div className="scroll-x" ref={scroller} style={{ maxHeight: 520, overflowY: 'auto' }}>
        <div style={{ position: 'relative', width: NOTE_LABEL + steps * pitch + pageTail(width, NOTE_LABEL, visibleCount, steps, cell) }}>
          <NoteCells pitches={pitches} steps={steps} cell={cell} keyName={key} focusChord={focusChord} onToggle={onToggle} onPreview={onPreview} />
          {visible.map((n) => {
            const bar = Math.floor(n.tick / BAR_TICKS);
            const tier = tierOf(n.midi, key, chordAtBar(song, bar));
            const style: CSSProperties = {
              position: 'absolute',
              top: (low + 23 - n.midi) * (ROW_H + GAP) + 3,
              height: ROW_H - 6,
              left: NOTE_LABEL + (n.tick / STEP_TICKS) * pitch + 1,
              width: Math.max(4, (n.dur / STEP_TICKS) * pitch - GAP - 2),
            };
            return <div key={n.id} className={`note ${tier}`} style={style} title={n.spell} />;
          })}
          <Playhead step={step} offset={NOTE_LABEL} cell={cell} height={24 * (ROW_H + GAP)} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- chords */

export function ChordLane({ song, track, step, lang, onSet, onPreview }: {
  song: Song;
  track: Track;
  step: number;
  lang: Lang;
  onSet: (bar: number, degree: number | null) => void;
  onPreview: (midis: number[]) => void;
}) {
  const triads = diatonicTriads(songKey(song));
  const chords = (track.clips[0].content as ChordsContent).chords;
  const bars = loopBars(song);
  const playingBar = step >= 0 ? Math.floor(step / 16) : -1;
  return (
    <div className="stack">
      {Array.from({ length: bars }, (_, bar) => {
        const current = chords.find((c) => c.tick === bar * BAR_TICKS);
        return (
          <section key={bar} className="card stack" style={{ padding: 12, gap: 8, borderColor: bar === playingBar ? 'var(--main)' : undefined }} aria-label={`${t('bar', lang)} ${bar + 1}`}>
            <div className="row">
              <strong className="grow">{t('bar', lang)} {bar + 1}</strong>
              <button type="button" className="btn ghost" onClick={() => onSet(bar, null)} disabled={!current}>{t('clear', lang)}</button>
            </div>
            <div className="chordbar">
              {triads.map((c) => (
                <button
                  key={c.degree}
                  type="button"
                  className="chordbtn"
                  aria-pressed={current?.degree === c.degree}
                  onClick={() => { onSet(bar, c.degree); onPreview(chordMidi(c, 52)); }}
                >
                  <span>{c.symbolDisplay}</span>
                  <small>{c.roman}</small>
                </button>
              ))}
            </div>
          </section>
        );
      })}
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

export function Keyboard({ song, low, focusBar, onPlay }: { song: Song; low: number; focusBar: number; onPlay: (midi: number) => void }) {
  const key = songKey(song);
  const chord = chordAtBar(song, focusBar);
  const start = low - (((low % 12) + 12) % 12); // start at a C
  const midis = Array.from({ length: 24 }, (_, i) => start + i);
  const whites = midis.filter((m) => WHITE_PCS.includes(m % 12));
  const markColor = (tier: Tier) => (tier === 'chord' ? 'var(--tier-chord)' : tier === 'scale' ? 'var(--tier-scale)' : 'transparent');
  return (
    <div className="keyboard" aria-label="Keyboard colored by key">
      {whites.map((m) => {
        const tier = tierOf(m, key, chord);
        const name = noteNameDisplay(m, spellInKey(m, key));
        return (
          <button key={m} type="button" className={`wkey${tier === 'outside' ? ' out' : ''}`} aria-label={`${name}, ${tier}`}
            onPointerDown={(e) => { e.preventDefault(); onPlay(m); }}>
            <span className="kmark" style={{ background: markColor(tier) }} />
            <span className="kname">{name}</span>
          </button>
        );
      })}
      {midis.filter((m) => !WHITE_PCS.includes(m % 12)).map((m) => {
        const whitesBefore = whites.filter((w) => w < m).length;
        const left = `calc(${(whitesBefore / whites.length) * 100}% - 22px)`;
        const tier = tierOf(m, key, chord);
        const name = noteNameDisplay(m, spellInKey(m, key)).replace(/\d+$/, '');
        return (
          <button key={m} type="button" className="bkey" style={{ left, width: 44 }} aria-label={`${name}, ${tier}`}
            onPointerDown={(e) => { e.preventDefault(); onPlay(m); }}>
            <span className="kname" style={{ fontSize: 10 }}>{name}</span>
            <span className="kmark" style={{ background: markColor(tier) }} />
          </button>
        );
      })}
    </div>
  );
}

export function TierLegend({ lang }: { lang: Lang }) {
  return (
    <div className="row wrap small" style={{ gap: 14 }}>
      <span className="row" style={{ gap: 6 }}><span className="dot chord" />{t('chordTone', lang)}</span>
      <span className="row" style={{ gap: 6 }}><span className="dot scale" />{t('inScale', lang)}</span>
      <span className="row" style={{ gap: 6 }}><span className="dot outside" />{t('outside', lang)}</span>
    </div>
  );
}
