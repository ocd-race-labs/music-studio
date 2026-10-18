// Song form on screen: the song's length, its parts (intro, verse, chorus...) and a timeline of the whole song.
// Ideas taken from desktop studios (arranger tracks, an overview strip, a loop over one part) and from tablet
// apps (one part at a time or all of them), made simple enough for a young musician.

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Lang, Section, SectionKind, Song } from '../domain/types';
import { BAR_TICKS } from '../domain/types';
import { kindLabel, MAX_BARS, SECTION_KINDS, sectionBars, sectionColor, sectionStartBar } from '../domain/arrange';
import type { CopyMode } from '../domain/arrange';
import { songBars } from '../domain/factory';
import { t } from './i18n';
import { Icon } from './ui';
import type { MarkSel } from './timegrid';

/* ---------------------------------------------------------------- length */

/** How many bars the song has: minus, the number (type any value), plus. */
export function LengthStepper({ bars, lang, onBars }: { bars: number; lang: Lang; onBars: (bars: number) => void }) {
  const [text, setText] = useState(String(bars));
  useEffect(() => { setText(String(bars)); }, [bars]);
  const commit = () => {
    const n = Math.round(Number(text));
    if (Number.isFinite(n) && n >= 1) onBars(Math.min(MAX_BARS, n));
    else setText(String(bars));
  };
  return (
    <div className="stepper" role="group" aria-label={t('songLength', lang)} title={t('songLengthHint', lang, { max: MAX_BARS })}>
      <span className="muted small hide-sm">{t('bars', lang)}</span>
      <button type="button" className="btn icon" onClick={() => onBars(bars - 1)} disabled={bars <= 1} aria-label={t('barsFewer', lang)}>−</button>
      <input className="field mono" inputMode="numeric" value={text} aria-label={t('bars', lang)}
        onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      <button type="button" className="btn icon" onClick={() => onBars(bars + 1)} disabled={bars >= MAX_BARS} aria-label={t('barsMore', lang)}>+</button>
    </div>
  );
}

/* ---------------------------------------------------------------- structure: parts and their actions */

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
export const songDuration = (song: Song): string => clock((songBars(song) * 4 * 60) / song.tempo_bpm);

export function StructureBar({ song, lang, focusId, marking, sel, onFocus, onMarking, onPick, onClearSel, onRename, onKind, onCopy, onRepeat, onUnmark, onDeleteBars }: {
  song: Song;
  lang: Lang;
  focusId: string | null;
  marking: boolean;
  sel: MarkSel;
  onFocus: (id: string | null) => void;
  onMarking: (on: boolean) => void;
  onPick: (kind: SectionKind) => void;
  onClearSel: () => void;
  onRename: (id: string, name: string) => void;
  onKind: (id: string, kind: SectionKind) => void;
  onCopy: (id: string, atBar: number, mode: CopyMode) => void;
  onRepeat: (id: string, times: number, extend: boolean) => void;
  onUnmark: (id: string) => void;
  onDeleteBars: (id: string) => void;
}) {
  const bars = songBars(song);
  const focus = song.sections.find((s) => s.id === focusId) ?? null;
  return (
    <section className="structure" aria-label={t('structure', lang)}>
      <div className="row wrap" style={{ gap: 6 }}>
        <span className="lbl" style={{ marginRight: 4 }}>{t('structure', lang)}</span>
        <button type="button" className="chip" aria-pressed={!focus} onClick={() => onFocus(null)}>
          {t('wholeSong', lang)} <span className="count mono">{bars}</span>
        </button>
        {song.sections.map((s) => (
          <button key={s.id} type="button" className="chip sec" aria-pressed={focus?.id === s.id}
            style={{ ['--sec' as string]: sectionColor(s) }} onClick={() => onFocus(focus?.id === s.id ? null : s.id)}
            title={t('sectionFocusHint', lang)}>
            {s.name} <span className="count mono" aria-label={`${sectionBars(s)} ${t('barsShort', lang)}`}>{sectionBars(s)}</span>
          </button>
        ))}
        <button type="button" className="btn small-btn" aria-pressed={marking} onClick={() => onMarking(!marking)}>
          <Icon name={marking ? 'check' : 'plus'} size={16} /> {t(marking ? 'markDone' : 'markSections', lang)}
        </button>
      </div>
      {marking && <MarkPanel song={song} lang={lang} sel={sel} onPick={onPick} onClear={onClearSel} />}
      {!marking && focus && (
        <SectionActions key={focus.id} song={song} section={focus} lang={lang}
          onRename={onRename} onKind={onKind} onCopy={onCopy} onRepeat={onRepeat} onUnmark={onUnmark} onDeleteBars={onDeleteBars} />
      )}
      {!marking && !song.sections.length && <p className="small muted" style={{ margin: 0 }}>{t('noSectionsHint', lang)}</p>}
    </section>
  );
}

