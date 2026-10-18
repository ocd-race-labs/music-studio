// Clave, the Classroom assistant. It is not an AI model: every answer below was written ahead of time, so it
// can only ever talk about Music Studio, instruments and music theory, kindly and simply, and nothing on the
// device is sent anywhere. Anything outside that frame gets the family's message, word for word.
// Matching is forgiving with spelling (a letter off is fine) and works in Spanish and English.

import type { Lang } from '../domain/types';
import { KNOWLEDGE } from './knowledge';
import type { Entry } from './knowledge';

export type ReplyKind = 'answer' | 'unknown' | 'outside' | 'care' | 'hello' | 'thanks';
export interface Reply { kind: ReplyKind; text: string; lesson?: string; id?: string }

/** The family's message for anything outside music, word for word. */
export const OUTSIDE: Record<Lang, string> = {
  es: 'Esa pregunta está fuera de los límites permitidos por tu papá, para este asistente. Habla directamente con él.',
  en: 'That question is outside the limits your dad set for this assistant. Talk to him directly.',
};

/** When a question sounds like she is sad, scared or hurt: kind, and toward her dad first, then her mom, then an adult
    her parents know (never a stranger). */
export const CARE: Record<Lang, string> = {
  es: 'Gracias por contármelo. Eso es muy importante, y yo solo sé de música. Cuéntaselo ahora a tu papá. También se lo puedes contar a tu mamá, o a otro adulto de confianza que tus papás conozcan. Ellos te van a ayudar.',
  en: 'Thank you for telling me. That is really important, and I only know about music. Tell your dad right now. You can also tell your mom, or another grown-up you trust whom your parents know. They will help you.',
};

const HELLO: Record<Lang, string> = {
  es: '¡Hola! Soy Clave, tu asistente de Music Studio. Pregúntame sobre el estudio, los instrumentos o la teoría musical. Por ejemplo: "¿qué es un acorde?" o "¿cómo hago un beat?".',
  en: 'Hi! I\'m Clave, your Music Studio helper. Ask me about the studio, instruments or music theory. For example: "what is a chord?" or "how do I make a beat?".',
};
const THANKS: Record<Lang, string> = {
  es: '¡De nada! Me encanta aprender contigo. Sigue creando, que vas muy bien.',
  en: 'You\'re welcome! I love learning with you. Keep creating, you\'re doing great.',
};
/** Sad, scared or nervous about music itself: encouragement, and dad. */
const ENCOURAGE: Record<Lang, string> = {
  es: 'Es muy normal sentirse así con la música; ¡a todos los músicos les pasa, incluso a los más grandes! Respira hondo, descansa un ratito y prueba otra vez más lento. Y cuéntale a tu papá cómo te sientes: él te puede acompañar.',
  en: 'It is very normal to feel that way about music; it happens to every musician, even the greatest ones! Take a deep breath, rest a little and try again more slowly. And tell your dad how you feel: he can help you.',
};
const UNKNOWN: Record<Lang, string> = {
  es: '¡Qué buena pregunta de música! Todavía no tengo esa respuesta. Pregúntasela a tu papá, y mientras tanto puedes mirar las lecciones.',
  en: 'What a great music question! I don\'t have that answer yet. Ask your dad, and meanwhile you can watch the lessons.',
};

/** Lowercase, no accents, letters and numbers only, single spaces, padded so phrases match whole words. */
export function normalize(text: string): string {
  return ` ${text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9#]+/g, ' ').trim()} `;
}

/** A word and its simple singular, so "acordes" finds "acorde" and "chords" finds "chord". */
function variants(word: string): string[] {
  const out = [word];
  if (word.length > 4 && word.endsWith('es')) out.push(word.slice(0, -2));
  if (word.length > 3 && word.endsWith('s')) out.push(word.slice(0, -1));
  return out;
}

/** One letter off (or two letters swapped) is still the same word, for words of five letters or more. */
function near(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diff = [...a].map((c, k) => (c === b[k] ? -1 : k)).filter((k) => k >= 0);
    if (diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]) return true;
  }
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

