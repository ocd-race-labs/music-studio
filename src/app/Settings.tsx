import { useEffect, useState } from 'react';
import { exportSongFile } from '../domain/files';
import type { Hat, Lang, Level, Profile, Song, ThemePreset } from '../domain/types';
import { requestPersistence } from '../store/store';
import type { SongStore } from '../store/store';
import { Avatar, downloadText, Icon, pickFile, useToast } from './ui';
import { parseSongFile } from '../domain/files';

const THEMES: { id: ThemePreset; name: string; ground: string; bars: string[] }[] = [
  { id: 'midnight-jewel', name: 'Midnight jewel', ground: '#1A1630', bars: ['#2DD4BF', '#A78BFA', '#F0509E', '#38BDF8'] },
  { id: 'graphite', name: 'Graphite', ground: '#161617', bars: ['#55555B', '#3A3A3E', '#F2F2F2', '#74747A'] },
  { id: 'daylight', name: 'Daylight', ground: '#F3F4F6', bars: ['#C9CDD4', '#C2410C', '#AEB3BC', '#C9CDD4'] },
];

const RINGS = ['#F0509E', '#2DD4BF', '#A78BFA', '#38BDF8', '#FBBF24', '#74747A', '#C2410C'];
const MUSICIAN_STYLES = ['Classical', 'Pop', 'Film score', 'Folk', 'Jazz', 'Rock', 'Cumbia', 'Reggaeton'];
const PRODUCER_STYLES = ['Hip hop', 'Lo-fi', 'Orchestral', 'Pop', 'Electronic', 'Reggaeton', 'R&B', 'Acoustic'];
const LEVELS: Level[] = ['starter', 'intermediate', 'advanced'];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" aria-label={label}>
      {options.map((o) => <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>{o.l}</button>)}
    </div>
  );
}

