// The guided beat assistant, without AI: it reads a description ("acid jazz chill out, slow and dark"), finds the
// closest style in the Colección, proposes tempo, feel, key and instruments, and builds a song from them.
// Everything here is plain rules and lists, so it works the same offline and for any profile.
// References to bands or producers are understood only to find a style; the app never shows them.

import { ENTRIES, GROUPS } from '../packs/collection';
import type { Entry, Genre } from '../packs/collection';
import { findByKey, resolveRow, rowsOf } from '../packs/core';
import { mod12, parseSpelling, scalePitchClasses, spellingPc } from '../theory';
import * as C from './commands';
import { newId, newSong, now, roleOf } from './factory';
import type { Lang, Note, NotesContent, PatternContent, Song } from './types';
import { STEP_TICKS } from './types';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Words and phrases that point to each style (Spanish and English). Longer phrases are checked first. */
const STYLE_WORDS: Record<string, string[]> = {
  'el-house': ['house', 'chicago house', 'disco', 'para bailar', 'bailar', 'club', 'cuatro en el piso', 'four on the floor', 'piano house', 'french house'],
  'el-deephouse': ['deep house', 'deep', 'sunset', 'lounge', 'chill house', 'atardecer'],
  'el-techno': ['techno', 'tecno', 'berlin', 'detroit', 'warehouse', 'rave', 'industrial', 'minimal', 'acid house', 'acid techno', 'acid'],
  'el-edm': ['edm', 'big room', 'festival', 'drop', 'progressive', 'future bass', 'electro house', 'dance', 'pop electronico', 'electronica bailable'],
  'el-triphop': ['trip hop', 'triphop', 'downtempo', 'chill out', 'chillout', 'chill', 'acid jazz', 'bristol', 'cinematic', 'cinematografico', 'noir', 'jazz electronico'],
  'el-idm': ['idm', 'glitch', 'experimental', 'braindance', 'roto', 'raro', 'intelligent dance'],
  'el-dnb': ['drum and bass', 'drum n bass', 'drum & bass', 'dnb', 'd&b', 'liquid', 'neurofunk'],
  'el-jungle': ['jungle', 'ragga', 'breakbeat', 'breaks'],
  'el-dubstep': ['dubstep', 'wobble', 'brostep', 'bass music', 'riddim'],
  'el-ambient': ['ambient', 'ambiental', 'atmosferico', 'relajante', 'meditacion', 'para dormir', 'espacial', 'drone'],
  'hh-oldschool': ['old school', 'oldschool', 'vieja escuela', 'electro', 'breakdance', 'hip hop de los 80', '80s hip hop'],
  'hh-boombap': ['boom bap', 'boombap', 'noventero', '90s hip hop', 'hip hop de los 90', 'golden age', 'sampleado', 'jazzy hip hop', 'rap clasico', 'hip hop clasico'],
  'hh-trap': ['trap', '808', 'redobles de hi hat', 'hi hat rolls', 'atlanta'],
  'hh-lofi': ['lofi', 'lo fi', 'lo-fi', 'para estudiar', 'study', 'beats to relax', 'relax'],
  'hh-drill': ['drill', 'uk drill', 'brooklyn drill', '808 deslizante', 'sliding 808'],
  'hh-westcoast': ['west coast', 'g funk', 'gfunk', 'california', 'funk', 'talkbox'],
  'rock-classic': ['rock clasico', 'classic rock', 'rock de los 70', '70s rock', 'rock de los 60', '60s', 'rock and roll', 'rock n roll', 'blues rock', 'hard rock'],
  'rock-modern': ['grunge', 'alternativo', 'alternative', 'indie', 'garage rock', 'rock moderno', 'rock de los 90', '90s rock', 'rock'],
  'rock-metal': ['metal', 'thrash', 'heavy', 'djent', 'metalcore', 'doble bombo', 'double kick'],
  'rock-punk': ['punk', 'pop punk', 'skate punk', 'hardcore', 'skate'],
};