interface Text { padded: string; words: Set<string> }

function prepare(question: string): Text {
  const padded = normalize(question);
  const words = new Set<string>();
  for (const w of padded.trim().split(' ')) if (w) variants(w).forEach((v) => words.add(v));
  return { padded, words };
}

/** True when a key (a word or a phrase) is in the text. */
function has(text: Text, key: string, fuzzy = true): boolean {
  if (key.includes(' ')) return text.padded.includes(` ${key} `);
  if (text.words.has(key)) return true;
  return fuzzy && key.length >= 6 && [...text.words].some((w) => near(w, key));
}

const prepared = (keys: string[]) => keys.map((k) => normalize(k).trim());

/* Words that say a question is about music at all. Short or everyday words (la, si, sol, mayor, tono) are not
   here: alone they say nothing; inside a phrase ("do mayor", "clave de sol") they count. */
const DOMAIN = prepared([
  'musica', 'musical', 'music', 'musico', 'musica', 'nota', 'notas', 'note', 'notes', 'escala', 'scale', 'acorde', 'chord',
  'ritmo', 'rhythm', 'tempo', 'bpm', 'compas', 'compases', 'measure', 'melodia', 'melody', 'armonia', 'harmony',
  'cancion', 'song', 'instrumento', 'instrument', 'violin', 'guitarra', 'guitar', 'piano', 'flauta', 'flute',
  'trompeta', 'trumpet', 'saxofon', 'saxophone', 'saxo', 'sax', 'chelo', 'cello', 'violonchelo', 'contrabajo', 'ukelele', 'ukulele',
  'pentagrama', 'music staff', 'sostenido', 'sharp', 'bemol', 'flat', 'tonalidad', 'tonica', 'tonic', 'dominante', 'octava', 'octave',
  'intervalo', 'interval', 'semitono', 'semitone', 'afinar', 'afinador', 'tune', 'tuner', 'partitura', 'sheet music', 'solfeo',
  'corchea', 'semicorchea', 'metronomo', 'metronome', 'swing', 'sincopa', 'syncopation', 'arpegio', 'arpeggio', 'triada', 'triad',
  'crescendo', 'forte', 'secuenciador', 'sequencer', 'beat', 'groove', 'loop', 'drums', 'bombo', 'kick', 'snare', 'hi hat', 'hihat', 'platillo', 'cymbal',
  'tambor', 'drum', 'conga', 'bongo', 'guiro', 'maracas', 'timbal', 'cencerro', 'cowbell', 'pandereta', 'triangulo', 'orquesta', 'orchestra',
  'coro', 'chorus', 'estribillo', 'verso', 'verse', 'estrofa', 'precoro', 'pre coro', 'pre chorus', 'puente musical',
  'hip hop', 'rock', 'jazz', 'pop', 'reggaeton', 'salsa', 'cumbia', 'electronica', 'clasica', 'blues', 'funk', 'rap',
  'pedal', 'pedales', 'reverb', 'reverberacion', 'delay', 'eco', 'mezclador', 'mixer', 'mezcla', 'mix', 'ecualizador', 'compresor',
  'music studio', 'classroom', 'leccion', 'lesson', 'pista', 'track', 'kit', 'piano roll', 'pads', 'paneo', 'fader', 'metronomo', 'cantar', 'sing', 'canto', 'singing', 'vocal',
  'productor', 'producer', 'producir', 'componer', 'compose', 'composer', 'compositor', 'banda', 'band', 'teclado', 'keyboard',
  'sintetizador', 'synth', 'synthesizer', '808', 'dj', 'vals', 'waltz', 'pizzicato', 'staccato', 'legato', 'grabar mi voz', 'record my voice', 'bajo electrico', 'bass guitar', 'clave de sol', 'clave de fa', 'treble clef', 'bass clef',
  'do mayor', 'do menor', 're mayor', 're menor', 'mi mayor', 'mi menor', 'fa mayor', 'fa menor', 'sol mayor', 'sol menor',
  'la mayor', 'la menor', 'si mayor', 'si menor', 'c major', 'c minor', 'a minor', 'g major', 'escala mayor', 'escala menor',
  'major scale', 'minor scale', 'redonda', 'blanca', 'negra', 'whole note', 'half note', 'quarter note', 'eighth note',
]);

