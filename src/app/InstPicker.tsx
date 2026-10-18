// Choosing one of the idea's instruments: a button that shows what plays, opening a panel grouped the way a musician
// looks for a sound: the basics by kind, then each genre by its styles. Every sound can be heard before it is picked.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Lang } from '../domain/types';
import { ENTRIES, entryOf, GENRES, GROUPS } from '../packs/collection';
import type { Entry, Genre } from '../packs/collection';
import { findByKey, title as catalogTitle } from '../packs/core';
import { t } from './i18n';
import type { StringKey } from './i18n';
import { instIcon } from './instIcon';
import { Icon, InstBadge } from './ui';

export type PickRole = 'chords' | 'drums' | 'bass';
type Tab = 'core' | Genre;
interface Item { key: string; sub: string }
interface Group { title: string; items: Item[] }

/** The app's own sounds, by kind: what a musician would look for first. */
const CORE_GROUPS: Record<PickRole, [StringKey, string[]][]> = {
  chords: [
    ['pickKeys', ['instrument.keys-piano', 'instrument.keys-ep', 'instrument.organ', 'instrument.vibes']],
    ['pickGuitars', ['instrument.guitar-nylon', 'instrument.guitar-clean']],
    ['pickOrchestra', ['instrument.strings-ensemble', 'instrument.choir-aah', 'instrument.brass-section']],
    ['pickPads', ['instrument.pad-warm', 'instrument.pad-supersaw']],
  ],
  drums: [
    ['pickAcousticKits', ['instrument.drums-pop', 'instrument.drums-rock', 'instrument.drums-jazz']],
    ['pickMachines', ['instrument.drums-909', 'instrument.drums-boom-bap', 'instrument.drums-trap']],
    ['pickWorldKits', ['instrument.drums-latin', 'instrument.drums-orch']],
  ],
  bass: [
    ['pickStringBass', ['instrument.bass-electric', 'instrument.bass-upright']],
    ['pickSynthBass', ['instrument.bass-synth', 'instrument.bass-808']],
  ],
};

/** Whether a Colección sound can play this job in the idea. */
const fits = (role: PickRole, e: Entry) => (role === 'drums' ? e.family === 'drums' : role === 'bass' ? e.family === 'bass'
  : e.family === 'guitar' || (e.family === 'synth' && !/bass|808|reese|sub|acid/i.test(`${e.instrument} ${e.voice ?? ''}`)));

export const instName = (key: string, lang: Lang) => entryOf(key)?.title[lang] ?? catalogTitle({ key, version: '1.0.0' }, lang);
/** The name without the kind it already sits under ("Batería: rock" is "Rock" among the drums). */
const shortName = (key: string, lang: Lang) => { const n = instName(key, lang).replace(/^(batería|drums|kit)\s*:\s*/i, ''); return n.charAt(0).toUpperCase() + n.slice(1); };
/** An era's first words: "Desde los 90 · …" is "Desde los 90". */
const eraShort = (e: Entry, lang: Lang) => e.era[lang].split(' · ')[0];
const tabOf = (key: string | null): Tab => (key ? entryOf(key)?.genre ?? 'core' : 'core');

function groupsFor(role: PickRole, tab: Tab, lang: Lang): Group[] {
  if (tab === 'core') {
    return CORE_GROUPS[role].map(([k, keys]) => ({ title: t(k, lang), items: keys.filter((x) => findByKey(x)).map((key) => ({ key, sub: '' })) }))
      .filter((g) => g.items.length);
  }
  const list = ENTRIES.filter((e) => e.genre === tab && fits(role, e));
  const groups = GROUPS.filter((g) => g.genre === tab)
    .map((g) => ({ title: g.title[lang], items: list.filter((e) => e.group === g.id).map((e) => ({ key: e.instrument, sub: eraShort(e, lang) })) }))
    .filter((g) => g.items.length);
  // One sound per style reads better as one list, each card naming its style.
  if (groups.length > 3 && list.length / groups.length < 1.5) {
    return [{ title: '', items: list.map((e) => ({ key: e.instrument, sub: `${GROUPS.find((g) => g.id === e.group)?.title[lang] ?? ''} · ${eraShort(e, lang)}` })) }];
  }
  return groups;
}

