// The sound studio: every sound to work with, found by genre, family and style; a detail panel to hear it, try its
// pieces and see its signal chain; Mi kit, the sounds a person chose for their songs; and their own sounds.
// Shaping a chain opens the signal-flow designer in place.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ENTRIES, entryOf, FAMILIES, familiesIn, GENRES, GROUPS, SOURCES } from '../packs/collection';
import type { Entry, Family, Genre } from '../packs/collection';
import { findByKey, findItem, KITS, kitSlots, ROLES, rowsOf, title as catalogTitle } from '../packs/core';
import { engine } from '../engine/engine';
import type { CustomSound, FxChain, Lang, Role, Song, StarredInstrument, Track } from '../domain/types';
import { ROLE_NAMES, roleOf } from '../domain/factory';
import { t } from './i18n';
import { Icon } from './ui';
import { familyOf, rackOf, templateFor } from './rack';
import ChainDesigner, { STAGE_COLOR, stageOf } from './ChainDesigner';
import type { DesignerTarget } from './ChainDesigner';

type Shelf = { kind: 'browse' } | { kind: 'mine' } | { kind: 'kit' };
export type DesignRequest = { base: string; from: string; start: FxChain; sound?: CustomSound; target?: DesignerTarget };

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** The job a sound usually does in a kit, used when it is starred: drums, bass, chords or melody. */
export function defaultRole(instrumentKey: string): Role {
  const e = entryOf(instrumentKey);
  const fam = familyOf(instrumentKey);
  if (fam === 'drums') return 'drums';
  if (fam === 'bass') return 'bass';
  if (fam === 'guitar') return 'chords';
  const low = (findByKey(instrumentKey)?.manifest as { low?: number } | undefined)?.low ?? 60;
  if (low <= 40) return 'bass';
  if (e?.phrase?.notes.some((n) => n.midi.length > 1)) return 'chords';
  return 'lead';
}

/** Roles a sound can take: a kit is drums or percussion; anything melodic can take any melodic job. */
const rolesFor = (instrumentKey: string): Role[] => (familyOf(instrumentKey) === 'drums' ? ['drums', 'perc'] : ROLES.filter((r) => r !== 'drums' && r !== 'perc'));

/** Tracks a sound can go on, the ones whose job matches it first: a kit on drum tracks, a bass on the bass, the rest on melodic tracks. */
export function fittingTracks(song: Song, instrumentKey: string): Track[] {
  const fam = familyOf(instrumentKey);
  const role = defaultRole(instrumentKey);
  const fits = song.tracks.filter((tr) => (fam === 'drums' ? tr.kind === 'drums'
    : tr.kind !== 'drums' && (role === 'bass' ? roleOf(tr) === 'bass' : roleOf(tr) !== 'bass')));
  return [...fits.filter((tr) => roleOf(tr) === role), ...fits.filter((tr) => roleOf(tr) !== role)];
}

