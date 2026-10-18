// The studio: where every track's sound is made. One diagram runs across the top, in the order the sound flows:
// the track it is for, the instrument, each unit of its chain, and the desk it goes to, as the musician's sound or the
// producer's version. Tap a box and the work area shows what belongs to it: the tracks, the catalog, a unit's knobs,
// or where the sound goes. Whatever is tried stays a draft, heard in the song or alone, until it is used.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ENTRIES, entryOf, FAMILIES, GENRES, GROUPS, SOURCES } from '../packs/collection';
import type { Entry, Family, Genre } from '../packs/collection';
import { findByKey, findItem, KITS, kitSlots, ref, rowsOf, ROLES, title as catalogTitle } from '../packs/core';
import { engine } from '../engine/engine';
import type { CustomSound, FxChain, Lang, Role, Song, StarredInstrument, TrackVariant } from '../domain/types';
import { newId, now, ROLE_NAMES, roleOf } from '../domain/factory';
import { hasWritten } from '../domain/commands';
import { t } from './i18n';
import { Icon } from './ui';
import { familyOf, rackFor, templateFor } from './rack';
import { AddUnit, insertAt, newSlot, RigFlow, UnitEditor } from './Rig';
import type { RigSel } from './Rig';
import { auditionSong, currentOf, defaultRole, draftKind, fitsTrack, ownGear, rolesFor, sameChain, songGenre, suggestionsFor } from './sounddraft';
import type { Draft, Slot } from './sounddraft';

type Source = 'catalog' | 'kit' | 'mine';
type Shelf = Genre | 'more';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nameOf = (key: string, lang: Lang) => entryOf(key)?.title[lang] ?? (findItem({ key, version: '1.0.0' }) ? catalogTitle({ key, version: '1.0.0' }, lang) : key);

/** The synthesized instruments of the genre kits, as cards: every instrument the app has that is not in the catalog. */
const CORE = KITS.flatMap((k) => kitSlots(k.key).filter((s) => !entryOf(s.instrument)).map((s) => ({ kit: k, role: s.role, key: s.instrument })))
  .filter((x, i, all) => all.findIndex((y) => y.key === x.key) === i);

