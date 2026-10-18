import { useEffect, useRef, useState } from 'react';
import { entriesIn, entryOf, familiesIn, FAMILIES, GENRES, groupsIn, SOURCES } from '../packs/collection';
import type { Family, Genre } from '../packs/collection';
import { effectParams, findByKey, title as catalogTitle } from '../packs/core';
import { engine } from '../engine/engine';
import type { CustomSound, FxChain, FxSlot, Lang, Song } from '../domain/types';
import { newId, now } from '../domain/factory';
import { t } from './i18n';
import { ChoiceParam, formatParam, PEDAL_BLURB } from './panels';
import { Icon, Modal } from './ui';
import { familyOf, rackBase, rackOf, targetTrack, templateFor } from './rack';

/** The pieces of a full kit, in the order a drummer names them. */
const PIECES: { voice: string; key: string }[] = [
  { voice: 'kick', key: 'sound.kick' }, { voice: 'snare', key: 'sound.snare' },
  { voice: 'tom1', key: 'sound.tom-1' }, { voice: 'tom2', key: 'sound.tom-2' },
  { voice: 'hatClosed', key: 'sound.hat-closed' }, { voice: 'hatOpen', key: 'sound.hat-open' },
  { voice: 'ride', key: 'sound.ride' }, { voice: 'crash', key: 'sound.crash' }, { voice: 'china', key: 'sound.china' },
];

/* ---------------------------------------------------------------- the Colección */

