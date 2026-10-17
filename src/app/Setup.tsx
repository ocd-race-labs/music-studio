import { useState } from 'react';
import type { ThemePreset } from '../domain/types';

export interface Person {
  name: string;
  preset: ThemePreset;
  ring: string;
}

const THEMES: { id: ThemePreset; name: string; colors: string[] }[] = [
  { id: 'graphite', name: 'Graphite', colors: ['#0E0E0F', '#55555B', '#F2F2F2'] },
  { id: 'midnight-jewel', name: 'Midnight jewel', colors: ['#120F1F', '#2DD4BF', '#F0509E', '#A78BFA'] },
  { id: 'daylight', name: 'Daylight', colors: ['#F3F4F6', '#C2410C', '#AEB3BC'] },
];

const RING: Record<ThemePreset, string> = { graphite: '#74747A', 'midnight-jewel': '#F0509E', daylight: '#C2410C' };

/** First run: the family's profiles are created here and stored only on this device. */
export default function Setup({ onDone }: { onDone: (people: Person[]) => void }) {
  const [people, setPeople] = useState<Person[]>([
    { name: '', preset: 'graphite', ring: RING.graphite },
    { name: '', preset: 'midnight-jewel', ring: RING['midnight-jewel'] },
  ]);
  const ready = people.some((p) => p.name.trim());

  const update = (i: number, patch: Partial<Person>) =>
    setPeople((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch, ring: patch.preset ? RING[patch.preset] : p.ring } : p)));

  return (
    <main className="home">
      <header className="stack" style={{ maxWidth: 680 }}>
        <h1 className="display" style={{ fontSize: 44, lineHeight: 1.05 }}>Set up your family studio</h1>
        <p className="muted" style={{ fontSize: 17 }}>
          Add the people who'll make music here. Names and songs stay in this browser; nothing is sent anywhere.
        </p>
      </header>
      <div className="cards">
        {people.map((p, i) => (
          <section key={i} className="card stack" style={{ flex: '1 1 300px' }} aria-label={`Person ${i + 1}`}>
            <label className="lbl" htmlFor={`name-${i}`}>Person {i + 1}{i === 1 ? ' (optional)' : ''}</label>
            <input id={`name-${i}`} className="field" value={p.name} maxLength={40} placeholder="Name" onChange={(e) => update(i, { name: e.target.value })} />
            <span className="lbl">Theme</span>
            <div className="stack" style={{ gap: 8 }}>
              {THEMES.map((th) => (
                <button key={th.id} type="button" className="chip" aria-pressed={p.preset === th.id} onClick={() => update(i, { preset: th.id })} style={{ justifyContent: 'space-between', minHeight: 44 }}>
                  <span>{th.name}</span>
                  <span className="row" style={{ gap: 4 }} aria-hidden="true">
                    {th.colors.map((c) => <span key={c} className="swatch" style={{ background: c, border: '1px solid var(--line)' }} />)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn primary" disabled={!ready} onClick={() => onDone(people.filter((p) => p.name.trim()).map((p) => ({ ...p, name: p.name.trim() })))}>
          Create profiles
        </button>
        <span className="muted small">You can change names, themes and avatars later in profile settings.</span>
      </div>
    </main>
  );
}