/** Who the person may mention, mapped to a style. Used to understand only; never shown in the app. */
const REFERENCES: Record<string, string[]> = {
  'el-triphop': ['portishead', 'massive attack', 'tricky', 'morcheeba', 'zero 7', 'bonobo', 'thievery corporation', 'air'],
  'el-house': ['daft punk', 'frankie knuckles', 'disclosure', 'fisher'],
  'el-deephouse': ['larry heard', 'kerri chandler', 'moodymann'],
  'el-techno': ['jeff mills', 'richie hawtin', 'carl cox', 'charlotte de witte', 'amelie lens'],
  'el-edm': ['avicii', 'martin garrix', 'david guetta', 'calvin harris', 'tiesto', 'alesso', 'swedish house mafia'],
  'el-idm': ['aphex twin', 'autechre', 'boards of canada', 'squarepusher', 'four tet'],
  'el-dnb': ['goldie', 'roni size', 'noisia', 'pendulum', 'chase and status', 'netsky'],
  'el-jungle': ['shy fx', 'congo natty', 'remarc'],
  'el-dubstep': ['skrillex', 'burial', 'rusko', 'excision', 'skream'],
  'el-ambient': ['brian eno', 'stars of the lid', 'tim hecker'],
  'hh-oldschool': ['run dmc', 'grandmaster flash', 'afrika bambaataa', 'beastie boys', 'll cool j'],
  'hh-boombap': ['j dilla', 'dj premier', 'pete rock', 'nas', 'wu tang', 'a tribe called quest', 'mf doom', 'gang starr'],
  'hh-trap': ['travis scott', 'metro boomin', 'future', 'migos', 'bad bunny', 'young thug'],
  'hh-lofi': ['nujabes', 'lofi girl', 'jinsang', 'tomppabeats'],
  'hh-drill': ['pop smoke', 'chief keef', 'central cee', 'headie one'],
  'hh-westcoast': ['dr dre', 'snoop dogg', 'warren g', '2pac', 'tupac', 'kendrick'],
  'rock-classic': ['led zeppelin', 'ac dc', 'acdc', 'beatles', 'rolling stones', 'queen', 'deep purple', 'jimi hendrix', 'black sabbath'],
  'rock-modern': ['nirvana', 'foo fighters', 'pearl jam', 'the strokes', 'arctic monkeys', 'white stripes', 'radiohead', 'soda stereo', 'los bunkers'],
  'rock-metal': ['metallica', 'slayer', 'iron maiden', 'megadeth', 'pantera', 'slipknot', 'gojira', 'tool'],
  'rock-punk': ['ramones', 'sex pistols', 'the clash', 'green day', 'blink 182', 'the offspring'],
};

const DARK = ['oscuro', 'oscura', 'triste', 'melancolico', 'melancolica', 'dark', 'sad', 'noir', 'misterioso', 'misteriosa', 'tenso', 'nocturno', 'menor'];
const BRIGHT = ['alegre', 'feliz', 'luminoso', 'luminosa', 'happy', 'bright', 'optimista', 'brillante', 'mayor', 'veraniego'];
const SLOW = ['lento', 'lenta', 'slow', 'tranquilo', 'tranquila', 'relajado', 'relajada', 'calmado', 'chill'];
const FAST = ['rapido', 'rapida', 'fast', 'energico', 'energica', 'energetico', 'enérgico', 'potente', 'intenso', 'intensa'];
const SWING = ['swing', 'con swing', 'shuffle', 'groove', 'saltado', 'jazzy', 'jazz'];
const STRAIGHT = ['recto', 'straight', 'sin swing', 'cuadrado'];

/** Instruments the person may ask for, and the voices or Colección words that fit them. */
const WANTS: Record<string, string[]> = {
  piano: ['piano', 'keys', 'teclado', 'teclados', 'rhodes', 'piano electrico', 'wurlitzer'],
  strings: ['cuerdas', 'strings', 'violin', 'violines', 'orquesta', 'orquestal'],
  bells: ['campanas', 'bells', 'campanitas', 'glockenspiel'],
  guitar: ['guitarra', 'guitar', 'guitarras'],
  pad: ['pad', 'pads', 'atmosfera', 'colchon'],
};

