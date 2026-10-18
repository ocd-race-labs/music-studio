import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Lang, Profile } from '../domain/types';
import { t } from './i18n';
import { instIcon, trackIcon } from './instIcon';
import type { Track } from '../domain/types';

type IconName = 'home' | 'play' | 'stop' | 'undo' | 'redo' | 'gear' | 'menu' | 'plus' | 'close' | 'upload' | 'download' | 'check' | 'mic' | 'flask' | 'arrow' | 'reset' | 'expand' | 'shrink' | 'sun' | 'moon' | 'headphones' | 'star' | 'starFill' | 'trash' | 'warning' | 'sliders' | 'back' | 'classroom' | 'chat' | 'speaker' | 'music' | 'crate' | 'disc' | 'bulb' | 'chevronDown' | 'chevronRight' | 'panel' | 'amp' | 'list' | 'swap' | 'copy' | 'edit'
  | 'drums' | 'drumpad' | 'conga' | 'timpani' | 'guitar' | 'acoustic' | 'bass' | 'piano' | 'organ' | 'synth' | 'lead' | 'pad' | 'sub' | 'violin' | 'trumpet' | 'sax' | 'flute' | 'choir' | 'bells' | 'knob' | 'pedal' | 'cab' | 'tape' | 'space' | 'eq';
export type { IconName };

