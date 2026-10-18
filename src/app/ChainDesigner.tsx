// The signal chain of a sound, drawn as boxes in the order the sound flows through them: the instrument, then each
// unit (preamp, pedals, amp, cabinet and microphone, console channel, color, space), then the output. Tap a box to
// see and change how it is set. Listen to the whole chain, only up to one box, or with one box switched off, while
// it plays. Saving makes a sound of your own; the original stays as it was.

import { useEffect, useMemo, useRef, useState } from 'react';
import { EFFECTS, effectParams, findByKey, rowsOf, title as catalogTitle } from '../packs/core';
import type { ParamDef } from '../packs/core';
import { entryOf } from '../packs/collection';
import { engine } from '../engine/engine';
import type { CustomSound, FxChain, FxSlot, Lang, Role } from '../domain/types';
import { defaultFxParams, newId, now, ROLE_NAMES } from '../domain/factory';
import { ref } from '../packs/core';
import { t } from './i18n';
import { ChoiceParam, formatParam, PEDAL_BLURB } from './panels';
import { Icon } from './ui';
import { OutMeter } from './Transport';
import { templateFor } from './rack';

export type Stage = 'pre' | 'pedal' | 'amp' | 'cab' | 'channel' | 'color' | 'space';
export const STAGES: Stage[] = ['pre', 'pedal', 'amp', 'cab', 'channel', 'color', 'space'];
const STAGE_OF: Record<string, Stage> = {
  'effect.preamp': 'pre',
  'effect.drive': 'pedal', 'effect.octave': 'pedal', 'effect.chorus': 'pedal', 'effect.phaser': 'pedal', 'effect.tremolo': 'pedal',
  'effect.filter-sweep': 'pedal', 'effect.pump': 'pedal',
  'effect.amp': 'amp', 'effect.cab': 'cab',
  'effect.eq': 'channel', 'effect.compressor': 'channel', 'effect.comp-studio': 'channel',
  'effect.tape': 'color', 'effect.lofi': 'color', 'effect.radio': 'color',
  'effect.delay': 'space', 'effect.pingpong': 'space', 'effect.reverb': 'space', 'effect.gated-room': 'space', 'effect.widener': 'space',
};
export const stageOf = (key: string): Stage => STAGE_OF[key] ?? 'pedal';
export const STAGE_COLOR: Record<Stage, string> = {
  pre: '#38BDF8', pedal: '#F0509E', amp: '#F97316', cab: '#A78BFA', channel: '#2DD4BF', color: '#FBBF24', space: '#84CC16',
};
const STAGE_NAME: Record<Stage, { en: string; es: string }> = {
  pre: { en: 'Preamp', es: 'Preamplificador' },
  pedal: { en: 'Pedal', es: 'Pedal' },
  amp: { en: 'Amplifier', es: 'Amplificador' },
  cab: { en: 'Cabinet and mic', es: 'Gabinete y micrófono' },
  channel: { en: 'Console channel', es: 'Canal de consola' },
  color: { en: 'Color', es: 'Color' },
  space: { en: 'Space', es: 'Espacio' },
};
export const stageName = (s: Stage, lang: Lang) => STAGE_NAME[s][lang];

/** One or two words on how a unit is set: its model, then its first knob. */
export function unitSummary(slot: FxSlot, lang: Lang): string {
  const params = effectParams(slot.effect);
  const bits: string[] = [];
  for (const p of params.filter((x) => x.choices)) bits.push(p.choices![Math.round(slot.params[p.name] ?? p.default)]?.[lang] ?? '');
  const knob = params.find((x) => !x.choices);
  if (knob) bits.push(`${knob.label[lang].toLowerCase()} ${formatParam(knob, slot.params[knob.name] ?? knob.default)}`);
  return bits.filter(Boolean).slice(0, 2).join(' · ');
}

const sameParams = (a: Record<string, number>, b: Record<string, number>) =>
  Object.keys({ ...a, ...b }).every((k) => Math.abs((a[k] ?? 0) - (b[k] ?? 0)) < 1e-6);

/** Where a new unit goes when added from the menu: after the last unit of the same stage or an earlier one. */
export function insertAt(chain: FxChain, key: string): number {
  const rank = STAGES.indexOf(stageOf(key));
  return chain.slots.reduce((at, x, i) => (STAGES.indexOf(stageOf(x.effect.key)) <= rank ? i + 1 : at), 0);
}