export interface Parsed {
  /** Styles in order of fit (Colección groups), best first; empty when nothing matched. */
  styles: { group: string; score: number }[];
  tempo?: number;
  mood?: 'dark' | 'bright';
  pace?: 'slow' | 'fast';
  swing?: boolean;
  wants: string[];
  /** The words that were understood, for the "this is what I understood" line. */
  understood: string[];
}

const has = (text: string, phrase: string) => ` ${text} `.includes(` ${phrase} `);

export function parseRequest(raw: string): Parsed {
  const text = norm(raw);
  const scores = new Map<string, number>();
  const understood: string[] = [];
  // Mentions of a band or producer point to a style (and are never repeated back).
  for (const [group, names] of Object.entries(REFERENCES)) {
    if (names.some((n) => has(text, norm(n)))) scores.set(group, (scores.get(group) ?? 0) + 3);
  }
  let rest = ` ${text} `;
  const phrases = Object.entries(STYLE_WORDS).flatMap(([group, words]) => words.map((w) => ({ group, w: norm(w) })))
    .sort((a, b) => b.w.length - a.w.length);
  for (const { group, w } of phrases) {
    if (rest.includes(` ${w} `)) {
      // A longer phrase counts more and hides its words from shorter matches ("acid jazz" is not "acid").
      scores.set(group, (scores.get(group) ?? 0) + 2 + w.split(' ').length);
      rest = rest.replace(` ${w} `, ' ');
      understood.push(w);
    }
  }
  const styles = [...scores.entries()].map(([group, score]) => ({ group, score })).sort((a, b) => b.score - a.score);
  const num = text.match(/\b(\d{2,3})\s*(bpm)?\b/);
  const tempo = num && Number(num[1]) >= 50 && Number(num[1]) <= 220 ? Number(num[1]) : undefined;
  const any = (list: string[]) => list.some((w) => has(text, norm(w)));
  const mood = any(DARK) ? 'dark' : any(BRIGHT) ? 'bright' : undefined;
  const pace = any(FAST) ? 'fast' : any(SLOW) ? 'slow' : undefined;
  const swing = any(STRAIGHT) ? false : any(SWING) ? true : undefined;
  const wants = Object.entries(WANTS).filter(([, words]) => any(words)).map(([k]) => k);
  return { styles, tempo, mood, pace, swing, wants, understood };
}

/* ---------------------------------------------------------------- the plan */

export interface BeatPlan {
  group: string;
  genre: Genre;
  tempo: number;
  /** Swing as the song stores it (0 straight, up to 0.75). */
  swing: number;
  tonic: string;
  mode: 'minor' | 'major';
  bars: number;
  drums: string;
  bass: string | null;
  chords: string | null;
}

export const entriesOf = (group: string, family: Entry['family']) => ENTRIES.filter((e) => e.group === group && e.family === family);
const genreOf = (group: string): Genre => GROUPS.find((g) => g.id === group)?.genre ?? 'rock';

/** Tempo ranges per style (BPM), from the research tables; the plan starts in the middle unless told otherwise. */
const TEMPO_RANGE: Record<string, [number, number]> = {
  'el-house': [118, 128], 'el-deephouse': [116, 124], 'el-techno': [126, 138], 'el-edm': [124, 130], 'el-triphop': [76, 100],
  'el-idm': [90, 160], 'el-dnb': [168, 178], 'el-jungle': [160, 175], 'el-dubstep': [138, 142], 'el-ambient': [60, 90],
  'hh-oldschool': [96, 120], 'hh-boombap': [84, 96], 'hh-trap': [130, 150], 'hh-lofi': [70, 90], 'hh-drill': [138, 146], 'hh-westcoast': [88, 100],
  'rock-classic': [96, 140], 'rock-modern': [100, 140], 'rock-metal': [120, 200], 'rock-punk': [150, 200],
};
export const tempoRange = (group: string): [number, number] => TEMPO_RANGE[group] ?? [80, 140];

