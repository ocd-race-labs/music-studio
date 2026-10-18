// Read aloud. Every caption and every answer of Clave has a recorded voice (classroom/voice/<lang>/<hash>.mp3,
// made offline with an open voice, so nothing is sent anywhere): an <audio> element plays it, the same way on every
// device and in silent mode too. Only a text without a recording falls back to the voice built into the device.
//
// The device voice on iPhone and iPad needs care:
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

/** Speaks the text with the device's own voice, stopping anything already being read. */
function speakSynth(text: string, lang: Lang, events: SpeakEvents = {}): void {
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

/* ---------------------------------------------------------------- the recorded voice */

/** FNV-1a of the text: the recording's file name, so a changed text never plays an old recording. */
export function voiceHash(text: string): string {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
export const voicePath = (text: string, lang: Lang): string => `classroom/voice/${lang}/${voiceHash(text)}.mp3`;

let narrator: HTMLAudioElement | null = null;
let unlocked = false;
let narrating = 0; // which recorded line is current

function player(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!narrator) {
    narrator = new Audio();
    narrator.preload = 'auto';
    narrator.setAttribute('playsinline', '');
  }
  return narrator;
}

/** A tenth of a second of silence (8 kHz, 8-bit WAV), to unlock the player inside a tap. */
function silence(): string {
  const n = 800;
  const b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  const w = (o: number, t: string) => { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true); b.fill(128, 44);
  let s = '';
  b.forEach((x) => { s += String.fromCharCode(x); });
  return `data:audio/wav;base64,${btoa(s)}`;
}

/**
 * iPhone and iPad let a page play sound on its own only after a tap has played it once. Call from any tap
 * (opening a lesson, the read-aloud button): later lines can then start by themselves.
 */
export function unlockVoice(): void {
  prepareSpeech();
  const a = player();
  if (!a || unlocked) return;
  unlocked = true;
  a.src = silence();
  // A line may start right after (same tap): only stop the silence itself.
  a.play().then(() => { if (a.src.startsWith('data:')) a.pause(); }).catch((e: unknown) => {
    if (e instanceof DOMException && e.name === 'NotAllowedError') unlocked = false;
  });
}

/** Reads the text: the recording when there is one, otherwise the device's voice. Stops anything being read. */
export function speak(text: string, lang: Lang, events: SpeakEvents = {}): void {
  stopRecording();
  if (canSpeak() && speaking()) { generation++; window.clearTimeout(pendingTimer); current = null; window.speechSynthesis.cancel(); }
  const a = player();
  if (!a) { speakSynth(text, lang, events); return; }
  const mine = ++narrating;
  let started = false;
  let done = false;
  const finish = (how: SpeakEnd) => {
    if (done) return;
    done = true;
    window.clearTimeout(guard);
    a.onplaying = a.onended = a.onerror = null;
    events.onEnd?.(mine === narrating ? how : 'cut');
  };
  // No recording (or it cannot load): the device's voice reads it instead.
  const fallback = () => {
    if (done || mine !== narrating) return;
    done = true;
    window.clearTimeout(guard);
    a.onplaying = a.onended = a.onerror = null;
    speakSynth(text, lang, events);
  };
  const guard = window.setTimeout(() => { if (!started) fallback(); }, 4000);
  a.onplaying = () => { if (!started) { started = true; events.onStart?.(); } };
  a.onended = () => finish('done');
  a.onerror = fallback;
  a.src = voicePath(text, lang);
  a.currentTime = 0;
  a.play().then(() => { unlocked = true; }).catch((e: unknown) => {
    // Blocked until a tap (NotAllowedError): say so; anything else, try the device's voice.
    if (e instanceof DOMException && e.name === 'NotAllowedError') finish('failed');
    else if (!(e instanceof DOMException && e.name === 'AbortError')) fallback();
  });
}

function stopRecording(): void {
  narrating++;
  if (narrator && !narrator.paused) narrator.pause();
}

export function hush(): void {
  stopRecording();
  if (!canSpeak()) return;
  generation++;
  window.clearTimeout(pendingTimer);
  current = null;
  window.speechSynthesis.cancel();
}

/** True while the device's voice is reading or about to. */
export const speaking = (): boolean => canSpeak() && (current !== null || window.speechSynthesis.speaking);

/** Reading aloud is possible: a recording can play, or the device has a voice. */
export const canReadAloud = (): boolean => typeof Audio !== 'undefined' || canSpeak();
