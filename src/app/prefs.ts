// Device preferences: light or dark appearance. Saved on this device only, so the iPad, the iPhone and the
// laptop can each follow their own setting.

import { useCallback, useEffect, useState } from 'react';
import type { ThemePreset } from '../domain/types';

export type Appearance = 'auto' | 'light' | 'dark';
export type Mode = 'light' | 'dark';

const KEY = 'music-studio.appearance';

export function readAppearance(): Appearance {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

function writeAppearance(a: Appearance): void {
  try {
    if (a === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, a);
  } catch { /* storage blocked: the choice lasts this visit */ }
}

const darkQuery = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null);

/**
 * Appearance for this device. Automatic follows the system and changes with it. The quick switch picks the
 * other mode; picking the mode the system already shows goes back to Automatic.
 */
export function useAppearance() {
  const [appearance, setAppearanceState] = useState<Appearance>(readAppearance);
  const [systemDark, setSystemDark] = useState<boolean>(() => darkQuery()?.matches ?? false);

  useEffect(() => {
    const q = darkQuery();
    if (!q) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    q.addEventListener('change', onChange);
    return () => q.removeEventListener('change', onChange);
  }, []);

  const system: Mode = systemDark ? 'dark' : 'light';
  const mode: Mode = appearance === 'auto' ? system : appearance;

  const setAppearance = useCallback((a: Appearance) => {
    setAppearanceState(a);
    writeAppearance(a);
  }, []);

  const toggle = useCallback(() => {
    const next: Mode = mode === 'dark' ? 'light' : 'dark';
    setAppearance(next === system ? 'auto' : next);
  }, [mode, system, setAppearance]);

  return { appearance, mode, setAppearance, toggle };
}

/** Ground color of each palette in each mode: the browser bar and the previews use it. */
export const GROUND: Record<ThemePreset, Record<Mode, string>> = {
  daylight: { light: '#F3F4F6', dark: '#141518' },
  graphite: { light: '#F4F4F5', dark: '#0E0E0F' },
  'midnight-jewel': { light: '#F6F4FD', dark: '#120F1F' },
};

/** Small previews of each palette for the home cards and settings. */
export const PREVIEW: Record<ThemePreset, Record<Mode, { ground: string; panel: string; ink: string; ink2: string; line: string; bars: string[][] }>> = {
  graphite: {
    dark: { ground: '#0E0E0F', panel: '#161617', ink: '#F2F2F2', ink2: '#A6A6AB', line: '#2A2A2D', bars: [['#3A3A3E', '#3A3A3E'], ['#55555B', '#55555B'], ['#74747A', '#F2F2F2']] },
    light: { ground: '#E8E8EA', panel: '#FFFFFF', ink: '#111113', ink2: '#55555B', line: '#D4D4D8', bars: [['#C4C4C8', '#C4C4C8'], ['#A1A1AA', '#A1A1AA'], ['#71717A', '#111113']] },
  },
  'midnight-jewel': {
    dark: { ground: '#120F1F', panel: '#1A1630', ink: '#F4F1FF', ink2: '#B9B2D9', line: '#342C55', bars: [['#2DD4BF', '#2DD4BF'], ['#A78BFA', '#A78BFA'], ['#F0509E', '#38BDF8']] },
    light: { ground: '#ECE8FA', panel: '#FFFFFF', ink: '#1A1630', ink2: '#4B4470', line: '#D9D2F2', bars: [['#0F8C7E', '#0F8C7E'], ['#7C5CE0', '#7C5CE0'], ['#BE185D', '#0284C7']] },
  },
  daylight: {
    light: { ground: '#E9EBEF', panel: '#FFFFFF', ink: '#15171C', ink2: '#4A4F5A', line: '#D5D8DE', bars: [['#C9CDD4', '#C9CDD4'], ['#C2410C', '#AEB3BC'], ['#AEB3BC', '#C9CDD4']] },
    dark: { ground: '#141518', panel: '#1C1E22', ink: '#F3F4F6', ink2: '#A9AEB8', line: '#33363D', bars: [['#33363D', '#33363D'], ['#F97316', '#5B6170'], ['#5B6170', '#33363D']] },
  },
};
