// The producer's desk: one channel strip per track and the master, on the console character the song is mixed on.
// A simple view shows the knobs a young producer needs (lows, highs, compressor, room, echo, pan, volume); the full
// view shows the whole strip. The inspector at the side opens one channel in detail, with its EQ curve.

import { useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';
import type { ChannelStrip, ConsoleModel, Lang, MixSettings, Song, Track } from '../domain/types';
import { CONSOLES, consoleOf, GLUES, mixOf, snapFreq, snapGain, STRIP_FLAT, stripOf } from '../domain/mix';
import type { Band, ConsoleSpec } from '../domain/mix';
import { engine } from '../engine/engine';
import { t } from './i18n';
import { Icon } from './ui';
import { Knob } from './Knob';
import { dbLabel, dbOfGain, FADER_MAX_DB, FADER_MIN_DB, gainOfDb, panLabel } from './levels';
import { eqResponse, LOG_FREQS } from './eqcurve';
import { soundName } from './SongsRoom';

export type DeskView = 'simple' | 'full';

const fmtDb = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(Math.abs(v) < 10 ? 1 : 0)} dB`;
const fmtHz = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)} kHz` : `${Math.round(v)} Hz`);
const fmtPct = (v: number) => `${Math.round(v * 100)}%`;
/** Knob size on the strips: small enough that a whole channel, fader included, fits a laptop screen. */
const KS = 36;

/** A band's frequency control on this console: a knob, a stepped knob, or a fixed label. */
function FreqKnob({ c, band, value, label, lang, onChange }: { c: ConsoleSpec; band: Band; value: number; label: string; lang: Lang; onChange: (hz: number) => void }) {
  const spec = c.bands[band];
  if (spec.hidden) return null;
  if (spec.fixed) return <div className="knob fixed" title={t('deskFixedHint', lang)}><span className="knob-fixed mono">{fmtHz(spec.fixed)}</span><span className="knob-label">{label}</span><span className="knob-num">{t('deskFixed', lang)}</span></div>;
  return <Knob value={value} min={spec.min} max={spec.max} def={snapFreq(spec, (STRIP_FLAT as unknown as Record<string, number>)[`${band}_hz`])} log steps={spec.steps} label={label} display={fmtHz(value)} onChange={(hz) => onChange(snapFreq(spec, hz))} />;
}

