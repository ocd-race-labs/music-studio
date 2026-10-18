import { useEffect, useMemo, useRef, useState } from 'react';
import { buildBeat, entriesOf, parseRequest, planFor, tempoRange } from '../domain/beat';
import type { BeatPlan, Parsed } from '../domain/beat';
import { ENTRIES, entryOf, GENRES, GROUPS } from '../packs/collection';
import { findByKey, title as catalogTitle } from '../packs/core';
import { engine } from '../engine/engine';
import type { Lang, Song } from '../domain/types';
import { t } from './i18n';
import { Icon, Modal } from './ui';
import { templateFor } from './rack';

const EXAMPLES: { en: string; es: string }[] = [
  { en: 'Slow, dark acid jazz chill out', es: 'Acid jazz chill out, lento y oscuro' },
  { en: '90s boom bap with dusty piano', es: 'Boom bap noventero con piano polvoriento' },
  { en: 'Happy house to dance', es: 'House alegre para bailar' },
  { en: 'Fast punk', es: 'Punk rápido' },
  { en: 'Lo-fi to study', es: 'Lo-fi para estudiar' },
  { en: 'Dark trap at 140', es: 'Trap oscuro a 140' },
];

const groupTitle = (id: string, lang: Lang) => GROUPS.find((g) => g.id === id)?.title[lang] ?? id;
const nameOf = (key: string | null, lang: Lang) => (key ? entryOf(key)?.title[lang] ?? catalogTitle({ key, version: '1.0.0' }, lang) : '');

/** Sounds offered for a role: the style's own first, then the rest of the Colección for that family. */
function optionsFor(group: string, family: 'drums' | 'bass' | 'chords', extra: string[] = []): string[] {
  const fam = family === 'chords' ? (['synth', 'guitar'] as const) : ([family] as const);
  const own = fam.flatMap((f) => entriesOf(group, f)).map((e) => e.instrument);
  const rest = ENTRIES.filter((e) => (fam as readonly string[]).includes(e.family) && !own.includes(e.instrument)).map((e) => e.instrument);
  return [...new Set([...own, ...extra.filter((k) => findByKey(k)), ...rest])];
}