export default function SoundStudio({ song, selectedId, starred, sounds, profileId, lang, design, onDesign, onUse, onUseSound, onSaveSound, onDeleteSound, onStar, onUnstar, onBeat, onNewWithKit, onApplyKit, onProducerSound }: {
  song: Song;
  selectedId: string | null;
  starred: StarredInstrument[];
  sounds: CustomSound[];
  profileId: string;
  lang: Lang;
  /** A chain being shaped: the designer replaces the shelves while it is open. */
  design: DesignRequest | null;
  onDesign: (d: DesignRequest | null) => void;
  onUse: (trackId: string, instrumentKey: string) => void;
  onUseSound: (trackId: string, sound: CustomSound) => void;
  onSaveSound: (sound: CustomSound) => Promise<void>;
  onDeleteSound: (id: string) => void;
  onStar: (s: StarredInstrument) => void;
  onUnstar: (s: StarredInstrument) => void;
  onBeat: () => void;
  onNewWithKit: () => void;
  onApplyKit: () => void;
  onProducerSound: (trackId: string, sound: CustomSound) => void;
}) {
  const [shelf, setShelf] = useState<Shelf>({ kind: 'browse' });
  const [genre, setGenre] = useState<Genre>(GENRES[0].id);
  const [family, setFamily] = useState<Family | 'all'>('drums');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string>(() => ENTRIES[0].instrument);
  const [pickedMine, setPickedMine] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const stopTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => { engine.stopPreview(); window.clearTimeout(stopTimer.current); }, []);

  const q = norm(query.trim());
  const families = familiesIn(genre);
  const list = useMemo(() => ENTRIES.filter((e) => (q
    ? norm(`${e.title[lang]} ${e.era[lang]} ${e.blurb[lang]} ${GROUPS.find((g) => g.id === e.group)?.title[lang] ?? ''}`).includes(q)
    : e.genre === genre && (family === 'all' || e.family === family))), [q, genre, family, lang]);
  const groups = useMemo(() => {
    const out: { id: string; title: string; items: Entry[] }[] = [];
    for (const e of list) {
      let g = out.find((x) => x.id === e.group);
      if (!g) { g = { id: e.group, title: GROUPS.find((x) => x.id === e.group)?.title[lang] ?? e.group, items: [] }; out.push(g); }
      g.items.push(e);
    }
    return out;
  }, [list, lang]);

  const inUse = new Set(song.tracks.flatMap((tr) => [tr.sound ? '' : tr.instrument?.key ?? '', tr.producer && !tr.producer.sound ? tr.producer.instrument?.key ?? '' : '']).filter(Boolean));
  const soundsInUse = new Set(song.tracks.flatMap((tr) => [tr.sound?.id, tr.producer?.sound?.id]).filter(Boolean) as string[]);
  const starOf = (key: string, soundId?: string) => starred.find((x) => x.key === key && (soundId ? x.sound?.id === soundId : !x.sound));

  const listen = async (id: string, instrumentKey: string, chain?: FxChain) => {
    window.clearTimeout(stopTimer.current);
    if (playing === id) { engine.stopPreview(); setPlaying(null); return; }
    engine.stopPreview();
    setPlaying(null);
    const e = templateFor(instrumentKey);
    if (!e) return;
    setLoading(id);
    const secs = await engine.previewGroove(instrumentKey, e.groove, e.tempo, chain, chain ? 2 : 1, e.phrase);
    setLoading((l) => (l === id ? null : l));
    if (secs <= 0) return;
    setPlaying(id);
    stopTimer.current = window.setTimeout(() => setPlaying((p) => (p === id ? null : p)), secs * 1000);
  };
  const playBtn = (id: string, instrumentKey: string, name: string, chain?: FxChain, big = false) => (
    <button type="button" className={`${big ? 'btn' : 'ss-play'}${playing === id ? ' on' : ''}`} onClick={(ev) => { ev.stopPropagation(); listen(id, instrumentKey, chain); }}
      aria-label={playing === id ? t('stop', lang) : t('listenTo', lang, { name })} title={playing === id ? t('stop', lang) : t('listenTo', lang, { name })}>
      <Icon name={playing === id ? 'stop' : 'play'} size={big ? 18 : 14} />
      {big && (loading === id ? t('collectionLoading', lang) : playing === id ? t('stop', lang) : t('collectionListen', lang))}
    </button>
  );

  const openDesigner = (d: DesignRequest) => { engine.stopPreview(); setPlaying(null); onDesign(d); };

  if (design) {
    const original = rackOf(design.from);
    return (
      <div className="sound-studio designing">
        <ChainDesigner key={`${design.base}-${design.sound?.id ?? ''}-${design.target?.trackId ?? ''}`} base={design.base} from={design.from} start={design.start} original={original}
          sound={design.sound} target={design.target} roles={rolesFor(design.base)} defaultRole={defaultRole(design.base)} profileId={profileId} lang={lang}
          onBack={() => onDesign(null)}
          onDelete={design.sound ? () => { onDeleteSound(design.sound!.id); onDesign(null); } : undefined}
          onSave={async (x, opts) => {
            await onSaveSound(x);
            if (opts.kitRole) onStar({ key: x.base.key, role: opts.kitRole, sound: { id: x.id, name: x.name, chain: x.chain } });
            if (opts.applyTo) {
              if (opts.applyTo.as === 'producer') onProducerSound(opts.applyTo.trackId, x);
              else onUseSound(opts.applyTo.trackId, x);
            }
            setShelf({ kind: 'mine' });
            setPickedMine(x.id);
            onDesign(null);
          }} />
      </div>
    );
  }

  const kitName = (s: StarredInstrument) => s.sound?.name ?? entryOf(s.key)?.title[lang] ?? (findItem({ key: s.key, version: '1.0.0' }) ? catalogTitle({ key: s.key, version: '1.0.0' }, lang) : s.key);
  const kitFrom = (s: StarredInstrument) => (s.sound ? t('mySounds', lang) : entryOf(s.key) ? t('collection', lang) : t('instrumentsCore', lang));

  const detailProps: DetailProps = { song, selectedId, lang, starOf, playBtn, openDesigner, onStar, onUnstar };
  const pickedEntry = entryOf(picked) ?? ENTRIES[0];
  const pickedSound = sounds.find((x) => x.id === pickedMine) ?? sounds[0];

  return (
    <div className="sound-studio">
      <nav className="ss-rail" aria-label={t('roomSounds', lang)}>
        <label className="ss-search">
          <Icon name="list" size={16} />
          <input className="field" type="search" value={query} placeholder={t('ssSearch', lang)} aria-label={t('ssSearch', lang)}
            onChange={(e) => { setQuery(e.target.value); setShelf({ kind: 'browse' }); }} />
        </label>
        <span className="lbl">{t('genre', lang)}</span>
        <div className="ss-nav">
          {GENRES.map((g) => (
            <button key={g.id} type="button" aria-current={shelf.kind === 'browse' && !q && genre === g.id}
              onClick={() => { setShelf({ kind: 'browse' }); setQuery(''); setGenre(g.id); if (family !== 'all' && !familiesIn(g.id).includes(family)) setFamily('all'); }}>
              <span className="grow">{g.title[lang]}</span><span className="count mono">{ENTRIES.filter((e) => e.genre === g.id).length}</span>
            </button>
          ))}
        </div>
        <span className="lbl">{t('collectionFamily', lang)}</span>
        <div className="row wrap" style={{ gap: 6 }}>
          <button type="button" className="chip" aria-pressed={family === 'all'} onClick={() => { setFamily('all'); setShelf({ kind: 'browse' }); }}>{t('ssAll', lang)}</button>
          {FAMILIES.filter((f) => families.includes(f.id)).map((f) => (
            <button key={f.id} type="button" className="chip" aria-pressed={family === f.id} onClick={() => { setFamily(f.id); setShelf({ kind: 'browse' }); }}>{f.title[lang]}</button>
          ))}
        </div>
        <div className="ss-nav ss-nav-own">
          <button type="button" aria-current={shelf.kind === 'kit'} onClick={() => setShelf({ kind: 'kit' })}>
            <Icon name="starFill" size={16} /> <span className="grow">{t('myKit', lang)}</span><span className="count mono">{starred.length}</span>
          </button>
          <button type="button" aria-current={shelf.kind === 'mine'} onClick={() => setShelf({ kind: 'mine' })}>
            <Icon name="sliders" size={16} /> <span className="grow">{t('mySounds', lang)}</span><span className="count mono">{sounds.length}</span>
          </button>
        </div>
        <button type="button" className="btn small-btn beat-btn" onClick={onBeat} title={t('beatOpenHint', lang)}><Icon name="music" size={16} /> {t('beatOpen', lang)}</button>
        <details className="small muted col-credits">
          <summary>{t('ssCredits', lang)}</summary>
          <p style={{ margin: '6px 0' }}>{t('collectionCredits', lang).replace(/\s*(Credits|Créditos)$/, '')}</p>
          <ul>{SOURCES.map((x) => <li key={x.name}><a href={x.url} target="_blank" rel="noreferrer">{x.name}</a>, {x.by} · {x.license}</li>)}</ul>
          <p style={{ margin: 0 }}>{t('collectionChanges', lang)}</p>
        </details>
      </nav>

      {shelf.kind === 'browse' && (<>
        <section className="ss-list" aria-label={t('collection', lang)}>
          <div className="row wrap ss-list-head">
            <h2 className="display grow">{q ? t('ssResults', lang, { n: list.length }) : `${GENRES.find((g) => g.id === genre)?.title[lang]}${family !== 'all' ? ` · ${FAMILIES.find((f) => f.id === family)?.title[lang]}` : ''}`}</h2>
            <span className="small muted">{t('ssCount', lang, { n: list.length })}</span>
          </div>
          {groups.map((g) => (
            <div key={g.id} className="ss-group" role="group" aria-label={g.title}>
              <h3 className="ss-group-title">{g.title}</h3>
              {g.items.map((e) => {
                const star = starOf(e.instrument);
                return (
                  <div key={e.instrument} role="button" tabIndex={0} className={`ss-row${picked === e.instrument ? ' on' : ''}`}
                    onClick={() => setPicked(e.instrument)} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setPicked(e.instrument); } }}
                    aria-pressed={picked === e.instrument} aria-label={e.title[lang]}>
                    {playBtn(e.instrument, e.instrument, e.title[lang])}
                    <span className="stack grow" style={{ gap: 1, minWidth: 0 }}>
                      <span className="row" style={{ gap: 8, minWidth: 0 }}>
                        <strong className="ellipsis">{e.title[lang]}</strong>
                        {(q || family === 'all') && <span className="tag fam">{FAMILIES.find((f) => f.id === e.family)?.title[lang]}</span>}
                      </span>
                      <span className="small muted ellipsis">{e.era[lang]} · {e.blurb[lang]}</span>
                    </span>
                    {inUse.has(e.instrument) && <span className="col-badge" title={t('collectionInUse', lang)}><Icon name="check" size={14} /><span className="hide-md">{t('collectionInUse', lang)}</span></span>}
                    {star && <span className="ss-star" title={t('ssInKit', lang, { role: ROLE_NAMES[lang][star.role] })}><Icon name="starFill" size={16} /></span>}
                  </div>
                );
              })}
            </div>
          ))}
          {!list.length && <p className="muted">{t('ssNothing', lang)}</p>}
        </section>
        <EntryDetail key={pickedEntry.instrument + song.id} e={pickedEntry} {...detailProps} onUse={onUse} />
      </>)}

      {shelf.kind === 'mine' && (<>
        <section className="ss-list" aria-label={t('mySounds', lang)}>
          <div className="row wrap ss-list-head"><h2 className="display grow">{t('mySounds', lang)}</h2></div>
          {!sounds.length && <p className="muted">{t('ssNoMine', lang)}</p>}
          {sounds.map((x) => {
            const star = starOf(x.base.key, x.id);
            return (
              <div key={x.id} role="button" tabIndex={0} className={`ss-row${pickedSound?.id === x.id ? ' on' : ''}`} onClick={() => setPickedMine(x.id)}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setPickedMine(x.id); } }} aria-pressed={pickedSound?.id === x.id} aria-label={x.name}>
                {playBtn(x.id, x.base.key, x.name, x.chain)}
                <span className="stack grow" style={{ gap: 1, minWidth: 0 }}>
                  <strong className="ellipsis">{x.name}</strong>
                  <span className="small muted ellipsis">{t('basedOn', lang, { name: entryOf(x.base.key)?.title[lang] ?? catalogTitle(x.base, lang) })} · {x.chain.slots.filter((s) => !s.bypass).map((s) => catalogTitle(s.effect, lang)).join(' › ')}</span>
                </span>
                {soundsInUse.has(x.id) && <span className="col-badge"><Icon name="check" size={14} /><span className="hide-md">{t('collectionInUse', lang)}</span></span>}
                {star && <span className="ss-star"><Icon name="starFill" size={16} /></span>}
              </div>
            );
          })}
        </section>
        {pickedSound ? <MineDetail key={pickedSound.id} x={pickedSound} {...detailProps} onUseSound={onUseSound} /> : <aside className="ss-detail"><p className="muted">{t('ssNoMineHint', lang)}</p></aside>}
      </>)}

      {shelf.kind === 'kit' && (
        <section className="ss-list ss-kit" aria-label={t('myKit', lang)}>
          <div className="row wrap ss-list-head">
            <div className="stack grow" style={{ gap: 2 }}>
              <h2 className="display">{t('myKit', lang)}</h2>
              <span className="small muted">{t('myKitHint', lang)}</span>
            </div>
            <button type="button" className="btn" disabled={!starred.length} onClick={onApplyKit}>{t('myKitApply', lang)}</button>
            <button type="button" className="btn primary" disabled={!starred.length} onClick={onNewWithKit}><Icon name="plus" size={18} /> {t('myKitNew', lang)}</button>
          </div>
          {ROLES.map((r) => {
            const items = starred.filter((s) => s.role === r);
            return (
              <div key={r} className="kit-role">
                <span className="kit-role-name">{ROLE_NAMES[lang][r]}</span>
                <div className="stack grow" style={{ gap: 4, minWidth: 0 }}>
                  {!items.length && <span className="small muted">{t('myKitEmptyRole', lang)}</span>}
                  {items.map((s) => (
                    <div key={`${s.key}-${s.sound?.id ?? ''}`} className="row kit-item">
                      {playBtn(`kit-${s.key}-${s.sound?.id ?? ''}`, s.key, kitName(s), s.sound?.chain)}
                      <span className="stack grow" style={{ gap: 0, minWidth: 0 }}>
                        <strong className="ellipsis">{kitName(s)}</strong>
                        <span className="small muted">{kitFrom(s)}</span>
                      </span>
                      <button type="button" className="btn icon ghost" onClick={() => onUnstar(s)} aria-label={t('unstar', lang, { name: kitName(s) })} title={t('unstar', lang, { name: kitName(s) })}><Icon name="close" size={18} /></button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <details className="kit-synth">
            <summary>{t('myKitSynth', lang)}</summary>
            <p className="small muted" style={{ margin: '6px 0' }}>{t('buildKitHint', lang)}</p>
            {KITS.map((k) => (
              <div key={k.key} className="stack" style={{ gap: 2 }}>
                <h4 style={{ margin: '8px 0 2px', fontSize: 14 }}>{k.title[lang]}</h4>
                {kitSlots(k.key).map((slot) => {
                  const name = catalogTitle({ key: slot.instrument, version: '1.0.0' }, lang);
                  const on = starOf(slot.instrument);
                  return (
                    <div key={`${slot.role}-${slot.instrument}`} className="row kit-row">
                      <button type="button" className="mini" onClick={() => engine.previewInstrument(slot.instrument)} aria-label={t('listenTo', lang, { name })}><Icon name="play" size={14} /></button>
                      <span className="grow stack" style={{ gap: 0, minWidth: 0 }}><span>{name}</span><span className="small muted">{ROLE_NAMES[lang][slot.role]}</span></span>
                      <button type="button" className={`mini star${on ? ' on' : ''}`} aria-pressed={!!on} onClick={() => (on ? onUnstar(on) : onStar({ key: slot.instrument, role: slot.role }))}
                        aria-label={t(on ? 'unstar' : 'star', lang, { name })}><Icon name={on ? 'starFill' : 'star'} size={16} /></button>
                    </div>
                  );
                })}
              </div>
            ))}
          </details>
        </section>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- the detail of one sound */

interface DetailProps {
song: Song;
selectedId: string | null;
lang: Lang;
starOf: (key: string, soundId?: string) => StarredInstrument | undefined;
playBtn: (id: string, instrumentKey: string, name: string, chain?: FxChain, big?: boolean) => React.ReactNode;
openDesigner: (d: DesignRequest) => void;
onStar: (s: StarredInstrument) => void;
onUnstar: (s: StarredInstrument) => void;
}

function EntryDetail({ e, song, selectedId, lang, starOf, playBtn, openDesigner, onStar, onUnstar, onUse }: DetailProps & { e: Entry; onUse: (trackId: string, key: string) => void }) {
  const fits = fittingTracks(song, e.instrument);
  const [target, setTarget] = useState<string>(() => (fits.find((x) => x.id === selectedId) ?? fits[0])?.id ?? '');
  const [role, setRole] = useState<Role>(defaultRole(e.instrument));
  const star = starOf(e.instrument);
  const chain = rackOf(e.instrument);
  const tr = song.tracks.find((x) => x.id === target);
  const already = !!tr && tr.instrument?.key === e.instrument && !tr.sound;
  return (
    <aside className="ss-detail" aria-label={e.title[lang]}>
      <span className="lbl">{GENRES.find((g) => g.id === e.genre)?.title[lang]} · {GROUPS.find((g) => g.id === e.group)?.title[lang]}</span>
      <h2 className="display ss-title">{e.title[lang]}</h2>
      <span className="small muted">{e.era[lang]}</span>
      <p style={{ margin: 0 }}>{e.blurb[lang]}</p>
      <div className="row wrap" style={{ gap: 8 }}>{playBtn(e.instrument, e.instrument, e.title[lang], undefined, true)}</div>
      {e.family === 'drums' && (
        <div className="stack" style={{ gap: 6 }}>
          <h3 className="sub">{t('collectionPieces', lang)}</h3>
          <div className="col-pads" role="group" aria-label={t('collectionPieces', lang)}>
            {rowsOf(e.instrument).map((k) => {
              const voice = String(findByKey(k)?.manifest.voice ?? k);
              return (
                <button key={k} type="button" className="col-pad" onPointerDown={() => engine.previewPiece(e.instrument, voice)}
                  onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); engine.previewPiece(e.instrument, voice); } }}>
                  {findByKey(k)?.title[lang] ?? voice}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="stack" style={{ gap: 6 }}>
        <h3 className="sub">{t('cdFlow', lang)}</h3>
        <button type="button" className="ss-chain" onClick={() => openDesigner({ base: e.instrument, from: e.instrument, start: chain })} title={t('rackHint', lang)}>
          <span className="ss-chain-box">{t('cdInstrument', lang)}</span>
          {chain.slots.map((sl, i) => (
            <span key={i} className={`ss-chain-box${sl.bypass ? ' off' : ''}`} style={{ ['--stage' as string]: STAGE_COLOR[stageOf(sl.effect.key)] }}>{catalogTitle(sl.effect, lang)}</span>
          ))}
          <span className="ss-chain-open"><Icon name="edit" size={16} /> {t('cdOpen', lang)}</span>
        </button>
      </div>
      <div className="stack ss-actions" style={{ gap: 8 }}>
        <h3 className="sub">{t('ssUseTitle', lang)}</h3>
        {fits.length > 0 ? (
          <div className="row wrap" style={{ gap: 6 }}>
            <select className="field grow" value={target} onChange={(ev) => setTarget(ev.target.value)} aria-label={t('track', lang)}>
              {fits.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <button type="button" className="btn primary" disabled={!target || already} onClick={() => target && onUse(target, e.instrument)}>
              {already ? <><Icon name="check" size={16} /> {t('collectionInUse', lang)}</> : t('ssUseOn', lang)}
            </button>
          </div>
        ) : <p className="small muted" style={{ margin: 0 }}>{t('collectionNoTrack', lang)}</p>}
        <div className="row wrap" style={{ gap: 6 }}>
          {star ? (
            <button type="button" className="btn star-on" onClick={() => onUnstar(star)}><Icon name="starFill" size={16} /> {t('ssInKit', lang, { role: ROLE_NAMES[lang][star.role] })}</button>
          ) : (<>
            <select className="field grow" value={role} onChange={(ev) => setRole(ev.target.value as Role)} aria-label={t('ssKitRole', lang)}>
              {rolesFor(e.instrument).map((r) => <option key={r} value={r}>{t('cdKitAs', lang, { role: ROLE_NAMES[lang][r] })}</option>)}
            </select>
            <button type="button" className="btn" onClick={() => onStar({ key: e.instrument, role })}><Icon name="star" size={16} /> {t('ssAddKit', lang)}</button>
          </>)}
        </div>
        <button type="button" className="btn ghost" onClick={() => openDesigner({ base: e.instrument, from: e.instrument, start: chain })}>
          <Icon name="sliders" size={16} /> {t('ssMakeMine', lang)}
        </button>
      </div>
    </aside>
);
}

function MineDetail({ x, song, selectedId, lang, starOf, playBtn, openDesigner, onStar, onUnstar, onUseSound }: DetailProps & { x: CustomSound; onUseSound: (trackId: string, sound: CustomSound) => void }) {
  const fits = fittingTracks(song, x.base.key);
  const [target, setTarget] = useState<string>(() => (fits.find((f) => f.id === selectedId) ?? fits[0])?.id ?? '');
  const star = starOf(x.base.key, x.id);
  const role = defaultRole(x.base.key);
  return (
    <aside className="ss-detail" aria-label={x.name}>
      <span className="lbl">{t('mySounds', lang)}</span>
      <h2 className="display ss-title">{x.name}</h2>
      <span className="small muted">{t('basedOn', lang, { name: entryOf(x.base.key)?.title[lang] ?? catalogTitle(x.base, lang) })}</span>
      <div className="row wrap" style={{ gap: 8 }}>{playBtn(x.id, x.base.key, x.name, x.chain, true)}</div>
      <div className="stack" style={{ gap: 6 }}>
        <h3 className="sub">{t('cdFlow', lang)}</h3>
        <button type="button" className="ss-chain" onClick={() => openDesigner({ base: x.base.key, from: x.base.key, start: x.chain, sound: x })}>
          <span className="ss-chain-box">{t('cdInstrument', lang)}</span>
          {x.chain.slots.map((sl, i) => <span key={i} className={`ss-chain-box${sl.bypass ? ' off' : ''}`} style={{ ['--stage' as string]: STAGE_COLOR[stageOf(sl.effect.key)] }}>{catalogTitle(sl.effect, lang)}</span>)}
          <span className="ss-chain-open"><Icon name="edit" size={16} /> {t('rackEdit', lang)}</span>
        </button>
      </div>
      <div className="stack ss-actions" style={{ gap: 8 }}>
        <h3 className="sub">{t('ssUseTitle', lang)}</h3>
        {fits.length > 0 && (
          <div className="row wrap" style={{ gap: 6 }}>
            <select className="field grow" value={target} onChange={(ev) => setTarget(ev.target.value)} aria-label={t('track', lang)}>
              {fits.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button type="button" className="btn primary" disabled={!target} onClick={() => target && onUseSound(target, x)}>{t('ssUseOn', lang)}</button>
          </div>
        )}
        {star
          ? <button type="button" className="btn star-on" onClick={() => onUnstar(star)}><Icon name="starFill" size={16} /> {t('ssInKit', lang, { role: ROLE_NAMES[lang][star.role] })}</button>
          : <button type="button" className="btn" onClick={() => onStar({ key: x.base.key, role, sound: { id: x.id, name: x.name, chain: x.chain } })}><Icon name="star" size={16} /> {t('ssAddKitAs', lang, { role: ROLE_NAMES[lang][role] })}</button>}
      </div>
    </aside>
);
}