export default function Desk({ song, selected, lang, view, showConsole, onSelect, onStrip, onGain, onPan, onMute, onSolo, onMix, onConsole, onView }: {
  song: Song;
  selected: string;
  lang: Lang;
  view: DeskView;
  /** The producer picks the console; the musician's mixer uses the song's as it is. */
  showConsole: boolean;
  onSelect: (trackId: string) => void;
  onStrip: (trackId: string, patch: Partial<ChannelStrip>) => void;
  onGain: (trackId: string, gain: number) => void;
  onPan: (trackId: string, pan: number) => void;
  onMute: (trackId: string) => void;
  onSolo: (trackId: string) => void;
  onMix: (patch: Partial<MixSettings>) => void;
  onConsole: (model: ConsoleModel) => void;
  onView: (v: DeskView) => void;
}) {
  const mix = mixOf(song);
  const c = consoleOf(mix.console);
  const meters = useRef(new Map<string, HTMLSpanElement>());
  const grs = useRef(new Map<string, HTMLSpanElement>());
  const master = useRef<HTMLSpanElement>(null);
  const glueGr = useRef<HTMLSpanElement>(null);
  const lufsShort = useRef<HTMLSpanElement>(null);
  const lufsInt = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let id = 0;
    let last = 0;
    const tick = (now: number) => {
      for (const [trackId, el] of meters.current) el.style.transform = `scaleY(${engine.trackLevel(trackId).toFixed(3)})`;
      for (const [trackId, el] of grs.current) el.style.transform = `scaleY(${Math.min(1, -engine.trackReduction(trackId) / 12).toFixed(3)})`;
      if (master.current) master.current.style.transform = `scaleY(${engine.outputLevel().toFixed(3)})`;
      if (glueGr.current) glueGr.current.style.transform = `scaleY(${Math.min(1, -engine.glueReduction() / 8).toFixed(3)})`;
      if (now - last > 120) {
        last = now;
        const l = engine.loudness();
        const f = (v: number) => (Number.isFinite(v) && v > -70 ? v.toFixed(1) : '–');
        if (lufsShort.current) { lufsShort.current.textContent = f(l.short); lufsShort.current.dataset.hot = String(l.short > -9); }
        if (lufsInt.current) lufsInt.current.textContent = f(l.integrated);
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  const strip = (tr: Track) => {
    const s = stripOf(tr);
    const set = (patch: Partial<ChannelStrip>) => onStrip(tr.id, patch);
    const gain = (band: Band, label: string) => {
      if (c.bands[band].hidden) return null;
      const key = `${band}_db` as const;
      return <Knob size={KS} value={s[key]} min={-c.gain.max} max={c.gain.max} def={0} steps={c.gain.steps} label={label} display={fmtDb(s[key])} onChange={(v) => set({ [key]: snapGain(c, v) } as Partial<ChannelStrip>)} />;
    };
    const playing = tr.producer && tr.voice_from === 'producer' ? tr.producer : null;
    return (
      <div key={tr.id} className={`dstrip${tr.id === selected ? ' on' : ''}`} style={{ ['--trk' as string]: tr.color }}>
        <button type="button" className="dstrip-name" onClick={() => onSelect(tr.id)} aria-current={tr.id === selected}>
          <strong className="ellipsis">{tr.name}</strong>
          <span className="small muted ellipsis">{soundName(playing ? playing.instrument : tr.instrument, playing ? playing.sound : tr.sound, lang)}</span>
          {playing && <span className="tag prod">{t('deskProducerTag', lang)}</span>}
        </button>
        {view === 'full' && (
          <div className="dstrip-sec">
            <Knob size={KS} value={s.trim_db} min={-12} max={12} def={0} label={t('deskTrim', lang)} display={fmtDb(s.trim_db)} onChange={(v) => set({ trim_db: v })} />
            <Knob size={KS} value={s.hpf_hz} min={0} max={400} def={0} steps={c.hpfSteps} label={t('deskHpf', lang)} display={s.hpf_hz > 0 ? fmtHz(s.hpf_hz) : t('deskOff', lang)}
              onChange={(v) => set({ hpf_hz: v < 15 ? 0 : Math.round(v) })} />
          </div>
        )}
        <div className="dstrip-sec eq">
          {view === 'full' ? (<>
            {gain('high', t('deskHigh', lang))}
            {gain('hmid', t('deskHmid', lang))}
            {gain('lmid', t('deskLmid', lang))}
            {gain('low', t('deskLow', lang))}
          </>) : (<>
            {gain('high', t('deskAir', lang))}
            {gain('low', t('deskBody', lang))}
          </>)}
        </div>
        <div className="dstrip-sec">
          <Knob size={KS} value={s.comp} min={0} max={1} def={0} label={t('deskComp', lang)} display={s.comp > 0 ? fmtPct(s.comp) : t('deskOff', lang)} onChange={(v) => set({ comp: v })} />
          {view === 'full'
            ? <Knob size={KS} value={s.drive} min={0} max={1} def={0} label={t('deskDrive', lang)} display={fmtPct(s.drive)} onChange={(v) => set({ drive: v })} />
            : <Knob size={KS} value={tr.pan} min={-1} max={1} def={0} label={t('pan', lang)} display={panLabel(tr.pan)} onChange={(v) => onPan(tr.id, Math.abs(v) < 0.02 ? 0 : v)} />}
        </div>
        <div className="dstrip-sec sends">
          <Knob size={KS} value={s.send_room} min={0} max={1} def={0} label={t('deskRoom', lang)} display={fmtPct(s.send_room)} onChange={(v) => set({ send_room: v })} />
          <Knob size={KS} value={s.send_echo} min={0} max={1} def={0} label={t('deskEcho', lang)} display={fmtPct(s.send_echo)} onChange={(v) => set({ send_echo: v })} />
        </div>
        {view === 'full' && <Knob size={KS} value={tr.pan} min={-1} max={1} def={0} label={t('pan', lang)} display={panLabel(tr.pan)} onChange={(v) => onPan(tr.id, Math.abs(v) < 0.02 ? 0 : v)} />}
        <div className="strip-fader">
          <span className="gr" title={t('deskGr', lang)} aria-hidden="true"><span ref={(el) => { if (el) grs.current.set(tr.id, el); else grs.current.delete(tr.id); }} /></span>
          <input className="fader" type="range" min={FADER_MIN_DB} max={FADER_MAX_DB} step={0.5} value={dbOfGain(tr.gain)}
            aria-label={`${t('volume', lang)} ${tr.name}`} onChange={(e) => onGain(tr.id, gainOfDb(Number(e.target.value)))} onDoubleClick={() => onGain(tr.id, 0.8)} />
          <span className="vmeter" aria-hidden="true"><span ref={(el) => { if (el) meters.current.set(tr.id, el); else meters.current.delete(tr.id); }} /></span>
        </div>
        <div className="dstrip-foot">
          <span className="mono small" title={`${dbLabel(tr.gain)} dB`}>{dbLabel(tr.gain)}</span>
          <button type="button" className="mini" aria-pressed={tr.muted} onClick={() => onMute(tr.id)} aria-label={t('muteTrack', lang, { name: tr.name })} title={t('muteHint', lang)}>M</button>
          <button type="button" className="mini" aria-pressed={tr.solo} onClick={() => onSolo(tr.id)} aria-label={t('soloTrack', lang, { name: tr.name })} title={t('soloHint', lang)}>S</button>
        </div>
      </div>
    );
  };

  return (
    <section className={`desk v-${view}`} aria-label={t('console', lang)}>
      <div className="row wrap desk-head">
        {showConsole ? (
          <label className="row desk-console" style={{ gap: 8 }}>
            <span className="lbl">{t('deskConsole', lang)}</span>
            <select className="field" value={mix.console} onChange={(e) => onConsole(e.target.value as ConsoleModel)}>
              {CONSOLES.map((x) => <option key={x.id} value={x.id}>{x.name[lang]} · {x.era[lang]}</option>)}
            </select>
          </label>
        ) : <span className="lbl">{t('deskOn', lang, { name: c.name[lang] })}</span>}
        <div className="seg small-seg" aria-label={t('deskView', lang)}>
          <button type="button" aria-pressed={view === 'simple'} onClick={() => onView('simple')}>{t('deskSimple', lang)}</button>
          <button type="button" aria-pressed={view === 'full'} onClick={() => onView('full')}>{t('deskFull', lang)}</button>
        </div>
        <span className="small muted desk-blurb" title={c.blurb[lang]}>{c.blurb[lang]}</span>
      </div>
      <div className="desk-row">
        <div className="desk-strips">{song.tracks.map(strip)}</div>
        <div className="dstrip master">
          <span className="dstrip-name"><strong>{t('masterOut', lang)}</strong><span className="small muted">{t('deskMasterHint', lang)}</span></span>
          <div className="dstrip-sec">
            <Knob size={KS} value={mix.glue} min={0} max={1} def={0} label={t('deskGlue', lang)} display={mix.glue > 0 ? fmtPct(mix.glue) : t('deskOff', lang)} onChange={(v) => onMix({ glue: v })} />
            {view === 'full' && (
              <select className="field small-field" value={mix.glue_model} onChange={(e) => onMix({ glue_model: e.target.value as MixSettings['glue_model'] })} aria-label={t('deskGlueModel', lang)} title={GLUES.find((g) => g.id === mix.glue_model)?.blurb[lang]}>
                {GLUES.map((g) => <option key={g.id} value={g.id}>{g.name[lang]}</option>)}
              </select>
            )}
          </div>
          <div className="dstrip-sec eq">
            <Knob size={KS} value={mix.air_db} min={-6} max={6} def={0} label={t('deskAir', lang)} display={fmtDb(mix.air_db)} onChange={(v) => onMix({ air_db: v })} />
            <Knob size={KS} value={mix.body_db} min={-6} max={6} def={0} label={t('deskBody', lang)} display={fmtDb(mix.body_db)} onChange={(v) => onMix({ body_db: v })} />
          </div>
          <div className="dstrip-sec sends">
            <Knob size={KS} value={mix.room_level} min={0} max={1} def={0.8} label={t('deskRoomReturn', lang)} display={fmtPct(mix.room_level)} onChange={(v) => onMix({ room_level: v })} />
            <Knob size={KS} value={mix.echo_level} min={0} max={1} def={0.7} label={t('deskEchoReturn', lang)} display={fmtPct(mix.echo_level)} onChange={(v) => onMix({ echo_level: v })} />
          </div>
          {view === 'full' && (
            <div className="dstrip-sec col">
              <select className="field small-field" value={mix.room_kind} onChange={(e) => onMix({ room_kind: e.target.value as MixSettings['room_kind'] })} aria-label={t('deskRoomKind', lang)}>
                {(['room', 'plate', 'hall'] as const).map((k) => <option key={k} value={k}>{t(k === 'room' ? 'roomRoom' : k === 'plate' ? 'roomPlate' : 'roomHall', lang)}</option>)}
              </select>
              <select className="field small-field" value={mix.echo_time} onChange={(e) => onMix({ echo_time: e.target.value as MixSettings['echo_time'] })} aria-label={t('deskEchoTime', lang)}>
                {(['1/8', '1/4', '3/8', '1/2'] as const).map((k) => <option key={k} value={k}>{t('deskEchoEvery', lang, { n: k })}</option>)}
              </select>
              <Knob size={KS} value={mix.echo_feedback} min={0} max={0.85} def={0.3} label={t('deskRepeats', lang)} display={fmtPct(mix.echo_feedback)} onChange={(v) => onMix({ echo_feedback: v })} />
              <Knob size={KS} value={mix.ceiling_db} min={-3} max={-0.3} def={-1} label={t('deskCeiling', lang)} display={fmtDb(mix.ceiling_db)} onChange={(v) => onMix({ ceiling_db: v })} />
            </div>
          )}
          <div className="strip-fader">
            <span className="gr" title={t('deskGlueGr', lang)} aria-hidden="true"><span ref={glueGr} /></span>
            <span className="vmeter wide" aria-hidden="true"><span ref={master} /></span>
          </div>
          <div className="lufs" title={t('deskLufsHint', lang)}>
            <span className="lbl">LUFS</span>
            <span className="mono lufs-num" ref={lufsShort}>–</span>
            <span className="small muted">{t('deskLufsInt', lang)} <span className="mono" ref={lufsInt}>–</span></span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- one channel in detail */

const BANDS: { band: Band; key: 'low' | 'lmid' | 'hmid' | 'high' }[] = [{ band: 'low', key: 'low' }, { band: 'lmid', key: 'lmid' }, { band: 'hmid', key: 'hmid' }, { band: 'high', key: 'high' }];
const W = 300, H = 140, DB = 18;
const xOf = (f: number) => (Math.log(f / 20) / Math.log(1000)) * W;
const fOf = (x: number) => 20 * Math.pow(1000, Math.max(0, Math.min(1, x / W)));
const yOf = (db: number) => H / 2 - (db / DB) * (H / 2 - 6);
const dbOfY = (y: number) => -((y - H / 2) / (H / 2 - 6)) * DB;

export function ChannelInspector({ song, track, lang, onStrip, onReset }: {
  song: Song;
  track: Track;
  lang: Lang;
  onStrip: (patch: Partial<ChannelStrip>) => void;
  onReset: () => void;
}) {
  const c = consoleOf(mixOf(song).console);
  const s = stripOf(track);
  const freqs = LOG_FREQS(140);
  const curve = eqResponse(s, c, freqs);
  const path = curve.map((db, i) => `${i ? 'L' : 'M'} ${xOf(freqs[i]).toFixed(1)} ${yOf(Math.max(-DB, Math.min(DB, db))).toFixed(1)}`).join(' ');
  const dragging = useRef<Band | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const flat = JSON.stringify(s) === JSON.stringify(STRIP_FLAT);
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const band = dragging.current;
    const el = svg.current;
    if (!band || !el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const y = ((e.clientY - r.top) / r.height) * H;
    const spec = c.bands[band];
    onStrip({ [`${band}_hz`]: snapFreq(spec, fOf(x)), [`${band}_db`]: snapGain(c, dbOfY(y)) } as Partial<ChannelStrip>);
  };
  const label: Record<Band, string> = { low: t('deskLow', lang), lmid: t('deskLmid', lang), hmid: t('deskHmid', lang), high: t('deskHigh', lang) };
  return (
    <section className="card stack inspector" aria-label={t('deskChannelOf', lang, { name: track.name })}>
      <div className="row">
        <span className="swatch" style={{ background: track.color }} />
        <h3 className="grow" style={{ fontSize: 16 }}>{t('deskChannelOf', lang, { name: track.name })}</h3>
        <button type="button" className="btn small-btn ghost" disabled={flat} onClick={onReset} title={t('deskFlatHint', lang)}><Icon name="reset" size={16} /> {t('deskFlat', lang)}</button>
      </div>
      <span className="small muted">{t('deskOn', lang, { name: c.name[lang] })}</span>
      <svg ref={svg} className="eq-graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('deskEqCurve', lang)}
        onPointerMove={move} onPointerUp={() => { dragging.current = null; }} onPointerLeave={() => { dragging.current = null; }}>
        {[100, 1000, 10000].map((f) => <line key={f} x1={xOf(f)} x2={xOf(f)} y1={0} y2={H} className="eq-grid" />)}
        {[-12, -6, 0, 6, 12].map((db) => <line key={db} x1={0} x2={W} y1={yOf(db)} y2={yOf(db)} className={`eq-grid${db === 0 ? ' zero' : ''}`} />)}
        <path d={`${path} L ${W} ${H / 2} L 0 ${H / 2} Z`} className="eq-fill" />
        <path d={path} className="eq-line" />
        {BANDS.filter(({ band }) => !c.bands[band].hidden).map(({ band }) => (
          <circle key={band} cx={xOf(s[`${band}_hz`])} cy={yOf(s[`${band}_db`])} r={7} className={`eq-dot b-${band}`}
            onPointerDown={(e) => { dragging.current = band; (e.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture?.(e.pointerId); }}>
            <title>{label[band]}</title>
          </circle>
        ))}
        {[100, 1000, 10000].map((f) => <text key={f} x={xOf(f) + 3} y={H - 4} className="eq-text">{fmtHz(f)}</text>)}
      </svg>
      <div className="insp-bands">
        {BANDS.map(({ band }) => (c.bands[band].hidden ? null : (
          <div key={band} className="insp-band">
            <span className="insp-dot" style={{ background: `var(--b-${band})` }} />
            <Knob value={s[`${band}_db`]} min={-c.gain.max} max={c.gain.max} def={0} steps={c.gain.steps} label={label[band]} display={fmtDb(s[`${band}_db`])}
              onChange={(v) => onStrip({ [`${band}_db`]: snapGain(c, v) } as Partial<ChannelStrip>)} />
            <FreqKnob c={c} band={band} value={s[`${band}_hz`]} label={t('deskFreq', lang)} lang={lang} onChange={(hz) => onStrip({ [`${band}_hz`]: hz } as Partial<ChannelStrip>)} />
          </div>
        )))}
      </div>
      <div className="insp-row">
        <Knob value={s.trim_db} min={-12} max={12} def={0} label={t('deskTrim', lang)} display={fmtDb(s.trim_db)} onChange={(v) => onStrip({ trim_db: v })} />
        <Knob value={s.hpf_hz} min={0} max={400} def={0} steps={c.hpfSteps} label={t('deskHpf', lang)} display={s.hpf_hz > 0 ? fmtHz(s.hpf_hz) : t('deskOff', lang)} onChange={(v) => onStrip({ hpf_hz: v < 15 ? 0 : Math.round(v) })} />
        <Knob value={s.comp} min={0} max={1} def={0} label={t('deskComp', lang)} display={s.comp > 0 ? fmtPct(s.comp) : t('deskOff', lang)} onChange={(v) => onStrip({ comp: v })} />
        <Knob value={s.drive} min={0} max={1} def={0} label={t('deskDrive', lang)} display={fmtPct(s.drive)} onChange={(v) => onStrip({ drive: v })} />
        <Knob value={s.send_room} min={0} max={1} def={0} label={t('deskRoom', lang)} display={fmtPct(s.send_room)} onChange={(v) => onStrip({ send_room: v })} />
        <Knob value={s.send_echo} min={0} max={1} def={0} label={t('deskEcho', lang)} display={fmtPct(s.send_echo)} onChange={(v) => onStrip({ send_echo: v })} />
      </div>
      <dl className="insp-help small">
        <dt>{t('deskTrim', lang)}</dt><dd>{t('helpTrim', lang)}</dd>
        <dt>{t('deskHpf', lang)}</dt><dd>{t('helpHpf', lang)}</dd>
        <dt>{t('deskComp', lang)}</dt><dd>{t('helpComp', lang)}</dd>
        <dt>{t('deskEq', lang)}</dt><dd>{t('helpEq', lang)}</dd>
        <dt>{t('deskDrive', lang)}</dt><dd>{t('helpDrive', lang)}</dd>
        <dt>{t('deskSends', lang)}</dt><dd>{t('helpSends', lang)}</dd>
      </dl>
    </section>
  );
}
