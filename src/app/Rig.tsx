// The studio's one diagram: where the sound comes from (the track), the instrument, each unit of its signal chain
// in the order the sound flows through them, and where it goes (the desk, as the musician's sound or the producer's
// version). Tap a box and the work area below shows what belongs to it. A unit opens its editor here.

import { EFFECTS, effectParams, title as catalogTitle } from '../packs/core';
import type { ParamDef } from '../packs/core';
import type { FxChain, FxSlot, Lang } from '../domain/types';
import { defaultFxParams } from '../domain/factory';
import { ref } from '../packs/core';
import { t } from './i18n';
import { ChoiceParam, formatParam, PEDAL_BLURB } from './panels';
import { Icon } from './ui';
import { Knob } from './Knob';

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
/** Short names for the boxes of the flow, where space is tight. */
const STAGE_SHORT: Record<Stage, { en: string; es: string }> = {
  pre: { en: 'Preamp', es: 'Preamp' }, pedal: { en: 'Pedal', es: 'Pedal' }, amp: { en: 'Amp', es: 'Ampli' }, cab: { en: 'Cabinet', es: 'Gabinete' },
  channel: { en: 'Console', es: 'Consola' }, color: { en: 'Color', es: 'Color' }, space: { en: 'Space', es: 'Espacio' },
};

/** One or two words on how a unit is set: its model, then its first knob. */
export function unitSummary(slot: FxSlot, lang: Lang): string {
  const params = effectParams(slot.effect);
  const bits: string[] = [];
  for (const p of params.filter((x) => x.choices)) bits.push(p.choices![Math.round(slot.params[p.name] ?? p.default)]?.[lang] ?? '');
  const knob = params.find((x) => !x.choices);
  if (knob) bits.push(`${knob.label[lang].toLowerCase()} ${formatParam(knob, slot.params[knob.name] ?? knob.default)}`);
  return bits.filter(Boolean).slice(0, 2).join(' · ');
}

/** Where a new unit goes when added from the menu: after the last unit of the same stage or an earlier one. */
export function insertAt(chain: FxChain, key: string): number {
  const rank = STAGES.indexOf(stageOf(key));
  return chain.slots.reduce((at, x, i) => (STAGES.indexOf(stageOf(x.effect.key)) <= rank ? i + 1 : at), 0);
}

export const newSlot = (key: string): FxSlot => ({ effect: ref(key), bypass: false, params: defaultFxParams(key) });

export type RigSel = 'track' | 'instrument' | 'out' | number;

export interface RigEnds {
  track: { name: string; color: string; sum: string };
  instrument: { name: string; sum: string };
  out: { name: string; sum: string; warn?: boolean };
}

