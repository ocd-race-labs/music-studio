import type { Lang, Profile, ThemePreset } from '../domain/types';
import { GUEST_ID, guestProfile } from './guest';
import { t } from './i18n';
import { Avatar, Icon } from './ui';

const PREVIEW: Record<ThemePreset, { ground: string; panel: string; ink: string; ink2: string; line: string; bars: string[][] }> = {
  graphite: { ground: '#0E0E0F', panel: '#161617', ink: '#F2F2F2', ink2: '#A6A6AB', line: '#2A2A2D', bars: [['#3A3A3E', '#3A3A3E'], ['#55555B', '#55555B'], ['#74747A', '#F2F2F2']] },
  'midnight-jewel': { ground: '#120F1F', panel: '#1A1630', ink: '#F4F1FF', ink2: '#B9B2D9', line: '#342C55', bars: [['#2DD4BF', '#2DD4BF'], ['#A78BFA', '#A78BFA'], ['#F0509E', '#38BDF8']] },
  daylight: { ground: '#E9EBEF', panel: '#FFFFFF', ink: '#15171C', ink2: '#4A4F5A', line: '#D5D8DE', bars: [['#C9CDD4', '#C9CDD4'], ['#C2410C', '#AEB3BC'], ['#AEB3BC', '#C9CDD4']] },
};

const THEME_NAME: Record<ThemePreset, string> = { graphite: 'Graphite', 'midnight-jewel': 'Midnight jewel', daylight: 'Daylight' };

function ProfileCard({ profile, lang, guest, onOpen }: { profile: Profile; lang: Lang; guest?: boolean; onOpen: () => void }) {
  const c = PREVIEW[profile.theme.preset];
  return (
    <button type="button" className="pcard" onClick={onOpen} style={{ background: c.panel, color: c.ink, borderColor: c.line }}>
      <div className="preview" style={{ background: c.ground }} aria-hidden="true">
        <div className="row" style={{ gap: 6 }}><div className="bar" style={{ width: '34%', background: c.bars[0][0] }} /><div className="bar" style={{ width: '30%', background: c.bars[0][1], opacity: 0.6 }} /></div>
        <div className="row" style={{ gap: 6 }}><div style={{ width: '14%' }} /><div className="bar" style={{ width: '48%', background: c.bars[1][0] }} /><div className="bar" style={{ width: '24%', background: c.bars[1][1] }} /></div>
        <div className="row" style={{ gap: 6 }}><div className="bar" style={{ width: '56%', background: c.bars[2][0] }} /><div className="bar" style={{ width: '32%', background: c.bars[2][1] }} /></div>
      </div>
      <div className="info" style={{ width: '100%' }}>
        <div className="row" style={{ gap: 14 }}>
          <Avatar profile={profile} size={52} />
          <div className="stack" style={{ gap: 2 }}>
            <span style={{ fontSize: 22, fontWeight: 600 }}>{guest ? t('guest', lang) : profile.name}</span>
            <span style={{ fontSize: 14, color: c.ink2 }}>{guest ? t('tryStudio', lang) : `${THEME_NAME[profile.theme.preset]} · ${t(profile.default_hat, lang)}`}</span>
          </div>
        </div>
        <span className="row" style={{ fontWeight: 600, fontSize: 15 }}>
          {guest ? t('startGuest', lang) : t('openStudio', lang)} <Icon name="arrow" size={18} />
        </span>
        {guest && <span className="small" style={{ color: c.ink2 }}>{t('notSaved', lang)}</span>}
      </div>
    </button>
  );
}

export default function Home({ profiles, lang, onLang, onOpen, onSettings, onLab, onAddPerson }: {
  profiles: Profile[];
  lang: Lang;
  onLang: (l: Lang) => void;
  onOpen: (id: string) => void;
  onSettings: () => void;
  onLab: () => void;
  onAddPerson: () => void;
}) {
  const guest: Profile = { ...guestProfile, name: 'G' };
  return (
    <main className="home">
      <header className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 12 }}>
          <img src="icon.svg" width={34} height={34} alt="" style={{ borderRadius: 8 }} />
          <span className="display" style={{ fontSize: 22, fontWeight: 700 }}>Music Studio</span>
        </div>
        <div className="row">
          <div className="seg" aria-label="Interface language">
            <button type="button" aria-pressed={lang === 'en'} onClick={() => onLang('en')}>English</button>
            <button type="button" aria-pressed={lang === 'es'} onClick={() => onLang('es')}>Español</button>
          </div>
          <button type="button" className="btn icon" onClick={onSettings} aria-label={t('settings', lang)}><Icon name="gear" /></button>
        </div>
      </header>
      <section className="stack" style={{ maxWidth: 720, gap: 10 }}>
        <h1 className="display" style={{ fontSize: 'clamp(36px, 6vw, 56px)', lineHeight: 1.02 }}>{t('whoPlaying', lang)}</h1>
        <p className="muted" style={{ fontSize: 18, margin: 0 }}>{t('pickProfile', lang)}</p>
      </section>
      <div className="cards">
        {profiles.map((p) => <ProfileCard key={p.id} profile={p} lang={lang} onOpen={() => onOpen(p.id)} />)}
        <ProfileCard profile={guest} lang={lang} guest onOpen={() => onOpen(GUEST_ID)} />
      </div>
      <footer className="row wrap" style={{ gap: 10 }}>
        <button type="button" className="btn ghost" onClick={onLab}><Icon name="flask" /> {t('lab', lang)}</button>
        {profiles.length < 4 && <button type="button" className="btn ghost" onClick={onAddPerson}><Icon name="plus" /> Add a person</button>}
      </footer>
    </main>
  );
}
