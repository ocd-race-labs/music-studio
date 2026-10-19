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
import type { IconName } from './ui';
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
export const STAGE_ICON: Record<Stage, IconName> = { pre: 'knob', pedal: 'pedal', amp: 'amp', cab: 'cab', channel: 'sliders', color: 'tape', space: 'space' };
/** What each kind of unit does, in a line. */
const STAGE_HINT: Record<Stage, { en: string; es: string }> = {
  pre: { en: 'Body and push, before everything else.', es: 'Cuerpo y empuje, antes que todo.' },
  pedal: { en: 'Grit, movement, filters and pumping.', es: 'Saturación, movimiento, filtros y bombeo.' },
  amp: { en: 'The character of a guitar or bass amp.', es: 'El carácter de un ampli de guitarra o bajo.' },
  cab: { en: 'The speakers and how the mic hears them.', es: 'Los parlantes y cómo los escucha el micrófono.' },
  channel: { en: 'Equalizer and compressors of a console.', es: 'Ecualizador y compresores de una consola.' },
  color: { en: 'Tape, lo-fi and radio: the sound of an era.', es: 'Cinta, lo-fi y radio: el sonido de una época.' },
  space: { en: 'Echoes, rooms and width.', es: 'Ecos, salas y amplitud.' },
};

/** One thing to try in the picker: a unit, or one model of a unit that has models (an amp's clean or crunch). */
export interface FxOption { id: string; key: string; title: string; blurb: string; slot: FxSlot }
export function optionsFor(stage: Stage, lang: Lang): FxOption[] {
  return EFFECTS.filter((e) => stageOf(e.key) === stage).flatMap((e) => {
    const model = MODEL_PRESET[e.key] ? effectParams(ref(e.key)).find((p) => p.choices) : undefined;
    const base = newSlot(e.key);
    if (!model?.choices) return [{ id: e.key, key: e.key, title: e.title[lang], blurb: PEDAL_BLURB[e.key]?.[lang] ?? '', slot: base }];
    return model.choices.map((c, i) => ({
      id: `${e.key}#${i}`, key: e.key, title: `${e.title[lang]} · ${c[lang]}`,
      blurb: CHOICE_HINT[e.key]?.[i]?.[lang] ?? PEDAL_BLURB[e.key]?.[lang] ?? '',
      slot: { ...base, params: { ...base.params, [model.name]: i, ...modelPreset(e.key, i) } },
    }));
  });
}
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

export type RigSel = 'track' | 'instrument' | 'out' | 'add' | number;

export interface RigEnds {
  track: { name: string; color: string; sum: string; icon: IconName };
  instrument: { name: string; sum: string; icon: IconName };
  out: { name: string; sum: string; warn?: boolean };
}

/** A switch whose position shows its state: on or off, never what pressing it would do. */
export function OnSwitch({ on, label, lang, onToggle, small }: { on: boolean; label: string; lang: Lang; onToggle: () => void; small?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`es-sw${on ? ' on' : ''}${small ? ' small' : ''}`} onClick={onToggle}
      title={t(on ? 'turnOff' : 'turnOn', lang)}>
      <span className="es-sw-track" aria-hidden="true"><span className="es-sw-thumb" /></span>
      <span className="es-sw-txt">{t(on ? 'esOn' : 'esOff', lang)}</span>
    </button>
  );
}

