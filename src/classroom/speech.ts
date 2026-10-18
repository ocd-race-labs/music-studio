// Read aloud with the voice already on the device (no download, nothing sent anywhere).

import type { Lang } from '../domain/types';

const PREFER: Record<Lang, string[]> = { es: ['es-MX', 'es-419', 'es-US', 'es-CL', 'es-ES', 'es'], en: ['en-US', 'en-GB', 'en'] };

export const canSpeak = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

function voiceFor(lang: Lang): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  for (const tag of PREFER[lang]) {
    const v = voices.find((x) => x.lang.replace('_', '-').toLowerCase().startsWith(tag.toLowerCase()));
    if (v) return v;
  }
  return undefined;
}

/** Speaks the text (stopping anything already being read) and calls onEnd when it finishes or is cut short. */
export function speak(text: string, lang: Lang, onEnd?: () => void): void {
  if (!canSpeak()) { onEnd?.(); return; }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[▲▼★]/g, ''));
  u.lang = lang === 'es' ? 'es-MX' : 'en-US';
  const v = voiceFor(lang);
  if (v) u.voice = v;
  u.rate = 0.95;
  let done = false;
  // Some devices never report the end (no voice installed, speech blocked): move on after a fair reading time.
  const guard = window.setTimeout(() => finish(), 2500 + text.length * 95);
  const finish = () => { if (!done) { done = true; window.clearTimeout(guard); onEnd?.(); } };
  u.onend = finish;
  u.onerror = finish;
  synth.speak(u);
}

export function hush(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