export function InstPicker({ role, label, value, lang, allowNone, onPick, onListen }: {
  role: PickRole;
  label: string;
  value: string | null;
  lang: Lang;
  allowNone?: boolean;
  onPick: (key: string | null) => void;
  onListen: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(tabOf(value));
  const [shift, setShift] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const tabs: Tab[] = ['core', ...GENRES.filter((g) => ENTRIES.some((e) => e.genre === g.id && fits(role, e))).map((g) => g.id)];

  useEffect(() => {
    if (!open) return;
    const down = (ev: PointerEvent) => { if (root.current && !root.current.contains(ev.target as Node)) setOpen(false); };
    const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  // The panel opens under its button and moves left when it would leave the screen.
  useLayoutEffect(() => {
    if (!open || !root.current || !panel.current) return;
    const left = root.current.getBoundingClientRect().left;
    setShift(Math.min(0, window.innerWidth - 16 - panel.current.offsetWidth - left));
    panel.current.querySelector<HTMLElement>('.ipick-item.on .ipick-pick')?.scrollIntoView({ block: 'nearest' });
  }, [open, tab]);

  const toggle = () => { if (!open) setTab(tabOf(value)); setOpen((o) => !o); };
  const pick = (k: string | null) => { onPick(k); setOpen(false); };
  const name = value ? shortName(value, lang) : t('ideaNoBass', lang);
  const tabName = (x: Tab) => (x === 'core' ? t('pickCore', lang) : GENRES.find((g) => g.id === x)!.title[lang]);

  return (
    <div className={`ipick${open ? ' open' : ''}`} ref={root}>
      <div className="ipick-chip">
        <button type="button" className="ipick-btn" aria-expanded={open} aria-haspopup="dialog" onClick={toggle} aria-label={`${label}: ${name}`}>
          {value ? <InstBadge icon={instIcon(value)} size="sm" /> : <span className="ibadge sm ipick-none" aria-hidden="true"><Icon name="close" size={14} /></span>}
          <span className="stack ipick-txt">
            <span className="ipick-role">{label}</span>
            <strong className="ellipsis">{name}</strong>
          </span>
          <Icon name="chevronDown" size={16} />
        </button>
        <button type="button" className="ipick-hear" disabled={!value} onClick={() => value && onListen(value)}
          aria-label={t('listenTo', lang, { name })} title={t('listenTo', lang, { name })}>
          <Icon name="play" size={14} />
        </button>
      </div>
      {open && (
        <div className="ipick-panel" role="dialog" aria-label={label} ref={panel} style={{ transform: shift ? `translateX(${shift}px)` : undefined }}>
          <div className="ipick-top">
            <div className="seg" role="group" aria-label={t('genre', lang)}>
              {tabs.map((x) => <button key={x} type="button" aria-pressed={tab === x} onClick={() => setTab(x)}>{tabName(x)}</button>)}
            </div>
            <span className="grow" />
            {allowNone && <button type="button" className="chip" aria-pressed={!value} onClick={() => pick(null)}>{t('ideaNoBass', lang)}</button>}
            <button type="button" className="btn icon ghost" onClick={() => setOpen(false)} aria-label={t('close', lang)}><Icon name="close" size={18} /></button>
          </div>
          <div className="ipick-body">
            {groupsFor(role, tab, lang).map((g, i) => (
              <div key={`${tab}-${i}`} className="ipick-group">
                {g.title && <span className="lbl">{g.title}</span>}
                <div className="ipick-items">
                  {g.items.map((it) => {
                    const on = value === it.key;
                    const nm = shortName(it.key, lang);
                    return (
                      <div key={it.key} className={`ipick-item${on ? ' on' : ''}`}>
                        <button type="button" className="ss-play" onClick={() => onListen(it.key)} aria-label={t('listenTo', lang, { name: nm })} title={t('listenTo', lang, { name: nm })}>
                          <Icon name="play" size={12} />
                        </button>
                        <button type="button" className="ipick-pick" aria-pressed={on} onClick={() => pick(it.key)}>
                          <InstBadge icon={instIcon(it.key)} size="sm" />
                          <span className="stack ipick-txt">
                            <strong className="ipick-name">{nm}</strong>
                            {it.sub && <span className="small muted ellipsis">{it.sub}</span>}
                          </span>
                          {on && <Icon name="check" size={16} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