/* Words that put a question outside the frame even if it mentions music: people's lives, money, the internet,
   personal data, grown-up topics, and attempts to change the rules. */
const NEVER = prepared([
  'novio', 'novia', 'boyfriend', 'girlfriend', 'beso', 'besar', 'kiss', 'enamorada', 'enamorado', 'enamorarse', 'sexo', 'sex', 'sexy',
  'desnudo', 'desnuda', 'naked',
  'droga', 'drug', 'alcohol', 'cerveza', 'beer', 'cigarro', 'fumar', 'pelea', 'fight', 'pistola', 'gun', 'armas', 'weapon',
  'matar', 'kill', 'muerto', 'dead', 'politica', 'politics', 'presidente', 'president', 'eleccion', 'election', 'religion',
  'dinero', 'money', 'precio', 'price', 'cuanto cuesta', 'how much does', 'how much money', 'comprar', 'buy', 'tarjeta', 'card number',
  'contrasena', 'password', 'tu direccion', 'mi direccion', 'your address', 'my address', 'donde vives', 'where do you live', 'telefono', 'phone number', 'celular',
  'whatsapp', 'instagram', 'tiktok', 'youtube', 'youtuber', 'facebook', 'snapchat', 'discord', 'roblox', 'fortnite', 'minecraft',
  'famoso', 'famosa', 'famous', 'millonario', 'millionaire', 'cuantos anos tiene', 'how old is', 'chisme', 'gossip',
  'ignora', 'ignore', 'olvida tus', 'forget your', 'finge', 'pretend', 'actua como', 'act as', 'eres ahora', 'ahora eres', 'you are now',
  'now you are', 'haz como que', 'imagina que eres', 'cualquier pregunta', 'any question',
  'modo desarrollador', 'developer mode', 'prompt', 'tus instrucciones', 'your instructions', 'tus reglas', 'your rules',
  'sin limites', 'no limits', 'hackear', 'hack', 'tu papa dijo', 'your dad said', 'mi papa dijo', 'my dad said',
  'buenas notas', 'malas notas', 'mis notas', 'notas del colegio', 'notas en el colegio', 'sacar notas', 'good grades', 'my grades',
]);

/* Words that sound like she is hurt or in danger: always the kind answer that points to a trusted grown-up,
   even inside a music question. */
const CARE_WORDS = prepared([
  'me pegan', 'me pegaron', 'me pega', 'hit me', 'hits me', 'me duele', 'it hurts', 'me hacen dano', 'me lastiman', 'hurt me', 'hurts me',
  'me molestan', 'me acosan', 'bullying', 'bully', 'acoso', 'nadie me quiere', 'nobody loves me', 'me siento sola', 'me siento solo', 'lonely',
  'quiero morir', 'me quiero morir', 'morirme', 'want to die', 'matarme', 'hacerme dano', 'hurt myself',
  'guardar un secreto', 'es un secreto', 'keep a secret', 'tocarme', 'touched me', 'escaparme', 'me escapo', 'run away',
]);

/* Words that sound like she is sad, scared or nervous. About music, encouragement; about anything else, the
   kind answer that points to a trusted grown-up. */
const FEEL_WORDS = prepared([
  'estoy triste', 'me siento triste', 'ando triste', 'i am sad', 'i m sad', 'im sad', 'i feel sad',
  'tengo miedo', 'me da miedo', 'i am scared', 'i m scared', 'im scared', 'estoy asustada', 'estoy asustado',
  'estoy llorando', 'i am crying', 'i m crying', 'im crying', 'me siento mal', 'i feel bad',
  'estoy nerviosa', 'estoy nervioso', 'i am nervous', 'i m nervous', 'me pongo nerviosa', 'me pongo nervioso',
]);