/** The diagram itself: source, instrument, units, destination, with a + between boxes to add a unit there. */
export function RigFlow({ chain, ends, sel, upTo, adding, lang, onSel, onToggle, onUpTo, onAdd, onStarter }: {
  chain: FxChain;
  ends: RigEnds;
  sel: RigSel;
  upTo: number | null;
  adding: number | null;
  lang: Lang;
  onSel: (s: RigSel) => void;
  onToggle: (i: number) => void;
  onUpTo: (i: number) => void;
  onAdd: (at: number | null) => void;
  /** Load the family's starting rack when the chain is empty. */
  onStarter: () => void;
}) {
  const link = (at: number) => (
    <div key={`plus-${at}`} className="cd-link">
      <span className="cd-arrow" aria-hidden="true" />
      <button type="button" className={`cd-plus${adding === at ? ' on' : ''}`} onClick={() => onAdd(adding === at ? null : at)} aria-label={t('cdAddHere', lang)} title={t('cdAddHere', lang)}>
        <Icon name="plus" size={14} />
      </button>
    </div>
  );
  const arrow = (k: string) => <div key={k} className="cd-link plain" aria-hidden="true"><span className="cd-arrow" /></div>;
  const end = (key: 'track' | 'instrument' | 'out', kicker: string, name: string, sum: string, extra?: string, color?: string) => (
    <div role="listitem" key={key} className={`cd-box io es-${key}${sel === key ? ' sel' : ''}${extra ?? ''}`} style={color ? { ['--stage' as string]: color } : undefined}>
      <button type="button" className="cd-box-main" onClick={() => onSel(key)} aria-pressed={sel === key}>
        <span className="cd-stage">{kicker}</span>
        <strong className="cd-name">{name}</strong>
        <span className="cd-sum">{sum}</span>
      </button>
    </div>
  );
  return (
    <div className="cd-flow es-flow" role="list" aria-label={t('esFlow', lang)} ref={(el) => {
      const box = el?.querySelector<HTMLElement>('.cd-box.sel');
      if (el && box && (box.offsetLeft < el.scrollLeft || box.offsetLeft + box.offsetWidth > el.scrollLeft + el.clientWidth)) {
        el.scrollTo({ left: Math.max(0, box.offsetLeft - 40), behavior: 'smooth' });
      }
    }}>
      {end('track', t('esTrack', lang), ends.track.name, ends.track.sum, '', ends.track.color)}
      {arrow('a0')}
      {end('instrument', t('cdInstrument', lang), ends.instrument.name, ends.instrument.sum)}
      {chain.slots.length === 0 ? (<>
        {link(0)}
        <div role="listitem" className="cd-box es-empty">
          <div className="cd-box-main">
            <span className="cd-stage">{t('esNoGear', lang)}</span>
            <span className="cd-sum">{t('esNoGearHint', lang)}</span>
            <button type="button" className="btn small-btn" onClick={onStarter}><Icon name="plus" size={14} /> {t('esStarter', lang)}</button>
          </div>
        </div>
        {arrow('a1')}
      </>) : (<>
        {chain.slots.map((slot, i) => {
          const stage = stageOf(slot.effect.key);
          const cut = upTo !== null && i > upTo;
          return [link(i), (
            <div role="listitem" key={`b${i}`} className={`cd-box${sel === i ? ' sel' : ''}${slot.bypass ? ' off' : ''}${cut ? ' cut' : ''}`} style={{ ['--stage' as string]: STAGE_COLOR[stage] }}>
              <button type="button" className="cd-box-main" onClick={() => onSel(i)} aria-pressed={sel === i}>
                <span className="cd-stage" title={stageName(stage, lang)}>{STAGE_SHORT[stage][lang]}</span>
                <strong className="cd-name">{catalogTitle(slot.effect, lang)}</strong>
                <span className="cd-sum">{slot.bypass ? t('pedalOff', lang) : unitSummary(slot, lang)}</span>
              </button>
              <div className="cd-box-foot">
                <button type="button" className="cd-led" aria-pressed={!slot.bypass} onClick={() => onToggle(i)}
                  aria-label={`${catalogTitle(slot.effect, lang)}: ${t(slot.bypass ? 'pedalOff' : 'pedalOn', lang)}`} title={t(slot.bypass ? 'turnOn' : 'turnOff', lang)} />
                <button type="button" className={`cd-upto${upTo === i ? ' on' : ''}`} onClick={() => onUpTo(i)} aria-pressed={upTo === i} title={t('cdUpToHint', lang)} aria-label={`${t('cdUpTo', lang)}: ${catalogTitle(slot.effect, lang)}`}>
                  <Icon name="headphones" size={14} /> <span className="cd-upto-txt">{t('cdUpTo', lang)}</span>
                </button>
              </div>
            </div>
          )];
        })}
        {link(chain.slots.length)}
      </>)}
      {end('out', t('esToDesk', lang), ends.out.name, ends.out.sum, ends.out.warn ? ' warn' : '')}
    </div>
  );
}

/** The palette that opens from a + : every unit by stage. */
export function AddUnit({ lang, onPick, onCancel }: { lang: Lang; onPick: (key: string) => void; onCancel: () => void }) {
  return (
    <div className="cd-add" role="group" aria-label={t('cdAddHere', lang)}>
      <span className="lbl">{t('cdAddWhich', lang)}</span>
      {STAGES.map((st) => {
        const list = EFFECTS.filter((e) => stageOf(e.key) === st);
        if (!list.length) return null;
        return (
          <div key={st} className="row wrap" style={{ gap: 6 }}>
            <span className="cd-add-stage" style={{ ['--stage' as string]: STAGE_COLOR[st] }}>{stageName(st, lang)}</span>
            {list.map((e) => <button key={e.key} type="button" className="chip" onClick={() => onPick(e.key)}>{e.title[lang]}</button>)}
          </div>
        );
      })}
      <button type="button" className="btn ghost small-btn" style={{ alignSelf: 'flex-start' }} onClick={onCancel}>{t('cancel', lang)}</button>
    </div>
  );
}