export default function Settings({ store, profile, profiles, onSwitch, onSaved, onHome, onStudio }: {
  store: SongStore;
  profile: Profile;
  profiles: Profile[];
  onSwitch: (id: string) => void;
  onSaved: () => void;
  onHome: () => void;
  onStudio: () => void;
}) {
  const [p, setP] = useState<Profile>(profile);
  const [storage, setStorage] = useState<{ persisted: boolean; usage?: number; quota?: number } | null>(null);
  const [toast, showToast] = useToast();

  useEffect(() => setP(profile), [profile]);
  useEffect(() => { requestPersistence().then(setStorage).catch(() => setStorage({ persisted: false })); }, []);

  // Changes save automatically.
  const save = async (next: Profile) => {
    setP(next);
    await store.saveProfile(next);
    onSaved();
  };
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const backup = async () => {
    const all: Song[] = [];
    for (const pr of profiles) all.push(...(await store.listSongs(pr.id)));
    downloadText(`music-studio-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ format: 'music-studio.backup', version: 1, created_at: new Date().toISOString(), profiles, songs: all.map((s) => JSON.parse(exportSongFile(s))) }, null, 2));
    showToast(`Backed up ${all.length} song${all.length === 1 ? '' : 's'}`);
  };

  const restore = async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as { format?: string; profiles?: Profile[]; songs?: unknown[] };
      if (data.format !== 'music-studio.backup') throw new Error('Not a Music Studio backup');
      for (const pr of data.profiles ?? []) await store.saveProfile(pr);
      let n = 0;
      for (const s of data.songs ?? []) {
        const parsed = parseSongFile(JSON.stringify(s));
        if (parsed.ok) { await store.saveSong(parsed.value); n++; }
      }
      onSaved();
      showToast(`Restored ${n} song${n === 1 ? '' : 's'}`);
    } catch (e) {
      showToast(String((e as Error).message));
    }
  };

  const mb = (b?: number) => (b === undefined ? '?' : `${(b / 1024 / 1024).toFixed(1)} MB`);

  return (
    <main className="home" style={{ gap: 24 }}>
      <header className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 12 }}>
          <button type="button" className="btn" onClick={onHome}><Icon name="home" size={18} /> Home</button>
          <h1 className="display" style={{ fontSize: 30 }}>Profile settings</h1>
        </div>
        <div className="seg" aria-label="Profile">
          {profiles.map((pr) => <button key={pr.id} type="button" aria-pressed={pr.id === p.id} onClick={() => onSwitch(pr.id)}>{pr.name}</button>)}
        </div>
        <button type="button" className="btn primary" onClick={onStudio}>Open studio <Icon name="arrow" size={18} /></button>
      </header>

      <div className="cards" style={{ alignItems: 'flex-start' }}>
        <section className="card stack" style={{ flex: '1 1 300px', maxWidth: 400 }} aria-label="Avatar">
          <h2 style={{ fontSize: 18 }}>Avatar</h2>
          <div className="row" style={{ justifyContent: 'center', padding: 10 }}><Avatar profile={p} size={110} /></div>
          <label className="stack" style={{ gap: 4 }}>
            <span className="lbl">Display name</span>
            <input className="field" value={p.name} maxLength={40} onChange={(e) => setP({ ...p, name: e.target.value })} onBlur={() => p.name.trim() && save({ ...p, name: p.name.trim() })} />
          </label>
          <span className="lbl">Ring color</span>
          <div className="row wrap">
            {RINGS.map((c) => (
              <button key={c} type="button" aria-label={`Ring ${c}`} aria-pressed={p.avatar.ring === c} onClick={() => save({ ...p, avatar: { ...p.avatar, ring: c } })}
                style={{ width: 44, height: 44, borderRadius: 999, background: c, border: p.avatar.ring === c ? '3px solid var(--ink)' : '3px solid transparent' }} />
            ))}
          </div>
        </section>

        <div className="stack" style={{ flex: '2 1 560px', minWidth: 0, gap: 20 }}>
          <section className="card stack" aria-label="Color theme">
            <h2 style={{ fontSize: 18 }}>Color theme</h2>
            <div className="cards" style={{ gap: 12 }}>
              {THEMES.map((th) => (
                <button key={th.id} type="button" className="chip" aria-pressed={p.theme.preset === th.id}
                  onClick={() => save({ ...p, theme: { preset: th.id, base: th.id === 'daylight' ? 'light' : 'dark' } })}
                  style={{ flex: '1 1 150px', flexDirection: 'column', alignItems: 'stretch', padding: 10, borderRadius: 14, minHeight: 0 }}>
                  <span style={{ display: 'flex', gap: 4, padding: 8, borderRadius: 8, background: th.ground }} aria-hidden="true">
                    {th.bars.map((b, i) => <span key={i} style={{ flex: 1, height: 10, borderRadius: 3, background: b }} />)}
                  </span>
                  <strong style={{ textAlign: 'left' }}>{th.name}</strong>
                </button>
              ))}
            </div>
            <p className="small muted" style={{ margin: 0 }}>Each theme was chosen so text, buttons and note colors stay readable.</p>
          </section>

          <section className="card stack" aria-label="Style preferences">
            <h2 style={{ fontSize: 18 }}>Style preferences</h2>
            <div className="cards" style={{ gap: 14 }}>
              {(['musician', 'producer'] as const).map((lane) => {
                const styles = lane === 'musician' ? MUSICIAN_STYLES : PRODUCER_STYLES;
                const picked = lane === 'musician' ? p.musician_styles : p.producer_styles;
                const level = lane === 'musician' ? p.musician_level : p.producer_level;
                return (
                  <div key={lane} className="stack" style={{ flex: '1 1 260px', padding: 12, borderRadius: 12, background: 'var(--raised)' }}>
                    <strong>{cap(lane)}</strong>
                    <div className="row wrap" style={{ gap: 6 }}>
                      {styles.map((s) => (
                        <button key={s} type="button" className="chip" aria-pressed={picked.includes(s)}
                          onClick={() => save(lane === 'musician' ? { ...p, musician_styles: toggle(p.musician_styles, s) } : { ...p, producer_styles: toggle(p.producer_styles, s) })}>{s}</button>
                      ))}
                    </div>
                    <span className="lbl">Level</span>
                    <Seg label={`${lane} level`} value={level} options={LEVELS.map((l) => ({ v: l, l: cap(l) }))}
                      onChange={(v) => save(lane === 'musician' ? { ...p, musician_level: v } : { ...p, producer_level: v })} />
                  </div>
                );
              })}
            </div>
            <div className="row wrap" style={{ gap: 20 }}>
              <div className="stack" style={{ gap: 6 }}><span className="lbl">Start in</span>
                <Seg<Hat> label="Start in" value={p.default_hat} options={[{ v: 'musician', l: 'Musician hat' }, { v: 'producer', l: 'Producer hat' }]} onChange={(v) => save({ ...p, default_hat: v })} /></div>
              <div className="stack" style={{ gap: 6 }}><span className="lbl">Lyrics language</span>
                <Seg<Lang> label="Lyrics language" value={p.lyrics_lang} options={[{ v: 'es', l: 'Español' }, { v: 'en', l: 'English' }]} onChange={(v) => save({ ...p, lyrics_lang: v })} /></div>
              <div className="stack" style={{ gap: 6 }}><span className="lbl">App language</span>
                <Seg<Lang> label="App language" value={p.ui_lang} options={[{ v: 'en', l: 'English' }, { v: 'es', l: 'Español' }]} onChange={(v) => save({ ...p, ui_lang: v })} /></div>
            </div>
          </section>

          <section className="card stack" aria-label="Storage and backup">
            <h2 style={{ fontSize: 18 }}>Storage and backup</h2>
            <p style={{ margin: 0 }}>
              {storage?.persisted
                ? <span className="ok">This browser will keep your songs.</span>
                : <span className="warn">This browser may clear saved songs. On the iPad, add the app to the Home Screen and back up from time to time.</span>}
            </p>
            <p className="small muted" style={{ margin: 0 }}>Using {mb(storage?.usage)} of {mb(storage?.quota)} available.</p>
            <div className="row wrap">
              <button type="button" className="btn" onClick={backup}><Icon name="download" size={18} /> Back up all songs</button>
              <button type="button" className="btn ghost" onClick={restore}><Icon name="upload" size={18} /> Restore a backup</button>
            </div>
          </section>
        </div>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