export default function Collection({ song, selectedId, profileId, lang, sounds, onUse, onUseSound, onSaveSound, onDeleteSound, onClose }: {
  song: Song;
  selectedId: string | null;
  profileId: string;
  lang: Lang;
  sounds: CustomSound[];
  onUse: (trackId: string, instrumentKey: string) => void;
  onUseSound: (trackId: string, sound: CustomSound) => void;
  onSaveSound: (sound: CustomSound) => void;
  onDeleteSound: (id: string) => void;
  onClose: () => void;
}) {
  const [genre, setGenre] = useState<Genre>(GENRES[0].id);
  const families = familiesIn(genre);
  const [family, setFamily] = useState<Family>(families[0] ?? 'drums');
  const [open, setOpen] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [rack, setRack] = useState<null | { base: string; from?: string; sound?: CustomSound }>(null);
  const stopTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => { engine.stopPreview(); window.clearTimeout(stopTimer.current); }, []);

  const target = targetTrack(song, selectedId, family);
  const inUse = new Set(song.tracks.filter((tr) => !tr.sound).map((tr) => tr.instrument?.key).filter(Boolean) as string[]);
  const soundsInUse = new Set(song.tracks.map((tr) => tr.sound?.id).filter(Boolean) as string[]);
  const mine = sounds.filter((x) => familyOf(x.base.key) === family && (entryOf(x.base.key)?.genre ?? genre) === genre);

  /** Play (or stop) a groove; `id` names what is playing so its button shows Stop. */
  const listen = async (id: string, instrumentKey: string, chain?: FxChain) => {
    window.clearTimeout(stopTimer.current);
    if (playing === id) { engine.stopPreview(); setPlaying(null); return; }
    engine.stopPreview();
    setPlaying(null);
    const e = templateFor(instrumentKey);
    if (!e) return;
    setLoading(id);
    const secs = await engine.previewGroove(instrumentKey, e.groove, e.tempo, chain, chain ? 4 : 1, e.phrase);
    setLoading((l) => (l === id ? null : l));
    if (secs <= 0) return;
    setPlaying(id);
    stopTimer.current = window.setTimeout(() => setPlaying((p) => (p === id ? null : p)), secs * 1000);
  };

  const listenBtn = (id: string, instrumentKey: string, name: string, chain?: FxChain) => (
    <button type="button" className={`btn small-btn${playing === id ? ' on' : ''}`} onClick={() => listen(id, instrumentKey, chain)}
      aria-label={playing === id ? t('stop', lang) : t('listenTo', lang, { name })}>
      <Icon name={playing === id ? 'stop' : 'play'} size={16} />
      {loading === id ? t('collectionLoading', lang) : playing === id ? t('stop', lang) : t('collectionListen', lang)}
    </button>
  );

  return (
    <section className="collection" aria-label={t('collection', lang)}>
      <div className="row wrap">
        <button type="button" className="btn" onClick={onClose}><Icon name="back" size={18} /> {t('console', lang)}</button>
        <h2 className="display grow" style={{ fontSize: 24 }}>{t('collection', lang)}</h2>
      </div>
      <p className="muted" style={{ margin: 0 }}>{t('collectionHint', lang)}</p>

      <div className="row wrap" style={{ gap: 10 }}>
        {GENRES.length > 1 && (
          <div className="seg" aria-label={t('genre', lang)}>
            {GENRES.map((g) => <button key={g.id} type="button" aria-pressed={genre === g.id} onClick={() => { setGenre(g.id); setFamily(familiesIn(g.id)[0] ?? 'drums'); }}>{g.title[lang]}</button>)}
          </div>
        )}
        <div className="row wrap" style={{ gap: 6 }} role="group" aria-label={t('collectionFamily', lang)}>
          {FAMILIES.filter((f) => families.includes(f.id)).map((f) => (
            <button key={f.id} type="button" className="chip" aria-pressed={family === f.id} onClick={() => setFamily(f.id)}>{f.title[lang]}</button>
          ))}
        </div>
      </div>

      {!target && <p className="small muted" role="note" style={{ margin: 0 }}>{t('collectionNoTrack', lang)}</p>}

      {mine.length > 0 && (
        <section className="stack" style={{ gap: 10 }} aria-label={t('mySounds', lang)}>
          <h3 className="col-group">{t('mySounds', lang)}</h3>
          <div className="col-grid">
            {mine.map((x) => {
              const used = soundsInUse.has(x.id);
              const gear = x.chain.slots.filter((sl) => !sl.bypass).map((sl) => catalogTitle(sl.effect, lang)).join(' · ');
              return (
                <article key={x.id} className={`col-card mine${used ? ' used' : ''}`} aria-label={x.name}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                      <strong className="col-name">{x.name}</strong>
                      <span className="small muted">{t('basedOn', lang, { name: entryOf(x.base.key)?.title[lang] ?? catalogTitle(x.base, lang) })}</span>
                    </div>
                    {used && <span className="col-badge"><Icon name="check" size={14} /> {t('collectionInUse', lang)}</span>}
                  </div>
                  <p className="small" style={{ margin: 0 }}>{gear || t('rackEmpty', lang)}</p>
                  <div className="row wrap" style={{ gap: 6 }}>
                    {listenBtn(x.id, x.base.key, x.name, x.chain)}
                    <button type="button" className="btn small-btn ghost" onClick={() => { engine.stopPreview(); setPlaying(null); setRack({ base: x.base.key, sound: x }); }}>
                      <Icon name="sliders" size={16} /> {t('rackEdit', lang)}
                    </button>
                    <span className="grow" />
                    <button type="button" className="btn small-btn primary" disabled={!target} onClick={() => target && onUseSound(target.id, x)}>
                      {target ? t('collectionUse', lang, { track: target.name }) : t('collectionUseNone', lang)}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {groupsIn(genre, family).map((g) => (
        <section key={g.id} className="stack" style={{ gap: 10 }} aria-label={g.title[lang]}>
          <h3 className="col-group">{g.title[lang]}</h3>
          <div className="col-grid">
            {entriesIn(genre, family, g.id).map((e) => {
              const used = inUse.has(e.instrument);
              const isOpen = open === e.instrument;
              return (
                <article key={e.instrument} className={`col-card${used ? ' used' : ''}`} aria-label={e.title[lang]}>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <div className="stack grow" style={{ gap: 2, minWidth: 0 }}>
                      <strong className="col-name">{e.title[lang]}</strong>
                      <span className="small muted">{e.era[lang]}</span>
                    </div>
                    {used && <span className="col-badge"><Icon name="check" size={14} /> {t('collectionInUse', lang)}</span>}
                  </div>
                  <p className="small" style={{ margin: 0 }}>{e.blurb[lang]}</p>
                  <div className="row wrap" style={{ gap: 6 }}>
                    {listenBtn(e.instrument, e.instrument, e.title[lang])}
                    {e.family === 'drums' && (
                      <button type="button" className="btn small-btn ghost" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : e.instrument)}>
                        {t('collectionPieces', lang)}
                      </button>
                    )}
                    <button type="button" className="btn small-btn ghost" onClick={() => { engine.stopPreview(); setPlaying(null); setRack({ base: rackBase(e.instrument), from: e.instrument }); }}
                      title={t('rackHint', lang)}>
                      <Icon name="sliders" size={16} /> {t('rackOpen', lang)}
                    </button>
                    <span className="grow" />
                    <button type="button" className="btn small-btn primary" disabled={!target || (used && target?.instrument?.key === e.instrument && !target.sound)}
                      onClick={() => target && onUse(target.id, e.instrument)}>
                      {target ? t('collectionUse', lang, { track: target.name }) : t('collectionUseNone', lang)}
                    </button>
                  </div>
                  {isOpen && (
                    <div className="col-pads" role="group" aria-label={t('collectionPieces', lang)}>
                      {PIECES.map((p) => (
                        <button key={p.voice} type="button" className="col-pad" onPointerDown={() => engine.previewPiece(e.instrument, p.voice)}
                          onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); engine.previewPiece(e.instrument, p.voice); } }}>
                          {findByKey(p.key)?.title[lang] ?? p.voice}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
      <details className="small muted col-credits">
        <summary>{t('collectionCredits', lang)}</summary>
        <ul>
          {SOURCES.map((x) => (
            <li key={x.name}><a href={x.url} target="_blank" rel="noreferrer">{x.name}</a>, {x.by} · {x.license}</li>
          ))}
        </ul>
        <p style={{ margin: 0 }}>{t('collectionChanges', lang)}</p>
      </details>

      {rack && (
        <StudioRack base={rack.base} from={rack.from ?? rack.base} sound={rack.sound} profileId={profileId} lang={lang}
          onSave={(x) => { onSaveSound(x); setRack(null); }}
          onDelete={rack.sound ? () => { onDeleteSound(rack.sound!.id); setRack(null); } : undefined}
          onClose={() => setRack(null)} />
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- the rack */

function StudioRack({ base, from, sound, profileId, lang, onSave, onDelete, onClose }: {
  base: string;
  /** The Colección sound the chain starts from (its own gear for a guitar or bass). */
  from: string;
  sound?: CustomSound;
  profileId: string;
  lang: Lang;
  onSave: (sound: CustomSound) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const entry = templateFor(from);
  const baseName = entryOf(from)?.title[lang] ?? catalogTitle({ key: from, version: '1.0.0' }, lang);
  const [chain, setChain] = useState<FxChain>(() => (sound ? structuredClone(sound.chain) : rackOf(from)));
  const [name, setName] = useState(sound?.name ?? t('mySoundName', lang, { name: baseName }));
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => { engine.stopPreview(); window.clearTimeout(timer.current); }, []);

  const change = (next: FxChain) => {
    setChain(next);
    engine.updatePreviewChain(next);
  };
  const setSlot = (i: number, fn: (s: FxSlot) => FxSlot) => change({ ...chain, slots: chain.slots.map((s, j) => (j === i ? fn(s) : s)) });

  const listen = async () => {
    window.clearTimeout(timer.current);
    if (playing) { engine.stopPreview(); setPlaying(false); return; }
    if (!entry) return;
    setLoading(true);
    const secs = await engine.previewGroove(base, entry.groove, entry.tempo, chain, 4, entry.phrase);
    setLoading(false);
    if (secs <= 0) return;
    setPlaying(true);
    timer.current = window.setTimeout(() => setPlaying(false), secs * 1000);
  };

  const save = () => {
    const at = now();
    onSave({
      id: sound?.id ?? newId(), profile_id: profileId, name: name.trim() || t('mySoundName', lang, { name: baseName }),
      base: { key: base, version: '1.0.0' }, chain, chain_schema_version: 1, status: 'active', origin: 'person',
      created_at: sound?.created_at ?? at, updated_at: at,
    });
  };

  return (
    <Modal title={t('rackTitle', lang, { name: baseName })} closeLabel={t('close', lang)} onClose={onClose}>
      <p className="small muted" style={{ margin: 0 }}>{t('rackIntro', lang)}</p>
      <div className="row wrap" style={{ gap: 8 }}>
        <button type="button" className={`btn${playing ? ' primary' : ''}`} onClick={listen}>
          <Icon name={playing ? 'stop' : 'play'} size={18} /> {loading ? t('collectionLoading', lang) : playing ? t('stop', lang) : t('rackListen', lang)}
        </button>
        <span className="small muted">{t('rackLive', lang)}</span>
      </div>
      <ol className="rack">
        {chain.slots.map((slot, i) => {
          const label = catalogTitle(slot.effect, lang);
          return (
            <li key={slot.effect.key} className={`rack-unit${slot.bypass ? '' : ' on'}`}>
              <div className="row" style={{ gap: 8 }}>
                <span className="rack-n mono">{i + 1}</span>
                <strong className="grow">{label}</strong>
                <button type="button" className="chip" aria-pressed={!slot.bypass} onClick={() => setSlot(i, (s) => ({ ...s, bypass: !s.bypass }))}
                  aria-label={`${label}: ${t(slot.bypass ? 'pedalOff' : 'pedalOn', lang)}`}>
                  {t(slot.bypass ? 'pedalOff' : 'pedalOn', lang)}
                </button>
              </div>
              {PEDAL_BLURB[slot.effect.key] && <span className="small muted">{PEDAL_BLURB[slot.effect.key][lang]}</span>}
              {!slot.bypass && (
                <div className="rack-knobs">
                  {effectParams(slot.effect).map((p) => {
                    const v = slot.params[p.name] ?? p.default;
                    const set = (x: number) => setSlot(i, (s) => ({ ...s, params: { ...s.params, [p.name]: x } }));
                    if (p.choices) return <ChoiceParam key={p.name} p={p} value={v} lang={lang} onChange={set} />;
                    return (
                      <label key={p.name} className="stack" style={{ gap: 2 }}>
                        <span className="lbl">{p.label[lang]} <span className="mono">{formatParam(p, v)}</span></span>
                        <input type="range" min={p.min} max={p.max} step={p.step ?? (p.max - p.min) / 100} value={v} onChange={(ev) => set(Number(ev.target.value))} />
                      </label>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <label className="stack" style={{ gap: 4 }}>
        <span className="lbl">{t('mySoundNameLabel', lang)}</span>
        <input className="field" value={name} maxLength={40} onChange={(ev) => setName(ev.target.value)} />
      </label>
      <div className="row wrap" style={{ justifyContent: 'flex-end', gap: 8 }}>
        {onDelete && <button type="button" className="btn ghost" onClick={onDelete}><Icon name="trash" size={18} /> {t('mySoundDelete', lang)}</button>}
        <span className="grow" />
        <button type="button" className="btn ghost" onClick={onClose}>{t('cancel', lang)}</button>
        <button type="button" className="btn primary" onClick={save}><Icon name="check" size={18} /> {t(sound ? 'mySoundUpdate' : 'mySoundSave', lang)}</button>
      </div>
    </Modal>
  );
}
