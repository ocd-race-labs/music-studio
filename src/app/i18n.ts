// Every word on screen comes from here, in English and Spanish. {name} marks a value filled in at runtime.

import type { Lang, Level, ThemePreset } from '../domain/types';
import type { Naming, Tier } from '../theory';

const STRINGS = {
  /* app shell */
  loading: { en: 'Loading…', es: 'Cargando…' },
  storageBlockedTitle: { en: 'This browser blocked storage', es: 'Este navegador bloqueó el almacenamiento' },
  storageBlockedBody: { en: 'Music Studio saves songs in the browser. Private browsing can block that; open it in a normal window.', es: 'Music Studio guarda las canciones en el navegador. La navegación privada puede bloquearlo; ábrelo en una ventana normal.' },
  home: { en: 'Home', es: 'Inicio' },
  interfaceLanguage: { en: 'Interface language', es: 'Idioma de la app' },
  switchToDark: { en: 'Switch to dark', es: 'Cambiar a oscuro' },
  switchToLight: { en: 'Switch to light', es: 'Cambiar a claro' },
  updateReady: { en: 'A new version of Music Studio is ready.', es: 'Hay una versión nueva de Music Studio.' },
  updateNow: { en: 'Update', es: 'Actualizar' },
  switchLanguage: { en: 'Cambiar a español', es: 'Switch to English' },

  /* home */
  whoPlaying: { en: "Who's making music today?", es: '¿Quién hace música hoy?' },
  pickProfile: { en: 'Pick your profile. Your songs, styles and levels come with you.', es: 'Elige tu perfil. Tus canciones, estilos y niveles van contigo.' },
  openStudio: { en: 'Open studio', es: 'Abrir estudio' },
  guest: { en: 'Guest', es: 'Invitado' },
  tryStudio: { en: 'Try the studio', es: 'Prueba el estudio' },
  notSaved: { en: 'Not saved to a profile', es: 'No se guarda en un perfil' },
  startGuest: { en: 'Start as guest', es: 'Entrar como invitado' },
  settings: { en: 'Profile settings', es: 'Ajustes de perfil' },
  lab: { en: 'Lab: device tests', es: 'Lab: pruebas del equipo' },
  addPerson: { en: 'Add a person', es: 'Agregar a alguien' },

  iPlay: { en: 'Plays', es: 'Toca' },
  instrumentsIPlay: { en: 'Instruments I play', es: 'Instrumentos que toco' },
  startOver: { en: 'Start over on this device', es: 'Empezar de nuevo en este dispositivo' },
  startOverHint: { en: 'Removes every profile and song saved in this browser and goes back to the first screen. Back up first if you want to keep them.', es: 'Borra todos los perfiles y canciones guardados en este navegador y vuelve a la primera pantalla. Respalda antes si quieres conservarlos.' },
  startOverAsk: { en: 'This removes {n} profiles and all their songs from this browser. It cannot be undone.', es: 'Esto borra {n} perfiles y todas sus canciones de este navegador. No se puede deshacer.' },
  startOverYes: { en: 'Yes, remove everything', es: 'Sí, borrar todo' },
  cancel: { en: 'Cancel', es: 'Cancelar' },

  /* first run */
  setupTitle: { en: 'Set up your family studio', es: 'Arma tu estudio familiar' },
  setupBody: { en: "Add the people who'll make music here. Names and songs stay in this browser; nothing is sent anywhere.", es: 'Agrega a quienes harán música aquí. Los nombres y las canciones se quedan en este navegador; nada se envía a ningún lado.' },
  personN: { en: 'Person {n}', es: 'Persona {n}' },
  optional: { en: '(optional)', es: '(opcional)' },
  name: { en: 'Name', es: 'Nombre' },
  theme: { en: 'Theme', es: 'Tema' },
  createProfiles: { en: 'Create profiles', es: 'Crear perfiles' },
  setupLater: { en: 'You can change names, themes and avatars later in profile settings.', es: 'Después puedes cambiar nombres, temas y avatares en los ajustes de perfil.' },

  /* studio */
  musician: { en: 'Musician', es: 'Músico' },
  producer: { en: 'Producer', es: 'Productor' },
  hat: { en: 'Hat', es: 'Rol' },
  tracks: { en: 'Tracks', es: 'Pistas' },
  pads: { en: 'Pads', es: 'Pads' },
  keyboard: { en: 'Keyboard', es: 'Teclado' },
  keyboardColored: { en: 'Keyboard colored by key', es: 'Teclado coloreado por tonalidad' },
  record: { en: 'Record taps', es: 'Grabar toques' },
  recordHint: { en: 'When on, pads and keys write into the loop while it plays', es: 'Encendido, los pads y las teclas se graban en el loop mientras suena' },
  play: { en: 'Play', es: 'Reproducir' },
  stop: { en: 'Stop', es: 'Detener' },
  undo: { en: 'Undo', es: 'Deshacer' },
  redo: { en: 'Redo', es: 'Rehacer' },
  songTitle: { en: 'Song title', es: 'Título de la canción' },
  noteLength: { en: 'Note length', es: 'Duración' },
  bars: { en: 'Bars', es: 'Compases' },
  bar: { en: 'Bar', es: 'Compás' },
  barChord: { en: 'Bar {n}: {chord}', es: 'Compás {n}: {chord}' },
  swing: { en: 'Swing', es: 'Swing' },
  key: { en: 'Key', es: 'Tonalidad' },
  tonic: { en: 'Tonic', es: 'Tónica' },
  scale: { en: 'Scale', es: 'Escala' },
  chordTone: { en: 'Chord tone', es: 'Nota del acorde' },
  inScale: { en: 'In the scale', es: 'En la escala' },
  outside: { en: 'Outside: tension', es: 'Fuera: tensión' },
  tierChord: { en: 'chord tone', es: 'nota del acorde' },
  tierScale: { en: 'in the scale', es: 'en la escala' },
  tierOutside: { en: 'outside the scale', es: 'fuera de la escala' },
  chordsOfKey: { en: 'Chords in this key', es: 'Acordes de esta tonalidad' },
  chords: { en: 'Chords', es: 'Acordes' },
  clear: { en: 'Clear', es: 'Quitar' },
  stepN: { en: '{row}, step {n}', es: '{row}, paso {n}' },
  stepOn: { en: ', on', es: ', activo' },
  octave: { en: 'Octave', es: 'Octava' },
  octaveUp: { en: 'Octave up', es: 'Subir una octava' },
  octaveDown: { en: 'Octave down', es: 'Bajar una octava' },
  nAbove: { en: '{n} above', es: '{n} arriba' },
  nBelow: { en: '{n} below', es: '{n} abajo' },
  zoom: { en: 'Zoom', es: 'Zoom' },
  zoomFit: { en: 'Whole loop', es: 'Todo' },
  zoomBar: { en: '1 bar', es: '1 compás' },
  zoomHalf: { en: '½ bar', es: '½ compás' },
  fullScreen: { en: 'Full screen', es: 'Pantalla completa' },
  onlyThis: { en: 'Only this track', es: 'Solo esta pista' },
  onlyThisHint: { en: 'Play only the track you are editing; the others stay quiet until you turn this off', es: 'Suena solo la pista que estás editando; las demás quedan en silencio hasta que lo apagues' },
  exitFullScreen: { en: 'Exit full screen', es: 'Salir de pantalla completa' },
  tapToStart: { en: 'Tap to start the sound', es: 'Toca para activar el sonido' },
  soundBlocked: { en: 'No sound yet. Turn the volume up, turn off silent mode, then tap again.', es: 'Aún no hay sonido. Sube el volumen, quita el modo silencio y toca de nuevo.' },
  soundOutput: { en: 'Sound output', es: 'Salida de sonido' },
  saved: { en: 'Saved', es: 'Guardado' },
  saving: { en: 'Saving', es: 'Guardando' },
  firstSong: { en: 'First song', es: 'Primera canción' },
  guestJam: { en: 'Guest jam', es: 'Jam de invitado' },
  songN: { en: 'Song {n}', es: 'Canción {n}' },

  /* producer */
  mixer: { en: 'Mix and pedals', es: 'Mezcla y pedales' },
  volume: { en: 'Volume', es: 'Volumen' },
  kit: { en: 'Kit', es: 'Kit' },
  muteTrack: { en: 'Mute {name}', es: 'Silenciar {name}' },
  soloTrack: { en: 'Solo {name}', es: 'Solo {name}' },
  pedalOn: { en: 'On', es: 'Activo' },
  pedalOff: { en: 'Off', es: 'Apagado' },
  reset: { en: 'Reset', es: 'Restablecer' },

  /* songs and versions */
  songs: { en: 'Songs', es: 'Canciones' },
  newSong: { en: 'New song', es: 'Nueva canción' },
  exportSong: { en: 'Export song', es: 'Exportar canción' },
  importSong: { en: 'Import song', es: 'Importar canción' },
  saveVersion: { en: 'Save version', es: 'Guardar versión' },
  versions: { en: 'Versions', es: 'Versiones' },
  versionN: { en: 'Version {n}', es: 'Versión {n}' },
  noVersions: { en: 'No saved versions yet.', es: 'Aún no hay versiones guardadas.' },
  restore: { en: 'Restore', es: 'Restaurar' },
  close: { en: 'Close', es: 'Cerrar' },
  imported: { en: 'Imported “{title}”', es: 'Importada “{title}”' },
  versionSaved: { en: 'Version {n} saved', es: 'Versión {n} guardada' },
  versionRestored: { en: 'Restored version {n}', es: 'Versión {n} restaurada' },

  /* ideas */
  ideas: { en: 'Ideas tray', es: 'Bandeja de ideas' },
  ideasHint: { en: 'Ideas from Claude arrive as a file. Import it here, listen, then keep or dismiss.', es: 'Las ideas de Claude llegan como archivo. Impórtalo aquí, escucha y luego úsala o descártala.' },
  importIdeas: { en: 'Import ideas', es: 'Importar ideas' },
  copyFormat: { en: 'Copy the format for Claude', es: 'Copiar el formato para Claude' },
  copiedFormat: { en: 'Copied. Paste it in your Claude project with your request.', es: 'Copiado. Pégalo en tu proyecto de Claude junto con lo que pides.' },
  into: { en: 'Into', es: 'En' },
  noTrackFits: { en: 'No track can take this idea.', es: 'Ninguna pista puede recibir esta idea.' },
  listen: { en: 'Listen', es: 'Escuchar' },
  keep: { en: 'Keep', es: 'Usar' },
  dismiss: { en: 'Dismiss', es: 'Descartar' },
  ideaRefused: { en: 'Idea file refused: {error}', es: 'Archivo de ideas rechazado: {error}' },
  ideasReadyOne: { en: '1 idea ready to try', es: '1 idea lista para probar' },
  ideasReadyMany: { en: '{n} ideas ready to try', es: '{n} ideas listas para probar' },
  keptIdea: { en: 'Kept “{title}”', es: 'Usaste “{title}”' },

  /* settings */
  avatar: { en: 'Avatar', es: 'Avatar' },
  displayName: { en: 'Display name', es: 'Nombre visible' },
  ringColor: { en: 'Ring color', es: 'Color del anillo' },
  ringN: { en: 'Ring {color}', es: 'Anillo {color}' },
  profile: { en: 'Profile', es: 'Perfil' },
  colorTheme: { en: 'Color theme', es: 'Tema de color' },
  themeReadable: { en: 'Each theme has a light and a dark version, chosen so text, buttons and note colors stay readable.', es: 'Cada tema tiene versión clara y oscura, elegidas para que el texto, los botones y los colores de las notas se lean bien.' },
  appearance: { en: 'Appearance', es: 'Apariencia' },
  appearanceAuto: { en: 'Automatic', es: 'Automático' },
  appearanceLight: { en: 'Light', es: 'Claro' },
  appearanceDark: { en: 'Dark', es: 'Oscuro' },
  appearanceHint: { en: 'Automatic follows this device. Saved on this device.', es: 'Automático sigue a este dispositivo. Se guarda en este dispositivo.' },
  stylePrefs: { en: 'Style preferences', es: 'Preferencias de estilo' },
  level: { en: 'Level', es: 'Nivel' },
  startIn: { en: 'Start in', es: 'Empezar como' },
  musicianHat: { en: 'Musician hat', es: 'Músico' },
  producerHat: { en: 'Producer hat', es: 'Productor' },
  lyricsLanguage: { en: 'Lyrics language', es: 'Idioma de las letras' },
  appLanguage: { en: 'App language', es: 'Idioma de la app' },
  appLanguageHint: { en: 'Saved on this device. In Spanish, notes are named Do, Re, Mi.', es: 'Se guarda en este dispositivo. En español las notas se llaman Do, Re, Mi.' },
  storageBackup: { en: 'Storage and backup', es: 'Almacenamiento y respaldo' },
  storageKept: { en: 'This browser will keep your songs.', es: 'Este navegador guardará tus canciones.' },
  storageMayClear: { en: 'This browser may clear saved songs. On the iPad, add the app to the Home Screen and back up from time to time.', es: 'Este navegador podría borrar las canciones. En el iPad, agrega la app a la pantalla de inicio y respalda de vez en cuando.' },
  storageUsing: { en: 'Using {used} of {quota} available.', es: 'Usando {used} de {quota} disponibles.' },
  backupAll: { en: 'Back up all songs', es: 'Respaldar todas las canciones' },
  restoreBackup: { en: 'Restore a backup', es: 'Restaurar un respaldo' },
  backedUpOne: { en: 'Backed up 1 song', es: '1 canción respaldada' },
  backedUpMany: { en: 'Backed up {n} songs', es: '{n} canciones respaldadas' },
  restoredOne: { en: 'Restored 1 song', es: '1 canción restaurada' },
  restoredMany: { en: 'Restored {n} songs', es: '{n} canciones restauradas' },
  notABackup: { en: 'Not a Music Studio backup', es: 'No es un respaldo de Music Studio' },

  /* lab */
  labTitle: { en: 'Lab: device tests', es: 'Lab: pruebas del equipo' },
  labIntro: { en: 'Phase 0 tests. Run them on the laptop (Chrome) and the iPad (Safari).', es: 'Pruebas de la Fase 0. Córrelas en el laptop (Chrome) y en el iPad (Safari).' },
  labAudio: { en: '1. Device and audio timing', es: '1. Equipo y tiempos de audio' },
  startAudio: { en: 'Start audio', es: 'Activar audio' },
  audio: { en: 'Audio', es: 'Audio' },
  audioSession: { en: 'Audio session', es: 'Sesión de audio' },
  sampleRate: { en: 'Sample rate', es: 'Frecuencia de muestreo' },
  baseLatency: { en: 'Base latency', es: 'Latencia base' },
  outputLatency: { en: 'Output latency', es: 'Latencia de salida' },
  lookAhead: { en: 'Scheduling look-ahead', es: 'Anticipación de agenda' },
  notReported: { en: 'not reported', es: 'no informada' },
  playTestTone: { en: 'Play test tone', es: 'Tocar tono de prueba' },
  testTonePlaying: { en: 'Playing A4 for one second…', es: 'Tocando La4 por un segundo…' },
  testToneOk: { en: 'The app made sound (level {n}%). If you heard nothing, check the device volume, silent mode and output.', es: 'La app produjo sonido (nivel {n}%). Si no oíste nada, revisa el volumen, el modo silencio y la salida del equipo.' },
  testToneSilent: { en: 'The app made no sound (audio {state}). Tap the button again; if it repeats, tell Claude this line.', es: 'La app no produjo sonido (audio {state}). Toca el botón otra vez; si se repite, cuéntale esta línea a Claude.' },
  storageLabel: { en: 'Storage:', es: 'Almacenamiento:' },
  storageKeptShort: { en: 'kept by the browser', es: 'el navegador lo guarda' },
  storageMayClearShort: { en: 'may be cleared; add to Home Screen on the iPad', es: 'podría borrarse; agrégala a la pantalla de inicio en el iPad' },
  labTap: { en: '2. Tap along (latency feel)', es: '2. Toca al ritmo (sensación de latencia)' },
  labTapHint: { en: 'Press start, then tap the big pad on every click, twelve times. Positive means you hear the click late or tap late.', es: 'Toca empezar y luego golpea el pad grande con cada clic, doce veces. Positivo significa que oyes el clic tarde o que golpeas tarde.' },
  start: { en: 'Start', es: 'Empezar' },
  tapNow: { en: 'Tap!', es: '¡Toca!' },
  pad: { en: 'Pad', es: 'Pad' },
  tapResult: { en: 'Average offset {mean} ms, spread {spread} ms over {n} taps.', es: 'Desfase promedio {mean} ms, dispersión {spread} ms en {n} toques.' },
  feelsTight: { en: 'Feels tight.', es: 'Se siente justo.' },
  noticeable: { en: 'Noticeable; try headphones or the laptop.', es: 'Se nota; prueba con audífonos o en el laptop.' },
  labMidi: { en: '3. MIDI keyboard or e-drums', es: '3. Teclado MIDI o batería electrónica' },
  connectMidi: { en: 'Connect MIDI', es: 'Conectar MIDI' },
  midiInputs: { en: 'Inputs: {list}', es: 'Entradas: {list}' },
  midiPlugIn: { en: 'Plug in the device, then connect.', es: 'Conecta el equipo y luego toca conectar.' },
  midiNote: { en: 'Note {note} velocity {vel} from {device}', es: 'Nota {note}, velocidad {vel}, desde {device}' },
  midiNone: { en: 'This browser has no MIDI support (expected on the iPad). Use the laptop in Chrome.', es: 'Este navegador no tiene MIDI (es lo esperado en el iPad). Usa el laptop con Chrome.' },
  labRecord: { en: '4. Record (one format for Chrome and Safari)', es: '4. Grabar (un formato para Chrome y Safari)' },
  monitorHint: { en: 'Hear yourself while recording (use headphones)', es: 'Escucharte mientras grabas (usa audífonos)' },
  recordMic: { en: 'Record', es: 'Grabar' },
  inputLevel: { en: 'Input level', es: 'Nivel de entrada' },
  micUnavailable: { en: 'Microphone not available: {error}', es: 'Micrófono no disponible: {error}' },
  keepTake: { en: 'Keep take', es: 'Guardar toma' },
  takeSaved: { en: 'Take saved in this browser', es: 'Toma guardada en este navegador' },
  download: { en: 'Download', es: 'Descargar' },
  peak: { en: 'peak', es: 'pico' },
  labVoice: { en: '5. Guide voice (free, in the browser)', es: '5. Voz guía (gratis, en el navegador)' },
  noVoices: { en: 'This browser has no speech voices.', es: 'Este navegador no tiene voces.' },
  voice: { en: 'Voice', es: 'Voz' },
  voicesCount: { en: '{n} {language} voices on this device', es: '{n} voces en {language} en este equipo' },
  langSpanish: { en: 'Spanish', es: 'español' },
  langEnglish: { en: 'English', es: 'inglés' },
  lyricLine: { en: 'Lyric line', es: 'Línea de la letra' },
  speed: { en: 'Speed {n}', es: 'Velocidad {n}' },
  speak: { en: 'Speak', es: 'Decir' },
  rapOnBeat: { en: 'Rap on the beat (90 BPM)', es: 'Rapear al ritmo (90 BPM)' },
  voiceNote: { en: "Test result to note: timing on the beat, and that this voice plays beside the music but can't be recorded or mixed yet.", es: 'Qué anotar: si cae a tiempo y que esta voz suena junto a la música, pero todavía no se puede grabar ni mezclar.' },
  labIdeas: { en: '6. Idea files from Claude', es: '6. Archivos de ideas de Claude' },
  labIdeasHint: { en: "Paste this format into your Claude project with a request, save Claude's answer as a .json file, then check it here or import it in the studio's ideas tray.", es: 'Pega este formato en tu proyecto de Claude con lo que pides, guarda la respuesta de Claude como archivo .json y revísala aquí o impórtala en la bandeja de ideas del estudio.' },
  copyFormatShort: { en: 'Copy the format', es: 'Copiar el formato' },
  formatCopied: { en: 'Format copied for Claude', es: 'Formato copiado para Claude' },
  copyFailed: { en: 'Copy failed; select the text instead', es: 'No se pudo copiar; selecciona el texto' },
  checkFile: { en: 'Check a file', es: 'Revisar un archivo' },
  fileOk: { en: 'OK: {kind} “{title}”', es: 'OK: {kind} “{title}”' },
  fileProblem: { en: 'Problem: {error}', es: 'Problema: {error}' },
} as const;

