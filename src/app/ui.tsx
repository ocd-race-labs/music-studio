import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Lang, Profile } from '../domain/types';
import { t } from './i18n';

type IconName = 'home' | 'play' | 'stop' | 'undo' | 'redo' | 'gear' | 'menu' | 'plus' | 'close' | 'upload' | 'download' | 'check' | 'mic' | 'flask' | 'arrow' | 'reset' | 'expand' | 'shrink' | 'sun' | 'moon' | 'headphones' | 'star' | 'starFill' | 'trash' | 'warning' | 'sliders';

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
