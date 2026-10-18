import { useEffect, useRef } from 'react';
import type { Lang, Song } from '../domain/types';
import { engine } from '../engine/engine';
import { title as catalogTitle } from '../packs/core';
import { t } from './i18n';
import { dbLabel, dbOfGain, FADER_MAX_DB, FADER_MIN_DB, gainOfDb, panLabel } from './levels';

/** The producer's mixer: every track side by side, with fader, pan, meter, mute and solo. */
export default function MixerBoard({ song, selected, lang, onSelect, onGain, onPan, onMute, onSolo }: {
  song: Song;
  selected: string;
  lang: Lang;
  onSelect: (trackId: string) => void;
  onGain: (trackId: string, gain: number) => void;
  onPan: (trackId: string, pan: number) => void;
  onMute: (trackId: string) => void;
  onSolo: (trackId: string) => void;
}) {
  const meters = useRef(new Map<string, HTMLSpanElement>());
  const master = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let id = 0;
    const tick = () => {
      for (const [trackId, el] of meters.current) el.style.transform = `scaleY(${engine.trackLevel(trackId).toFixed(3)})`;
      if (master.current) master.current.style.transform = `scaleY(${engine.outputLevel().toFixed(3)})`;
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <section className="board" aria-label={t('mixerBoard', lang)}>
      {song.tracks.map((tr) => (
        <div key={tr.id} className={`strip${tr.id === selected ? ' on' : ''}`}>
          <button type="button" className="strip-name" onClick={() => onSelect(tr.id)} aria-current={tr.id === selected}>
            <span className="swatch" style={{ background: tr.color }} />
            <strong>{tr.name}</strong>
            <span className="small muted">{tr.instrument ? catalogTitle(tr.instrument, lang) : ''}</span>
          </button>
          <label className="stack strip-pan" style={{ gap: 2 }}>
            <span className="lbl">{t('pan', lang)} <span className="mono">{panLabel(tr.pan)}</span></span>
            <input type="range" min={-1} max={1} step={0.02} value={tr.pan} aria-label={`${t('pan', lang)} ${tr.name}`}
              onChange={(e) => onPan(tr.id, Number(e.target.value))} onDoubleClick={() => onPan(tr.id, 0)} />
          </label>
          <div className="strip-fader">
            <span className="vmeter" aria-hidden="true"><span ref={(el) => { if (el) meters.current.set(tr.id, el); else meters.current.delete(tr.id); }} /></span>
            <input className="fader" type="range" min={FADER_MIN_DB} max={FADER_MAX_DB} step={0.5} value={dbOfGain(tr.gain)}
              aria-label={`${t('volume', lang)} ${tr.name}`} onChange={(e) => onGain(tr.id, gainOfDb(Number(e.target.value)))} />
          </div>
          <span className="mono small" aria-live="off">{dbLabel(tr.gain)} dB</span>
          <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
            <button type="button" className="mini" aria-pressed={tr.muted} onClick={() => onMute(tr.id)} aria-label={t('muteTrack', lang, { name: tr.name })} title={t('muteHint', lang)}>M</button>
            <button type="button" className="mini" aria-pressed={tr.solo} onClick={() => onSolo(tr.id)} aria-label={t('soloTrack', lang, { name: tr.name })} title={t('soloHint', lang)}>S</button>
          </div>
        </div>
      ))}
      <div className="strip master">
        <span className="strip-name"><strong>{t('masterOut', lang)}</strong></span>
        <div className="strip-fader"><span className="vmeter wide" aria-hidden="true"><span ref={master} /></span></div>
      </div>
    </section>
  );
}