/** A unit's knobs, laid out like a rack unit: model choices first, then the knobs. */
function ParamKnob({ p, value, lang, onChange }: { p: ParamDef; value: number; lang: Lang; onChange: (v: number) => void }) {
  const step = p.step ?? 0;
  const count = step ? Math.round((p.max - p.min) / step) : 0;
  const steps = step && count > 0 && count <= 24 ? Array.from({ length: count + 1 }, (_, i) => p.min + i * step) : undefined;
  return <Knob size={52} value={value} min={p.min} max={p.max} def={p.default} steps={steps} log={p.unit === 'Hz' && p.min > 0 && p.max / p.min > 20}
    label={p.label[lang]} display={formatParam(p, value)} onChange={onChange} />;
}

export function UnitEditor({ slot, index, count, original, without, lang, onChange, onSwap, onToggle, onWithout, onMove, onRestore, onRemove }: {
  slot: FxSlot;
  index: number;
  count: number;
  /** The same unit in the sound as it comes, to put it back. */
  original?: FxSlot;
  without: boolean;
  lang: Lang;
  onChange: (params: Record<string, number>) => void;
  onSwap: (key: string) => void;
  onToggle: () => void;
  onWithout: () => void;
  onMove: (d: -1 | 1) => void;
  onRestore: () => void;
  onRemove: () => void;
}) {
  const stage = stageOf(slot.effect.key);
  const params = effectParams(slot.effect);
  const choices = params.filter((p) => p.choices);
  const knobs = params.filter((p) => !p.choices);
  const others = EFFECTS.filter((e) => stageOf(e.key) === stage && e.key !== slot.effect.key);
  const same = !!original && original.bypass === slot.bypass && Object.keys({ ...original.params, ...slot.params }).every((k) => Math.abs((original.params[k] ?? 0) - (slot.params[k] ?? 0)) < 1e-6);
  return (
    <section className="es-unit" style={{ ['--stage' as string]: STAGE_COLOR[stage] }} aria-label={catalogTitle(slot.effect, lang)}>
      <div className="row wrap es-unit-head">
        <span className="cd-add-stage">{stageName(stage, lang)}</span>
        <h3 className="grow display" style={{ fontSize: 20 }}>{catalogTitle(slot.effect, lang)}</h3>
        <button type="button" className="chip" aria-pressed={!slot.bypass} onClick={onToggle}>{t(slot.bypass ? 'pedalOff' : 'pedalOn', lang)}</button>
        <button type="button" className="btn small-btn" aria-pressed={without} onClick={onWithout} title={t('cdWithoutHint', lang)}>
          <Icon name="headphones" size={16} /> {t(without ? 'cdWithoutOn' : 'cdWithout', lang)}
        </button>
      </div>
      {PEDAL_BLURB[slot.effect.key] && <p className="small muted" style={{ margin: 0 }}>{PEDAL_BLURB[slot.effect.key][lang]}</p>}
      <div className="es-unit-body">
        {choices.map((p) => <ChoiceParam key={p.name} p={p} value={slot.params[p.name] ?? p.default} lang={lang} onChange={(v) => onChange({ ...slot.params, [p.name]: v })} />)}
        {knobs.length > 0 && (
          <div className="es-knobs" role="group" aria-label={t('esKnobs', lang)}>
            {knobs.map((p) => <ParamKnob key={p.name} p={p} value={slot.params[p.name] ?? p.default} lang={lang} onChange={(v) => onChange({ ...slot.params, [p.name]: v })} />)}
          </div>
        )}
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        <button type="button" className="btn small-btn ghost" onClick={() => onMove(-1)} disabled={index === 0}>← {t('cdEarlier', lang)}</button>
        <button type="button" className="btn small-btn ghost" onClick={() => onMove(1)} disabled={index === count - 1}>{t('cdLater', lang)} →</button>
        {others.length > 0 && (
          <label className="row" style={{ gap: 6 }}>
            <span className="small muted">{t('esSwap', lang)}</span>
            <select className="field small-field" value="" onChange={(e) => e.target.value && onSwap(e.target.value)} aria-label={t('esSwap', lang)}>
              <option value="">{t('esSwapPick', lang)}</option>
              {others.map((e) => <option key={e.key} value={e.key}>{e.title[lang]}</option>)}
            </select>
          </label>
        )}
        <span className="grow" />
        <button type="button" className="btn small-btn ghost" disabled={!original || same} onClick={onRestore}><Icon name="reset" size={16} /> {t('cdRestore', lang)}</button>
        <button type="button" className="btn small-btn ghost" onClick={onRemove}><Icon name="trash" size={16} /> {t('cdRemove', lang)}</button>
      </div>
    </section>
  );
}
