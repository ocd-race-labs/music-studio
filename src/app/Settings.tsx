import { useEffect, useState } from 'react';
import { exportSongFile, parseSongFile } from '../domain/files';
import { classroomOn, studentOf } from '../domain/factory';
import type { Hat, Lang, Level, Profile, Song, ThemePreset } from '../domain/types';
import { requestPersistence } from '../store/store';
import type { SongStore } from '../store/store';
import { INSTRUMENT_IDS, instrumentName, levelName, styleName, t, themeName, tn } from './i18n';
import { PREVIEW } from './prefs';
import type { Appearance, Mode } from './prefs';
import { Avatar, downloadText, Icon, pickFile, useToast } from './ui';

const THEMES: ThemePreset[] = ['midnight-jewel', 'graphite', 'daylight'];

const RINGS = ['#F0509E', '#2DD4BF', '#A78BFA', '#38BDF8', '#FBBF24', '#74747A', '#C2410C'];
const MUSICIAN_STYLES = ['Classical', 'Pop', 'Film score', 'Folk', 'Jazz', 'Rock', 'Cumbia', 'Reggaeton'];
const PRODUCER_STYLES = ['Hip hop', 'Lo-fi', 'Orchestral', 'Pop', 'Electronic', 'Reggaeton', 'R&B', 'Acoustic'];
const LEVELS: Level[] = ['starter', 'intermediate', 'advanced'];

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" aria-label={label}>
      {options.map((o) => <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>{o.l}</button>)}
    </div>
  );
}