const PATHS: Record<IconName, ReactNode> = {
  home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></>,
  play: <path d="M7 4l13 8-13 8z" fill="currentColor" stroke="none" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>,
  redo: <><path d="M15 14l5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h3" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  upload: <><path d="M12 16V4M6 10l6-6 6 6" /><path d="M4 20h16" /></>,
  download: <><path d="M12 4v12M6 10l6 6 6-6" /><path d="M4 20h16" /></>,
  check: <path d="M5 12l5 5L20 7" />,
  mic: <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" /></>,
  flask: <><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  reset: <><path d="M4.5 13a7.5 7.5 0 1 0 2.2-6.3" /><path d="M4 4v4.5h4.5" /></>,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  shrink: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  headphones: <><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="14" width="5" height="7" rx="2" /><rect x="16" y="14" width="5" height="7" rx="2" /></>,
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  warning: <><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></>,
  sliders: <><path d="M6 4v16M12 4v16M18 4v16" /><rect x="3.5" y="13" width="5" height="3" rx="1" fill="currentColor" /><rect x="9.5" y="7" width="5" height="3" rx="1" fill="currentColor" /><rect x="15.5" y="15" width="5" height="3" rx="1" fill="currentColor" /></>,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
  // A student reading: head, shoulders and an open book.
  classroom: <><circle cx="12" cy="5.6" r="2.9" /><path d="M6.6 13.2a5.4 5.4 0 0 1 10.8 0" /><path d="M2.8 14.6c3.1-.9 6.2-.5 9.2 1.3 3-1.8 6.1-2.2 9.2-1.3v6.2c-3.1-.9-6.2-.5-9.2 1.3-3-1.8-6.1-2.2-9.2-1.3z" /><path d="M12 15.9v6.2" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  speaker: <><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  music: <><path d="M9 18V5.5l11-2V16" /><circle cx="6.5" cy="18" r="2.6" fill="currentColor" /><circle cx="17.5" cy="16" r="2.6" fill="currentColor" /></>,
  // A crate of records: the Colección.
  crate: <><rect x="3" y="12" width="18" height="8.5" rx="1.5" /><path d="M6.5 12V5.5h3.5V12M11.5 12V4h3.5v8M16.5 12V6.5h2.5V12" /><path d="M9 16.2h6" /></>,
  // A record: the songs.
  disc: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.5" /><path d="M12 3a9 9 0 0 1 9 9" opacity="0.5" /></>,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.6 10.8c.8.6 1.1 1.4 1.1 2.2h5c0-.8.3-1.6 1.1-2.2A6 6 0 0 0 12 3z" /></>,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></>,
  // An amplifier with two knobs and a speaker: the sound studio.
  amp: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /><circle cx="7" cy="6.5" r="0.6" fill="currentColor" /><circle cx="10" cy="6.5" r="0.6" fill="currentColor" /><circle cx="12" cy="14.5" r="3.5" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></>,
  swap: <><path d="M7 4L3 8l4 4" /><path d="M3 8h14" /><path d="M17 20l4-4-4-4" /><path d="M21 16H7" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14 6l4 4" /></>,
  // Instruments and the stages of a sound's chain: simple outlines on the same grid and stroke as the rest.
  drums: <><ellipse cx="12" cy="12.5" rx="7.5" ry="2.6"/><path d="M4.5 12.5v5.5c0 1.5 3.4 2.6 7.5 2.6s7.5-1.1 7.5-2.6v-5.5"/><path d="M8.5 15v5.4M15.5 15v5.4"/><path d="M6.5 2.5l9 7.5M17.5 2.5l-9 7.5"/></>,
  drumpad: <><rect x="3" y="3" width="18" height="18" rx="3.5"/><rect x="6.5" y="6.5" width="4.5" height="4.5" rx="1"/><rect x="13" y="6.5" width="4.5" height="4.5" rx="1" fill="currentColor"/><rect x="6.5" y="13" width="4.5" height="4.5" rx="1"/><rect x="13" y="13" width="4.5" height="4.5" rx="1"/></>,
  conga: <><ellipse cx="8" cy="5.5" rx="3.6" ry="1.3"/><path d="M4.4 5.5c-.7 5 .4 10.5 1.6 15.5h4c1.2-5 2.3-10.5 1.6-15.5"/><ellipse cx="16.5" cy="9" rx="3.3" ry="1.2"/><path d="M13.2 9c-.5 4 .3 8 1.3 12h4c1-4 1.8-8 1.3-12"/></>,
  timpani: <><ellipse cx="12" cy="9.5" rx="8.5" ry="2.4"/><path d="M3.5 9.5c0 5.5 3.8 8.5 8.5 8.5s8.5-3 8.5-8.5"/><path d="M8 17.3L6.5 21.5M16 17.3l1.5 4.2"/><path d="M14.5 2.5l3 4.5"/><circle cx="14.2" cy="2.4" r="1" fill="currentColor"/></>,
  guitar: <><g transform="rotate(40 12 12)"><path d="M11 10.2C10.2 9 9 8.2 8.4 9.2C7.8 10.4 8.4 11.8 8.8 12.8C7.2 14 6.8 16.4 7.6 18.6C8.4 20.8 10 21.6 12 21.6S15.6 20.8 16.4 18.6C17.2 16.4 16.8 14 15.2 12.8C15.6 11.8 16.2 9.8 15.6 8.6C15 7.6 13.8 8.8 13 10.2"/><path d="M11 10.2V3.6M13 10.2V3.6"/><path d="M10.6 1.4h2.8l.4 2.2h-3.6z"/><path d="M10 15.4h4M10.4 18.4h3.2"/></g></>,
  acoustic: <><g transform="rotate(40 12 12)"><path d="M13 8.46A3.2 3.2 0 0 1 14.58 13.39A4.6 4.6 0 1 1 9.42 13.39A3.2 3.2 0 0 1 11 8.46"/><path d="M11 8.46V3.6M13 8.46V3.6"/><rect x="10.2" y="1" width="3.6" height="2.8" rx="1"/><circle cx="12" cy="15.6" r="1.4"/><path d="M10.8 19h2.4"/></g></>,
  bass: <><g transform="rotate(40 12 12)"><path d="M12.9 10.35A2.8 2.8 0 0 1 14.24 14.68A4 4 0 1 1 9.76 14.68A2.8 2.8 0 0 1 11.1 10.35"/><path d="M11.1 10.35V2.6M12.9 10.35V2.6"/><rect x="10.4" y=".4" width="3.2" height="2.6" rx=".9"/><path d="M10.6 17h2.8M10.6 19.6h2.8"/></g></>,
  piano: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M7 12.5V19M12 12.5V19M17 5v14"/><rect x="5.5" y="5" width="3" height="7.5" rx=".6" fill="currentColor" stroke="none"/><rect x="10.5" y="5" width="3" height="7.5" rx=".6" fill="currentColor" stroke="none"/></>,
  organ: <><path d="M2.5 21h19"/><rect x="2.5" y="10" width="3" height="11" rx="1.5"/><rect x="7" y="6" width="3" height="15" rx="1.5"/><rect x="11.5" y="3" width="3" height="18" rx="1.5" transform="translate(-.5 0)"/><rect x="15.5" y="6" width="3" height="15" rx="1.5" transform="translate(-.5 0)"/><rect x="19.5" y="10" width="3" height="11" rx="1.5" transform="translate(-1 0)"/></>,
  synth: <><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10.5h19"/><circle cx="6.5" cy="7.8" r=".9" fill="currentColor"/><circle cx="10" cy="7.8" r=".9" fill="currentColor"/><path d="M14 7.8h4"/><path d="M7.2 10.5V19M12 10.5V19M16.8 10.5V19"/></>,
  lead: <><path d="M2.5 16.5l6-9v9l6.5-9v9l6.5-9"/></>,
  pad: <><path d="M2.5 12c2.4-4.6 4.8-4.6 7.2 0s4.8 4.6 7.2 0 3.6-3.4 4.6-2"/><path d="M2.5 7.5c2.4-2.6 4.8-2.6 7.2 0s4.8 2.6 7.2 0 3.6-2 4.6-1.2M2.5 16.5c2.4 2.6 4.8 2.6 7.2 0s4.8-2.6 7.2 0 3.6 2 4.6 1.2" opacity=".45"/></>,
  sub: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/></>,
  violin: <><path d="M12 8.2C14.73 8.2 16.42 9.2 16.16 11C16.03 12 14.73 12.6 14.73 13.8C14.73 14.9 17.2 15.5 17.2 18.2C17.2 20.9 14.86 22 12 22S6.8 20.9 6.8 18.2C6.8 15.5 9.27 14.9 9.27 13.8C9.27 12.6 7.97 12 7.84 11C7.58 9.2 9.27 8.2 12 8.2Z"/><path d="M12 4.2V16.2M10.2 17.6h3.6"/><path d="M12 4.2c-1.6 0-2-2.4-.3-2.6 1.1-.1 1.3 1.1.5 1.4"/></>,
  trumpet: <><path d="M2.5 11.5H14"/><path d="M14 9.5L21 6.5v10l-7-3"/><path d="M14 13.5H8a2.5 2.5 0 0 0 0 5h4a2 2 0 0 0 2-2"/><path d="M7.5 11.5V8M10.5 11.5V8M13.5 11.5V9.5M6.5 7.5h2M9.5 7.5h2"/></>,
  sax: <><path d="M5 3.2c2.2-.6 3.8.2 4.6 1.8"/><path d="M9.2 5.2V15a4.8 4.8 0 0 0 9.6 0v-2.2l2-2"/><path d="M12 6v8.8a2 2 0 0 0 4 0v-2"/><circle cx="10.7" cy="8.4" r=".8" fill="currentColor"/><circle cx="10.7" cy="11.2" r=".8" fill="currentColor"/></>,
  flute: <><g transform="rotate(-35 12 12)"><rect x="1.5" y="10.6" width="21" height="2.8" rx="1.4"/><circle cx="5" cy="12" r=".7" fill="currentColor"/><circle cx="10" cy="12" r=".7" fill="currentColor"/><circle cx="12.8" cy="12" r=".7" fill="currentColor"/><circle cx="15.6" cy="12" r=".7" fill="currentColor"/><circle cx="18.4" cy="12" r=".7" fill="currentColor"/></g></>,
  choir: <><circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="8" r="3"/><path d="M2.8 20a5.2 5.2 0 0 1 10.4 0M11.3 20a5.2 5.2 0 0 1 10.4 0"/></>,
  bells: <><rect x="3" y="5" width="3.6" height="14" rx="1"/><rect x="8.1" y="6.5" width="3.6" height="11" rx="1"/><rect x="13.2" y="8" width="3.6" height="8" rx="1"/><rect x="18.3" y="9.5" width="2.7" height="5" rx="1"/></>,
  knob: <><circle cx="12" cy="12.5" r="6.5"/><path d="M12 12.5L8.6 9.1"/><circle cx="4.2" cy="18.6" r=".8" fill="currentColor" stroke="none"/><circle cx="19.8" cy="18.6" r=".8" fill="currentColor" stroke="none"/><circle cx="3.6" cy="9.6" r=".8" fill="currentColor" stroke="none"/><circle cx="20.4" cy="9.6" r=".8" fill="currentColor" stroke="none"/><circle cx="12" cy="3.6" r=".8" fill="currentColor" stroke="none"/></>,
  pedal: <><rect x="5" y="3" width="14" height="18" rx="2.5"/><circle cx="9" cy="7" r="1.4"/><circle cx="15" cy="7" r="1.4"/><circle cx="12" cy="16" r="2.2"/></>,
  cab: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.3" cy="8.3" r="2.8"/><circle cx="15.7" cy="8.3" r="2.8"/><circle cx="8.3" cy="15.7" r="2.8"/><circle cx="15.7" cy="15.7" r="2.8"/></>,
  tape: <><rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8" cy="11" r="2.4"/><circle cx="16" cy="11" r="2.4"/><path d="M8 13.4h8M6.5 19l1.5-2.8h8l1.5 2.8"/></>,
  space: <><circle cx="5" cy="12" r="1.5" fill="currentColor"/><path d="M9 8a5.5 5.5 0 0 1 0 8M13 5.5a9 9 0 0 1 0 13" /><path d="M17 3a12.5 12.5 0 0 1 0 18" opacity=".5"/></>,
  eq: <><path d="M3 15c3 0 3.5-7 6-7s3 9 6 9 3.5-5 6-5"/><path d="M3 20h18" opacity=".5"/></>,
  starFill: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="currentColor" />,
};