/** The diagram itself: 1 track, 2 instrument, 3 the chain's units, 4 the desk, with a + between units to add one there. */
export function RigFlow({ chain, ends, sel, upTo, adding, lang, onSel, onToggle, onRemove, onAdd, onStarter }: {
  chain: FxChain;
  ends: RigEnds;
  sel: RigSel;
  upTo: number | null;
  adding: number | null;
  lang: Lang;
  onSel: (s: RigSel) => void;
  onToggle: (i: number) => void;
  /** Take a unit out of the chain, from its own box. */
  onRemove: (i: number) => void;
  /** Open the picker to add a unit at a place, -1 for where its kind goes, null to close it. */
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
  // The way in: a box at the end of the chain that opens the kinds of units to add.
  const addBox = (
    <div role="listitem" key="addbox" className={`cd-box es-addbox${sel === 'add' && adding === -1 ? ' sel' : ''}`}>
      <button type="button" className="cd-box-main" onClick={() => onAdd(sel === 'add' && adding === -1 ? null : -1)} aria-pressed={sel === 'add' && adding === -1}>
        <span className="es-addbox-plus" aria-hidden="true"><Icon name="plus" size={18} /></span>
        <strong className="cd-name">{t('esAddEffect', lang)}</strong>
      </button>
    </div>
  );
  const end = (key: 'track' | 'instrument' | 'out', kicker: string, name: string, sum: string, icon: IconName, extra?: string, color?: string) => (
    <div role="listitem" key={key} className={`cd-box io es-${key}${sel === key ? ' sel' : ''}${extra ?? ''}`} style={color ? { ['--stage' as string]: color } : undefined}>
      <button type="button" className="cd-box-main" onClick={() => onSel(key)} aria-pressed={sel === key}>
        <span className="cd-stage"><Icon name={icon} size={14} /> {kicker}</span>
        <strong className="cd-name">{name}</strong>
        <span className="cd-sum">{sum}</span>
      </button>
    </div>
  );
  const on = chain.slots.filter((x) => !x.bypass).length;
  return (
    <div className="cd-flow es-flow" role="list" aria-label={t('esFlow', lang)} ref={(el) => {
      const box = el?.querySelector<HTMLElement>('.cd-box.sel');
      if (el && box && (box.offsetLeft < el.scrollLeft || box.offsetLeft + box.offsetWidth > el.scrollLeft + el.clientWidth)) {
        el.scrollTo({ left: Math.max(0, box.offsetLeft - 40), behavior: 'smooth' });
      }
    }}>
      {end('track', t('esStep1', lang), ends.track.name, ends.track.sum, ends.track.icon, '', ends.track.color)}
      {arrow('a0')}
      {end('instrument', t('esStep2', lang), ends.instrument.name, ends.instrument.sum, ends.instrument.icon)}
      <div className="es-chainwrap" role="group" aria-label={t('esStep3', lang)}>
        <span className="es-step">{t('esStep3', lang)} <span className="es-step-n">{chain.slots.length ? t('esUnitsOn', lang, { n: on, of: chain.slots.length }) : t('esNoGear', lang).toLowerCase()}</span></span>
        <div className="es-chainrow">
          {chain.slots.length === 0 ? (<>
            <div role="listitem" className="cd-box es-empty">
              <div className="cd-box-main">
                <span className="cd-sum">{t('esNoGearHint', lang)}</span>
                <button type="button" className="btn small-btn" onClick={onStarter}><Icon name="plus" size={14} /> {t('esStarter', lang)}</button>
              </div>
            </div>
            {arrow('a-empty')}
            {addBox}
          </>) : (<>
            {chain.slots.map((slot, i) => {
              const stage = stageOf(slot.effect.key);
              const cut = upTo !== null && i > upTo;
              return [link(i), (
                <div role="listitem" key={`b${i}`} className={`cd-box${sel === i ? ' sel' : ''}${slot.bypass ? ' off' : ''}${cut ? ' cut' : ''}`} style={{ ['--stage' as string]: STAGE_COLOR[stage] }}>
                  <button type="button" className="cd-box-main" onClick={() => onSel(i)} aria-pressed={sel === i}>
                    <span className="cd-stage" title={stageName(stage, lang)}><Icon name={STAGE_ICON[stage]} size={14} /> {STAGE_SHORT[stage][lang]}</span>
                    <strong className="cd-name">{catalogTitle(slot.effect, lang)}</strong>
                    <span className="cd-sum">{slot.bypass ? t('pedalOff', lang) : unitSummary(slot, lang)}</span>
                  </button>
                  <div className="cd-box-foot">
                    <OnSwitch small on={!slot.bypass} lang={lang} label={catalogTitle(slot.effect, lang)} onToggle={() => onToggle(i)} />
                  </div>
                  <button type="button" className="cd-x" onClick={() => onRemove(i)}
                    aria-label={t('esRemoveUnit', lang, { name: catalogTitle(slot.effect, lang) })} title={t('esRemoveUnit', lang, { name: catalogTitle(slot.effect, lang) })}>
                    <Icon name="close" size={14} />
                  </button>
                </div>
              )];
            })}
            {arrow('a-end')}
            {addBox}
          </>)}
        </div>
      </div>
      {arrow('a1')}
      {end('out', t('esStep4', lang), ends.out.name, ends.out.sum, 'sliders', ends.out.warn ? ' warn' : '')}
    </div>
  );
}

/**
 * Adding a unit: the kinds of units as icons. Opening one hides the others and lists its options; each is heard
 * alone on the instrument, without the rest of the rack, before it goes into the chain.
 */
export function EffectPicker({ title, lang, stage, trial, playing, onStage, onTrial, onAdd, onClose }: {
  title: string;
  lang: Lang;
  stage: Stage | null;
  /** The option heard alone right now, by id. */
  trial: string | null;
  playing: boolean;
  onStage: (s: Stage | null) => void;
  onTrial: (o: FxOption | null) => void;
  onAdd: (o: FxOption) => void;
  onClose?: () => void;
}) {
  return (
    <section className={`es-fxpick${stage ? ' open' : ''}`} aria-label={title} style={stage ? { ['--stage' as string]: STAGE_COLOR[stage] } : undefined}>
      <div className="row wrap es-fxpick-head">
        {stage
          ? <button type="button" className="btn small-btn ghost" onClick={() => onStage(null)}><Icon name="back" size={16} /> {t('esFxAllKinds', lang)}</button>
          : <span className="es-fxpick-plus" aria-hidden="true"><Icon name="plus" size={16} /></span>}
        {stage && <span className="es-fxkind-icon small" aria-hidden="true"><Icon name={STAGE_ICON[stage]} size={20} /></span>}
        <h3 className="grow display" style={{ fontSize: 18 }}>{stage ? stageName(stage, lang) : title}</h3>
        {onClose && <button type="button" className="btn icon ghost" onClick={onClose} aria-label={t('close', lang)} title={t('close', lang)}><Icon name="close" size={18} /></button>}
      </div>
      {!stage ? (
        <div className="es-fxkinds">
          {STAGES.map((st) => (
            <button key={st} type="button" className="es-fxkind" style={{ ['--stage' as string]: STAGE_COLOR[st] }} onClick={() => onStage(st)}>
              <span className="es-fxkind-icon" aria-hidden="true"><Icon name={STAGE_ICON[st]} size={26} /></span>
              <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                <strong>{stageName(st, lang)}</strong>
                <span className="small muted">{STAGE_HINT[st][lang]}</span>
              </span>
              <span className="es-fxkind-n">{optionsFor(st, lang).length}</span>
            </button>
          ))}
        </div>
      ) : (<>
        <p className="small muted" style={{ margin: 0 }}>{STAGE_HINT[stage][lang]} {t('esFxTryHint', lang)}</p>
        <div className="es-fxopts">
          {optionsFor(stage, lang).map((o) => {
            const on = trial === o.id && playing;
            return (
              <div key={o.id} className={`es-fxopt${trial === o.id ? ' on' : ''}`}>
                <button type="button" className={`ss-play${on ? ' on' : ''}`} onClick={() => onTrial(on ? null : o)}
                  aria-label={on ? t('stop', lang) : t('esFxHearAlone', lang, { name: o.title })} title={on ? t('stop', lang) : t('esFxHearAlone', lang, { name: o.title })}>
                  <Icon name={on ? 'stop' : 'play'} size={14} />
                </button>
                <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                  <strong>{o.title}</strong>
                  {o.blurb && <span className="small muted">{o.blurb}</span>}
                </span>
                <button type="button" className="btn small-btn primary" onClick={() => onAdd(o)}><Icon name="plus" size={16} /> {t('esFxAdd', lang)}</button>
              </div>
            );
          })}
        </div>
      </>)}
    </section>
  );
}

/** What each model of a unit sounds like, shown under its choice. */
const CHOICE_HINT: Record<string, { en: string; es: string }[]> = {
  'effect.preamp': [
    { en: 'Transparent: more level, no color.', es: 'Transparente: más nivel, sin color.' },
    { en: 'Rounds the sound and fattens the lows.', es: 'Redondea el sonido y engorda los graves.' },
    { en: 'Warm; it gets gritty when pushed.', es: 'Cálida; se ensucia cuando la empujas.' },
  ],
  'effect.comp-studio': [
    { en: 'Fast and punchy: grabs every hit.', es: 'Rápido y con golpe: agarra cada golpe.' },
    { en: 'Slow and smooth: evens out without being heard.', es: 'Lento y suave: empareja sin que se note.' },
    { en: 'Gentle: holds the parts together.', es: 'Suave: mantiene todo unido.' },
  ],
  'effect.amp': [
    { en: 'Clean and bright, no grit.', es: 'Limpio y brillante, sin suciedad.' },
    { en: 'Breaks up when you play hard.', es: 'Se ensucia cuando tocas fuerte.' },
    { en: 'Heavy distortion, for metal and walls of guitars.', es: 'Mucha distorsión, para metal y muros de guitarras.' },
    { en: 'Round and deep, made for the bass.', es: 'Redondo y profundo, hecho para el bajo.' },
  ],
  'effect.cab': [
    { en: 'Open back: airy, small room.', es: 'Abierto atrás: aireado, de sala chica.' },
    { en: 'Two speakers: balanced, rock and pop.', es: 'Dos parlantes: equilibrado, rock y pop.' },
    { en: 'Closed and big: tight lows, heavy rock.', es: 'Cerrado y grande: graves firmes, rock pesado.' },
    { en: 'Eight bass speakers: big and punchy.', es: 'Ocho parlantes de bajo: grande y con golpe.' },
    { en: 'One big speaker: deep and round.', es: 'Un parlante grande: profundo y redondo.' },
  ],
  'effect.tape': [
    { en: 'Slower tape: warmer, rounder lows.', es: 'Cinta más lenta: más cálida, graves redondos.' },
    { en: 'Faster tape: cleaner and brighter.', es: 'Cinta más rápida: más limpia y brillante.' },
  ],
};

/** Each model comes with its usual settings, so changing the model is heard and seen at once. */
const MODEL_PRESET: Record<string, Record<string, number>[]> = {
  'effect.preamp': [{ drive: 0.2, lowcut: 30 }, { drive: 0.4, lowcut: 40 }, { drive: 0.55, lowcut: 50 }],
  'effect.comp-studio': [{ amount: 0.5, mix: 1 }, { amount: 0.4, mix: 1 }, { amount: 0.3, mix: 1 }],
  'effect.amp': [
    { gain: 0.3, bass: 0, mid: 0, treble: 2, level: 0 },
    { gain: 0.55, bass: 1, mid: 2, treble: 1, level: -2 },
    { gain: 0.8, bass: 3, mid: -3, treble: 2, level: -4 },
    { gain: 0.3, bass: 3, mid: 0, treble: -2, level: 0 },
  ],
  'effect.cab': [{ mic: 0.3 }, { mic: 0.3 }, { mic: 0.35 }, { mic: 0.2 }, { mic: 0.2 }],
  'effect.tape': [{ drive: 0.45 }, { drive: 0.25 }],
};
export const modelPreset = (key: string, index: number): Record<string, number> => MODEL_PRESET[key]?.[index] ?? {};

/** A unit's knobs, laid out like a rack unit: model choices first, then the knobs. */
function ParamKnob({ p, value, lang, onChange }: { p: ParamDef; value: number; lang: Lang; onChange: (v: number) => void }) {
  const step = p.step ?? 0;
  const count = step ? Math.round((p.max - p.min) / step) : 0;
  const steps = step && count > 0 && count <= 24 ? Array.from({ length: count + 1 }, (_, i) => p.min + i * step) : undefined;
  return <Knob size={52} value={value} min={p.min} max={p.max} def={p.default} steps={steps} log={p.unit === 'Hz' && p.min > 0 && p.max / p.min > 20}
    label={p.label[lang]} display={formatParam(p, value)} onChange={onChange} />;
}

export type ListenMode = 'all' | 'upto' | 'without';

export function UnitEditor({ slot, index, count, original, listen, lang, onChange, onSwap, onToggle, onListen, onMove, onRestore }: {
  slot: FxSlot;
  index: number;
  count: number;
  /** The same unit in the sound as it comes, to put it back. */
  original?: FxSlot;
  listen: ListenMode;
  lang: Lang;
  onChange: (params: Record<string, number>) => void;
  onSwap: (key: string) => void;
  onToggle: () => void;
  onListen: (m: ListenMode) => void;
  onMove: (d: -1 | 1) => void;
  onRestore: () => void;
}) {
  const stage = stageOf(slot.effect.key);
  const params = effectParams(slot.effect);
  const choices = params.filter((p) => p.choices);
  const knobs = params.filter((p) => !p.choices);
  const others = EFFECTS.filter((e) => stageOf(e.key) === stage && e.key !== slot.effect.key);
  const same = !!original && original.bypass === slot.bypass && Object.keys({ ...original.params, ...slot.params }).every((k) => Math.abs((original.params[k] ?? 0) - (slot.params[k] ?? 0)) < 1e-6);
  const name = catalogTitle(slot.effect, lang);
  const hints = CHOICE_HINT[slot.effect.key];
  return (
    <section className="es-unit" style={{ ['--stage' as string]: STAGE_COLOR[stage] }} aria-label={name}>
      <div className="row wrap es-unit-head">
        <span className="cd-add-stage"><Icon name={STAGE_ICON[stage]} size={14} /> {stageName(stage, lang)}</span>
        <h3 className="grow display" style={{ fontSize: 20 }}>{name}</h3>
        <OnSwitch on={!slot.bypass} lang={lang} label={name} onToggle={onToggle} />
      </div>
      {PEDAL_BLURB[slot.effect.key] && <p className="small muted" style={{ margin: 0 }}>{PEDAL_BLURB[slot.effect.key][lang]}</p>}
      <div className="es-unit-body">
        {choices.map((p) => {
          const v = Math.round(slot.params[p.name] ?? p.default);
          return (
            <div key={p.name} className="stack es-choice" style={{ gap: 4 }}>
              <ChoiceParam p={p} value={v} lang={lang} onChange={(x) => onChange({ ...slot.params, [p.name]: x, ...modelPreset(slot.effect.key, Math.round(x)) })} />
              {hints?.[v] && <span className="small muted">{hints[v][lang]}</span>}
            </div>
          );
        })}
        {knobs.length > 0 && (
          <div className="es-knobs" role="group" aria-label={t('esKnobs', lang)}>
            {knobs.map((p) => <ParamKnob key={p.name} p={p} value={slot.params[p.name] ?? p.default} lang={lang} onChange={(v) => onChange({ ...slot.params, [p.name]: v })} />)}
          </div>
        )}
      </div>
      {choices.length > 0 && <p className="small muted" style={{ margin: 0 }}>{t('esModelHint', lang)}</p>}
      <div className="es-listenmode">
        <span className="lbl">{t('esHear', lang)}</span>
        <div className="seg small-seg" role="group" aria-label={t('esHear', lang)}>
          <button type="button" aria-pressed={listen === 'all'} onClick={() => onListen('all')}>{t('esHearAll', lang)}</button>
          <button type="button" aria-pressed={listen === 'upto'} onClick={() => onListen('upto')}>{t('esHearUpTo', lang)}</button>
          <button type="button" aria-pressed={listen === 'without'} onClick={() => onListen('without')}>{t('esHearWithout', lang)}</button>
        </div>
        <span className="small muted">{t(listen === 'all' ? 'esHearAllHint' : listen === 'upto' ? 'esHearUpToHint' : 'esHearWithoutHint', lang)}</span>
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        <button type="button" className="btn small-btn ghost" onClick={() => onMove(-1)} disabled={index === 0} title={t('esMoveHint', lang)}>← {t('esMoveEarlier', lang)}</button>
        <button type="button" className="btn small-btn ghost" onClick={() => onMove(1)} disabled={index === count - 1} title={t('esMoveHint', lang)}>{t('esMoveLater', lang)} →</button>
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
      </div>
    </section>
  );
}