export default function Settings({ store, profile, profiles, lang, onLang, appearance, mode, onAppearance, onStartOver, onSwitch, onSaved, onHome, onStudio }: {
  store: SongStore;
  profile: Profile;
  profiles: Profile[];
  lang: Lang;
  onLang: (l: Lang) => void;
  appearance: Appearance;
  mode: Mode;
  onAppearance: (a: Appearance) => void;
  onStartOver: () => void;
  onSwitch: (id: string) => void;
  onSaved: () => void;
  onHome: () => void;
  onStudio: () => void;
}) {
  const [p, setP] = useState<Profile>(profile);
  const [storage, setStorage] = useState<{ persisted: boolean; usage?: number; quota?: number } | null>(null);
  const [toast, showToast] = useToast();
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => setP(profile), [profile]);
  useEffect(() => { requestPersistence().then(setStorage).catch(() => setStorage({ persisted: false })); }, []);

  // Changes save automatically.
  const save = async (next: Profile) => {
    setP(next);
    await store.saveProfile(next);
    onSaved();
  };
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const changeLang = (l: Lang) => {
    onLang(l);
    save({ ...p, ui_lang: l });
  };

  const backup = async () => {
    const all: Song[] = [];
    for (const pr of profiles) all.push(...(await store.listSongs(pr.id)));
    downloadText(`music-studio-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ format: 'music-studio.backup', version: 1, created_at: new Date().toISOString(), profiles, songs: all.map((s) => JSON.parse(exportSongFile(s))) }, null, 2));
    showToast(tn('backedUpOne', 'backedUpMany', all.length, lang));
  };

  const restore = async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as { format?: string; profiles?: Profile[]; songs?: unknown[] };
      if (data.format !== 'music-studio.backup') throw new Error(t('notABackup', lang));
      for (const pr of data.profiles ?? []) await store.saveProfile(pr);
      let n = 0;
      for (const s of data.songs ?? []) {
        const parsed = parseSongFile(JSON.stringify(s));
        if (parsed.ok) { await store.saveSong(parsed.value); n++; }
      }
      onSaved();
      showToast(tn('restoredOne', 'restoredMany', n, lang));
    } catch (e) {
      showToast(String((e as Error).message));
    }
  };

  const mb = (b?: number) => (b === undefined ? '?' : `${(b / 1024 / 1024).toFixed(1)} MB`);

  return (
    <main className="home" style={{ gap: 24 }}>
      <header className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div className="row wrap" style={{ gap: 12 }}>
          <button type="button" className="btn" onClick={onHome}><Icon name="home" size={18} /> {t('home', lang)}</button>
          <h1 className="display" style={{ fontSize: 30 }}>{t('settings', lang)}</h1>
        </div>
        <div className="seg" aria-label={t('profile', lang)}>
          {profiles.map((pr) => <button key={pr.id} type="button" aria-pressed={pr.id === p.id} onClick={() => onSwitch(pr.id)}>{pr.name}</button>)}
        </div>
        <button type="button" className="btn primary" onClick={onStudio}>{t('openStudio', lang)} <Icon name="arrow" size={18} /></button>
      </header>

      <div className="cards" style={{ alignItems: 'flex-start' }}>
        <section className="card stack" style={{ flex: '1 1 300px', maxWidth: 400 }} aria-label={t('avatar', lang)}>
          <h2 style={{ fontSize: 18 }}>{t('avatar', lang)}</h2>
          <div className="row" style={{ justifyContent: 'center', padding: 10 }}><Avatar profile={p} size={110} /></div>
          <label className="stack" style={{ gap: 4 }}>
            <span className="lbl">{t('displayName', lang)}</span>
            <input className="field" value={p.name} maxLength={40} onChange={(e) => setP({ ...p, name: e.target.value })} onBlur={() => p.name.trim() && save({ ...p, name: p.name.trim() })} />
          </label>
          <span className="lbl">{t('ringColor', lang)}</span>
          <div className="row wrap">
            {RINGS.map((c) => (
              <button key={c} type="button" aria-label={t('ringN', lang, { color: c })} aria-pressed={p.avatar.ring === c} onClick={() => save({ ...p, avatar: { ...p.avatar, ring: c } })}
                style={{ width: 44, height: 44, borderRadius: 999, background: c, border: p.avatar.ring === c ? '3px solid var(--ink)' : '3px solid transparent' }} />
            ))}
          </div>
          <span className="lbl">{t('instrumentsIPlay', lang)}</span>
          <div className="row wrap" style={{ gap: 6 }}>
            {INSTRUMENT_IDS.map((id) => (
              <button key={id} type="button" className="chip" aria-pressed={p.instruments.includes(id)}
                onClick={() => save({ ...p, instruments: toggle(p.instruments, id) })}>{instrumentName(id, lang)}</button>
            ))}
          </div>
        </section>

        <div className="stack" style={{ flex: '2 1 560px', minWidth: 0, gap: 20 }}>
          <section className="card stack" aria-label={t('colorTheme', lang)}>
            <h2 style={{ fontSize: 18 }}>{t('colorTheme', lang)}</h2>
            <div className="stack" style={{ gap: 6 }}>
              <span className="lbl">{t('appearance', lang)}</span>
              <Seg<Appearance> label={t('appearance', lang)} value={appearance} onChange={onAppearance}
                options={[{ v: 'auto', l: t('appearanceAuto', lang) }, { v: 'light', l: t('appearanceLight', lang) }, { v: 'dark', l: t('appearanceDark', lang) }]} />
              <span className="small muted">{t('appearanceHint', lang)}</span>
            </div>
            <div className="cards" style={{ gap: 12 }}>
              {THEMES.map((id) => {
                const c = PREVIEW[id][mode];
                return (
                  <button key={id} type="button" className="chip" aria-pressed={p.theme.preset === id}
                    onClick={() => save({ ...p, theme: { preset: id, base: mode } })}
                    style={{ flex: '1 1 150px', flexDirection: 'column', alignItems: 'stretch', padding: 10, borderRadius: 14, minHeight: 0 }}>
                    <span style={{ display: 'flex', gap: 4, padding: 8, borderRadius: 8, background: c.ground }} aria-hidden="true">
                      {[c.bars[0][0], c.bars[1][0], c.bars[2][0], c.bars[2][1]].map((b, i) => <span key={i} style={{ flex: 1, height: 10, borderRadius: 3, background: b }} />)}
                    </span>
                    <strong style={{ textAlign: 'left' }}>{themeName(id, lang)}</strong>
                  </button>
                );
              })}
            </div>
            <p className="small muted" style={{ margin: 0 }}>{t('themeReadable', lang)}</p>
          </section>

          <section className="card stack" aria-label={t('stylePrefs', lang)}>
            <h2 style={{ fontSize: 18 }}>{t('stylePrefs', lang)}</h2>
            <div className="cards" style={{ gap: 14 }}>
              {(['musician', 'producer'] as const).map((lane) => {
                const styles = lane === 'musician' ? MUSICIAN_STYLES : PRODUCER_STYLES;
                const picked = lane === 'musician' ? p.musician_styles : p.producer_styles;
                const level = lane === 'musician' ? p.musician_level : p.producer_level;
                return (
                  <div key={lane} className="stack" style={{ flex: '1 1 260px', padding: 12, borderRadius: 12, background: 'var(--raised)' }}>
                    <strong>{t(lane, lang)}</strong>
                    <div className="row wrap" style={{ gap: 6 }}>
                      {styles.map((s) => (
                        <button key={s} type="button" className="chip" aria-pressed={picked.includes(s)}
                          onClick={() => save(lane === 'musician' ? { ...p, musician_styles: toggle(p.musician_styles, s) } : { ...p, producer_styles: toggle(p.producer_styles, s) })}>{styleName(s, lang)}</button>
                      ))}
                    </div>
                    <span className="lbl">{t('level', lang)}</span>
                    <Seg label={`${t(lane, lang)}: ${t('level', lang)}`} value={level} options={LEVELS.map((l) => ({ v: l, l: levelName(l, lang) }))}
                      onChange={(v) => save(lane === 'musician' ? { ...p, musician_level: v } : { ...p, producer_level: v })} />
                  </div>
                );
              })}
            </div>
            <div className="row wrap" style={{ gap: 20 }}>
              <div className="stack" style={{ gap: 6 }}><span className="lbl">{t('startIn', lang)}</span>
                <Seg<Hat> label={t('startIn', lang)} value={p.default_hat} options={[{ v: 'musician', l: t('musicianHat', lang) }, { v: 'producer', l: t('producerHat', lang) }]} onChange={(v) => save({ ...p, default_hat: v })} /></div>
              <div className="stack" style={{ gap: 6 }}><span className="lbl">{t('lyricsLanguage', lang)}</span>
                <Seg<Lang> label={t('lyricsLanguage', lang)} value={p.lyrics_lang} options={[{ v: 'es', l: 'Español' }, { v: 'en', l: 'English' }]} onChange={(v) => save({ ...p, lyrics_lang: v })} /></div>
              <div className="stack" style={{ gap: 6 }}><span className="lbl">{t('appLanguage', lang)}</span>
                <Seg<Lang> label={t('appLanguage', lang)} value={lang} options={[{ v: 'en', l: 'English' }, { v: 'es', l: 'Español' }]} onChange={changeLang} />
                <span className="small muted">{t('appLanguageHint', lang)}</span></div>
            </div>
          </section>

          <section className="card stack" aria-label="Music Studio Classroom">
            <h2 style={{ fontSize: 18 }} className="row"><Icon name="classroom" /> Music Studio Classroom</h2>
            <p className="small muted" style={{ margin: 0 }}>{t('clSettingHint', lang)}</p>
            <div className="stack" style={{ gap: 6 }}><span className="lbl">{t('clShow', lang)}</span>
              <Seg<'on' | 'off'> label={t('clShow', lang)} value={classroomOn(p) ? 'on' : 'off'} options={[{ v: 'on', l: t('yes', lang) }, { v: 'off', l: t('no', lang) }]}
                onChange={(v) => save({ ...p, classroom: v === 'on' })} /></div>
            {classroomOn(p) && (
              <div className="stack" style={{ gap: 6 }}><span className="lbl">{t('clStudent', lang)}</span>
                <Seg<'f' | 'm'> label={t('clStudent', lang)} value={studentOf(p)} options={[{ v: 'f', l: t('clStudentF', lang) }, { v: 'm', l: t('clStudentM', lang) }]}
                  onChange={(v) => save({ ...p, student: v })} />
                <span className="small muted">{t('clStudentHint', lang)}</span></div>
            )}
          </section>

          <section className="card stack" aria-label={t('storageBackup', lang)}>
            <h2 style={{ fontSize: 18 }}>{t('storageBackup', lang)}</h2>
            <p style={{ margin: 0 }}>
              {storage?.persisted
                ? <span className="ok">{t('storageKept', lang)}</span>
                : <span className="warn">{t('storageMayClear', lang)}</span>}
            </p>
            <p className="small muted" style={{ margin: 0 }}>{t('storageUsing', lang, { used: mb(storage?.usage), quota: mb(storage?.quota) })}</p>
            <div className="row wrap">
              <button type="button" className="btn" onClick={backup}><Icon name="download" size={18} /> {t('backupAll', lang)}</button>
              <button type="button" className="btn ghost" onClick={restore}><Icon name="upload" size={18} /> {t('restoreBackup', lang)}</button>
            </div>
            <div className="stack" style={{ gap: 8, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
              {!confirmReset ? (
                <>
                  <button type="button" className="btn ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmReset(true)}>{t('startOver', lang)}</button>
                  <span className="small muted">{t('startOverHint', lang)}</span>
                </>
              ) : (
                <>
                  <span className="warn small" role="alert">{t('startOverAsk', lang, { n: profiles.length })}</span>
                  <div className="row wrap">
                    <button type="button" className="btn danger" onClick={onStartOver}>{t('startOverYes', lang)}</button>
                    <button type="button" className="btn" onClick={() => setConfirmReset(false)}>{t('cancel', lang)}</button>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
