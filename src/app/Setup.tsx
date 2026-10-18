import { useState } from 'react';
import type { Lang, ThemePreset } from '../domain/types';
import { INSTRUMENT_IDS, instrumentName, t, themeName } from './i18n';
import type { Mode } from './prefs';
import { LangSwitch, ModeSwitch } from './ui';

export interface Person {
  name: string;
  preset: ThemePreset;
  ring: string;
  instruments: string[];
}

/* Swatches show each palette's character; the studio then uses its light or dark version. */
const THEMES: { id: ThemePreset; colors: string[] }[] = [
  { id: 'midnight-jewel', colors: ['#120F1F', '#2DD4BF', '#F0509E', '#A78BFA'] },
  { id: 'graphite', colors: ['#0E0E0F', '#55555B', '#F2F2F2'] },
  { id: 'daylight', colors: ['#F3F4F6', '#C2410C', '#AEB3BC'] },
];

const RING: Record<ThemePreset, string> = { graphite: '#74747A', 'midnight-jewel': '#F0509E', daylight: '#C2410C' };

/* The two people from the mockups, in home order: the young musician first, then the producer.
   Only the look and instruments are preset; names are typed here and stay on this device. */
const PRESETS: Person[] = [
  { name: '', preset: 'midnight-jewel', ring: RING['midnight-jewel'], instruments: ['violin', 'beats', 'lyrics'] },
  { name: '', preset: 'graphite', ring: RING.graphite, instruments: ['drums', 'guitar'] },
];

/** First run: the family's profiles are created here and stored only on this device. */
export default function Setup({ lang, onLang, mode, onToggleMode, onDone }: {
  lang: Lang;
  onLang: (l: Lang) => void;
  mode: Mode;
  onToggleMode: () => void;
  onDone: (people: Person[]) => void;
}) {
  const [people, setPeople] = useState<Person[]>(PRESETS);
  const ready = people.some((p) => p.name.trim());

  const update = (i: number, patch: Partial<Person>) =>
    setPeople((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch, ring: patch.preset ? RING[patch.preset] : p.ring } : p)));
  const toggleInstrument = (i: number, id: string) =>
    update(i, { instruments: people[i].instruments.includes(id) ? people[i].instruments.filter((x) => x !== id) : [...people[i].instruments, id] });

  return (
    <main className="home">
      <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
        <LangSwitch lang={lang} onLang={onLang} />
        <ModeSwitch mode={mode} onToggle={onToggleMode} lang={lang} />
      </div>
      <header className="stack" style={{ maxWidth: 680 }}>
        <h1 className="display" style={{ fontSize: 'clamp(32px, 6vw, 44px)', lineHeight: 1.05 }}>{t('setupTitle', lang)}</h1>
        <p className="muted" style={{ fontSize: 17 }}>{t('setupBody', lang)}</p>
      </header>
      <div className="cards">
        {people.map((p, i) => (
          <section key={i} className="card stack" style={{ flex: '1 1 300px' }} aria-label={t('personN', lang, { n: i + 1 })}>
            <label className="lbl" htmlFor={`name-${i}`}>{t('personN', lang, { n: i + 1 })}{i === 1 ? ` ${t('optional', lang)}` : ''}</label>
            <input id={`name-${i}`} className="field" value={p.name} maxLength={40} placeholder={t('name', lang)} onChange={(e) => update(i, { name: e.target.value })} />
            <span className="lbl">{t('theme', lang)}</span>
            <div className="stack" style={{ gap: 8 }}>
              {THEMES.map((th) => (
                <button key={th.id} type="button" className="chip" aria-pressed={p.preset === th.id} onClick={() => update(i, { preset: th.id })} style={{ justifyContent: 'space-between', minHeight: 44 }}>
                  <span>{themeName(th.id, lang)}</span>
                  <span className="row" style={{ gap: 4 }} aria-hidden="true">
                    {th.colors.map((c) => <span key={c} className="swatch" style={{ background: c, border: '1px solid var(--line)' }} />)}
                  </span>
                </button>
              ))}
            </div>
            <span className="lbl">{t('iPlay', lang)}</span>
            <div className="row wrap" style={{ gap: 6 }}>
              {INSTRUMENT_IDS.map((id) => (
                <button key={id} type="button" className="chip" aria-pressed={p.instruments.includes(id)} onClick={() => toggleInstrument(i, id)}>{instrumentName(id, lang)}</button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="row wrap">
        <button type="button" className="btn primary" disabled={!ready} onClick={() => onDone(people.filter((p) => p.name.trim()).map((p) => ({ ...p, name: p.name.trim() })))}>
          {t('createProfiles', lang)}
        </button>
        <span className="muted small">{t('setupLater', lang)}</span>
      </div>
    </main>
  );
}
