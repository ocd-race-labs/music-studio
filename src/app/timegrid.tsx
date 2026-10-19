// The parts every step grid shares: only the steps on screen are drawn (a 96-bar song has thousands of
// squares), a ruler of bars with the song's sections on top, and paging that follows the playhead.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Lang, Section } from '../domain/types';
import { BAR_TICKS } from '../domain/types';
import { sectionColor } from '../domain/arrange';
import { t } from './i18n';
import { GAP } from './zoom';

export const RULER_H = 28;

/** The part of the song a grid shows, in steps: the whole song, or one section. */
export interface View { start: number; length: number }

/** A request to scroll a grid so that `step` comes into view; `n` changes on every request. */
export interface Jump { step: number; n: number }

/** Mark mode: the first bar chosen and the bar the range reaches so far. */
export interface MarkSel { a: number | null; b: number | null }

/** Room after the last step so the last page can line up with the left edge, like the others. */
export const tailRoom = (clientWidth: number, label: number, pitch: number, count: number): number => {
  const fits = Math.floor((clientWidth - label) / pitch);
  return fits < count ? Math.max(0, clientWidth - label - fits * pitch) : 0;
};

/**
 * Which steps to draw (local to the view), from the scroll position, in whole bars with a bar of margin.
 * Also reports the first bar on screen, and keeps the same bar in view when the zoom changes.
 */
export function useStepWindow(
  scroller: RefObject<HTMLDivElement | null>, view: View, pitch: number, label: number,
  onFirstBar?: (bar: number, bars: number) => void,
) {
  const count = view.length;
  const [win, setWin] = useState({ from: 0, to: Math.min(count, 128) });
  const first = useRef(0);
  const usedPitch = useRef(pitch);
  const reported = useRef('');
  const report = useRef(onFirstBar);
  useLayoutEffect(() => { report.current = onFirstBar; }, [onFirstBar]);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const left = Math.floor(el.scrollLeft / pitch);
      const right = Math.ceil((el.scrollLeft + el.clientWidth - label) / pitch);
      first.current = left;
      const from = Math.max(0, Math.floor((left - 16) / 16) * 16);
      const to = Math.min(count, Math.ceil((right + 16) / 16) * 16);
      setWin((w) => (w.from === from && w.to === to ? w : { from, to }));
      const bar = Math.floor((view.start + left) / 16);
      const bars = Math.max(1, Math.round((el.clientWidth - label) / pitch / 16));
      const key = `${bar}:${bars}`;
      if (key !== reported.current) { reported.current = key; report.current?.(bar, bars); }
    };
    // A new zoom keeps the same step at the left edge.
    if (usedPitch.current !== pitch) { el.scrollLeft = first.current * pitch; usedPitch.current = pitch; }
    update();
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(onScroll) : null;
    ro?.observe(el);
    return () => { el.removeEventListener('scroll', onScroll); ro?.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [scroller, count, pitch, label, view.start]);
  return { win, first };
}

/**
 * Scroll on request (the timeline, a section chosen), and turn the page as the playhead moves on, like a score.
 * When the person scrolls away while it plays (to look ahead or fix something), the view stays where they put it:
 * pages turn again once the playhead comes into view, when the song starts again, or after a jump.
 */
export function useScrollControl(
  scroller: RefObject<HTMLDivElement | null>, view: View, pitch: number, label: number, step: number, jump: Jump | undefined,
) {
  const held = useRef(false);
  const ours = useRef(0);
  const prev = useRef(-1);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const byHand = () => { held.current = true; };
    // A scroll the grid did itself shows up as a scroll event too: only the ones that follow none of ours count.
    const onScroll = () => { if (performance.now() - ours.current > 300) held.current = true; };
    el.addEventListener('wheel', byHand, { passive: true });
    el.addEventListener('touchmove', byHand, { passive: true });
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('wheel', byHand);
      el.removeEventListener('touchmove', byHand);
      el.removeEventListener('scroll', onScroll);
    };
  }, [scroller]);
  const jumpN = jump?.n;
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !jump) return;
    const local = Math.max(0, Math.min(view.length - 1, jump.step - view.start));
    ours.current = performance.now();
    held.current = false;
    el.scrollLeft = Math.floor(local / 16) * 16 * pitch;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpN, view.start, view.length]);
  useEffect(() => {
    const el = scroller.current;
    const started = prev.current < 0 && step >= 0;
    prev.current = step;
    if (!el || step < 0) return;
    if (started) held.current = false;
    const local = step - view.start;
    if (local < 0 || local >= view.length) return;
    const fits = Math.max(1, Math.floor((el.clientWidth - label) / pitch));
    const firstOnScreen = Math.round(el.scrollLeft / pitch);
    if (local >= firstOnScreen && local < firstOnScreen + fits) { held.current = false; return; }
    if (held.current) return;
    const page = fits >= 16 ? Math.floor(fits / 16) * 16 : fits;
    ours.current = performance.now();
    el.scrollTo({ left: Math.floor(local / page) * page * pitch });
  }, [scroller, step, view.start, view.length, pitch, label]);
}

/** Bar numbers over the grid, colored by section; in mark mode a tap picks bars. */
export function Ruler({ view, win, pitch, label, sections, lang, marking, sel, cursorBar, onBarTap }: {
  view: View;
  win: { from: number; to: number };
  pitch: number;
  label: number;
  sections: Section[];
  lang: Lang;
  marking: boolean;
  sel: MarkSel;
  cursorBar: number | null;
  onBarTap: (bar: number) => void;
}) {
  const firstBar = Math.floor((view.start + win.from) / 16);
  const lastBar = Math.ceil((view.start + win.to) / 16);
  const endStep = view.start + view.length;
  const lo = sel.a === null ? null : Math.min(sel.a, sel.b ?? sel.a);
  const hi = sel.a === null ? null : Math.max(sel.a, sel.b ?? sel.a);
  const bars = [];
  for (let bar = firstBar; bar < lastBar; bar++) {
    const s0 = Math.max(bar * 16, view.start);
    const s1 = Math.min((bar + 1) * 16, endStep);
    if (s1 <= s0) continue;
    const sec = sections.find((x) => bar * BAR_TICKS >= x.start_tick && bar * BAR_TICKS < x.start_tick + x.length_ticks);
    const startsHere = sec && sec.start_tick === bar * BAR_TICKS;
    const picked = lo !== null && hi !== null && bar >= lo && bar <= hi;
    bars.push(
      <button key={bar} type="button" className={`rbar${picked ? ' picked' : ''}${marking ? ' marking' : ''}${cursorBar === bar ? ' cursor' : ''}`}
        style={{ left: label + (s0 - view.start) * pitch, width: (s1 - s0) * pitch - GAP, ['--sec' as string]: sec ? sectionColor(sec) : 'transparent' }}
        onClick={() => onBarTap(bar)}
        // No focus on tap: focusing a half-hidden bar would scroll the grid under the finger.
        onMouseDown={(e) => e.preventDefault()}
        aria-label={`${t('bar', lang)} ${bar + 1}${sec ? `, ${sec.name}` : ''}`} aria-pressed={marking ? picked : undefined}>
        <span className="mono">{bar + 1}</span>
        {startsHere && <span className="rname">{sec.name}</span>}
      </button>,
    );
  }
  return <>{bars}</>;
}