/** Light and dark in one tap. Shows where it will take you: the moon in light mode, the sun in dark mode. */
export function ModeSwitch({ mode, onToggle, lang }: { mode: 'light' | 'dark'; onToggle: () => void; lang: Lang }) {
  const label = t(mode === 'dark' ? 'switchToLight' : 'switchToDark', lang);
  return (
    <button type="button" className="btn icon" onClick={onToggle} aria-label={label} title={label}>
      <Icon name={mode === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

/** One tap between English and Spanish; shows the language in use. */
export function LangToggle({ lang, onLang }: { lang: Lang; onLang: (l: Lang) => void }) {
  const label = t('switchLanguage', lang);
  return (
    <button type="button" className="btn icon lang-toggle" onClick={() => onLang(lang === 'es' ? 'en' : 'es')} aria-label={label} title={label}>
      {lang.toUpperCase()}
    </button>
  );
}

/** English or Spanish for the whole app on this device. */
export function LangSwitch({ lang, onLang }: { lang: Lang; onLang: (l: Lang) => void }) {
  return (
    <div className="seg" aria-label={t('interfaceLanguage', lang)}>
      <button type="button" aria-pressed={lang === 'en'} onClick={() => onLang('en')} lang="en">English</button>
      <button type="button" aria-pressed={lang === 'es'} onClick={() => onLang('es')} lang="es">Español</button>
    </div>
  );
}

/** Width of an element, kept current as the screen turns or panels open and close. */
export function useWidth<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver((entries) => setWidth(Math.round(entries[0].contentRect.width)));
    observer.current.observe(el);
  }, []);
  return [ref, width];
}

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/** An instrument's icon on a tile tinted with its track's color; the icon mixes the color with the ink, so it reads on every theme. */
export function InstBadge({ icon, color, size = 'md', title }: { icon: IconName; color?: string; size?: 'sm' | 'md' | 'lg'; title?: string }) {
  const px = size === 'sm' ? 15 : size === 'lg' ? 24 : 18;
  return (
    <span className={`ibadge ${size}`} style={color ? { ['--trk' as string]: color } : undefined} title={title} aria-hidden={title ? undefined : true}>
      <Icon name={icon} size={px} />
    </span>
  );
}

