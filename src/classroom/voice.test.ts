import { describe, expect, it } from 'vitest';
import { FIXED_REPLIES } from './assistant';
import { KNOWLEDGE } from './knowledge';
import { addressed, cuesFor, LESSONS, STUDENTS } from './lessons';
import { voiceHash, voicePath } from './speech';

// Every caption, lesson title and answer of Clave has its recorded voice, so iPhone and iPad never depend on the
// device's own voice. A changed text has a new name: this fails until its voice is recorded again.
describe('recorded voice', () => {
  const texts: Record<'es' | 'en', string>[] = [];
  for (const l of LESSONS) { texts.push(l.title); cuesFor(l.id).forEach((c) => texts.push(c)); }
  KNOWLEDGE.forEach((e) => texts.push(e.answer));
  FIXED_REPLIES.forEach((r) => texts.push(r));

  it('speaks to an alumna or an alumno', () => {
    expect(addressed('Bienvenid{a|o}, vamos junt{as|os}.', 'f')).toBe('Bienvenida, vamos juntas.');
    expect(addressed('Bienvenid{a|o}, vamos junt{as|os}.', 'm')).toBe('Bienvenido, vamos juntos.');
    expect(addressed('Sin cambios.', 'm')).toBe('Sin cambios.');
  });

  it('names a recording after its text', () => {
    expect(voiceHash('Hola')).toMatch(/^[0-9a-f]{8}$/);
    expect(voiceHash('Hola')).not.toBe(voiceHash('Hola.'));
    expect(voicePath('Hola', 'es')).toBe(`classroom/voice/es/${voiceHash('Hola')}.mp3`);
  });

  // The recordings on disk (paths only; nothing is loaded).
  const onDisk = new Set(Object.keys(import.meta.glob('/public/classroom/voice/*/*.mp3')));

  it('has a recording for every text, in both languages', () => {
    expect(onDisk.size).toBeGreaterThanOrEqual(texts.length * 2);
    const missing: string[] = [];
    for (const r of texts) for (const lang of ['es', 'en'] as const) for (const who of STUDENTS) {
      const text = addressed(r[lang], who);
      if (!onDisk.has(`/public/${voicePath(text, lang)}`)) missing.push(`${lang} ${who}: ${text.slice(0, 50)}`);
    }
    expect(missing).toEqual([]);
  });
});
