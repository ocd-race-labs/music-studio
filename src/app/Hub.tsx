// A profile's home, all in one screen: the instrument store on top; the three rooms in a row (the sound studio, the
// musician, the producer); and the songs, with the one in progress shown as a single's cover.

import type { Lang, Profile, Song } from '../domain/types';
import { songBars } from '../domain/factory';
import { scaleById, tonicDisplay } from '../theory';
import { songDuration } from './Arrange';
import { namingFor, t } from './i18n';
import type { Mode } from './prefs';
import { Avatar, Icon, LangToggle, ModeSwitch } from './ui';
import type { Room } from './rooms';
import { Art, ArtDefs } from './Store';
import { STORE_ITEMS, WINDOWS, windowTitle } from './storeCatalog';
import type { ArtId } from './storeArt';

const SHOP_WALL: [ArtId, number, number][] = [
  ['i-violin', 34, 112], ['i-guitar', 44, 122], ['i-piano', 104, 66], ['i-sax', 54, 112], ['i-eguitar', 42, 104], ['i-congas', 52, 66], ['i-synth', 112, 44], ['i-trumpet', 86, 40], ['i-drums', 100, 74],
];

export default function Hub({ profile, song, songs, lang, mode, stats, onLang, onToggleMode, onRoom, onOpenSong, onProfiles, onSettings, onClassroom }: {
  profile: Profile;
  song: Song | null;
  songs: Song[];
  onOpenSong: (s: Song) => void;
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

  const others = songs.filter((s) => s.id !== song?.id).slice(0, 4);

  return (
    <main className="hub">
      <ArtDefs />
      <header className="hub-head">
        <Avatar profile={profile} size={46} />
        <div className="stack grow" style={{ gap: 0, minWidth: 0 }}>
          <h1 className="display">{t('hubHello', lang, { name: profile.name })}</h1>
          <p className="muted small" style={{ margin: 0 }}>{t('hubAsk', lang)}</p>
        </div>
        <button type="button" className="row hub-brand hide-sm" onClick={onProfiles} aria-label={t('hubProfiles', lang)} title={t('hubProfiles', lang)}>
          <img src="icon.svg" width={24} height={24} alt="" style={{ borderRadius: 6 }} />
          <span className="display" style={{ fontSize: 16, fontWeight: 700 }}>Music Studio</span>
        </button>
        <div className="row">
          {onClassroom && (
            <button type="button" className="btn classroom-btn" onClick={onClassroom}><Icon name="classroom" size={20} /> <span className="hide-sm">{t('classroom', lang)}</span></button>
          )}
          <LangToggle lang={lang} onLang={onLang} />
          <ModeSwitch mode={mode} onToggle={onToggleMode} lang={lang} />
          {onSettings && <button type="button" className="btn icon" onClick={onSettings} aria-label={t('settings', lang)} title={t('settings', lang)}><Icon name="gear" /></button>}
          <button type="button" className="btn ghost" onClick={onProfiles}><Icon name="swap" size={18} /> <span className="hide-sm">{t('hubProfiles', lang)}</span></button>
        </div>
      </header>

      <button type="button" className="hub-store" onClick={() => onRoom('store')}>
        <span className="hub-store-text">
          <span className="hub-store-eyebrow mono">{t('storeOpen', lang)}</span>
          <strong className="hub-store-title display">{t('roomStore', lang)}</strong>
          <span className="hub-blurb">{t('roomStoreBlurb', lang)}</span>
          <span className="hub-status">
            <span className="hot">{t('hubStoreReal', lang, { n: STORE_ITEMS.filter((x) => x.recorded).length })}</span>
            <span>{t('hubStoreCount', lang, { n: STORE_ITEMS.length })}</span>
            <span>{t('hubStoreWindows', lang, { n: WINDOWS.length })}</span>
          </span>
          <span className="btn primary hub-store-go"><Icon name="store" size={18} /> {t('hubStoreEnter', lang)} <Icon name="arrow" size={18} /></span>
        </span>
        <span className="hub-store-wall" aria-hidden="true">
          {SHOP_WALL.map(([id, w, h]) => <Art key={id} id={id} w={w} h={h} />)}
        </span>
      </button>

      <div className="hub-flow">
        {node('sounds', 1, 'amp', t('roomSounds', lang), t('roomSoundsBlurb', lang), [t('hubKit', lang, { n: stats.kit }), t('hubSounds', lang, { n: stats.sounds })])}
        {node('musician', 2, 'music', t('roomMusician', lang), t('roomMusicianBlurb', lang), [ideaLine, t('hubTracks', lang, { n: tracks })])}
        {node('producer', 3, 'sliders', t('roomProducer', lang), t('roomProducerBlurb', lang), [t('hubChannels', lang, { n: tracks })])}
      </div>

      <section className="hub-songs" aria-label={t('roomSongs', lang)}>
        {song && (
          <div className="hub-single">
            <button type="button" className="hub-cover-wrap" onClick={() => onRoom(continueRoom)} aria-label={t('hubContinue', lang, { room: t(continueRoom, lang) })}>
              <Cover song={song} lang={lang} size={150} />
              <span className="hub-sticker mono">{t('hubInProgress', lang)}</span>
            </button>
            <div className="stack hub-single-text">
              <span className="hub-store-eyebrow mono">{t('hubCurrent', lang)}</span>
              <strong className="display hub-song-title">{song.title}</strong>
              <span className="small muted mono">
                {tonicDisplay(song.key_tonic, naming)} {scaleById(song.key_mode).name[lang].toLowerCase()} · {song.tempo_bpm} BPM · {t('nBars', lang, { n: songBars(song) })} · {songDuration(song)}
              </span>
              <span className="small">{ideaLine} · {t('hubTracks', lang, { n: tracks })}</span>
              <button type="button" className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={() => onRoom(continueRoom)}>
                {t('hubContinue', lang, { room: t(continueRoom, lang) })} <Icon name="arrow" size={18} />
              </button>
            </div>
          </div>
        )}
        <div className="hub-shelf">
          <button type="button" className="hub-shelf-head" onClick={() => onRoom('songs')}>
            <strong className="display">{t('roomSongs', lang)} <span className="muted">· {stats.songs}</span></strong>
            <span className="small muted">{t('hubSongsAll', lang)} <Icon name="arrow" size={14} /></span>
          </button>
          <div className="hub-covers">
            {others.map((s) => (
              <button key={s.id} type="button" className="hub-mini" onClick={() => onOpenSong(s)} title={s.title}>
                <Cover song={s} lang={lang} size={104} />
              </button>
            ))}
            <button type="button" className="hub-mini hub-new" onClick={() => onRoom('songs')}>
              <Icon name="plus" size={22} /><span className="small">{t('hubSongNew', lang)}</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

/** A song as a single's cover: its style's colour, a pattern of its own, its title. */
function Cover({ song, lang, size }: { song: Song; lang: Lang; size: number }) {
  const genre = (song.kit_key ?? 'kit.hiphop').replace('kit.', '');
  const win = WINDOWS.find((w) => w.id === genre);
  const rgb = win?.glow ?? '160,160,170';
  const kind = win ? windowTitle(win.id, lang) : t('kitCustom', lang);
  let h = 0; for (const ch of song.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pattern = h % 3;
  const bars = [30, 52, 20, 64, 40, 26, 58, 34].map((b, i) => ((b + (h >> i) % 24) % 70) + 14);
  return (
    <span className="hub-cover" style={{ width: size, height: size, background: `linear-gradient(140deg, rgb(${rgb}), rgba(${rgb},0.18) 75%), #120e10` }}>
      <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden="true">
        {pattern === 0 && bars.map((b, i) => <rect key={i} x={12 + i * 14} y={96 - b} width={8} height={b} rx={2} fill="rgba(255,255,255,0.16)" />)}
        {pattern === 1 && [14, 28, 42, 56].map((r) => <circle key={r} cx={104} cy={28} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={5} />)}
        {pattern === 2 && <><path d="M0 60C20 30 40 90 60 60S100 30 128 60" stroke="rgba(255,255,255,0.22)" strokeWidth={6} fill="none" /><path d="M0 82C20 52 40 112 60 82S100 52 128 82" stroke="rgba(255,255,255,0.12)" strokeWidth={6} fill="none" /></>}
      </svg>
      <span className="hub-cover-kind mono">{kind}</span>
      <span className="hub-cover-title display">{song.title}</span>
    </span>
  );
}