/** The chord instrument that best fits what was asked for (piano, strings, bells, guitar), else the style's first. */
function pickChords(group: string, wants: string[]): string | null {
  const melodic = [...entriesOf(group, 'synth'), ...entriesOf(group, 'guitar')];
  const fits = (e: Entry, want: string) => {
    const v = `${e.voice ?? ''} ${e.instrument}`;
    if (want === 'piano') return /keys|piano|Ep/i.test(v);
    if (want === 'strings') return /strings/i.test(v);
    if (want === 'bells') return /bells/i.test(v);
    if (want === 'pad') return /pad|drone|strings|supersaw/i.test(v);
    if (want === 'guitar') return e.family === 'guitar';
    return false;
  };
  for (const w of wants) {
    const hit = melodic.find((e) => fits(e, w));
    if (hit) return hit.instrument;
    if (w === 'piano') return 'instrument.keys-ep';
    if (w === 'strings') return 'instrument.strings-ensemble';
    if (w === 'guitar') return 'instrument.guitar-clean-60';
  }
  return melodic[0]?.instrument ?? null;
}

export function planFor(parsed: Parsed, group = parsed.styles[0]?.group ?? 'hh-boombap'): BeatPlan {
  const [lo, hi] = tempoRange(group);
  const drums = entriesOf(group, 'drums')[0];
  const base = parsed.tempo ?? (parsed.pace === 'slow' ? lo : parsed.pace === 'fast' ? hi : drums?.tempo ?? Math.round((lo + hi) / 2));
  const grooveSwing = drums?.groove.swing ?? 0.5;
  const swingOn = parsed.swing ?? grooveSwing > 0.5;
  return {
    group,
    genre: genreOf(group),
    tempo: Math.round(Math.min(220, Math.max(50, base))),
    swing: swingOn ? Math.min(0.6, Math.max(0.2, (Math.max(grooveSwing, 0.56) - 0.5) * 4)) : 0,
    tonic: 'A',
    mode: parsed.mood === 'bright' ? 'major' : 'minor',
    bars: 4,
    drums: drums?.instrument ?? 'instrument.drums-rock',
    bass: entriesOf(group, 'bass')[0]?.instrument ?? null,
    chords: pickChords(group, parsed.wants),
  };
}

/* ---------------------------------------------------------------- building the song */

const KIT_OF: Record<Genre, string> = { rock: 'kit.rock', electronic: 'kit.electronic', hiphop: 'kit.hiphop' };
const VOICE_ROW: Record<string, string> = {
  kick: 'sound.kick', snare: 'sound.snare', clap: 'sound.clap', hatClosed: 'sound.hat-closed', hatOpen: 'sound.hat-open', rim: 'sound.rim',
  tom: 'sound.tom', tom1: 'sound.tom-1', tom2: 'sound.tom-2', ride: 'sound.ride', crash: 'sound.crash', china: 'sound.china',
};
/** Chord progressions by scale degree, one chord per bar: i VI III VII in minor, I V vi IV in major. */
const PROGRESSIONS = { minor: [0, 5, 2, 6], major: [0, 4, 5, 3] };

/** Move a phrase written in A minor to the song's key: transposed, then each note to the nearest scale note. */
export function toKey(midi: number, tonic: string, mode: 'minor' | 'major'): number {
  const shift = mod12(spellingPc(parseSpelling(tonic)) - 9);
  const moved = midi + (shift > 6 ? shift - 12 : shift);
  const scale = scalePitchClasses({ tonic, mode });
  for (const d of [0, -1, 1, -2, 2]) if (scale.includes(mod12(moved + d))) return moved + d;
  return moved;
}

