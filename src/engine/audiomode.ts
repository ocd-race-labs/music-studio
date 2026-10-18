// How this device computes audio, chosen per device. Fast answers at once, for playing live; stable computes in
// bigger batches so a busy or locked-down computer stops cutting out, at the cost of a small delay when playing.

export type AudioMode = 'fast' | 'stable';

const KEY = 'music-studio.audio-mode';

export const AUDIO_MODES: Record<AudioMode, { latencyHint: AudioContextLatencyCategory; lookAhead: number }> = {
  fast: { latencyHint: 'interactive', lookAhead: 0.05 },
  stable: { latencyHint: 'playback', lookAhead: 0.2 },
};

export function readAudioMode(): AudioMode {
  try { return localStorage.getItem(KEY) === 'stable' ? 'stable' : 'fast'; } catch { return 'fast'; }
}

export function writeAudioMode(m: AudioMode): void {
  try { localStorage.setItem(KEY, m); } catch { /* this browser keeps nothing; the choice lasts the visit */ }
}

/** Where to come back after the page reloads to apply a new mode. */
const RESUME = 'music-studio.resume';
export function rememberResume(route: unknown): void {
  try { sessionStorage.setItem(RESUME, JSON.stringify(route)); } catch { /* best effort */ }
}
export function takeResume<T>(): T | null {
  try {
    const raw = sessionStorage.getItem(RESUME);
    sessionStorage.removeItem(RESUME);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