/** A track's badge: what it plays, in its color. */
export const TrackBadge = ({ track, size }: { track: Track; size?: 'sm' | 'md' | 'lg' }) => <InstBadge icon={trackIcon(track)} color={track.color} size={size} />;

/** An instrument's badge by its catalog key. */
export const KeyBadge = ({ k, color, size }: { k: string; color?: string; size?: 'sm' | 'md' | 'lg' }) => <InstBadge icon={instIcon(k)} color={color} size={size} />;

export function Avatar({ profile, size = 40, onClick, label, colors }: { profile: Profile; size?: number; onClick?: () => void; label?: string; colors?: { bg: string; fg: string } }) {
  const style = {
    width: size,
    height: size,
    fontSize: size * 0.45,
    ...(colors ? { background: colors.bg, color: colors.fg } : {}),
    boxShadow: profile.avatar.ring ? `0 0 0 2px var(--ground), 0 0 0 4px ${profile.avatar.ring}` : undefined,
  };
  const initial = profile.name.trim().charAt(0).toUpperCase() || '?';
  return onClick
    ? <button type="button" className="avatar" style={style} onClick={onClick} aria-label={label ?? profile.name}>{initial}</button>
    : <span className="avatar" style={style} aria-hidden="true">{initial}</span>;
}

export function Modal({ title, onClose, children, closeLabel = 'Close' }: { title: string; onClose: () => void; children: ReactNode; closeLabel?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 className="display grow" style={{ fontSize: 22 }}>{title}</h2>
          <button type="button" className="btn icon ghost" onClick={onClose} aria-label={closeLabel}><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function useToast(): [string | null, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2600);
  }, []);
  return [msg, show];
}

export function downloadText(filename: string, text: string, type = 'application/json'): void {
  downloadBlob(filename, new Blob([text], { type }));
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'song';
