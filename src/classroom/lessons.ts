// The Classroom lessons: one short video per part of the studio. Each video is recorded from the real app; its
// captions (Spanish and English, with the time they appear) come from the recording, in cues.json.

import type { Lang } from '../domain/types';
import CUES from './cues.json';

export type LessonId = 'studio' | 'beat' | 'notes' | 'chords' | 'genres' | 'form' | 'mixer' | 'pedals' | 'save';

export interface Cue { t: number; es: string; en: string }
export interface Lesson {
  id: LessonId;
  title: Record<Lang, string>;
  blurb: Record<Lang, string>;
  examples: Record<Lang, string[]>;
}

export const LESSONS: Lesson[] = [
  {
    id: 'studio',
    title: { es: 'Conoce el estudio', en: 'Meet the studio' },
    blurb: { es: 'Qué hay en la pantalla, cómo suena tu canción y cómo cambiar su velocidad.', en: 'What is on the screen, how your song plays and how to change its speed.' },
    examples: { es: ['Tocar y detener la canción', 'Cambiar el BPM de 90 a 120'], en: ['Play and stop the song', 'Change the BPM from 90 to 120'] },
  },
  {
    id: 'beat',
    title: { es: 'Tu primer beat', en: 'Your first beat' },
    blurb: { es: 'La grilla de la batería: bombo, caja y hi-hat, cuadrado por cuadrado.', en: 'The drum grid: kick, snare and hi-hat, square by square.' },
    examples: { es: ['Un beat de hip hop clásico', 'Mover el bombo para darle onda'], en: ['A classic hip hop beat', 'Move the kick to make it groove'] },
  },
  {
    id: 'notes',
    title: { es: 'Melodías y colores', en: 'Melodies and colors' },
    blurb: { es: 'El piano roll, las notas dulces, amargas y de casa, y las notas largas.', en: 'The piano roll, sweet, bitter and home notes, and long notes.' },
    examples: { es: ['Subir la escala: Do, Re, Mi, Fa, Sol', 'Terminar en la nota de casa con una nota larga'], en: ['Climb the scale: C, D, E, F, G', 'End on the home note with a long note'] },
  },
  {
    id: 'chords',
    title: { es: 'Acordes', en: 'Chords' },
    blurb: { es: 'Un acorde por compás y la progresión más famosa del mundo.', en: 'One chord per bar and the most famous progression in the world.' },
    examples: { es: ['Do, Sol, Lam, Fa', 'Ver cómo los acordes pintan las notas'], en: ['C, G, Am, F', 'See how chords paint the notes'] },
  },
  {
    id: 'genres',
    title: { es: 'Géneros y tu kit', en: 'Genres and your kit' },
    blurb: { es: 'Cambiar de género manteniendo tus notas, y armar tu propio kit con estrellas.', en: 'Switch genres keeping your notes, and build your own kit with stars.' },
    examples: { es: ['Pasar tu canción de hip hop a rock', 'Armar tu kit con estrellas'], en: ['Turn your hip hop song into rock', 'Build your kit with stars'] },
  },
  {
    id: 'form',
    title: { es: 'La forma de la canción', en: 'The shape of a song' },
    blurb: { es: 'Partir de una forma en Idea: intro, verso, coro; escuchar una parte y repetirla.', en: 'Start from a shape in Idea: intro, verse, chorus; hear one part and repeat it.' },
    examples: { es: ['Elegir Canción corta', 'Repetir el coro y aceptar la idea'], en: ['Pick Short song', 'Repeat the chorus and accept the idea'] },
  },
  {
    id: 'mixer',
    title: { es: 'La mesa del productor', en: "The producer's desk" },
    blurb: { es: 'Volumen, paneo, mute y solo: que todas las pistas se escuchen bien.', en: 'Volume, pan, mute and solo: so every track sounds right.' },
    examples: { es: ['Bajar el hi-hat', 'Escuchar solo el bajo'], en: ['Turn down the hi-hat', 'Listen to the bass alone'] },
  },
  {
    id: 'pedals',
    title: { es: 'Efectos', en: 'Effects' },
    blurb: { es: 'En la sala Estudio: eco, sala, lo-fi y muchos más, en la cadena de sonido.', en: 'In the Studio room: echo, room, lo-fi and many more, in the sound chain.' },
    examples: { es: ['Ponerle eco a la melodía', 'Sonido de cassette con Lo-fi'], en: ['Add echo to the melody', 'A cassette sound with Lo-fi'] },
  },
  {
    id: 'save',
    title: { es: 'Guardar y deshacer', en: 'Saving and undo' },
    blurb: { es: 'Tus canciones se guardan solas; deshacer, versiones y canciones nuevas.', en: 'Your songs save on their own; undo, versions and new songs.' },
    examples: { es: ['Deshacer un error', 'Guardar una versión en Canciones'], en: ['Undo a mistake', 'Save a version in Songs'] },
  },
];

interface LessonCues { duration: number; cues: Cue[] }
const ALL = CUES as Partial<Record<LessonId, LessonCues>>;

export const cuesFor = (id: LessonId): Cue[] => ALL[id]?.cues ?? [];
export const durationOf = (id: LessonId): number => ALL[id]?.duration ?? 0;
export const hasVideo = (id: LessonId): boolean => cuesFor(id).length > 0;
export const lessonById = (id: string | undefined): Lesson | undefined => LESSONS.find((l) => l.id === id);

/** The caption showing at a moment of the video: the last one that has started. */
export function cueAt(cues: Cue[], time: number): number {
  let at = -1;
  for (let i = 0; i < cues.length; i++) if (cues[i].t <= time + 0.05) at = i;
  return at;
}

/** Who the lessons speak to. A text may hold both forms, as {a|o}: the first for an alumna, the second for an alumno. */
export type Student = 'f' | 'm';
export const STUDENTS: Student[] = ['f', 'm'];
export const addressed = (text: string, who: Student): string => text.replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, f: string, m: string) => (who === 'f' ? f : m));

export const clock = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