const HELLO_WORDS = prepared(['hola', 'hello', 'hi', 'hey', 'buenas', 'buenos dias', 'buenas tardes', 'good morning', 'quien eres', 'who are you', 'como te llamas', 'what is your name']);
const THANKS_WORDS = prepared(['gracias', 'thanks', 'thank you']);
/* A greeting or a thank-you counts only when the question is nothing else: "hola, ¿qué hora es?" is outside. */
const HELLO_ONLY = new Set(('hola hello hi hey oye buenas buenos dias tardes noches good morning afternoon evening clave como estas esta que tal '
  + 'how are you quien eres who te llamas what is your name y tu and mi amiga amigo friend').split(' '));
const THANKS_ONLY = new Set('gracias muchas thanks thank you so much genial clave super ok okay vale buenisimo bacan'.split(' '));
const only = (text: Text, allowed: Set<string>) => text.padded.trim().split(' ').every((w) => allowed.has(w));

const any = (text: Text, keys: string[], fuzzy = true) => keys.some((k) => has(text, k, fuzzy));

/** Phrases always count. Single words count only when the question is about music, and weak keys (written with
    ~) only next to another music word: so a question with no music in it never gets a music answer by accident. */
function score(entry: Entry, text: Text, inDomain: boolean): number {
  let s = 0;
  for (const raw of entry.keys) {
    const weak = raw.startsWith('~');
    const key = normalize(weak ? raw.slice(1) : raw).trim();
    if (key.includes(' ')) { if (!weak || inDomain) { if (text.padded.includes(` ${key} `)) s += 3 + key.split(' ').length; } continue; }
    if (!inDomain) continue;
    if (text.words.has(key)) s += 2;
    else if (key.length >= 6 && [...text.words].some((w) => near(w, key))) s += 1;
  }
  return s;
}

export function ask(question: string, lang: Lang): Reply {
  const text = prepare(question);
  if (!text.padded.trim()) return { kind: 'hello', text: HELLO[lang] };
  if (any(text, CARE_WORDS, false)) return { kind: 'care', text: CARE[lang] };
  if (any(text, NEVER, false)) return { kind: 'outside', text: OUTSIDE[lang] };
  const inDomain = any(text, DOMAIN);
  if (any(text, FEEL_WORDS, false)) return inDomain ? { kind: 'care', text: ENCOURAGE[lang] } : { kind: 'care', text: CARE[lang] };
  let best: Entry | null = null;
  let bestScore = 0;
  for (const e of KNOWLEDGE) {
    const s = score(e, text, inDomain);
    if (s > bestScore) { best = e; bestScore = s; }
  }
  if (best && bestScore >= 1) return { kind: 'answer', text: best.answer[lang], lesson: best.lesson, id: best.id };
  if (any(text, THANKS_WORDS, false) && only(text, THANKS_ONLY)) return { kind: 'thanks', text: THANKS[lang] };
  if (any(text, HELLO_WORDS, false) && only(text, HELLO_ONLY)) return { kind: 'hello', text: HELLO[lang] };
  if (inDomain) return { kind: 'unknown', text: UNKNOWN[lang] };
  return { kind: 'outside', text: OUTSIDE[lang] };
}

/** Every fixed reply, for the recorded voice and its checks. */
export const FIXED_REPLIES: Record<Lang, string>[] = [OUTSIDE, CARE, ENCOURAGE, HELLO, THANKS, UNKNOWN];

export const SUGGESTIONS: Record<Lang, string[]> = {
  es: ['¿Qué es un acorde?', '¿Cómo hago un beat?', '¿Qué es la escala mayor?', '¿Cómo marco el coro?', '¿Qué notas son dulces?', '¿Cuántas cuerdas tiene el violín?'],
  en: ['What is a chord?', 'How do I make a beat?', 'What is the major scale?', 'How do I mark the chorus?', 'Which notes are sweet?', 'How many strings does a violin have?'],
};
