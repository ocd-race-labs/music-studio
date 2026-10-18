// How this device computes audio, chosen per device. Fast answers at once, for playing live; stable computes in
// bigger batches so a busy or locked-down computer stops cutting out, at the cost of a small delay when playing.

export type AudioMode = 'fast' | 'stable';

const KEY = 'music-studio.audio-mode';

/**
 * latencyHint sets the size of the audio batches (a number asks for that many seconds, where the browser allows it);
 * lookAhead is how far ahead notes are planned; updateInterval is how often the planner runs. Notes land on time
 * while the page is never busier than lookAhead minus updateInterval.
 */
export const AUDIO_MODES: Record<AudioMode, { latencyHint: AudioContextLatencyCategory | number; fallbackHint: AudioContextLatencyCategory; lookAhead: number; updateInterval: number }> = {
  fast: { latencyHint: 'interactive', fallbackHint: 'interactive', lookAhead: 0.05, updateInterval: 0.025 },
  stable: { latencyHint: 0.1, fallbackHint: 'playback', lookAhead: 0.2, updateInterval: 0.05 },
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
