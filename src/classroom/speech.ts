// Read aloud with the voice already on the device (no download, nothing sent anywhere).
//
// iPhone and iPad need care:
// - the first spoken line must start inside a tap, so prepare() runs in the tap that turns reading on;
// - in silent mode the voice is muted unless the page asks for playback audio (navigator.audioSession);
// - speaking right after cancel() can be dropped, so a busy voice is cancelled first and the next line waits a moment;
// - starting to speak pauses any playing video, which the lesson player must not mistake for the child's pause;
// - an utterance nobody holds on to can be garbage collected before it reports its end.

import type { Lang } from '../domain/types';

type AudioSessionNav = Navigator & { audioSession?: { type: string } };

const PREFER: Record<Lang, string[]> = { es: ['es-MX', 'es-419', 'es-US', 'es-CL', 'es-ES', 'es'], en: ['en-US', 'en-GB', 'en'] };

export const canSpeak = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

const isApple = (): boolean => typeof navigator !== 'undefined'
  && (/iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && 'ontouchend' in document));

let voices: SpeechSynthesisVoice[] = [];
function loadVoices(): void {
  if (!canSpeak()) return;
  voices = window.speechSynthesis.getVoices();
}
if (canSpeak()) {
  loadVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

/** On iPhone and iPad the system picks its own voice for the language (some listed voices are novelty voices). */
function voiceFor(lang: Lang): SpeechSynthesisVoice | undefined {
  if (isApple() || !voices.length) return undefined;
  for (const tag of PREFER[lang]) {
    const match = voices.filter((x) => x.lang.replace('_', '-').toLowerCase().startsWith(tag.toLowerCase()));
    const pick = match.find((x) => x.localService) ?? match[0];
    if (pick) return pick;
  }
  return undefined;
}

/** Call inside a tap before the first spoken line: asks for playback audio (heard in silent mode too). */
export function prepareSpeech(): void {
  const session = typeof navigator !== 'undefined' ? (navigator as AudioSessionNav).audioSession : undefined;
  if (session) {
    try { session.type = 'playback'; } catch { /* not allowed here */ }
  }
  loadVoices();
}

export type SpeakEnd = 'done' | 'cut' | 'failed';

export interface SpeakEvents {
  /** The voice really started. */
  onStart?: () => void;
  /** How it ended: read to the end, cut short by another line or a stop, or the device did not speak at all. */
  onEnd?: (how: SpeakEnd) => void;
}

let current: SpeechSynthesisUtterance | null = null; // held so it is not collected before it ends
let pendingTimer: number | undefined;
let generation = 0;

/** Speaks the text, stopping anything already being read. */
export function speak(text: string, lang: Lang, events: SpeakEvents = {}): void {
  if (!canSpeak()) { events.onEnd?.('failed'); return; }
  const synth = window.speechSynthesis;
  const mine = ++generation;
  window.clearTimeout(pendingTimer);
  const busy = synth.speaking || synth.pending || current !== null;
  if (busy) synth.cancel();

  const u = new SpeechSynthesisUtterance(text.replace(/[▲▼★…]/g, ' '));
  u.lang = lang === 'es' ? 'es-MX' : 'en-US';
  const v = voiceFor(lang);
  if (v) u.voice = v;
  u.rate = 0.95;
  u.pitch = 1;
  u.volume = 1;
  let started = false;
  let done = false;
  let asked = 0;
  // Some devices never report the end (no voice installed, speech blocked): move on after a fair reading time.
  const guard = window.setTimeout(() => finish(started ? 'done' : 'failed'), 3500 + text.length * 95);
  const finish = (how: SpeakEnd) => {
    if (done) return;
    done = true;
    if (mine !== generation) how = 'cut'; // replaced by another line, or stopped
    window.clearTimeout(guard);
    if (current === u) current = null;
    events.onEnd?.(how);
  };
  u.onstart = () => { started = true; events.onStart?.(); };
  // An end with no start, right away, is a voice that never spoke (muted or blocked).
  u.onend = () => finish(started || Date.now() - asked > 400 ? 'done' : 'failed');
  u.onerror = (e) => finish(e.error === 'canceled' || e.error === 'interrupted' || mine !== generation ? 'cut' : 'failed');

  const go = () => {
    if (mine !== generation) { finish('cut'); return; }
    asked = Date.now();
    current = u;
    try { synth.resume(); } catch { /* not paused */ }
    synth.speak(u);
  };
  // Right after cancel() a new line can be dropped: give the voice a moment. Otherwise speak now (inside the tap).
  if (busy) pendingTimer = window.setTimeout(go, 160);
  else go();
}

export function hush(): void {
  if (!canSpeak()) return;
  generation++;
  window.clearTimeout(pendingTimer);
  current = null;
  window.speechSynthesis.cancel();
}

/** True while a line is being read or about to be. */
export const speaking = (): boolean => canSpeak() && (current !== null || window.speechSynthesis.speaking);
