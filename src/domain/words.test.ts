import { describe, expect, it } from 'vitest';
import {
  buildFromWords, chordPicks, choiceFromClaude, claudeRequest, formBars, formPicks, formTime, groovePicks, ideaPicks, instPicks,
  namesASong, previewFromWords, refineChords, refineForm, refineGroove, refineInst,
} from './words';
import type { WordsChoice } from './words';
import { parseSongIdeasFile } from './files';
import { MAX_BARS } from './arrange';
import { layout } from './sketch';

const choiceFor = (text: string): WordsChoice => {
  const idea = ideaPicks(text).picks[0];
  return { idea, form: formPicks(idea)[0], chords: chordPicks(idea)[0], inst: instPicks(idea)[0], groove: groovePicks(idea)[0] };
};

describe('idea from words', () => {
  it('understands the references in the examples, without showing them', () => {
    expect(ideaPicks('quiero una canción con la estructura de Wandering Star de Portishead').picks[0].group).toBe('el-triphop');
    expect(ideaPicks('la forma de One Weak de Deftones').picks[0].group).toBe('rock-metal');
    expect(ideaPicks('un beat al estilo de Keinemusik').picks[0].group).toBe('el-deephouse');
    for (const p of ideaPicks('como Portishead').picks) expect(JSON.stringify(p).toLowerCase()).not.toContain('portishead');
  });

  it('always offers three ideas, also when no style is named', () => {
    expect(ideaPicks('algo para escuchar de noche').picks).toHaveLength(3);
    expect(ideaPicks('algo para escuchar de noche').matched).toBe(false);
    const [a, b, c] = ideaPicks('trip hop lento y oscuro').picks;
    expect(a.mode).toBe('minor');
    expect(new Set([a.group + a.tempo, b.group + b.tempo, c.group + c.tempo]).size).toBe(3);
  });

  it('tells when the words name a specific song', () => {
    expect(namesASong('quiero una canción con la estructura de Wandering Star de Portishead')).toBe(true);
    expect(namesASong('trip hop lento y oscuro')).toBe(false);
  });

  it('offers forms that fit the song limit, with their length in time', () => {
    for (const text of ['house', 'boom bap', 'rock']) {
      for (const f of formPicks(ideaPicks(text).picks[0])) expect(formBars(f)).toBeLessThanOrEqual(MAX_BARS);
    }
    expect(formTime({ parts: [{ kind: 'verse', bars: 40, letter: 'a' }], title: { en: '', es: '' }, note: { en: '', es: '' } }, 76)).toBe('2:06');
  });

  it('reads free text for the form', () => {
    const base = formPicks(ideaPicks('rock').picks[0])[1];
    const r = refineForm('intro más largo y sin puente', base, 'es');
    expect(r.missed).toBe(false);
    expect(r.pick!.parts.some((p) => p.kind === 'bridge')).toBe(false);
    expect(r.pick!.parts[0].bars).toBe(base.parts[0].bars * 2);
    expect(refineForm('versos de 16', base, 'es').pick!.parts.filter((p) => p.kind === 'verse').every((p) => p.bars === 16)).toBe(true);
    expect(refineForm('qwerty', base, 'es').missed).toBe(true);
  });

  it('takes a form listed part by part exactly as written', () => {
    const base = formPicks(ideaPicks('boom bap').picks[0])[0];
    const shape = (text: string) => refineForm(text, base, 'es').pick!.parts.map((p) => `${p.kind} ${p.bars}`);
    const want = ['intro 4', 'verse 8', 'chorus 4', 'verse 4', 'bridge 4', 'outro 4'];
    expect(shape('intro de 4, verso de 8, coro de 4, verso de 4, puente de 4, y nada más de coros y versos, para pasar al outro directo.')).toEqual(want);
    expect(shape('intro 4 compases, verso 8, coro 4, verso 4, puente 4 y luego el outro')).toEqual(want);
    expect(shape('intro de cuatro, verso de ocho, coro de cuatro, verso de cuatro, puente de cuatro, outro de cuatro')).toEqual(want);
    expect(shape('intro 8, verso 16, coro 8, verso 16, coro 8, outro 4')).toEqual(['intro 8', 'verse 16', 'chorus 8', 'verse 16', 'chorus 8', 'outro 4']);
    const r = refineForm('intro de 4, verso de 8, coro de 4, verso de 4, puente de 4, y nada más de coros y versos, para pasar al outro directo.', base, 'es');
    expect(r.understood.join(' ')).toContain('outro con su largo habitual');
    const repeated = refineForm('intro 8, verso 16, coro 8, verso 16, coro 8, outro 4', base, 'es').pick!.parts;
    expect(repeated[3].letter).toBe(repeated[1].letter);
    expect(refineForm('intro más largo y sin puente', base, 'es').pick!.parts.length).toBe(base.parts.length);
  });

  it('reads free text for chords, instruments and groove', () => {
    const idea = ideaPicks('trip hop').picks[0];
    expect(refineChords('verso i VI III VII', chordPicks(idea)[0], 'es').pick!.verse).toEqual([0, 5, 2, 6]);
    expect(refineChords('más tensión al final del coro', chordPicks(idea)[0], 'es').pick!.chorus[3]).toBe(4);
    expect(refineInst('con piano y sin bajo', instPicks(idea)[0], 'es').pick).toMatchObject({ chords: 'instrument.keys-piano', bass: null });
    expect(refineGroove('sin batería en el intro', groovePicks(idea)[0], 'es').pick!.noIntro).toBe(true);
  });

  it('builds a song whose idea holds the choices, and writes the detail when accepted', () => {
    const choice = choiceFor('trip hop lento y oscuro');
    const draft = buildFromWords(choice, 'p1', 'es', 'Prueba', false);
    expect(draft.sketch!.order.length).toBe(choice.form.parts.length);
    expect(draft.sketch!.accepted_at).toBeNull();
    expect(draft.tempo_bpm).toBe(choice.idea.tempo);
    const accepted = buildFromWords(choice, 'p1', 'es', 'Prueba', true);
    expect(accepted.sketch!.accepted_at).not.toBeNull();
    expect(accepted.sections.length).toBe(layout(accepted.sketch!).length);
    const chords = accepted.tracks.find((t) => t.clips[0]?.kind === 'chords')!;
    expect((chords.clips[0].content as { chords: unknown[] }).chords.length).toBeGreaterThan(0);
  });

  it('previews a short loop or the whole form', () => {
    const choice = choiceFor('house');
    expect(previewFromWords(choice, 'p1', 'es', 'loop').length_ticks).toBe(4 * 3840);
    expect(previewFromWords(choice, 'p1', 'es', 'full').length_ticks).toBe(formBars(choice.form) * 3840);
  });

  it('reads a song idea file from Claude and makes it the first choice of every step', () => {
    const file = JSON.stringify({
      format: 'music-studio.ideas', version: 2, song_title: 'Estrella',
      ideas: [{
        kind: 'song', title: 'Lenta', payload: {
          style: 'el-triphop', tempo: 80, key: { tonic: 'A', mode: 'minor' }, swing: 0.2,
          form: [{ kind: 'intro', bars: 4, chords: [0], feel: null }, { kind: 'verse', bars: 8, chords: [0, 6, 5, 4], feel: 'normal' }, { kind: 'chorus', bars: 8, chords: [5, 6, 0, 0], feel: 'strong' }, { kind: 'verse', bars: 8, same_as: 1 }],
          instruments: { chords: { key: 'instrument.syn-triphop-strings', version: '1.0.0' }, drums: { key: 'instrument.drums-el-triphop', version: '1.0.0' }, bass: null },
        },
      }],
    });
    const parsed = parseSongIdeasFile(file);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const choice = choiceFromClaude(parsed.value[0].payload, parsed.value[0].title);
    const song = buildFromWords(choice, 'p1', 'es', 'Estrella', false);
    const s = song.sketch!;
    expect(s.order).toHaveLength(4);
    expect(s.order[3]).toBe(s.order[1]);
    expect(s.blocks.find((b) => b.kind === 'intro')!.groove).toBeNull();
    expect(s.blocks.find((b) => b.kind === 'chorus')!.chords).toEqual([5, 6, 0, 0, 5, 6, 0, 0]);
    expect(s.bass_instrument).toBeNull();
    expect(parseSongIdeasFile(file.replace('"same_as":1', '"same_as":3')).ok).toBe(false);
  });

  it('writes a request for Claude with the words and the format', () => {
    const req = claudeRequest('la estructura de una canción');
    expect(req.startsWith('la estructura de una canción')).toBe(true);
    expect(req).toContain('"version": 2');
    expect(req).toContain('Never copy its melody');
  });
});