export function buildBeat(plan: BeatPlan, owner: string, lang: Lang, title: string): Song {
  const by = owner;
  let song = newSong(owner, title, plan.bars, lang, KIT_OF[plan.genre], [], false);
  song = C.setTempo(song, plan.tempo, by);
  song = C.setSwing(song, plan.swing, by);
  song = C.setKey(song, plan.tonic, plan.mode, by);
  const trackOf = (role: string) => song.tracks.find((t) => roleOf(t) === role);
  const steps = plan.bars * 16;

  // Drums: the style's kit and its groove, repeated over the bars.
  const drumsTrack = trackOf('drums');
  const kitEntry = ENTRIES.find((e) => e.instrument === plan.drums);
  if (drumsTrack && findByKey(plan.drums)) {
    song = C.setInstrument(song, drumsTrack.id, { key: plan.drums, version: '1.0.0' }, by);
    const groove = kitEntry?.groove;
    if (groove) {
      const rows = rowsOf(plan.drums);
      const span = Math.max(1, groove.bars) * 16;
      song = {
        ...song,
        tracks: song.tracks.map((t) => {
          if (t.id !== drumsTrack.id) return t;
          const clip = t.clips[0];
          const p = clip.content as PatternContent;
          const hits = new Map<string, Map<number, number>>();
          for (const [voice, list] of Object.entries(groove.steps)) {
            const row = resolveRow(rows, VOICE_ROW[voice] ?? voice);
            if (!row) continue;
            const m = hits.get(row) ?? new Map<number, number>();
            for (let at = 0; at < steps; at += span) {
              for (const s of list ?? []) {
                if (at + s >= steps || s >= span) continue;
                const soft = groove.soft?.[voice]?.includes(s);
                m.set(at + s, Math.max(m.get(at + s) ?? 0, soft ? 0.45 : s % 4 === 0 ? 0.9 : 0.75));
              }
            }
            hits.set(row, m);
          }
          const content: PatternContent = {
            steps: p.steps,
            rows: p.rows.map((r) => ({ ...r, hits: [...(hits.get(r.sound.key) ?? new Map())].map(([step, vel]) => ({ step, vel })).sort((a, b) => a.step - b.step) })),
          };
          return { ...t, clips: [{ ...clip, content, updated_at: now() }] };
        }),
      };
    }
  }

  // Bass: the style's bass playing its phrase in the song's key.
  const bassTrack = trackOf('bass');
  const bassEntry = ENTRIES.find((e) => e.instrument === plan.bass);
  if (bassTrack && plan.bass && findByKey(plan.bass)) {
    song = C.setInstrument(song, bassTrack.id, { key: plan.bass, version: '1.0.0' }, by);
    const phrase = bassEntry?.phrase;
    if (phrase) {
      const span = phrase.bars * 16;
      const notes: Note[] = [];
      for (let at = 0; at < steps; at += span) {
        for (const n of phrase.notes) {
          if (at + n.at >= steps) continue;
          const midi = toKey(n.midi[0], plan.tonic, plan.mode);
          notes.push({ id: newId(), tick: (at + n.at) * STEP_TICKS, dur: Math.min(n.len, steps - at - n.at) * STEP_TICKS, midi, spell: C.spellNote(song, midi), vel: n.vel ?? 0.85 });
        }
      }
      song = {
        ...song,
        tracks: song.tracks.map((t) => (t.id === bassTrack.id
          ? { ...t, clips: [{ ...t.clips[0], content: { notes } as NotesContent, updated_at: now() }] } : t)),
      };
    }
  }

  // Chords: one chord per bar on the style's chord sound.
  const chordsTrack = trackOf('chords');
  if (chordsTrack) {
    if (plan.chords && findByKey(plan.chords)) song = C.setInstrument(song, chordsTrack.id, { key: plan.chords, version: '1.0.0' }, by);
    const prog = PROGRESSIONS[plan.mode];
    for (let bar = 0; bar < plan.bars; bar++) song = C.setChord(song, chordsTrack.id, bar, prog[bar % prog.length], by);
  }
  return { ...song, updated_at: now() };
}
