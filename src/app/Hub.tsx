// A profile's home: four rooms on a small map. The sound studio (instruments, kits, sounds), the musician (the idea
// and then the detail), the producer (the desk and the master), and the songs where all of it lands.

import type { Lang, Profile, Song } from '../domain/types';
import { songBars } from '../domain/factory';
import { scaleById, tonicDisplay } from '../theory';
import { songDuration } from './Arrange';
import { namingFor, t } from './i18n';
import type { Mode } from './prefs';
import { Avatar, Icon, LangToggle, ModeSwitch } from './ui';
import type { Room } from './rooms';

export default function Hub({ profile, song, lang, mode, stats, onLang, onToggleMode, onRoom, onProfiles, onSettings, onClassroom }: {
  profile: Profile;
  song: Song | null;
  lang: Lang;
  mode: Mode;
  stats: { kit: number; sounds: number; songs: number };
  onLang: (l: Lang) => void;
  onToggleMode: () => void;
  onRoom: (room: Room) => void;
  onProfiles: () => void;
  onSettings?: () => void;
  onClassroom?: () => void;
}) {
  const naming = namingFor(lang);
  const sketch = song?.sketch;
  const ideaLine = !sketch || !sketch.order.length
    ? t('hubIdeaNone', lang)
    : sketch.accepted_at ? t('hubIdeaAccepted', lang, { n: sketch.order.length }) : t('hubIdeaDraft', lang, { n: sketch.order.length });
  const tracks = song?.tracks.length ?? 0;
  const alt = song?.tracks.filter((tr) => tr.producer).length ?? 0;
  const continueRoom: Room = profile.default_hat === 'producer' ? 'producer' : 'musician';

  const node = (room: Room, n: number | null, icon: 'amp' | 'music' | 'sliders' | 'disc', title: string, blurb: string, status: string[]) => (
    <button type="button" className={`hub-node n-${room}`} onClick={() => onRoom(room)}>
      <span className="hub-node-top">
        {n !== null && <span className="hub-n mono">{n}</span>}
        <span className="hub-icon"><Icon name={icon} size={26} /></span>
        <Icon name="arrow" size={18} />
      </span>
      <strong className="hub-title display">{title}</strong>
      <span className="hub-blurb">{blurb}</span>
      <span className="hub-status">{status.map((s) => <span key={s}>{s}</span>)}</span>
    </button>
  );

  return (
    <main className="hub">
      <header className="hub-head">
        <button type="button" className="row hub-brand" onClick={onProfiles} aria-label={t('hubProfiles', lang)} title={t('hubProfiles', lang)}>
          <img src="icon.svg" width={30} height={30} alt="" style={{ borderRadius: 8 }} />
          <span className="display" style={{ fontSize: 20, fontWeight: 700 }}>Music Studio</span>
        </button>
        <div className="row">
          {onClassroom && (
            <button type="button" className="btn classroom-btn" onClick={onClassroom}><Icon name="classroom" size={20} /> <span className="hide-sm">{t('classroom', lang)}</span></button>
          )}
          <LangToggle lang={lang} onLang={onLang} />
          <ModeSwitch mode={mode} onToggle={onToggleMode} lang={lang} />
          {onSettings && <button type="button" className="btn icon" onClick={onSettings} aria-label={t('settings', lang)} title={t('settings', lang)}><Icon name="gear" /></button>}
        </div>
      </header>

      <section className="hub-hello">
        <Avatar profile={profile} size={56} />
        <div className="stack grow" style={{ gap: 2 }}>
          <h1 className="display">{t('hubHello', lang, { name: profile.name })}</h1>
          <p className="muted" style={{ margin: 0 }}>{t('hubAsk', lang)}</p>
        </div>
        <button type="button" className="btn ghost" onClick={onProfiles}><Icon name="swap" size={18} /> {t('hubProfiles', lang)}</button>
      </section>

      {song && (
        <section className="hub-song" aria-label={t('hubCurrent', lang)}>
          <span className="hub-disc"><Icon name="disc" size={30} /></span>
          <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
            <span className="lbl">{t('hubCurrent', lang)}</span>
            <strong className="display hub-song-title">{song.title}</strong>
            <span className="small muted">
              {tonicDisplay(song.key_tonic, naming)} {scaleById(song.key_mode).name[lang].toLowerCase()} · {song.tempo_bpm} BPM · {t('nBars', lang, { n: songBars(song) })} · {songDuration(song)}
            </span>
          </div>
          <button type="button" className="btn primary" onClick={() => onRoom(continueRoom)}>
            {t('hubContinue', lang, { room: t(continueRoom, lang) })} <Icon name="arrow" size={18} />
          </button>
        </section>
      )}

      <div className="hub-map">
        <div className="hub-flow">
          {node('sounds', 1, 'amp', t('roomSounds', lang), t('roomSoundsBlurb', lang), [t('hubKit', lang, { n: stats.kit }), t('hubSounds', lang, { n: stats.sounds })])}
          <span className="hub-link" aria-hidden="true" />
          {node('musician', 2, 'music', t('roomMusician', lang), t('roomMusicianBlurb', lang), [ideaLine, t('hubTracks', lang, { n: tracks })])}
          <span className="hub-link" aria-hidden="true" />
          {node('producer', 3, 'sliders', t('roomProducer', lang), t('roomProducerBlurb', lang), [t('hubChannels', lang, { n: tracks }), alt ? t('hubAlt', lang, { n: alt }) : t('hubAltNone', lang)])}
        </div>
        <div className="hub-bus" aria-hidden="true"><span /><span /><span /></div>
        {node('songs', null, 'disc', t('roomSongs', lang), t('roomSongsBlurb', lang), [t('hubSongs', lang, { n: stats.songs })])}
      </div>
    </main>
  );
}
