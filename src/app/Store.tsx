// The instrument store: style windows at the entrance (each a kit, with the Colección's styles), two wings
// (acoustic and electric) with aisles by how an instrument is played, and a counter to hear and play the one you
// took down, add it to your kit or use it in the song.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang, StarredInstrument, Song } from '../domain/types';
import { engine } from '../engine/engine';
import { entryOf, GROUPS } from '../packs/collection';
import { findByKey, lowOf, resolveRow, rowsOf, STANDARD_ROWS } from '../packs/core';
import { defaultRole, fitsTrack } from './sounddraft';
import { t } from './i18n';
import type { StringKey } from './i18n';
import { ART_VIEWBOX, STORE_DEFS, type ArtId } from './storeArt';
import {
  AISLE_TITLE, AISLES, matches, STORE_ITEMS, WINDOWS, windowKit, windowsOf, windowStyles, windowTitle, WING_TITLE,
  type Aisle, type StoreItem, type WindowId, type Wing,
} from './storeCatalog';
import { Icon } from './ui';

const nameOf = (key: string, lang: Lang) => findByKey(key)?.title[lang] ?? key;

/** One drawing, by id, sized to a box. */
export function Art({ id, w, h }: { id: ArtId; w: number; h: number }) {
  return <svg className="st-art" width={w} height={h} viewBox={ART_VIEWBOX[id]} aria-hidden="true" focusable="false"><use href={`#${id}`} /></svg>;
}

/** The drawings' definitions, once per page. */
export function ArtDefs() {
  return <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: STORE_DEFS }} />;
}

/** How big each drawing hangs in a niche (a flute lies long and thin, a cello stands tall). */
const NICHE_SIZE: Record<ArtId, [number, number]> = {
  'i-violin': [50, 158], 'i-cello': [52, 168], 'i-section': [112, 150], 'i-guitar': [56, 154], 'i-eguitar': [62, 152],
  'i-ebass': [58, 160], 'i-flute': [150, 22], 'i-trumpet': [140, 64], 'i-tmute': [142, 62], 'i-horn': [120, 112],
  'i-sax': [72, 150], 'i-piano': [150, 94], 'i-vibes': [144, 88], 'i-drums': [146, 108], 'i-congas': [104, 132],
  'i-timpani': [124, 116], 'i-synth': [150, 58], 'i-machine': [118, 90], 'i-mic': [56, 146], 'i-epiano': [150, 82],
  'i-organ': [148, 92],
};
const LIES_DOWN = new Set<ArtId>(['i-flute', 'i-trumpet', 'i-tmute']);

const WHITE = [0, 2, 4, 5, 7, 9, 11, 12];
const BLACK: [number, number][] = [[1, 1], [3, 2], [6, 4], [8, 5], [10, 6]]; // semitone, after which white key
const NOTE_ES = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
const NOTE_EN = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const noteName = (m: number, lang: Lang) => `${(lang === 'es' ? NOTE_ES : NOTE_EN)[m % 12]}${Math.floor(m / 12) - 1}`;