export default function BeatAssistant({ lang, owner, onCreate, onClose }: {
  lang: Lang;
  owner: string;
  onCreate: (song: Song) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [plan, setPlan] = useState<BeatPlan | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => { engine.stopPreview(); window.clearTimeout(timer.current); }, []);

  const understand = (value = text) => {
    const p = parseRequest(value);
    setParsed(p);
    setPlan(p.styles.length ? planFor(p) : null);
  };
  const pickStyle = (group: string) => parsed && setPlan(planFor(parsed, group));
  const set = (patch: Partial<BeatPlan>) => plan && setPlan({ ...plan, ...patch });

  const listen = async (key: string | null) => {
    window.clearTimeout(timer.current);
    if (!key) return;
    if (playing === key) { engine.stopPreview(); setPlaying(null); return; }
    const e = templateFor(key);
    if (!e) return;
    setPlaying(key);
    const secs = await engine.previewGroove(key, e.groove, plan?.tempo ?? e.tempo, undefined, 1, e.phrase);
    timer.current = window.setTimeout(() => setPlaying((p) => (p === key ? null : p)), Math.max(0.5, secs) * 1000);
  };

  const summary = useMemo(() => {
    if (!parsed || !plan) return '';
    const bits = [groupTitle(plan.group, lang)];
    if (parsed.pace) bits.push(t(parsed.pace === 'slow' ? 'beatSlow' : 'beatFast', lang));
    if (parsed.mood) bits.push(t(parsed.mood === 'dark' ? 'beatDark' : 'beatBright', lang));
    if (parsed.tempo) bits.push(`${parsed.tempo} BPM`);
    if (parsed.swing !== undefined) bits.push(t(parsed.swing ? 'beatSwing' : 'beatStraight', lang));
    for (const w of parsed.wants) bits.push(t(`want_${w}` as 'want_piano', lang));
    return bits.join(' · ');
  }, [parsed, plan, lang]);

  const [lo, hi] = plan ? tempoRange(plan.group) : [60, 180];
  const roleRow = (label: string, value: string | null, options: string[], onPick: (v: string | null) => void, allowNone: boolean) => (
    <div className="ba-role">
      <span className="lbl">{label}</span>
      <div className="row" style={{ gap: 6 }}>
        <select className="field grow" value={value ?? ''} onChange={(e) => onPick(e.target.value || null)} aria-label={label}>
          {allowNone && <option value="">{t('beatNone', lang)}</option>}
          {options.map((k) => <option key={k} value={k}>{nameOf(k, lang)}{entryOf(k) && entryOf(k)!.group !== plan?.group ? ` · ${groupTitle(entryOf(k)!.group, lang)}` : ''}</option>)}
        </select>
        <button type="button" className={`btn icon${playing === value && value ? ' primary' : ''}`} disabled={!value} onClick={() => listen(value)}
          aria-label={playing === value ? t('stop', lang) : t('listenTo', lang, { name: nameOf(value, lang) })}>
          <Icon name={playing === value && value ? 'stop' : 'play'} size={18} />
        </button>
      </div>
    </div>
  );

  return (
    <Modal title={t('beatTitle', lang)} closeLabel={t('close', lang)} onClose={onClose}>
      <p className="muted small" style={{ margin: 0 }}>{t('beatIntro', lang)}</p>
      <label className="stack" style={{ gap: 4 }}>
        <span className="lbl">{t('beatAsk', lang)}</span>
        <textarea className="field ba-text" rows={2} maxLength={200} value={text} placeholder={t('beatPlaceholder', lang)}
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); understand(); } }} />
      </label>
      <div className="row wrap" style={{ gap: 6 }}>
        {EXAMPLES.map((x) => (
          <button key={x.en} type="button" className="chip" onClick={() => { setText(x[lang]); understand(x[lang]); }}>{x[lang]}</button>
        ))}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn primary" disabled={!text.trim()} onClick={() => understand()}>{t('beatUnderstand', lang)}</button>
      </div>

      {parsed && (
        <section className="stack ba-plan" aria-live="polite">
          {plan ? (
            <p className="ba-understood"><Icon name="check" size={18} /> {t('beatUnderstood', lang)} <strong>{summary}</strong></p>
          ) : (
            <p className="ba-understood">{t('beatNoStyle', lang)}</p>
          )}
          <div className="stack" style={{ gap: 6 }}>
            <span className="lbl">{t('beatStyleQ', lang)}</span>
            <div className="row wrap" style={{ gap: 6 }}>
              {parsed.styles.slice(0, 3).map((s) => (
                <button key={s.group} type="button" className="chip" aria-pressed={plan?.group === s.group} onClick={() => pickStyle(s.group)}>{groupTitle(s.group, lang)}</button>
              ))}
              <select className="field" value={plan?.group ?? ''} onChange={(e) => pickStyle(e.target.value)} aria-label={t('beatOtherStyle', lang)}>
                <option value="" disabled>{t('beatOtherStyle', lang)}</option>
                {GENRES.map((g) => (
                  <optgroup key={g.id} label={g.title[lang]}>
                    {GROUPS.filter((x) => x.genre === g.id).map((x) => <option key={x.id} value={x.id}>{x.title[lang]}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {plan && (
            <>
              <label className="stack" style={{ gap: 2 }}>
                <span className="lbl">{t('beatTempoQ', lang)} <span className="mono">{plan.tempo} BPM</span> <span className="muted small">· {t('beatTempoUsual', lang, { lo, hi })}</span></span>
                <input type="range" min={Math.max(50, lo - 30)} max={Math.min(220, hi + 30)} value={plan.tempo} onChange={(e) => set({ tempo: Number(e.target.value) })} />
              </label>
              <div className="row wrap" style={{ gap: 16 }}>
                <div className="stack" style={{ gap: 4 }}>
                  <span className="lbl">{t('beatFeelQ', lang)}</span>
                  <div className="seg">
                    <button type="button" aria-pressed={plan.swing === 0} onClick={() => set({ swing: 0 })}>{t('beatStraight', lang)}</button>
                    <button type="button" aria-pressed={plan.swing > 0} onClick={() => set({ swing: plan.swing || 0.3 })}>{t('beatSwing', lang)}</button>
                  </div>
                </div>
                <div className="stack" style={{ gap: 4 }}>
                  <span className="lbl">{t('beatMoodQ', lang)}</span>
                  <div className="seg">
                    <button type="button" aria-pressed={plan.mode === 'minor'} onClick={() => set({ mode: 'minor' })}>{t('beatDarkMinor', lang)}</button>
                    <button type="button" aria-pressed={plan.mode === 'major'} onClick={() => set({ mode: 'major' })}>{t('beatBrightMajor', lang)}</button>
                  </div>
                </div>
                <div className="stack" style={{ gap: 4 }}>
                  <span className="lbl">{t('beatLengthQ', lang)}</span>
                  <div className="seg">
                    {[4, 8, 16].map((n) => <button key={n} type="button" aria-pressed={plan.bars === n} onClick={() => set({ bars: n })}>{n}</button>)}
                  </div>
                </div>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                <span className="lbl">{t('beatInstrumentsQ', lang)}</span>
                {roleRow(t('beatDrums', lang), plan.drums, optionsFor(plan.group, 'drums'), (v) => v && set({ drums: v }), false)}
                {roleRow(t('beatBass', lang), plan.bass, optionsFor(plan.group, 'bass'), (v) => set({ bass: v }), true)}
                {roleRow(t('beatChords', lang), plan.chords, optionsFor(plan.group, 'chords', ['instrument.keys-ep', 'instrument.keys-piano', 'instrument.strings-ensemble']), (v) => set({ chords: v }), true)}
              </div>
              <div className="row wrap" style={{ justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn ghost" onClick={onClose}>{t('cancel', lang)}</button>
                <button type="button" className="btn primary" onClick={() => { engine.stopPreview(); onCreate(buildBeat(plan, owner, lang, t('beatSongTitle', lang, { style: groupTitle(plan.group, lang) }))); }}>
                  <Icon name="music" size={18} /> {t('beatCreate', lang)}
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </Modal>
  );
}