function MarkPanel({ song, lang, sel, onPick, onClear }: { song: Song; lang: Lang; sel: MarkSel; onPick: (k: SectionKind) => void; onClear: () => void }) {
  const lo = sel.a === null ? null : Math.min(sel.a, sel.b ?? sel.a);
  const hi = sel.a === null ? null : Math.max(sel.a, sel.b ?? sel.a);
  const ready = sel.a !== null && sel.b !== null;
  return (
    <div className="mark-panel" role="status">
      {sel.a === null && <span>{t('markFirst', lang)}</span>}
      {sel.a !== null && sel.b === null && <span>{t('markLast', lang, { bar: sel.a + 1 })}</span>}
      {ready && lo !== null && hi !== null && (
        <>
          <span><strong>{t('markRange', lang, { from: lo + 1, to: hi + 1, n: hi - lo + 1 })}</strong> {t('markWhich', lang)}</span>
          <div className="row wrap" style={{ gap: 6 }}>
            {SECTION_KINDS.map((k) => (
              <button key={k} type="button" className="chip sec" style={{ ['--sec' as string]: sectionColor({ kind: k }) }} onClick={() => onPick(k)}>
                {kindLabel(k, lang)}
              </button>
            ))}
          </div>
        </>
      )}
      {sel.a !== null && <button type="button" className="btn ghost small-btn" style={{ alignSelf: 'flex-start' }} onClick={onClear}>{t('markRestart', lang)}</button>}
      <span className="small muted">{t('markTip', lang, { bars: songBars(song) })}</span>
    </div>
  );
}

