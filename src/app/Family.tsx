// A private family link prepares a device in one tap: #familia=Name1,Name2 creates the profiles from the
// mockups in that order. Names travel only in the part of the link after #, which browsers never send to the
// server, so they stay out of the public code and off the web.

import type { Hat, Lang, Profile } from '../domain/types';
import { newProfile } from '../domain/factory';
import type { SongStore } from '../store/store';
import { instrumentsLine, t, themeName } from './i18n';
import { PRESETS } from './Setup';
import { Avatar } from './ui';
import { PREVIEW } from './prefs';
import type { Mode } from './prefs';

const LINK = /^#(?:familia|family)=(.+)$/i;

/** Names from a family link, or null when the address has none. */
export function familyFromHash(hash: string): string[] | null {
  const m = LINK.exec(hash);
  if (!m) return null;
  let raw = m[1];
  try { raw = decodeURIComponent(raw); } catch { /* keep it as typed */ }
  const names = raw.split(',').map((n) => n.trim().slice(0, 40)).filter(Boolean).slice(0, 4);
  return names.length ? names : null;
}

/** The profile each name gets: the mockup look by position, Daylight after the second person. */
function planned(name: string, i: number, lang: Lang): Profile {
  const preset = PRESETS[i] ?? { preset: 'daylight' as const, ring: '#C2410C', instruments: [] };
  return { ...newProfile(name, preset.preset, preset.ring, (preset as { hat?: Hat }).hat), ui_lang: lang, instruments: preset.instruments, order: i };
}

const same = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/**
 * Put the family's profiles on this device, in the link's order. A person already here keeps everything,
 * songs included; only the place on the home screen changes. Other profiles leave the home screen when asked
 * (archived: their songs stay on the device).
 */
export async function applyFamily(store: SongStore, names: string[], lang: Lang, hideOthers: boolean): Promise<void> {
  const current = await store.listProfiles();
  for (const [i, name] of names.entries()) {
    const found = current.find((p) => same(p.name, name));
    await store.saveProfile(found ? { ...found, order: i } : planned(name, i, lang));
  }
  const others = current.filter((p) => !names.some((n) => same(n, p.name)));
  for (const [j, p] of others.entries()) {
    await store.saveProfile(hideOthers ? { ...p, status: 'archived' } : { ...p, order: names.length + j });
  }
}

export default function Family({ names, profiles, lang, mode, onApply, onCancel }: {
  names: string[];
  mode: Mode;
  profiles: Profile[];
  lang: Lang;
  onApply: (hideOthers: boolean) => void;
  onCancel: () => void;
}) {
  const others = profiles.filter((p) => !names.some((n) => same(n, p.name)));
  const othersLine = others.map((p) => p.name).join(', ');
  return (
    <main className="home">
      <header className="stack" style={{ maxWidth: 680 }}>
        <h1 className="display" style={{ fontSize: 'clamp(32px, 6vw, 44px)', lineHeight: 1.05 }}>{t('familyTitle', lang)}</h1>
        <p className="muted" style={{ fontSize: 17 }}>{t('familyBody', lang)}</p>
      </header>
      <div className="cards">
        {names.map((name, i) => {
          const here = profiles.find((p) => same(p.name, name));
          const p = here ?? planned(name, i, lang);
          return (
            <section key={name} className="card row" style={{ flex: '1 1 280px', gap: 14 }} aria-label={name}>
              <Avatar profile={p} size={48} colors={{ bg: PREVIEW[p.theme.preset][mode].main, fg: PREVIEW[p.theme.preset][mode].mainInk }} />
              <span className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                <strong style={{ fontSize: 18 }}>{p.name}</strong>
                <span className="small muted">{themeName(p.theme.preset, lang)} · {t(p.default_hat, lang)}</span>
                {p.instruments.length > 0 && <span className="small">{instrumentsLine(p.instruments, lang)}</span>}
                <span className="small muted">{t(here ? 'familyHere' : 'familyNew', lang)}</span>
              </span>
            </section>
          );
        })}
      </div>
      {others.length > 0 && <p className="muted" style={{ margin: 0 }}>{t('familyOthers', lang, { names: othersLine })}</p>}
      <div className="row wrap">
        <button type="button" className="btn primary" onClick={() => onApply(true)}>{t('familyGo', lang)}</button>
        {others.length > 0 && <button type="button" className="btn" onClick={() => onApply(false)}>{t('familyKeep', lang, { names: othersLine })}</button>}
        <button type="button" className="btn ghost" onClick={onCancel}>{t('cancel', lang)}</button>
      </div>
    </main>
  );
}