export type StringKey = keyof typeof STRINGS;

/** Text for the screen. Values in {braces} are filled from vars. */
export const t = (key: StringKey, lang: Lang, vars?: Record<string, string | number>): string => {
  const text: string = STRINGS[key][lang];
  return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
};

/** One or many: picks the singular or plural key. */
export const tn = (one: StringKey, many: StringKey, n: number, lang: Lang): string =>
  n === 1 ? t(one, lang) : t(many, lang, { n });

/** English names notes with letters; Spanish with fixed-do solfège. */
export const namingFor = (lang: Lang): Naming => (lang === 'es' ? 'solfege' : 'letters');

export const tierWord = (tier: Tier, lang: Lang): string =>
  t(tier === 'chord' ? 'tierChord' : tier === 'scale' ? 'tierScale' : 'tierOutside', lang);

const THEME_NAMES: Record<ThemePreset, { en: string; es: string }> = {
  graphite: { en: 'Graphite', es: 'Grafito' },
  'midnight-jewel': { en: 'Midnight jewel', es: 'Joya de medianoche' },
  daylight: { en: 'Daylight', es: 'Luz de día' },
};
export const themeName = (p: ThemePreset, lang: Lang): string => THEME_NAMES[p][lang];

const LEVELS: Record<Level, { en: string; es: string }> = {
  starter: { en: 'Starter', es: 'Inicial' },
  intermediate: { en: 'Intermediate', es: 'Intermedio' },
  advanced: { en: 'Advanced', es: 'Avanzado' },
};
export const levelName = (l: Level, lang: Lang): string => LEVELS[l][lang];