function SectionActions({ song, section, lang, onRename, onKind, onCopy, onRepeat, onUnmark, onDeleteBars }: {
  song: Song;
  section: Section;
  lang: Lang;
  onRename: (id: string, name: string) => void;
  onKind: (id: string, kind: SectionKind) => void;
  onCopy: (id: string, atBar: number, mode: CopyMode) => void;
  onRepeat: (id: string, times: number, extend: boolean) => void;
  onUnmark: (id: string) => void;
  onDeleteBars: (id: string) => void;
}) {
  const start = sectionStartBar(section);
  const n = sectionBars(section);
  const total = songBars(song);
  const [name, setName] = useState(section.name);
  useEffect(() => { setName(section.name); }, [section.name]);
  const [at, setAt] = useState(String(total + 1));
  useEffect(() => { setAt(String(total + 1)); }, [total]);
  const [mode, setMode] = useState<CopyMode>('insert');
  const [times, setTimes] = useState('1');
  const [extend, setExtend] = useState(true);
  const atBar = Math.max(1, Math.min(MAX_BARS, Math.round(Number(at) || total + 1)));
  const grows = mode === 'insert' ? Math.max(total, atBar - 1) + n : Math.max(total, atBar - 1 + n);
  return (
    <div className="sec-actions" style={{ ['--sec' as string]: sectionColor(section) }}>
      <div className="row wrap" style={{ gap: 8 }}>
        <input className="field sec-name" value={name} maxLength={40} aria-label={t('sectionName', lang)}
          onChange={(e) => setName(e.target.value)} onBlur={() => onRename(section.id, name)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        <select className="field" value={section.kind ?? 'other'} aria-label={t('sectionKind', lang)} onChange={(e) => onKind(section.id, e.target.value as SectionKind)}>
          {SECTION_KINDS.map((k) => <option key={k} value={k}>{kindLabel(k, lang)}</option>)}
        </select>
        <span className="small muted">{t('sectionSpan', lang, { from: start + 1, to: start + n, n })}</span>
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        <span className="small">{t('copyTo', lang)}</span>
        <input className="field mono num" inputMode="numeric" value={at} aria-label={t('copyBar', lang)} onChange={(e) => setAt(e.target.value.replace(/[^0-9]/g, ''))} />
        <div className="seg" aria-label={t('copyMode', lang)}>
          <button type="button" aria-pressed={mode === 'insert'} onClick={() => setMode('insert')} title={t('insertHint', lang)}>{t('insert', lang)}</button>
          <button type="button" aria-pressed={mode === 'replace'} onClick={() => setMode('replace')} title={t('replaceHint', lang)}>{t('replace', lang)}</button>
        </div>
        <button type="button" className="btn primary small-btn" disabled={grows > MAX_BARS} onClick={() => onCopy(section.id, atBar - 1, mode)}>
          <Icon name="plus" size={16} /> {t('addCopy', lang, { name: section.name })}
        </button>
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        <span className="small">{t('repeatAfter', lang)}</span>
        <input className="field mono num" inputMode="numeric" value={times} aria-label={t('repeatTimes', lang)} onChange={(e) => setTimes(e.target.value.replace(/[^0-9]/g, ''))} />
        <span className="small">{t('times', lang)}</span>
        <div className="seg" aria-label={t('repeatHow', lang)}>
          <button type="button" aria-pressed={extend} onClick={() => setExtend(true)} title={t('repeatExtendHint', lang)}>{t('repeatExtend', lang)}</button>
          <button type="button" aria-pressed={!extend} onClick={() => setExtend(false)} title={t('repeatNewHint', lang)}>{t('repeatNew', lang)}</button>
        </div>
        <button type="button" className="btn small-btn" disabled={!Number(times) || total + n * Number(times) > MAX_BARS}
          onClick={() => onRepeat(section.id, Math.min(32, Number(times)), extend)}>{t('repeat', lang)}</button>
        <span className="grow" />
        <button type="button" className="btn ghost small-btn" onClick={() => onUnmark(section.id)} title={t('unmarkHint', lang)}>{t('unmark', lang)}</button>
        <button type="button" className="btn danger small-btn" onClick={() => onDeleteBars(section.id)} title={t('deleteBarsHint', lang)}>
          <Icon name="trash" size={16} /> {t('deleteBars', lang, { n })}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- timeline of the whole song */

export function SongTimeline({ song, lang, step, firstBar, barsOnScreen, focusId, cursorBar, marking, sel, onBarTap, onScrub }: {
  song: Song;
  lang: Lang;
  step: number;
  firstBar: number;
  barsOnScreen: number;
  focusId: string | null;
  cursorBar: number;
  marking: boolean;
  sel: MarkSel;
  onBarTap: (bar: number) => void;
  onScrub: (bar: number) => void;
}) {
  const bars = songBars(song);
  const pct = (bar: number) => `${(bar / bars) * 100}%`;
  const strip = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const barAt = (clientX: number) => {
    const r = strip.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return 0;
    return Math.max(0, Math.min(bars - 1, Math.floor(((clientX - r.left) / r.width) * bars)));
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    const bar = barAt(e.clientX);
    if (marking) { onBarTap(bar); return; }
    dragging.current = true;
    strip.current?.setPointerCapture?.(e.pointerId);
    onScrub(bar);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => { if (dragging.current) onScrub(barAt(e.clientX)); };
  const up = () => { dragging.current = false; };
  const focus = song.sections.find((s) => s.id === focusId);
  const every = bars <= 16 ? 1 : bars <= 32 ? 4 : 8;
  const ticks = Array.from({ length: Math.floor((bars - 1) / every) + 1 }, (_, i) => i * every);
  const lo = sel.a === null ? null : Math.min(sel.a, sel.b ?? sel.a);
  const hi = sel.a === null ? null : Math.max(sel.a, sel.b ?? sel.a);
  const playing = step >= 0;
  const pos = playing ? `${Math.floor(step / 16) + 1}.${Math.floor((step % 16) / 4) + 1}` : `${cursorBar + 1}`;
  return (
    <section className="timeline" aria-label={t('timeline', lang)}>
      <div className="row small" style={{ gap: 10 }}>
        <strong>{t('timeline', lang)}</strong>
        <span className="muted">{t('timelineLength', lang, { bars, time: songDuration(song) })}</span>
        <span className="grow" />
        <span className="mono">{t(playing ? 'positionNow' : 'positionStart', lang, { pos })}</span>
      </div>
      <div ref={strip} className={`tl-strip${marking ? ' marking' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        role="slider" aria-label={t('timelineHint', lang)} aria-valuemin={1} aria-valuemax={bars} aria-valuenow={firstBar + 1} tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') onScrub(Math.min(bars - 1, firstBar + 4));
          if (e.key === 'ArrowLeft') onScrub(Math.max(0, firstBar - 4));
        }}>
        <div className="tl-lane">
          {song.sections.map((s) => (
            <div key={s.id} className={`tl-sec${focus?.id === s.id ? ' focus' : ''}`}
              style={{ left: pct(sectionStartBar(s)), width: pct(sectionBars(s)), ['--sec' as string]: sectionColor(s) }}
              title={`${s.name} · ${sectionBars(s)} ${t('barsShort', lang)}`}>
              <span className="tl-name">{s.name}</span>
              <span className="tl-bars mono">{sectionBars(s)}</span>
            </div>
          ))}
          {lo !== null && hi !== null && <div className="tl-pick" style={{ left: pct(lo), width: pct(hi - lo + 1) }} />}
          <div className="tl-view" style={{ left: pct(Math.min(firstBar, bars - 1)), width: pct(Math.max(1, Math.min(barsOnScreen, bars - firstBar))) }} />
          <div className="tl-cursor" style={{ left: pct(cursorBar) }} aria-hidden="true" />
          {playing && <div className="tl-head" style={{ left: `${(step / (bars * 16)) * 100}%` }} aria-hidden="true" />}
        </div>
        <div className="tl-ticks" aria-hidden="true">
          {ticks.map((b) => <span key={b} style={{ left: pct(b) }}>{b + 1}</span>)}
        </div>
      </div>
    </section>
  );
}

export const barOfTick = (tick: number) => Math.floor(tick / BAR_TICKS);
