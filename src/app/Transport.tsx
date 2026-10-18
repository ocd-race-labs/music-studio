// The transport: play, tempo, length, recording and where the song is. It belongs to the whole song, so it sits as
// one strip at the top of the work area, in the same place in every room, right above what is being edited.

import { useEffect, useRef } from 'react';
import type { Lang, Song } from '../domain/types';
import { songBars } from '../domain/factory';
import { engine } from '../engine/engine';
import { LengthStepper, songDuration } from './Arrange';
import { t } from './i18n';
import { Icon } from './ui';

export function Transport({ song, lang, playing, step, cursorBar, rec, onPlay, onTempo, onBars, onRec, children }: {
  song: Song;
  lang: Lang;
  playing: boolean;
  step: number;
  cursorBar: number;
  /** Record taps is the musician's; the producer's strip has no record button. */
  rec?: boolean;
  onPlay: () => void;
  onTempo: (bpm: number) => void;
  onBars: (bars: number) => void;
  onRec?: () => void;
  /** Room-specific controls at the right end of the strip. */
  children?: React.ReactNode;
}) {
  const bars = songBars(song);
  const pos = step >= 0 ? `${Math.floor(step / 16) + 1}.${Math.floor((step % 16) / 4) + 1}` : `${cursorBar + 1}`;
  return (
    <div className="transport" role="group" aria-label={t('transport', lang)}>
      <button type="button" className={`play${playing ? ' on' : ''}`} onClick={onPlay} aria-label={t(playing ? 'stop' : 'play', lang)} title={t('playHint', lang)}>
        <Icon name={playing ? 'stop' : 'play'} size={22} />
      </button>
      <div className="tp-pos mono" aria-live="off" title={t(step >= 0 ? 'positionNow' : 'positionStart', lang, { pos })}>
        <span className="tp-big">{pos}</span>
        <span className="tp-small">{t('timelineLength', lang, { bars, time: songDuration(song) })}</span>
      </div>
      <span className="tp-sep" aria-hidden="true" />
      <label className="tp-field">
        <span className="lbl">BPM</span>
        <input className="field mono" type="number" min={40} max={200} value={song.tempo_bpm}
          onChange={(e) => onTempo(Number(e.target.value) || song.tempo_bpm)} aria-label={t('tempo', lang)} />
      </label>
      <LengthStepper bars={bars} lang={lang} onBars={onBars} />
      {onRec && (
        <button type="button" className="btn rec" aria-pressed={rec} onClick={onRec} title={t('recordHint', lang)} aria-label={t('record', lang)}>
          <span className="dot" style={{ background: rec ? 'var(--highlight-ink)' : 'var(--highlight)' }} /> <span className="hide-sm">{t('record', lang)}</span>
        </button>
      )}
      <OutMeter label={t('soundOutput', lang)} />
      <span className="grow" />
      {children}
    </div>
  );
}

/** A small level bar next to Play: if it moves and nothing is heard, the device volume or silent mode is the cause. */
export function OutMeter({ label }: { label: string }) {
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