/** Styles are stored by their English name; this is how each one reads on screen. */
const STYLES: Record<string, string> = {
  Classical: 'Clásica', Pop: 'Pop', 'Film score': 'Música de cine', Folk: 'Folk', Jazz: 'Jazz', Rock: 'Rock',
  Cumbia: 'Cumbia', Reggaeton: 'Reguetón', 'Hip hop': 'Hip hop', 'Lo-fi': 'Lo-fi', Orchestral: 'Orquestal',
  Electronic: 'Electrónica', 'R&B': 'R&B', Acoustic: 'Acústica',
};
export const styleName = (s: string, lang: Lang): string => (lang === 'es' ? STYLES[s] ?? s : s);

/** What a person plays, shown on the home card. Stored by id. */
export const INSTRUMENT_IDS = ['violin', 'drums', 'guitar', 'piano', 'bass', 'voice', 'beats', 'lyrics'] as const;
const INSTRUMENT_NAMES: Record<string, { en: string; es: string }> = {
  violin: { en: 'Violin', es: 'Violín' }, drums: { en: 'Drums', es: 'Batería' }, guitar: { en: 'Guitar', es: 'Guitarra' },
  piano: { en: 'Piano', es: 'Piano' }, bass: { en: 'Bass', es: 'Bajo' }, voice: { en: 'Voice', es: 'Voz' },
  beats: { en: 'Beats', es: 'Beats' }, lyrics: { en: 'Lyrics', es: 'Letras' },
};
export const instrumentName = (id: string, lang: Lang): string => INSTRUMENT_NAMES[id]?.[lang] ?? id;
/** "Violin, beats, lyrics": first word capitalized, the rest in lower case, as in the mockup. */
export const instrumentsLine = (ids: string[], lang: Lang): string =>
  ids.map((id, i) => (i === 0 ? instrumentName(id, lang) : instrumentName(id, lang).toLowerCase())).join(', ');