export interface DesignerTarget {
  trackId: string;
  trackName: string;
  /** The producer's proposal for this track (kept beside the musician's), or the musician's own sound. */
  as: 'musician' | 'producer';
}

export default function ChainDesigner({ base, from, start, original, sound, target, roles, defaultRole, profileId, lang, onSave, onDelete, onBack }: {
  /** The instrument the chain is built on. */
  base: string;
  /** The Colección sound it started from: its groove or phrase plays it. */
  from: string;
  start: FxChain;
  /** The chain to compare with and to restore units from: the Colección sound as it comes. */
  original: FxChain;
  sound?: CustomSound;
  target?: DesignerTarget;
  roles: Role[];
  defaultRole: Role;
  profileId: string;
  lang: Lang;
  onSave: (sound: CustomSound, opts: { kitRole: Role | null; applyTo: DesignerTarget | null }) => void;
  onDelete?: () => void;
  onBack: () => void;
}) {
  const entry = templateFor(from);
  const baseName = entryOf(from)?.title[lang] ?? catalogTitle({ key: from, version: '1.0.0' }, lang);
  const [chain, setChain] = useState<FxChain>(() => structuredClone(start));
  const [sel, setSel] = useState<number | 'in' | 'out'>(() => (start.slots.length ? 0 : 'in'));
  const [upTo, setUpTo] = useState<number | null>(null);
  const [without, setWithout] = useState(false);
  const [abOriginal, setAbOriginal] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [name, setName] = useState(sound?.name ?? t('mySoundName', lang, { name: baseName }));
  const [kitRole, setKitRole] = useState<Role | ''>('');
  const [applyHere, setApplyHere] = useState(!!target);
  const loopRef = useRef(true);
  const timer = useRef<number | undefined>(undefined);
  const playToken = useRef(0);

  /** What is heard right now: the original, or the chain up to a box, with the chosen box switched off. */
  const heard = useMemo<FxChain>(() => {
    if (abOriginal) return original;
    let slots = upTo === null ? chain.slots : chain.slots.slice(0, upTo + 1);
    if (without && typeof sel === 'number') slots = slots.map((x, i) => (i === sel ? { ...x, bypass: true } : x));
    return { ...chain, slots };
  }, [chain, upTo, without, sel, abOriginal, original]);
  const heardRef = useRef(heard);
  useEffect(() => { heardRef.current = heard; if (playing) engine.updatePreviewChain(heard); }, [heard, playing]);
  useEffect(() => () => { playToken.current++; engine.stopPreview(); window.clearTimeout(timer.current); }, []);

  const play = async () => {
    if (!entry) return;
    const token = ++playToken.current;
    setLoading(true);
    const secs = await engine.previewGroove(base, entry.groove, entry.tempo, heardRef.current, 4, entry.phrase);
    if (token !== playToken.current) return;
    setLoading(false);
    if (secs <= 0) { setPlaying(false); return; }
    setPlaying(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (token !== playToken.current) return;
      if (loopRef.current) play(); else setPlaying(false);
    }, Math.max(0.5, secs - 0.5) * 1000);
  };
  const stop = () => { playToken.current++; window.clearTimeout(timer.current); engine.stopPreview(); setPlaying(false); setLoading(false); };

  const setSlot = (i: number, fn: (s: FxSlot) => FxSlot) => setChain((c) => ({ ...c, slots: c.slots.map((s, j) => (j === i ? fn(s) : s)) }));
  const addUnit = (key: string, at: number) => {
    const slot: FxSlot = { effect: ref(key), bypass: false, params: defaultFxParams(key) };
    setChain((c) => ({ ...c, slots: [...c.slots.slice(0, at), slot, ...c.slots.slice(at)] }));
    setSel(at);
    setAdding(null);
    setUpTo(null);
  };
  const removeUnit = (i: number) => {
    setChain((c) => ({ ...c, slots: c.slots.filter((_, j) => j !== i) }));
    setSel(chain.slots.length > 1 ? Math.max(0, i - 1) : 'in');
    setUpTo(null);
    setWithout(false);
  };
  const moveUnit = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= chain.slots.length) return;
    setChain((c) => {
      const slots = [...c.slots];
      [slots[i], slots[j]] = [slots[j], slots[i]];
      return { ...c, slots };
    });
    setSel(j);
    setUpTo(null);
  };
  const originalOf = (slot: FxSlot) => original.slots.find((x) => x.effect.key === slot.effect.key);

  const save = () => {
    const at = now();
    const made: CustomSound = {
      id: sound?.id ?? newId(), profile_id: profileId, name: name.trim() || t('mySoundName', lang, { name: baseName }),
      base: { key: base, version: '1.0.0' }, chain, chain_schema_version: 1, status: 'active', origin: 'person',
      created_at: sound?.created_at ?? at, updated_at: at,
    };
    onSave(made, { kitRole: kitRole || null, applyTo: applyHere && target ? target : null });
  };

  const box = (i: number) => {
    const slot = chain.slots[i];
    const stage = stageOf(slot.effect.key);
    const active = sel === i;
    const cut = upTo !== null && i > upTo;
    return (
      <div key={`${slot.effect.key}-${i}`} className={`cd-box${active ? ' sel' : ''}${slot.bypass ? ' off' : ''}${cut ? ' cut' : ''}`} style={{ ['--stage' as string]: STAGE_COLOR[stage] }}>
        <button type="button" className="cd-box-main" onClick={() => { setSel(i); setWithout(false); }} aria-pressed={active}>
          <span className="cd-stage">{stageName(stage, lang)}</span>
          <strong className="cd-name">{catalogTitle(slot.effect, lang)}</strong>
          <span className="cd-sum">{slot.bypass ? t('pedalOff', lang) : unitSummary(slot, lang)}</span>
        </button>
        <div className="cd-box-foot">
          <button type="button" className="cd-led" aria-pressed={!slot.bypass} onClick={() => setSlot(i, (s) => ({ ...s, bypass: !s.bypass }))}
            aria-label={`${catalogTitle(slot.effect, lang)}: ${t(slot.bypass ? 'pedalOff' : 'pedalOn', lang)}`} title={t(slot.bypass ? 'turnOn' : 'turnOff', lang)} />
          <button type="button" className={`cd-upto${upTo === i ? ' on' : ''}`} onClick={() => { setUpTo(upTo === i ? null : i); setAbOriginal(false); if (!playing) play(); }}
            aria-pressed={upTo === i} title={t('cdUpToHint', lang)}>
            <Icon name="headphones" size={14} /> {t('cdUpTo', lang)}
          </button>
        </div>
      </div>
    );
  };
  const plus = (at: number) => (
    <div key={`plus-${at}`} className="cd-link">
      <span className="cd-arrow" aria-hidden="true" />
      <button type="button" className={`cd-plus${adding === at ? ' on' : ''}`} onClick={() => setAdding(adding === at ? null : at)} aria-label={t('cdAddHere', lang)} title={t('cdAddHere', lang)}>
        <Icon name="plus" size={14} />
      </button>
    </div>
  );

  const selected = typeof sel === 'number' ? chain.slots[sel] : null;
  const orig = selected ? originalOf(selected) : undefined;
  const isDrums = (findByKey(base)?.manifest as { type?: string } | undefined)?.type === 'drumkit';

  return (
    <section className="designer" aria-label={t('cdTitle', lang, { name: baseName })}>
      <div className="row wrap cd-head">
        <button type="button" className="btn" onClick={() => { stop(); onBack(); }}><Icon name="back" size={18} /> {t('cdBack', lang)}</button>
        <div className="stack grow" style={{ gap: 0, minWidth: 0 }}>
          <span className="lbl">{t('cdKicker', lang)}</span>
          <h2 className="display ellipsis" style={{ fontSize: 22 }}>{sound ? sound.name : baseName}</h2>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button type="button" className={`btn${playing ? ' primary' : ''}`} onClick={() => (playing ? stop() : play())}>
            <Icon name={playing ? 'stop' : 'play'} size={18} /> {loading ? t('collectionLoading', lang) : playing ? t('stop', lang) : t('cdListen', lang)}
          </button>
          <button type="button" className="btn" aria-pressed={abOriginal} onClick={() => { setAbOriginal((a) => !a); setUpTo(null); if (!playing) play(); }} title={t('cdCompareHint', lang)}>
            <Icon name="swap" size={18} /> <span className="hide-sm">{t(abOriginal ? 'cdHearingOriginal' : 'cdCompare', lang)}</span>
          </button>
          <OutMeter label={t('soundOutput', lang)} />
        </div>
      </div>
      <p className="small muted" style={{ margin: 0 }} aria-live="polite">
        {abOriginal ? t('cdNowOriginal', lang) : upTo !== null ? t('cdNowUpTo', lang, { name: catalogTitle(chain.slots[upTo].effect, lang) }) : without && selected ? t('cdNowWithout', lang, { name: catalogTitle(selected.effect, lang) }) : t('cdNowAll', lang)}
      </p>

      <div className="cd-flow" role="list" aria-label={t('cdFlow', lang)}>
        <div role="listitem" className={`cd-box io${sel === 'in' ? ' sel' : ''}`}>
          <button type="button" className="cd-box-main" onClick={() => setSel('in')} aria-pressed={sel === 'in'}>
            <span className="cd-stage">{t('cdInstrument', lang)}</span>
            <strong className="cd-name">{baseName}</strong>
            <span className="cd-sum">{entryOf(from)?.era[lang] ?? ''}</span>
          </button>
        </div>
        {chain.slots.map((_, i) => [plus(i), <div key={`b${i}`} role="listitem" className="cd-item">{box(i)}</div>])}
        {plus(chain.slots.length)}
        <div role="listitem" className={`cd-box io${sel === 'out' ? ' sel' : ''}`}>
          <button type="button" className="cd-box-main" onClick={() => setSel('out')} aria-pressed={sel === 'out'}>
            <span className="cd-stage">{t('cdOutput', lang)}</span>
            <strong className="cd-name">{t('cdToDesk', lang)}</strong>
            <span className="cd-sum">{t('cdUnits', lang, { n: chain.slots.filter((x) => !x.bypass).length })}</span>
          </button>
        </div>
      </div>

      {adding !== null && (
        <div className="cd-add" role="group" aria-label={t('cdAddHere', lang)}>
          <span className="lbl">{t('cdAddWhich', lang)}</span>
          {STAGES.map((st) => {
            const list = EFFECTS.filter((e) => stageOf(e.key) === st);
            if (!list.length) return null;
            return (
              <div key={st} className="row wrap" style={{ gap: 6 }}>
                <span className="cd-add-stage" style={{ ['--stage' as string]: STAGE_COLOR[st] }}>{stageName(st, lang)}</span>
                {list.map((e) => <button key={e.key} type="button" className="chip" onClick={() => addUnit(e.key, adding)}>{e.title[lang]}</button>)}
              </div>
            );
          })}
          <button type="button" className="btn ghost small-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setAdding(null)}>{t('cancel', lang)}</button>
        </div>
      )}

      <div className="cd-editor">
        {sel === 'in' && (
          <div className="stack" style={{ gap: 8 }}>
            <h3 className="sub">{t('cdInstrument', lang)}</h3>
            <p style={{ margin: 0 }}>{entryOf(from)?.blurb[lang] ?? baseName}</p>
            {isDrums && (
              <div className="col-pads" role="group" aria-label={t('collectionPieces', lang)}>
                {rowsOf(base).map((k) => {
                  const voice = String(findByKey(k)?.manifest.voice ?? k);
                  return (
                    <button key={k} type="button" className="col-pad" onPointerDown={() => engine.previewPiece(base, voice)}
                      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); engine.previewPiece(base, voice); } }}>
                      {findByKey(k)?.title[lang] ?? voice}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="small muted" style={{ margin: 0 }}>{t('cdInstrumentHint', lang)}</p>
          </div>
        )}
        {sel === 'out' && (
          <div className="stack" style={{ gap: 8 }}>
            <h3 className="sub">{t('cdOutput', lang)}</h3>
            <p style={{ margin: 0 }}>{t('cdOutputHint', lang)}</p>
          </div>
        )}
        {selected && typeof sel === 'number' && (
          <div className="stack" style={{ gap: 10 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <span className="cd-add-stage" style={{ ['--stage' as string]: STAGE_COLOR[stageOf(selected.effect.key)] }}>{stageName(stageOf(selected.effect.key), lang)}</span>
              <h3 className="grow" style={{ fontSize: 18 }}>{catalogTitle(selected.effect, lang)}</h3>
              <button type="button" className="chip" aria-pressed={!selected.bypass} onClick={() => setSlot(sel, (s) => ({ ...s, bypass: !s.bypass }))}>{t(selected.bypass ? 'pedalOff' : 'pedalOn', lang)}</button>
              <button type="button" className="btn small-btn" aria-pressed={without} onClick={() => { setWithout((w) => !w); setAbOriginal(false); if (!playing) play(); }} title={t('cdWithoutHint', lang)}>
                <Icon name="headphones" size={16} /> {t(without ? 'cdWithoutOn' : 'cdWithout', lang)}
              </button>
            </div>
            {PEDAL_BLURB[selected.effect.key] && <p className="small muted" style={{ margin: 0 }}>{PEDAL_BLURB[selected.effect.key][lang]}</p>}
            <div className="rack-knobs">
              {effectParams(selected.effect).map((p: ParamDef) => {
                const v = selected.params[p.name] ?? p.default;
                const set = (x: number) => setSlot(sel, (s) => ({ ...s, params: { ...s.params, [p.name]: x } }));
                if (p.choices) return <ChoiceParam key={p.name} p={p} value={v} lang={lang} onChange={set} />;
                return (
                  <label key={p.name} className="stack" style={{ gap: 2 }}>
                    <span className="lbl">{p.label[lang]} <span className="mono">{formatParam(p, v)}</span></span>
                    <input type="range" min={p.min} max={p.max} step={p.step ?? (p.max - p.min) / 100} value={v} onChange={(ev) => set(Number(ev.target.value))} />
                  </label>
                );
              })}
            </div>
            <div className="row wrap" style={{ gap: 6 }}>
              <button type="button" className="btn small-btn ghost" onClick={() => moveUnit(sel, -1)} disabled={sel === 0}>← {t('cdEarlier', lang)}</button>
              <button type="button" className="btn small-btn ghost" onClick={() => moveUnit(sel, 1)} disabled={sel === chain.slots.length - 1}>{t('cdLater', lang)} →</button>
              <span className="grow" />
              <button type="button" className="btn small-btn ghost" disabled={!orig || (sameParams(orig.params, selected.params) && orig.bypass === selected.bypass)}
                onClick={() => orig && setSlot(sel, () => structuredClone(orig))}><Icon name="reset" size={16} /> {t('cdRestore', lang)}</button>
              <button type="button" className="btn small-btn ghost" onClick={() => removeUnit(sel)}><Icon name="trash" size={16} /> {t('cdRemove', lang)}</button>
            </div>
          </div>
        )}
      </div>

      <div className="cd-save">
        <label className="stack grow" style={{ gap: 4, minWidth: 200 }}>
          <span className="lbl">{t('mySoundNameLabel', lang)}</span>
          <input className="field" value={name} maxLength={40} onChange={(ev) => setName(ev.target.value)} />
        </label>
        <label className="stack" style={{ gap: 4 }}>
          <span className="lbl">{t('cdAlsoKit', lang)}</span>
          <select className="field" value={kitRole} onChange={(e) => setKitRole(e.target.value as Role | '')}>
            <option value="">{t('cdNotInKit', lang)}</option>
            {roles.map((r) => <option key={r} value={r}>{t('cdKitAs', lang, { role: ROLE_NAMES[lang][r] })}{r === defaultRole ? ' ★' : ''}</option>)}
          </select>
        </label>
        {target && (
          <label className="row cd-check">
            <input type="checkbox" checked={applyHere} onChange={(e) => setApplyHere(e.target.checked)} />
            <span>{t(target.as === 'producer' ? 'cdApplyProducer' : 'cdApplyTrack', lang, { track: target.trackName })}</span>
          </label>
        )}
        <div className="row" style={{ gap: 8, marginLeft: 'auto' }}>
          {onDelete && <button type="button" className="btn ghost" onClick={onDelete}><Icon name="trash" size={18} /> {t('mySoundDelete', lang)}</button>}
          <button type="button" className="btn primary" onClick={() => { stop(); save(); }}><Icon name="check" size={18} /> {t(sound ? 'mySoundUpdate' : 'mySoundSave', lang)}</button>
        </div>
      </div>
    </section>
  );
}