export default function SoundStudio({ song, selectedId, slot, playing, alone, starred, sounds, profileId, lang,
  onSelect, onSlot, onPlay, onAlone, onAudition, onUse, onUseSound, onProducerSound, onVoice, onDropProducer, onSaveSound, onDeleteSound,
  onStar, onUnstar, onBeat, onNewWithKit, onApplyKit, onDesk }: {
  song: Song;
  selectedId: string | null;
  /** The version being made: the musician's sound or the producer's. */
  slot: Slot;
  playing: boolean;
  alone: boolean;
  starred: StarredInstrument[];
  sounds: CustomSound[];
  profileId: string;
  lang: Lang;
  onSelect: (trackId: string) => void;
  onSlot: (s: Slot) => void;
  onPlay: () => void;
  onAlone: () => void;
  /** The song to play while here: the real one with the draft on its track, or null for the song as it is. */
  onAudition: (s: Song | null) => void;
  onUse: (trackId: string, instrumentKey: string) => void;
  onUseSound: (trackId: string, sound: CustomSound) => void;
  onProducerSound: (trackId: string, variant: Omit<TrackVariant, 'updated_at' | 'by'>) => void;
  onVoice: (trackId: string, from: Slot) => void;
  onDropProducer: (trackId: string) => void;
  onSaveSound: (sound: CustomSound) => Promise<void>;
  onDeleteSound: (id: string) => void;
  onStar: (s: StarredInstrument) => void;
  onUnstar: (s: StarredInstrument) => void;
  onBeat: () => void;
  onNewWithKit: () => void;
  onApplyKit: () => void;
  onDesk: () => void;
}) {
  const track = song.tracks.find((x) => x.id === selectedId) ?? song.tracks[0];
  const key = `${track.id}:${slot}`;
  const current = useMemo(() => currentOf(track, slot), [track, slot]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const draft = drafts[key] ?? current;
  const saved = draft.soundId ? sounds.find((x) => x.id === draft.soundId) : undefined;
  const kind = draftKind(draft, current, saved);
  const setDraft = (d: Draft) => setDrafts((m) => ({ ...m, [key]: d }));
  const resetDraft = () => setDrafts((m) => { const { [key]: _drop, ...rest } = m; return rest; });
  const setChain = (fn: (c: FxChain) => FxChain) => setDraft({ ...draft, chain: fn(draft.chain) });

  const [sel, setSel] = useState<RigSel>('instrument');
  const [upTo, setUpTo] = useState<number | null>(null);
  const [without, setWithout] = useState(false);
  const [ab, setAb] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [source, setSource] = useState<Source>('catalog');
  const [shelf, setShelf] = useState<Shelf>(() => entryOf(track.instrument?.key ?? '')?.genre ?? songGenre(song) ?? GENRES[0].id);
  const [family, setFamily] = useState<Family | 'all'>('all');
  const [fitOnly, setFitOnly] = useState(true);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'song' | 'solo'>('song');
  const [names, setNames] = useState<Record<string, string>>({});
  const [kitRole, setKitRole] = useState<Role | null>(null);

  // A new track or version starts on its instrument, nothing skipped.
  useEffect(() => { setSel('instrument'); setUpTo(null); setWithout(false); setAb(false); setAdding(null); setKitRole(null); }, [key]);

  const written = hasWritten(song, track.id);
  const songMode = mode === 'song' && written;
  const canAB = kind !== 'clean' || !sameChain(draft.chain, ownGear(draft.base));
  const abOn = ab && canAB;

  /** What is heard: the draft (up to a box, without a box), or, on A/B, what plays now (or the sound as it comes). */
  const heard = useMemo<{ base: string; chain: FxChain }>(() => {
    if (abOn) return kind !== 'clean' ? { base: current.base, chain: current.chain } : { base: draft.base, chain: ownGear(draft.base) };
    let slots = upTo === null ? draft.chain.slots : draft.chain.slots.slice(0, upTo + 1);
    if (without && typeof sel === 'number') slots = slots.map((x, i) => (i === sel ? { ...x, bypass: true } : x));
    return { base: draft.base, chain: { ...draft.chain, slots } };
  }, [abOn, kind, current, draft, upTo, without, sel]);

  /* ------------------------------------------------------------ listening */

  // In the song: the studio hands the engine the song with this track playing what is heard.
  const audition = useMemo(() => (songMode ? auditionSong(song, track.id, heard.base, heard.chain, draft.soundName ?? nameOf(heard.base, lang)) : null),
    [songMode, song, track.id, heard, draft.soundName, lang]);
  useEffect(() => { onAudition(audition); }, [audition, onAudition]);
  useEffect(() => () => onAudition(null), [onAudition]);

  // Alone: the sound with its own sample groove, looping.
  const [solo, setSolo] = useState(false);
  const [loading, setLoading] = useState(false);
  const soloToken = useRef(0);
  const soloTimer = useRef<number | undefined>(undefined);
  const soloBase = useRef('');
  const heardRef = useRef(heard);
  heardRef.current = heard;
  const startSolo = async (base: string, chain: FxChain) => {
    const e = templateFor(base);
    if (!e) return;
    const token = ++soloToken.current;
    soloBase.current = base;
    setLoading(true);
    const secs = await engine.previewGroove(base, e.groove, e.tempo, chain, 4, e.phrase);
    if (token !== soloToken.current) return;
    setLoading(false);
    if (secs <= 0) { setSolo(false); return; }
    setSolo(true);
    window.clearTimeout(soloTimer.current);
    soloTimer.current = window.setTimeout(() => {
      if (token === soloToken.current) startSolo(heardRef.current.base, heardRef.current.chain);
    }, Math.max(0.5, secs - 0.5) * 1000);
  };
  const stopSolo = () => { soloToken.current++; window.clearTimeout(soloTimer.current); engine.stopPreview(); setSolo(false); setLoading(false); };
  useEffect(() => () => { soloToken.current++; window.clearTimeout(soloTimer.current); engine.stopPreview(); }, []);
  useEffect(() => {
    if (!solo) return;
    if (heard.base !== soloBase.current) startSolo(heard.base, heard.chain);
    else engine.updatePreviewChain(heard.chain);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heard, solo]);
  // Leaving a track, or switching how to listen, stops the sound alone.
  useEffect(() => { if (solo) stopSolo(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, songMode]);

  const isPlaying = songMode ? playing : solo;
  const play = () => {
    if (songMode) onPlay();
    else if (solo) stopSolo();
    else startSolo(heard.base, heard.chain);
  };
  const ensurePlaying = (base: string, chain: FxChain) => {
    if (songMode) { if (!playing) onPlay(); }
    else startSolo(base, chain);
  };
  const pickMode = (m: 'song' | 'solo') => {
    if (m === mode) return;
    if (songMode && playing) onPlay();
    setMode(m);
  };

  /* ------------------------------------------------------------ loading sounds into the draft */

  const loadCatalog = (instrument: string, listen = false) => {
    const d: Draft = { base: instrument, chain: ownGear(instrument) };
    setDraft(d);
    setSel('instrument'); setUpTo(null); setWithout(false); setAb(false); setAdding(null);
    if (listen) ensurePlaying(d.base, d.chain);
  };
  const loadSound = (x: { id: string; name: string; base: string; chain: FxChain }, listen = false) => {
    const d: Draft = { base: x.base, chain: structuredClone(x.chain), soundId: x.id, soundName: x.name };
    setDraft(d);
    setSel('instrument'); setUpTo(null); setWithout(false); setAb(false); setAdding(null);
    if (listen) ensurePlaying(d.base, d.chain);
  };

  /* ------------------------------------------------------------ using and saving */

  const versionName = t(slot === 'producer' ? 'esVersionProducer' : 'esVersionMusician', lang);
  const instrumentName = draft.soundName ?? nameOf(draft.base, lang);
  const defaultName = draft.soundName ? t('esCopyName', lang, { name: draft.soundName }) : t('mySoundName', lang, { name: nameOf(draft.base, lang) });
  const name = names[key] ?? defaultName;
  const applyCatalog = () => {
    if (slot === 'producer') onProducerSound(track.id, { instrument: ref(draft.base) });
    else onUse(track.id, draft.base);
    resetDraft();
  };
  const applySaved = (x: { id: string; name: string; base: { key: string; version: string }; chain: FxChain }) => {
    if (slot === 'producer') onProducerSound(track.id, { instrument: x.base, sound: { id: x.id, name: x.name, chain: structuredClone(x.chain) } });
    else onUseSound(track.id, x as CustomSound);
    resetDraft();
  };
  const saveCustom = async (andUse: boolean, update: boolean) => {
    const at = now();
    const made: CustomSound = {
      id: update && saved ? saved.id : newId(), profile_id: profileId, name: (update && saved ? saved.name : name.trim()) || defaultName,
      base: ref(draft.base), chain: structuredClone(draft.chain), chain_schema_version: 1, status: 'active', origin: 'person',
      created_at: update && saved ? saved.created_at : at, updated_at: at,
    };
    await onSaveSound(made);
    setNames((m) => { const { [key]: _n, ...rest } = m; return rest; });
    if (andUse) applySaved(made);
    else setDraft({ ...draft, soundId: made.id, soundName: made.name });
  };

  /* ------------------------------------------------------------ the chain */

  const original = ownGear(draft.base);
  const unit = typeof sel === 'number' ? draft.chain.slots[sel] : undefined;
  const addUnit = (k: string) => {
    const at = adding ?? insertAt(draft.chain, k);
    setChain((c) => ({ ...c, slots: [...c.slots.slice(0, at), newSlot(k), ...c.slots.slice(at)] }));
    setSel(at); setAdding(null); setUpTo(null);
  };
  const moveUnit = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= draft.chain.slots.length) return;
    setChain((c) => { const slots = [...c.slots]; [slots[i], slots[j]] = [slots[j], slots[i]]; return { ...c, slots }; });
    setSel(j); setUpTo(null);
  };
  const removeUnit = (i: number) => {
    setChain((c) => ({ ...c, slots: c.slots.filter((_, j) => j !== i) }));
    setSel(draft.chain.slots.length > 1 ? Math.max(0, i - 1) : 'instrument'); setUpTo(null); setWithout(false);
  };

  /* ------------------------------------------------------------ what the boxes say */

  const plays = slot === 'producer' ? !!track.producer && track.voice_from === 'producer' : !(track.producer && track.voice_from === 'producer');
  const entry = entryOf(draft.base);
  const core = CORE.find((x) => x.key === draft.base);
  const ends = {
    track: { name: track.name, color: track.color, sum: ROLE_NAMES[lang][roleOf(track)] === track.name ? versionName : `${ROLE_NAMES[lang][roleOf(track)]} · ${versionName}` },
    instrument: { name: instrumentName, sum: draft.soundId ? t('mySounds', lang) : entry ? entry.era[lang].split(' · ')[0] : core ? t('esCoreKit', lang, { kit: core.kit.title[lang] }) : '' },
    out: {
      name: versionName,
      sum: slot === 'producer' && !track.producer ? t('esNoProducerYet', lang) : plays ? t('esPlaysNow', lang) : t('esNotPlaying', lang),
      warn: !plays,
    },
  };

  const unitName = (i: number) => catalogTitle(draft.chain.slots[i].effect, lang);
  const status = !written && mode === 'song'
    ? t('esEmptyTrack', lang, { track: track.name })
    : abOn
      ? (kind !== 'clean' ? t('esNowBefore', lang, { track: track.name }) : t('esNowOriginal', lang, { name: nameOf(draft.base, lang) }))
      : `${songMode ? t('esNowSong', lang, { name: instrumentName, track: track.name }) : t('esNowSolo', lang, { name: instrumentName })}${upTo !== null ? ` ${t('esNowUpTo', lang, { unit: unitName(upTo) })}` : without && typeof sel === 'number' ? ` ${t('esNowWithout', lang, { unit: unitName(sel) })}` : ''}`;

  /* ------------------------------------------------------------ the catalog */

  const q = norm(query.trim());
  const fit = (k: string) => !fitOnly || fitsTrack(k, track);
  const entries = useMemo(() => ENTRIES.filter((e) => fit(e.instrument) && (q
    ? norm(`${e.title[lang]} ${e.era[lang]} ${e.blurb[lang]} ${GROUPS.find((g) => g.id === e.group)?.title[lang] ?? ''}`).includes(q)
    : shelf !== 'more' && e.genre === shelf && (family === 'all' || e.family === family))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [q, shelf, family, fitOnly, track, lang]);
  const cores = useMemo(() => CORE.filter((x) => fit(x.key) && (q ? norm(`${nameOf(x.key, lang)} ${x.kit.title[lang]}`).includes(q) : shelf === 'more')),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [q, shelf, fitOnly, track, lang]);
  const groups = useMemo(() => {
    const out: { id: string; title: string; items: Entry[] }[] = [];
    for (const e of entries) {
      let g = out.find((x) => x.id === e.group);
      if (!g) { g = { id: e.group, title: GROUPS.find((x) => x.id === e.group)?.title[lang] ?? e.group, items: [] }; out.push(g); }
      g.items.push(e);
    }
    return out;
  }, [entries, lang]);
  // Suggestions earn their place: they go with the other tracks (era, style), or bring the song's genre while another is browsed.
  const suggestions = useMemo(() => (source === 'catalog' && !q
    ? suggestionsFor(song, track, lang).filter((x) => !x.byGenreOnly || x.entry.genre !== shelf) : []), [source, q, song, track, lang, shelf]);
  const familiesHere = shelf === 'more' ? [] : FAMILIES.filter((f) => ENTRIES.some((e) => e.genre === shelf && e.family === f.id && fit(e.instrument)));

  const usedOn = (k: string) => song.tracks.filter((x) => (x.instrument?.key === k && !x.sound) || (x.producer?.instrument?.key === k && !x.producer.sound)).map((x) => x.name);
  const starOf = (k: string, soundId?: string) => starred.find((x) => x.key === k && (soundId ? x.sound?.id === soundId : !x.sound));

  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { if (!isPlaying) setPreview(null); }, [isPlaying]);
  const card = (id: string, title: string, sub: string, load: (listen: boolean) => void, opts: { loaded: boolean; used?: string[]; star?: boolean; reason?: string }) => {
    const on = preview === id && isPlaying;
    return (
      <div key={id} role="button" tabIndex={0} className={`es-card${opts.loaded ? ' on' : ''}`} aria-pressed={opts.loaded} aria-label={title}
        onClick={() => load(false)} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); load(false); } }}>
        <button type="button" className={`ss-play${on ? ' on' : ''}`} aria-label={on ? t('stop', lang) : t('listenTo', lang, { name: title })} title={on ? t('stop', lang) : t('listenTo', lang, { name: title })}
          onClick={(ev) => { ev.stopPropagation(); if (on) { play(); return; } setPreview(id); load(true); }}>
          <Icon name={on ? 'stop' : 'play'} size={14} />
        </button>
        <span className="stack grow" style={{ gap: 1, minWidth: 0 }}>
          <strong className="ellipsis">{title}</strong>
          <span className="small muted ellipsis">{sub}</span>
          {opts.reason && <span className="es-reason ellipsis">{opts.reason}</span>}
        </span>
        <span className="es-card-marks">
          {opts.star && <span className="ss-star" title={t('myKit', lang)}><Icon name="starFill" size={14} /></span>}
          {!!opts.used?.length && <span className="es-used" title={t('esPlaysOn', lang, { tracks: opts.used.join(', ') })}><Icon name="check" size={13} /></span>}
        </span>
      </div>
    );
  };
  const entryCard = (e: Entry, reason?: string) => card(`e:${e.instrument}${reason ? ':s' : ''}`, e.title[lang], e.era[lang], (listen) => loadCatalog(e.instrument, listen),
    { loaded: draft.base === e.instrument && !draft.soundId, used: usedOn(e.instrument), star: !!starOf(e.instrument), reason });

  /* ------------------------------------------------------------ the work area for each box */

  const trackChooser = (
    <section className="es-panel" aria-label={t('esChooseTrack', lang)}>
      <div className="stack" style={{ gap: 2 }}>
        <h3 className="display" style={{ fontSize: 20 }}>{t('esChooseTrack', lang)}</h3>
        <p className="small muted" style={{ margin: 0 }}>{t('esChooseTrackHint', lang)}</p>
      </div>
      <div className="es-tracks">
        {song.tracks.map((tr) => {
          const prodPlays = !!tr.producer && tr.voice_from === 'producer';
          const pick = (s: Slot) => { onSelect(tr.id); onSlot(s); setSel('instrument'); };
          return (
            <div key={tr.id} className={`es-track${tr.id === track.id ? ' on' : ''}`} style={{ ['--trk' as string]: tr.color }}>
              <div className="row" style={{ gap: 8 }}><span className="swatch" style={{ background: tr.color }} /><strong className="grow ellipsis">{tr.name}</strong>{ROLE_NAMES[lang][roleOf(tr)] !== tr.name && <span className="small muted">{ROLE_NAMES[lang][roleOf(tr)]}</span>}</div>
              <button type="button" className={`es-ver${tr.id === track.id && slot === 'musician' ? ' sel' : ''}`} onClick={() => pick('musician')}>
                <span className="lbl">{t('musician', lang)}{!prodPlays && <span className="es-plays">{t('plays', lang)}</span>}</span>
                <span className="ellipsis">{tr.sound?.name ?? nameOf(tr.instrument?.key ?? '', lang)}</span>
              </button>
              <button type="button" className={`es-ver${tr.id === track.id && slot === 'producer' ? ' sel' : ''}${tr.producer ? '' : ' none'}`} onClick={() => pick('producer')}>
                <span className="lbl">{t('producer', lang)}{prodPlays && <span className="es-plays">{t('plays', lang)}</span>}</span>
                <span className="ellipsis">{tr.producer ? tr.producer.sound?.name ?? nameOf(tr.producer.instrument?.key ?? '', lang) : t('esMakeProducer', lang)}</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );

  const destination = (
    <section className="es-panel" aria-label={t('esDest', lang)}>
      <h3 className="display" style={{ fontSize: 20 }}>{t('esDestTitle', lang, { track: track.name })}</h3>
      <p className="small muted" style={{ margin: 0 }}>{t('cdOutputHint', lang)}</p>
      <div className="seg" aria-label={t('esVersion', lang)}>
        <button type="button" aria-pressed={slot === 'musician'} onClick={() => onSlot('musician')}>{t('esVersionMusician', lang)}</button>
        <button type="button" aria-pressed={slot === 'producer'} onClick={() => onSlot('producer')}>{t('esVersionProducer', lang)}</button>
      </div>
      <p style={{ margin: 0 }}>{plays ? t('esDestPlays', lang, { version: versionName.toLowerCase() }) : slot === 'producer' && !track.producer ? t('esNoProducerYetLong', lang) : t('esDestNotPlaying', lang, { version: versionName.toLowerCase() })}</p>
      <div className="row wrap" style={{ gap: 8 }}>
        {!plays && (slot === 'musician' || track.producer) && <button type="button" className="btn primary" onClick={() => onVoice(track.id, slot)}><Icon name="play" size={16} /> {t('esMakePlay', lang)}</button>}
        {slot === 'producer' && track.producer && <button type="button" className="btn ghost" onClick={() => onDropProducer(track.id)}><Icon name="trash" size={16} /> {t('esDropProducer', lang)}</button>}
        <button type="button" className="btn" onClick={onDesk}><Icon name="sliders" size={16} /> {t('esOpenDesk', lang)}</button>
      </div>
    </section>
  );

  const roleForKit = (k: string): Role => kitRole ?? (fitsTrack(k, track) && rolesFor(k).includes(roleOf(track)) ? roleOf(track) : defaultRole(k));
  const inspector = (
    <aside className="es-inspector" aria-label={instrumentName}>
      {draft.soundId ? (<>
        <span className="lbl">{t('mySounds', lang)}</span>
        <h2 className="display ss-title">{draft.soundName}</h2>
        <span className="small muted">{t('basedOn', lang, { name: nameOf(draft.base, lang) })}</span>
      </>) : (<>
        <span className="lbl">{entry ? `${GENRES.find((g) => g.id === entry.genre)?.title[lang]} · ${GROUPS.find((g) => g.id === entry.group)?.title[lang]}` : t('instrumentsCore', lang)}</span>
        <h2 className="display ss-title">{nameOf(draft.base, lang)}</h2>
        {entry ? (<>
          <span className="small muted">{entry.era[lang]}</span>
          <p style={{ margin: 0 }}>{entry.blurb[lang]}</p>
        </>) : core && <p style={{ margin: 0 }}>{t('esCoreBlurb', lang, { kit: core.kit.title[lang] })}</p>}
      </>)}
      {familyOf(draft.base) === 'drums' && (
        <div className="stack" style={{ gap: 6 }}>
          <h3 className="sub">{t('collectionPieces', lang)}</h3>
          <div className="col-pads" role="group" aria-label={t('collectionPieces', lang)}>
            {rowsOf(draft.base).map((k) => {
              const voice = String(findByKey(k)?.manifest.voice ?? k);
              return (
                <button key={k} type="button" className="col-pad" onPointerDown={() => engine.previewPiece(draft.base, voice)}
                  onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); engine.previewPiece(draft.base, voice); } }}>
                  {findByKey(k)?.title[lang] ?? voice}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="stack es-kitrow" style={{ gap: 6 }}>
        <h3 className="sub">{t('myKit', lang)}</h3>
        {(() => {
          const star = starOf(draft.base, draft.soundId);
          if (star) return <button type="button" className="btn star-on" onClick={() => onUnstar(star)}><Icon name="starFill" size={16} /> {t('ssInKit', lang, { role: ROLE_NAMES[lang][star.role] })}</button>;
          if (draft.soundId && !saved) return <p className="small muted" style={{ margin: 0 }}>{t('esSaveFirst', lang)}</p>;
          const role = roleForKit(draft.base);
          return (
            <div className="row wrap" style={{ gap: 6 }}>
              <select className="field grow" value={role} onChange={(ev) => setKitRole(ev.target.value as Role)} aria-label={t('ssKitRole', lang)}>
                {rolesFor(draft.base).map((r) => <option key={r} value={r}>{t('cdKitAs', lang, { role: ROLE_NAMES[lang][r] })}</option>)}
              </select>
              <button type="button" className="btn" onClick={() => onStar(draft.soundId && saved ? { key: draft.base, role, sound: { id: saved.id, name: saved.name, chain: saved.chain } } : { key: draft.base, role })}>
                <Icon name="star" size={16} /> {t('ssAddKit', lang)}
              </button>
            </div>
          );
        })()}
      </div>
      {draft.soundId && saved && (
        <button type="button" className="btn ghost small-btn" style={{ alignSelf: 'flex-start' }} onClick={() => { onDeleteSound(saved.id); resetDraft(); }}>
          <Icon name="trash" size={16} /> {t('mySoundDelete', lang)}
        </button>
      )}
    </aside>
  );

  const kitName = (s: StarredInstrument) => s.sound?.name ?? nameOf(s.key, lang);
  const browser = (
    <section className="es-browser" aria-label={t('esCatalog', lang)}>
      <div className="es-browser-head">
        <div className="seg" role="group" aria-label={t('esSources', lang)}>
          <button type="button" aria-pressed={source === 'catalog'} onClick={() => setSource('catalog')}>{t('esCatalog', lang)}</button>
          <button type="button" aria-pressed={source === 'kit'} onClick={() => setSource('kit')}><Icon name="starFill" size={14} /> {t('myKit', lang)} <span className="mono small">{starred.length}</span></button>
          <button type="button" aria-pressed={source === 'mine'} onClick={() => setSource('mine')}><Icon name="sliders" size={14} /> {t('mySounds', lang)} <span className="mono small">{sounds.length}</span></button>
        </div>
        <label className="ss-search grow">
          <Icon name="list" size={16} />
          <input className="field" type="search" value={query} placeholder={t('ssSearch', lang)} aria-label={t('ssSearch', lang)}
            onChange={(e) => { setQuery(e.target.value); setSource('catalog'); }} />
        </label>
        <button type="button" className="btn small-btn beat-btn" onClick={onBeat} title={t('beatOpenHint', lang)}><Icon name="music" size={16} /> <span className="hide-sm">{t('beatOpen', lang)}</span></button>
      </div>

      {source === 'catalog' && (<>
        <div className="es-filters">
          {!q && (
            <div className="seg small-seg" role="group" aria-label={t('genre', lang)}>
              {GENRES.map((g) => <button key={g.id} type="button" aria-pressed={shelf === g.id} onClick={() => { setShelf(g.id); setFamily('all'); }}>{g.title[lang]}</button>)}
              <button type="button" aria-pressed={shelf === 'more'} onClick={() => setShelf('more')}>{t('esMore', lang)}</button>
            </div>
          )}
          {!q && familiesHere.length > 1 && (
            <div className="row wrap" style={{ gap: 6 }}>
              <button type="button" className="chip" aria-pressed={family === 'all'} onClick={() => setFamily('all')}>{t('ssAll', lang)}</button>
              {familiesHere.map((f) => <button key={f.id} type="button" className="chip" aria-pressed={family === f.id} onClick={() => setFamily(f.id)}>{f.title[lang]}</button>)}
            </div>
          )}
          <label className="row es-fit">
            <input type="checkbox" checked={fitOnly} onChange={(e) => setFitOnly(e.target.checked)} />
            <span>{t('esFitOnly', lang, { track: track.name })}</span>
          </label>
        </div>
        {suggestions.length > 0 && (
          <div className="es-group es-suggest" role="group" aria-label={t('esSuggested', lang)}>
            <h3 className="ss-group-title">{t('esSuggested', lang)} <span className="muted es-suggest-hint">{t('esSuggestedHint', lang)}</span></h3>
            <div className="es-cards">{suggestions.map((s) => entryCard(s.entry, s.reasons[0]))}</div>
          </div>
        )}
        {groups.map((g) => (
          <div key={g.id} className="es-group" role="group" aria-label={g.title}>
            <h3 className="ss-group-title">{g.title}</h3>
            <div className="es-cards">{g.items.map((e) => entryCard(e))}</div>
          </div>
        ))}
        {cores.length > 0 && KITS.filter((k) => cores.some((x) => x.kit.key === k.key)).map((k) => (
          <div key={k.key} className="es-group" role="group" aria-label={k.title[lang]}>
            <h3 className="ss-group-title">{t('esCoreGroup', lang, { kit: k.title[lang] })}</h3>
            <div className="es-cards">
              {cores.filter((x) => x.kit.key === k.key).map((x) => card(`c:${x.key}`, nameOf(x.key, lang), ROLE_NAMES[lang][x.role], (listen) => loadCatalog(x.key, listen),
                { loaded: draft.base === x.key && !draft.soundId, used: usedOn(x.key), star: !!starOf(x.key) }))}
            </div>
          </div>
        ))}
        {!entries.length && !cores.length && <p className="muted">{fitOnly ? t('esNothingFits', lang, { track: track.name }) : t('ssNothing', lang)}</p>}
        <details className="small muted col-credits">
          <summary>{t('ssCredits', lang)}</summary>
          <p style={{ margin: '6px 0' }}>{t('collectionCredits', lang).replace(/\s*(Credits|Créditos)$/, '')}</p>
          <ul>{SOURCES.map((x) => <li key={x.name}><a href={x.url} target="_blank" rel="noreferrer">{x.name}</a>, {x.by} · {x.license}</li>)}</ul>
          <p style={{ margin: 0 }}>{t('collectionChanges', lang)}</p>
        </details>
      </>)}

      {source === 'mine' && (
        <div className="es-group">
          {!sounds.length && <p className="muted">{t('esNoMine', lang)}</p>}
          <div className="es-cards">
            {sounds.filter((x) => fit(x.base.key)).map((x) => card(`m:${x.id}`, x.name, t('basedOn', lang, { name: nameOf(x.base.key, lang) }),
              (listen) => loadSound({ id: x.id, name: x.name, base: x.base.key, chain: x.chain }, listen),
              { loaded: draft.soundId === x.id, star: !!starOf(x.base.key, x.id), used: song.tracks.filter((tr) => tr.sound?.id === x.id || tr.producer?.sound?.id === x.id).map((tr) => tr.name) }))}
          </div>
          {sounds.length > 0 && fitOnly && !sounds.some((x) => fit(x.base.key)) && <p className="muted">{t('esNothingFits', lang, { track: track.name })}</p>}
        </div>
      )}

      {source === 'kit' && (
        <div className="es-group">
          <div className="row wrap" style={{ gap: 8 }}>
            <p className="small muted grow" style={{ margin: 0 }}>{t('myKitHint', lang)}</p>
            <button type="button" className="btn small-btn" disabled={!starred.length} onClick={onApplyKit}>{t('myKitApply', lang)}</button>
            <button type="button" className="btn small-btn primary" disabled={!starred.length} onClick={onNewWithKit}><Icon name="plus" size={16} /> {t('myKitNew', lang)}</button>
          </div>
          {!starred.length && <p className="muted">{t('esKitEmpty', lang)}</p>}
          {ROLES.filter((r) => starred.some((s) => s.role === r)).map((r) => (
            <div key={r} className="es-group" role="group" aria-label={ROLE_NAMES[lang][r]}>
              <h3 className="ss-group-title">{ROLE_NAMES[lang][r]}</h3>
              <div className="es-cards">
                {starred.filter((s) => s.role === r).map((s) => (
                  <div key={`${s.key}-${s.sound?.id ?? ''}`} className="es-kitcard">
                    {card(`k:${s.key}:${s.sound?.id ?? ''}`, kitName(s), s.sound ? t('mySounds', lang) : entryOf(s.key)?.era[lang] ?? t('instrumentsCore', lang),
                      (listen) => (s.sound ? loadSound({ id: s.sound.id, name: s.sound.name, base: s.key, chain: s.sound.chain }, listen) : loadCatalog(s.key, listen)),
                      { loaded: s.sound ? draft.soundId === s.sound.id : draft.base === s.key && !draft.soundId })}
                    <button type="button" className="btn icon ghost es-unstar" onClick={() => onUnstar(s)} aria-label={t('unstar', lang, { name: kitName(s) })} title={t('unstar', lang, { name: kitName(s) })}><Icon name="close" size={16} /></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  /* ------------------------------------------------------------ the bar that uses or saves */

  const bar = kind === 'clean' ? null : (
    <div className="es-bar" role="region" aria-label={t('esBar', lang)}>
      <div className="stack grow" style={{ gap: 0, minWidth: 0 }}>
        <strong className="ellipsis">{kind === 'custom' ? t('esChanged', lang) : t('esTrying', lang, { name: instrumentName, track: track.name })}</strong>
        <span className="small muted ellipsis">{kind === 'custom' ? t('esChangedHint', lang) : t('esTryingHint', lang, { version: versionName.toLowerCase() })}</span>
      </div>
      {kind === 'custom' && (
        <label className="stack es-name" style={{ gap: 2 }}>
          <span className="lbl">{t('mySoundNameLabel', lang)}</span>
          <input className="field" value={name} maxLength={40} onChange={(e) => setNames((m) => ({ ...m, [key]: e.target.value }))} />
        </label>
      )}
      <div className="row wrap es-bar-actions">
        <button type="button" className="btn ghost" onClick={resetDraft}>{t('esDiscard', lang)}</button>
        {kind === 'catalog' && <button type="button" className="btn primary" onClick={applyCatalog}><Icon name="check" size={18} /> {t(slot === 'producer' ? 'esUseProducer' : 'esUseOn', lang, { track: track.name })}</button>}
        {kind === 'mine' && saved && <button type="button" className="btn primary" onClick={() => applySaved(saved)}><Icon name="check" size={18} /> {t(slot === 'producer' ? 'esUseProducer' : 'esUseOn', lang, { track: track.name })}</button>}
        {kind === 'custom' && (<>
          {saved && <button type="button" className="btn" onClick={() => saveCustom(false, true)}>{t('esUpdate', lang, { name: saved.name })}</button>}
          <button type="button" className="btn" onClick={() => saveCustom(false, false)}>{t('mySoundSave', lang)}</button>
          <button type="button" className="btn primary" onClick={() => saveCustom(true, false)}><Icon name="check" size={18} /> {t(slot === 'producer' ? 'esSaveUseProducer' : 'esSaveUse', lang, { track: track.name })}</button>
        </>)}
      </div>
    </div>
  );

  const work = sel === 'track' ? trackChooser
    : sel === 'out' ? destination
      : typeof sel === 'number' && unit ? (
        <UnitEditor key={`${key}-${sel}-${unit.effect.key}`} slot={unit} index={sel} count={draft.chain.slots.length} lang={lang}
          original={original.slots.find((x) => x.effect.key === unit.effect.key)} without={without}
          onChange={(params) => setChain((c) => ({ ...c, slots: c.slots.map((x, j) => (j === sel ? { ...x, params } : x)) }))}
          onSwap={(k) => setChain((c) => ({ ...c, slots: c.slots.map((x, j) => (j === sel ? newSlot(k) : x)) }))}
          onToggle={() => setChain((c) => ({ ...c, slots: c.slots.map((x, j) => (j === sel ? { ...x, bypass: !x.bypass } : x)) }))}
          onWithout={() => { setWithout((w) => !w); setAb(false); if (!isPlaying) ensurePlaying(heard.base, heard.chain); }}
          onMove={(d) => moveUnit(sel, d)}
          onRestore={() => { const o = original.slots.find((x) => x.effect.key === unit.effect.key); if (o) setChain((c) => ({ ...c, slots: c.slots.map((x, j) => (j === sel ? structuredClone(o) : x)) })); }}
          onRemove={() => removeUnit(sel)} />
      ) : null;

  return (
    <div className={`estudio${bar ? ' with-bar' : ''}`}>
      <div className="es-head">
        <div className="row wrap" style={{ gap: 10, minWidth: 0 }}>
          <span className="swatch big" style={{ background: track.color }} />
          <h2 className="display es-title ellipsis">{t('trackSoundOf', lang, { name: track.name })}</h2>
          <div className="seg" role="group" aria-label={t('esVersion', lang)}>
            <button type="button" aria-pressed={slot === 'musician'} onClick={() => onSlot('musician')}>{t('musician', lang)}</button>
            <button type="button" aria-pressed={slot === 'producer'} onClick={() => onSlot('producer')}>{t('producer', lang)}{track.producer && <span className="es-dot" aria-hidden="true" />}</button>
          </div>
        </div>
        <div className="row wrap es-listen">
          <button type="button" className={`btn${isPlaying ? ' primary' : ''}`} onClick={play}>
            <Icon name={isPlaying ? 'stop' : 'play'} size={18} /> {loading ? t('collectionLoading', lang) : isPlaying ? t('stop', lang) : t('cdListen', lang)}
          </button>
          <div className="seg small-seg" role="group" aria-label={t('esListenHow', lang)}>
            <button type="button" aria-pressed={songMode} disabled={!written} title={written ? t('esInSongHint', lang, { track: track.name }) : t('esEmptyTrack', lang, { track: track.name })} onClick={() => pickMode('song')}>{t('esInSong', lang)}</button>
            <button type="button" aria-pressed={!songMode} onClick={() => pickMode('solo')}>{t('esSoloSound', lang)}</button>
          </div>
          {songMode && <button type="button" className="btn small-btn" aria-pressed={alone} onClick={onAlone} title={t('onlyThisHint', lang)}><Icon name="headphones" size={16} /> {t('onlyThis', lang)}</button>}
          <button type="button" className="btn small-btn" aria-pressed={abOn} disabled={!canAB} onClick={() => { setAb((a) => !a); setUpTo(null); if (!isPlaying) ensurePlaying(heard.base, heard.chain); }} title={t('esABHint', lang)}>
            <Icon name="swap" size={16} /> A/B
          </button>
        </div>
        <p className="small muted es-now" aria-live="polite">{status}</p>
      </div>

      <RigFlow chain={draft.chain} ends={ends} sel={sel} upTo={upTo} adding={adding} lang={lang}
        onSel={(s) => { setSel(s); setWithout(false); setAdding(null); }}
        onToggle={(i) => setChain((c) => ({ ...c, slots: c.slots.map((x, j) => (j === i ? { ...x, bypass: !x.bypass } : x)) }))}
        onUpTo={(i) => { setUpTo(upTo === i ? null : i); setAb(false); if (!isPlaying) ensurePlaying(heard.base, heard.chain); }}
        onAdd={setAdding}
        onStarter={() => { setChain(() => rackFor(familyOf(draft.base))); setSel(0); }} />
      {adding !== null && <AddUnit lang={lang} onPick={addUnit} onCancel={() => setAdding(null)} />}

      <div className={`es-work${sel === 'instrument' ? ' split' : ''}`}>
        {sel === 'instrument' ? (<>{browser}{inspector}</>) : work}
      </div>
      {bar}
    </div>
  );
}
