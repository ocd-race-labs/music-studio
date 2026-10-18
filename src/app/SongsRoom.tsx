// Canciones: every song of the profile, the one in hand with its tracks, and for each track which sound plays,
// the musician's or the producer's. Both are kept, so a mix can go back and forth.

import type { Lang, Song, SongVersion, Track } from '../domain/types';
import { songBars } from '../domain/factory';
import { entryOf } from '../packs/collection';
import { findItem, title as catalogTitle } from '../packs/core';
import { scaleById, tonicDisplay } from '../theory';
import { songDuration } from './Arrange';
import { namingFor, t } from './i18n';
import { Icon } from './ui';
import type { Room } from './rooms';

/** The name of a track's sound: a saved sound's name, the Colección title, or the catalog title. */
export function soundName(instrument: Track['instrument'], sound: Track['sound'], lang: Lang): string {
  if (sound) return sound.name;
  if (!instrument || !findItem(instrument)) return '';
  return entryOf(instrument.key)?.title[lang] ?? catalogTitle(instrument, lang);
}

export default function SongsRoom({ song, songs, versions, lang, onOpen, onRoom, onNew, onBeat, onImport, onExport, onSaveVersion, onRestore, onVoice }: {
  song: Song;
  songs: Song[];
  versions: SongVersion[];
  lang: Lang;
  onOpen: (s: Song) => void;
  onRoom: (room: Room) => void;
  onNew: () => void;
  onBeat: () => void;
  onImport: () => void;
  onExport: () => void;
  onSaveVersion: () => void;
  onRestore: (v: SongVersion) => void;
  onVoice: (trackId: string, from: 'musician' | 'producer') => void;
}) {
  const naming = namingFor(lang);
  const meta = (s: Song) => `${tonicDisplay(s.key_tonic, naming)} ${scaleById(s.key_mode).name[lang].toLowerCase()} · ${s.tempo_bpm} BPM · ${t('nBars', lang, { n: songBars(s) })} · ${songDuration(s)}`;
  const stage = (s: Song) => (s.sketch?.accepted_at ? t('stageDetail', lang) : s.sketch?.order.length ? t('stageIdea', lang) : t('stageDetail', lang));
  const when = (iso: string) => new Date(iso).toLocaleDateString(lang === 'es' ? 'es-CL' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="songs-room">
      <section className="songs-list" aria-label={t('roomSongs', lang)}>
        <div className="row wrap" style={{ gap: 8 }}>
          <h2 className="display grow" style={{ fontSize: 22 }}>{t('roomSongs', lang)}</h2>
          <button type="button" className="btn primary" onClick={onNew}><Icon name="plus" size={18} /> {t('newSong', lang)}</button>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button type="button" className="btn small-btn beat-btn" onClick={onBeat} title={t('beatOpenHint', lang)}><Icon name="music" size={16} /> {t('beatOpen', lang)}</button>
          <button type="button" className="btn small-btn" onClick={onImport}><Icon name="upload" size={16} /> {t('importSong', lang)}</button>
        </div>
        <ul className="song-rows">
          {songs.map((s) => (
            <li key={s.id}>
              <button type="button" className="song-row" aria-current={s.id === song.id} onClick={() => onOpen(s)}>
                <span className="song-disc" style={{ background: s.tracks[0]?.color }}><Icon name="disc" size={18} /></span>
                <span className="stack grow" style={{ gap: 0, minWidth: 0 }}>
                  <strong className="ellipsis">{s.title}</strong>
                  <span className="small muted ellipsis">{meta(s)}</span>
                </span>
                <span className="stack" style={{ gap: 0, alignItems: 'flex-end', flex: 'none' }}>
                  <span className="tag">{stage(s)}</span>
                  <span className="small muted">{when(s.updated_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="song-detail" aria-label={song.title}>
        <div className="row wrap" style={{ gap: 10, alignItems: 'flex-start' }}>
          <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
            <span className="lbl">{t('songInHand', lang)}</span>
            <h2 className="display" style={{ fontSize: 26 }}>{song.title}</h2>
            <span className="small muted">{meta(song)}</span>
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <button type="button" className="btn primary" onClick={() => onRoom('musician')}><Icon name="music" size={18} /> {t('openInMusician', lang)}</button>
            <button type="button" className="btn" onClick={() => onRoom('producer')}><Icon name="sliders" size={18} /> {t('openInProducer', lang)}</button>
          </div>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <h3 className="sub">{t('songSounds', lang)}</h3>
          <p className="small muted" style={{ margin: 0 }}>{t('songSoundsHint', lang)}</p>
          <div className="voice-table" role="table" aria-label={t('songSounds', lang)}>
            <div className="vt-row vt-head" role="row">
              <span role="columnheader">{t('track', lang)}</span>
              <span role="columnheader">{t('musicianSound', lang)}</span>
              <span role="columnheader">{t('producerSound', lang)}</span>
              <span role="columnheader">{t('plays', lang)}</span>
            </div>
            {song.tracks.map((tr) => {
              const from = tr.producer && tr.voice_from === 'producer' ? 'producer' : 'musician';
              return (
                <div key={tr.id} className="vt-row" role="row">
                  <span role="cell" className="row" style={{ gap: 8, minWidth: 0 }}><span className="swatch" style={{ background: tr.color }} /><strong className="ellipsis">{tr.name}</strong></span>
                  <span role="cell" className={`ellipsis${from === 'musician' ? ' vt-on' : ''}`}>{soundName(tr.instrument, tr.sound, lang) || '—'}</span>
                  <span role="cell" className={`ellipsis${from === 'producer' ? ' vt-on' : ''}`}>{tr.producer ? soundName(tr.producer.instrument, tr.producer.sound, lang) : <span className="muted">{t('noProducerSound', lang)}</span>}</span>
                  <span role="cell">
                    <span className="seg small-seg" aria-label={`${t('plays', lang)}: ${tr.name}`}>
                      <button type="button" aria-pressed={from === 'musician'} onClick={() => onVoice(tr.id, 'musician')}>{t('musician', lang)}</button>
                      <button type="button" aria-pressed={from === 'producer'} disabled={!tr.producer} onClick={() => onVoice(tr.id, 'producer')}>{t('producer', lang)}</button>
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <h3 className="sub">{t('versions', lang)}</h3>
          <div className="row wrap" style={{ gap: 8 }}>
            <button type="button" className="btn small-btn" onClick={onSaveVersion}><Icon name="copy" size={16} /> {t('saveVersion', lang)}</button>
            <button type="button" className="btn small-btn" onClick={onExport}><Icon name="download" size={16} /> {t('exportSong', lang)}</button>
          </div>
          {versions.length === 0 && <p className="small muted" style={{ margin: 0 }}>{t('noVersions', lang)}</p>}
          {versions.map((v) => (
            <div key={v.id} className="row version-row">
              <span className="grow">{t('versionN', lang, { n: v.version_no })} <span className="small muted">· {when(v.created_at)}</span></span>
              <button type="button" className="btn small-btn ghost" onClick={() => onRestore(v)}>{t('restore', lang)}</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