export default function Store({ song, starred, lang, onHome, onKit, onStar, onStarMany, onUnstar, onUse }: {
  song: Song | null;
  starred: StarredInstrument[];
  lang: Lang;
  onHome: () => void;
  onKit: () => void;
  onStar: (x: StarredInstrument) => void;
  onStarMany: (xs: StarredInstrument[], style: string) => void;
  onUnstar: (x: StarredInstrument) => void;
  onUse: (trackId: string, key: string) => void;
}) {
  const [wing, setWing] = useState<Wing>('acoustic');
  const [win, setWin] = useState<WindowId | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [realOnly, setRealOnly] = useState(false);
  const [sel, setSel] = useState('instrument.violin');
  const [loud, setLoud] = useState(true);
  const [oct, setOct] = useState(0);
  const [picking, setPicking] = useState(false);
  const [listening, setListening] = useState(false);

  const wingsRef = useRef<HTMLDivElement>(null);
  /** Open a style window (or one of its styles) and walk down to it. */
  const openWindow = (id: WindowId, styleId: string | null) => {
    setWin(id); setStyle(styleId); setQuery('');
    requestAnimationFrame(() => wingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  useEffect(() => () => engine.stopPreview(), []);
  useEffect(() => { setOct(0); setPicking(false); }, [sel]);

  const keep = (keys: string[]) => keys.filter((k) => !realOnly || STORE_ITEMS.find((x) => x.key === k)?.recorded);
  const item = STORE_ITEMS.find((x) => x.key === sel) ?? STORE_ITEMS[0];
  const inKit = (key: string) => starred.find((x) => x.key === key && !x.sound);

  const results = useMemo(() => (query.trim() ? keep(STORE_ITEMS.filter((x) => matches(x.key, query, lang)).map((x) => x.key)) : []),
    [query, lang, realOnly]);

  const pick = (key: string) => { setSel(key); engine.stopPreview(); setListening(false); };

  const card = (key: string) => {
    const x = STORE_ITEMS.find((i) => i.key === key);
    if (!x) return null;
    const [w, h] = NICHE_SIZE[x.art];
    return (
      <button key={key} type="button" className={`st-item${sel === key ? ' on' : ''}`} aria-pressed={sel === key} onClick={() => pick(key)}>
        <span className={`st-niche${LIES_DOWN.has(x.art) ? ' lying' : ''}`}>
          <Art id={x.art} w={w} h={h} />
          <span className="st-floor" />
          {inKit(key) && <span className="st-owned" aria-label={t('storeInKit', lang)}><Icon name="check" size={14} /></span>}
        </span>
        <span className="st-meta">
          <span className="st-name">{nameOf(key, lang)}</span>
          <Tag recorded={x.recorded} lang={lang} />
        </span>
      </button>
    );
  };

  const shelf = (title: string, hint: string | null, keys: string[]) => (
    keys.length ? (
      <section key={title} className="st-aisle" aria-label={title}>
        <div className="st-aisle-head"><b>{title}</b>{hint && <span>{hint}</span>}</div>
        <div className="st-grid">{keys.map(card)}</div>
        <div className="st-shelf" />
      </section>
    ) : null
  );

  const aisleKeys = (a: Aisle) => keep(STORE_ITEMS.filter((x) => x.aisle === a).map((x) => x.key));

  const floor = (() => {
    if (query.trim()) {
      return (
        <>
          <div className="st-aisle-head"><b>{t('storeResults', lang, { n: results.length, q: query.trim() })}</b></div>
          {results.length ? <div className="st-grid">{results.map(card)}</div> : <p className="st-empty">{t('storeNothing', lang)}</p>}
        </>
      );
    }
    if (win) {
      const title = windowTitle(win, lang);
      const kit = windowKit(win);
      const styles = windowStyles(win).filter((s) => !style || s.id === style);
      const takeWindow = () => onStarMany(kit.map((s) => ({ key: s.instrument, role: s.role as StarredInstrument['role'] })), title);
      return (
        <>
          <div className="st-window-head">
            <button type="button" className="btn ghost" onClick={() => { setWin(null); setStyle(null); }}><Icon name="back" size={18} /> {t('storeBack', lang)}</button>
            <button type="button" className="btn primary" onClick={takeWindow}><Icon name="plus" size={18} /> {t('storeTakeWindow', lang)}</button>
          </div>
          {!style && shelf(t('storeKitOf', lang, { style: title }), null, keep(kit.map((s) => s.instrument)))}
          {styles.map((s) => shelf(s.title[lang], null, keep(s.keys)))}
        </>
      );
    }
    return AISLES[wing].map((a, i) => shelf(t('storeAisle', lang, { n: i + 1, name: AISLE_TITLE[a][lang] }), null, aisleKeys(a)));
  })();

  const listen = async () => {
    if (listening) { engine.stopPreview(); setListening(false); return; }
    const e = entryOf(item.key);
    if (e) {
      setListening(true);
      const secs = await engine.previewGroove(item.key, e.groove, e.tempo, undefined, 1, e.phrase);
      window.setTimeout(() => setListening(false), Math.max(0, secs * 1000));
      if (!secs) setListening(false);
    } else {
      void engine.previewInstrument(item.key, loud ? 0.9 : 0.6);
    }
  };

  const drums = findByKey(item.key)?.manifest.type === 'drumkit';
  const base = Math.ceil(lowOf(item.key) / 12) * 12 + oct * 12;
  const vel = loud ? 0.9 : 0.6;
  const rows = drums ? rowsOf(item.key) : [];
  const pads = drums ? STANDARD_ROWS.map((r, i) => findByKey(resolveRow(rows, r) ?? rows[i])?.title[lang] ?? `${i + 1}`) : [];
  const e = entryOf(item.key);
  const src = findByKey(item.key);
  const where = `${WING_TITLE[item.wing][lang]} · ${AISLE_TITLE[item.aisle][lang]}`;
  const tracks = song ? song.tracks.filter((tr) => fitsTrack(item.key, tr)) : [];
  const owned = inKit(item.key);
  const [bw, bh] = NICHE_SIZE[item.art];
  const scale = Math.min(250 / bh, 300 / bw, 1.7);

  return (
    <div className="store">
      <ArtDefs />
      <header className="st-top">
        <button type="button" className="btn ghost" onClick={onHome}><Icon name="home" size={18} /> {t('home', lang)}</button>
        <span className="grow" />
        <label className="st-search">
          <Icon name="search" size={16} />
          <span className="st-sr">{t('storeSearch', lang)}</span>
          <input type="search" value={query} placeholder={t('storeSearch', lang)} onChange={(ev) => setQuery(ev.target.value)} />
        </label>
        <button type="button" className="btn primary" onClick={onKit}><Icon name="star" size={18} /> {t('storeMyKit', lang, { n: starred.length })}</button>
      </header>

      <section className="st-entrance">
        <div className="st-sign mono">{t('storeOpen', lang)}</div>
        <h1 className="display st-h1">{t('roomStore', lang)}</h1>
        <p className="st-intro">{t('storeIntro', lang)}</p>
        <div className="st-aisle-head light"><b>{t('storeWindows', lang)}</b><span>{t('storeWindowsHint', lang)}</span></div>
        <div className="st-windows">
          {WINDOWS.map((w) => {
            const styles = windowStyles(w.id);
            const kit = windowKit(w.id);
            return (
              <div key={w.id} className={`st-win${win === w.id ? ' on' : ''}`} style={{ '--glow': w.glow } as React.CSSProperties}>
                <button type="button" className="st-win-main" aria-pressed={win === w.id}
                  onClick={() => openWindow(w.id, null)}>
                  <span className="st-glass">{w.art.map((a) => { const [aw, ah] = NICHE_SIZE[a]; const s = Math.min(70 / ah, 84 / aw); return <Art key={a} id={a} w={aw * s} h={ah * s} />; })}</span>
                  <strong className="display st-win-title">{windowTitle(w.id, lang)}</strong>
                  {!styles.length && <span className="st-win-line">{kit.map((s) => nameOf(s.instrument, lang)).join(', ')}</span>}
                </button>
                {styles.length > 0 && (
                  <span className="st-chips">
                    {styles.slice(0, 4).map((s) => (
                      <button key={s.id} type="button" className={`st-chip${win === w.id && style === s.id ? ' on' : ''}`}
                        onClick={() => openWindow(w.id, s.id)}>{s.title[lang]}</button>
                    ))}
                    {styles.length > 4 && (
                      <button type="button" className="st-chip" onClick={() => openWindow(w.id, null)}>+{styles.length - 4}</button>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="st-wings" ref={wingsRef} role="tablist" aria-label={t('roomStore', lang)}>
        {(['acoustic', 'electric'] as Wing[]).map((w) => (
          <button key={w} type="button" role="tab" aria-selected={!win && !query.trim() && wing === w} className="st-wing display"
            onClick={() => { setWing(w); setWin(null); setStyle(null); setQuery(''); }}>{WING_TITLE[w][lang]}</button>
        ))}
        <span className="grow" />
        <button type="button" className={`st-realonly${realOnly ? ' on' : ''}`} aria-pressed={realOnly} onClick={() => setRealOnly((v) => !v)}>
          {realOnly && <Icon name="check" size={14} />} {t('storeRealOnly', lang)}
        </button>
      </div>

      <div className="st-body">
        <main className="st-floorplan">{floor}</main>

        <aside className="st-counter" aria-label={t('storeCounter', lang)}>
          <div className="st-counter-lbl mono">{t('storeCounter', lang)}</div>
          <div className="st-stage">
            <Art id={item.art} w={bw * scale} h={bh * scale} />
            <span className="st-stage-floor" />
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <div className="small muted mono">{where}</div>
            <div className="row wrap" style={{ gap: 12 }}>
              <h2 className="display st-counter-name">{nameOf(item.key, lang)}</h2>
              <Tag recorded={item.recorded} lang={lang} long />
            </div>
            {e && <p className="st-desc">{e.era[lang]} · {e.blurb[lang]}</p>}
            <p className="st-desc">{item.recorded && src ? t('storeFrom', lang, { source: src.source, license: src.license }) : t('storeSynthBlurb', lang)}</p>
            {windowsOf(item.key).length > 0 && (
              <div className="row wrap" style={{ gap: 6 }}>
                <span className="small muted">{t('storeInWindows', lang)}</span>
                {windowsOf(item.key).map((w) => (
                  <button key={w} type="button" className="st-chip" onClick={() => openWindow(w, entryOf(item.key)?.genre === w ? entryOf(item.key)!.group : null)}>
                    {windowTitle(w, lang)}{entryOf(item.key)?.genre === w ? ` · ${GROUPS.find((g) => g.id === entryOf(item.key)!.group)?.title[lang] ?? ''}` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button type="button" className="btn st-listen" onClick={listen}>
            <Icon name={listening ? 'stop' : 'play'} size={16} /> {t(listening ? 'storeStop' : 'storeListen', lang)}
          </button>

          <div className="stack" style={{ gap: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
              <span className="small muted">{t('storePlayKeys', lang)}</span>
              <div className="seg" role="group" aria-label={t('storeIntensity', lang)}>
                <button type="button" aria-pressed={!loud} onClick={() => setLoud(false)}>{t('storeSoft', lang)}</button>
                <button type="button" aria-pressed={loud} onClick={() => setLoud(true)}>{t('storeLoud', lang)}</button>
              </div>
            </div>
            {drums ? (
              <div className="st-pads">
                {pads.map((label, i) => (
                  <button key={i} type="button" className="st-pad" onPointerDown={() => { void engine.previewPad(item.key, i, vel); }}>{label}</button>
                ))}
              </div>
            ) : (
              <>
                <div className="st-keys">
                  {WHITE.map((s) => (
                    <button key={s} type="button" className="st-key" aria-label={noteName(base + s, lang)}
                      onPointerDown={() => { void engine.previewKey(item.key, base + s, vel); }} />
                  ))}
                  {BLACK.map(([s, after]) => (
                    <button key={s} type="button" className="st-bkey" aria-label={noteName(base + s, lang)} style={{ left: `calc(${(after / WHITE.length) * 100}% - 12px)` }}
                      onPointerDown={() => { void engine.previewKey(item.key, base + s, vel); }} />
                  ))}
                </div>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <button type="button" className="btn icon" onClick={() => setOct((o) => Math.max(-2, o - 1))} disabled={base - 12 < 21} aria-label={t('storeOctDown', lang)} title={t('storeOctDown', lang)}><Icon name="back" size={16} /></button>
                  <span className="small muted mono">{noteName(base, lang)} – {noteName(base + 12, lang)}</span>
                  <button type="button" className="btn icon st-flip" onClick={() => setOct((o) => Math.min(2, o + 1))} disabled={base + 24 > 108} aria-label={t('storeOctUp', lang)} title={t('storeOctUp', lang)}><Icon name="back" size={16} /></button>
                </div>
              </>
            )}
          </div>

          <div className="stack st-actions" style={{ gap: 10 }}>
            {owned
              ? <button type="button" className="btn st-owned-btn" onClick={() => onUnstar(owned)}><Icon name="check" size={18} /> {t('storeInKit', lang)}</button>
              : <button type="button" className="btn primary st-take" onClick={() => onStar({ key: item.key, role: defaultRole(item.key) })}>{t('storeTake', lang)}</button>}
            {song && (
              <button type="button" className="btn ghost" aria-expanded={picking} onClick={() => setPicking((p) => !p)}>{t('storeUse', lang)}</button>
            )}
            {song && picking && (
              <div className="st-usepick" role="group" aria-label={t('storeUseOn', lang, { song: song.title })}>
                <span className="small muted">{t('storeUseOn', lang, { song: song.title })}</span>
                {tracks.length ? tracks.map((tr) => (
                  <button key={tr.id} type="button" className="btn ghost st-usetrack" onClick={() => { onUse(tr.id, item.key); setPicking(false); }}>
                    <span className="st-dot" style={{ background: tr.color }} /> {tr.name}
                    <span className="small muted ellipsis">{tr.instrument ? nameOf(tr.instrument.key, lang) : ''}</span>
                  </button>
                )) : <span className="small muted">{t('storeUseNone', lang)}</span>}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Tag({ recorded, lang, long }: { recorded: boolean; lang: Lang; long?: boolean }) {
  const key: StringKey = recorded ? (long ? 'storeRealLong' : 'storeReal') : (long ? 'storeSynthLong' : 'storeSynth');
  return <span className={`st-tag${recorded ? '' : ' syn'}`}>{t(key, lang)}</span>;
}

export type { StoreItem };
