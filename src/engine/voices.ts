// The v1 sound set: every instrument is synthesized in the browser with Tone.js.
// Each voice exposes the same small surface: play a pitch, or hit a drum row.

import * as Tone from 'tone';

export interface MelodicVoice {
  kind: 'melodic';
  output: Tone.ToneAudioNode;
  play(midi: number, durationSec: number, time: number, velocity: number, a4: number): void;
  dispose(): void;
}

export interface DrumVoice {
  kind: 'drums';
  output: Tone.ToneAudioNode;
  hit(voice: string, time: number, velocity: number): void;
  dispose(): void;
}

export type Voice = MelodicVoice | DrumVoice;

const hz = (midi: number, a4: number) => a4 * Math.pow(2, (midi - 69) / 12);

function polyVoice(synth: Tone.PolySynth, output: Tone.ToneAudioNode, extra: Tone.ToneAudioNode[] = []): MelodicVoice {
  return {
    kind: 'melodic',
    output,
    play(midi, dur, time, vel, a4) {
      synth.triggerAttackRelease(hz(midi, a4), dur, time, vel);
    },
    dispose() {
      synth.dispose();
      extra.forEach((n) => n.dispose());
    },
  };
}

function monoVoice(synth: Tone.MonoSynth | Tone.MembraneSynth, output: Tone.ToneAudioNode): MelodicVoice {
  return {
    kind: 'melodic',
    output,
    play(midi, dur, time, vel, a4) {
      synth.triggerAttackRelease(hz(midi, a4), dur, time, vel);
    },
    dispose() {
      synth.dispose();
    },
  };
}

/** Effects that live inside an instrument (an amp, a vibrato): chained in order after the synth. */
function chain(synth: Tone.PolySynth | Tone.MonoSynth | Tone.MembraneSynth, nodes: Tone.ToneAudioNode[]): Tone.ToneAudioNode {
  let prev: Tone.ToneAudioNode = synth;
  for (const n of nodes) { prev.connect(n); prev = n; }
  return prev;
}

function poly(synth: Tone.PolySynth, nodes: Tone.ToneAudioNode[] = []): MelodicVoice {
  return polyVoice(synth, chain(synth, nodes), nodes);
}

function mono(synth: Tone.MonoSynth | Tone.MembraneSynth, nodes: Tone.ToneAudioNode[] = []): MelodicVoice {
  const out = chain(synth, nodes);
  const v = monoVoice(synth, out);
  return { ...v, dispose() { synth.dispose(); nodes.forEach((n) => n.dispose()); } };
}

const lowpass = (hz: number) => new Tone.Filter(hz, 'lowpass');
const vibrato = (rate: number, depth: number) => new Tone.Vibrato(rate, depth);

/** Every melodic instrument, by the voice id in its catalog manifest. */
const MELODIC: Record<string, () => MelodicVoice> = {
  bass808: () => mono(new Tone.MembraneSynth({
    pitchDecay: 0.03, octaves: 1.5, oscillator: { type: 'sine' },
    envelope: { attack: 0.002, decay: 0.9, sustain: 0.5, release: 0.12 }, volume: -4,
  })),
  bassSynth: () => mono(new Tone.MonoSynth({
    oscillator: { type: 'square' }, filter: { Q: 1, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.1 },
    filterEnvelope: { attack: 0.005, decay: 0.15, sustain: 0.3, release: 0.1, baseFrequency: 120, octaves: 3 }, volume: -10,
  })),
  bassElectric: () => mono(new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' }, filter: { Q: 0.5, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.004, decay: 0.35, sustain: 0.35, release: 0.12 },
    filterEnvelope: { attack: 0.002, decay: 0.12, sustain: 0.25, release: 0.1, baseFrequency: 180, octaves: 2.2 }, volume: -10,
  })),
  bassUpright: () => mono(new Tone.MonoSynth({
    oscillator: { type: 'triangle' }, filter: { Q: 0.3, type: 'lowpass', rolloff: -12 },
    envelope: { attack: 0.008, decay: 0.5, sustain: 0.05, release: 0.15 },
    filterEnvelope: { attack: 0.004, decay: 0.2, sustain: 0.2, release: 0.1, baseFrequency: 300, octaves: 1.5 }, volume: -4,
  })),
  cello: () => mono(new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' }, filter: { Q: 1, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.09, decay: 0.2, sustain: 0.8, release: 0.4 },
    filterEnvelope: { attack: 0.08, decay: 0.3, sustain: 0.6, release: 0.4, baseFrequency: 350, octaves: 2 }, volume: -14,
  }), [vibrato(5, 0.08)]),

  keysEp: () => poly(new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3, modulationIndex: 8, oscillator: { type: 'sine' },
    envelope: { attack: 0.004, decay: 1.1, sustain: 0.25, release: 1.0 },
    modulation: { type: 'sine' }, modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.4 }, volume: -12,
  })),
  keysPiano: () => poly(new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 2, modulationIndex: 3.5, oscillator: { type: 'sine' },
    envelope: { attack: 0.002, decay: 1.4, sustain: 0.08, release: 0.8 },
    modulation: { type: 'triangle' }, modulationEnvelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.3 }, volume: -11,
  })),
  organ: () => poly(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'custom', partials: [1, 0.5, 0.33, 0.25, 0, 0.15] },
    envelope: { attack: 0.008, decay: 0.05, sustain: 0.9, release: 0.08 }, volume: -18,
  })),
  pluck: () => poly(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle8' }, envelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.2 }, volume: -12,
  }), [lowpass(3000)]),
  vibes: () => poly(new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 4, modulationIndex: 1.6, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
    envelope: { attack: 0.001, decay: 2.2, sustain: 0, release: 1.5 },
    modulationEnvelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.3 }, volume: -12,
  })),
  bellsFm: () => poly(new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.01, modulationIndex: 12, envelope: { attack: 0.001, decay: 1.6, sustain: 0, release: 1.2 },
    modulationEnvelope: { attack: 0.001, decay: 0.8, sustain: 0, release: 0.5 }, volume: -18,
  })),

  padWarm: () => poly(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 3, spread: 28 },
    envelope: { attack: 0.35, decay: 0.3, sustain: 0.7, release: 1.4 }, volume: -20,
  }), [lowpass(1400)]),
  padSupersaw: () => poly(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 7, spread: 40 },
    envelope: { attack: 0.5, decay: 0.4, sustain: 0.75, release: 1.8 }, volume: -24,
  }), [lowpass(2200)]),
  strings: () => poly(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 5, spread: 16 },
    envelope: { attack: 0.22, decay: 0.2, sustain: 0.85, release: 1.1 }, volume: -22,
  }), [lowpass(2400)]),
  brassSection: () => poly(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 3, spread: 12 },
    envelope: { attack: 0.05, decay: 0.2, sustain: 0.7, release: 0.25 }, volume: -20,
  }), [lowpass(2200)]),

  leadBright: () => mono(new Tone.MonoSynth({
    oscillator: { type: 'square' }, filter: { Q: 2, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.25 },
    filterEnvelope: { attack: 0.01, decay: 0.25, sustain: 0.4, release: 0.3, baseFrequency: 500, octaves: 3 }, volume: -14,
  })),
  leadSaw: () => mono(new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' }, filter: { Q: 4, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.2 },
    filterEnvelope: { attack: 0.005, decay: 0.3, sustain: 0.5, release: 0.3, baseFrequency: 700, octaves: 3.5 }, volume: -16,
  })),
  violin: () => mono(new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' }, filter: { Q: 1, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.06, decay: 0.2, sustain: 0.85, release: 0.3 },
    filterEnvelope: { attack: 0.06, decay: 0.3, sustain: 0.7, release: 0.3, baseFrequency: 900, octaves: 2.5 }, volume: -16,
  }), [vibrato(5.5, 0.12)]),
  flute: () => mono(new Tone.MonoSynth({
    oscillator: { type: 'sine' }, filter: { Q: 0.5, type: 'lowpass', rolloff: -12 },
    envelope: { attack: 0.07, decay: 0.1, sustain: 0.8, release: 0.2 },
    filterEnvelope: { attack: 0.05, decay: 0.2, sustain: 0.9, release: 0.2, baseFrequency: 2000, octaves: 1 }, volume: -8,
  }), [vibrato(5, 0.06)]),
  sax: () => mono(new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' }, filter: { Q: 2, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.04, decay: 0.2, sustain: 0.75, release: 0.15 },
    filterEnvelope: { attack: 0.04, decay: 0.25, sustain: 0.5, release: 0.2, baseFrequency: 500, octaves: 2.5 }, volume: -16,
  }), [vibrato(5, 0.05)]),
  trumpet: () => mono(new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' }, filter: { Q: 1.5, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.03, decay: 0.15, sustain: 0.7, release: 0.15 },
    filterEnvelope: { attack: 0.03, decay: 0.2, sustain: 0.6, release: 0.2, baseFrequency: 600, octaves: 3 }, volume: -16,
  })),
  trumpetMute: () => mono(new Tone.MonoSynth({
    oscillator: { type: 'square' }, filter: { Q: 6, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.03, decay: 0.15, sustain: 0.65, release: 0.15 },
    filterEnvelope: { attack: 0.03, decay: 0.2, sustain: 0.5, release: 0.2, baseFrequency: 900, octaves: 1.5 }, volume: -18,
  })),

  guitarClean: () => poly(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.6, sustain: 0.15, release: 0.5 }, volume: -12,
  }), [lowpass(3500)]),
  guitarDist: () => poly(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' }, envelope: { attack: 0.003, decay: 0.4, sustain: 0.6, release: 0.3 }, volume: -24,
  }), [new Tone.Distortion(0.85), lowpass(2600)]),
  guitarLead: () => mono(new Tone.MonoSynth({
    oscillator: { type: 'square' }, filter: { Q: 1, type: 'lowpass', rolloff: -12 },
    envelope: { attack: 0.003, decay: 0.3, sustain: 0.7, release: 0.25 },
    filterEnvelope: { attack: 0.003, decay: 0.2, sustain: 0.6, release: 0.2, baseFrequency: 900, octaves: 2 }, volume: -22,
  }), [new Tone.Distortion(0.7), lowpass(3200)]),
  guitarNylon: () => poly(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' }, envelope: { attack: 0.003, decay: 0.9, sustain: 0.05, release: 0.6 }, volume: -10,
  }), [lowpass(2200)]),
};

export const MELODIC_VOICES = Object.keys(MELODIC);

export function createMelodicVoice(voice: string): MelodicVoice {
  const make = MELODIC[voice];
  if (!make) throw new Error(`Unknown voice: ${voice}`);
  return make();
}
/** How a standard kit sounds: the same eight rows, tuned per genre. */
interface KitSound {
  kick: { note: string; pitchDecay: number; octaves: number; decay: number; volume: number };
  snare: { hp: number; decay: number; volume: number; noise: 'white' | 'pink'; body: string; bodyVolume: number };
  hat: { hp: number; closed: number; open: number; volume: number };
  rim: string;
  tom: { note: string; decay: number };
  crash: { hp: number; decay: number; volume: number };
  clap: { bp: number; volume: number };
}

const KIT_SOUNDS: Record<string, KitSound> = {
  boomBap: {
    kick: { note: 'C1', pitchDecay: 0.04, octaves: 5, decay: 0.35, volume: -2 },
    snare: { hp: 1400, decay: 0.18, volume: -8, noise: 'white', body: 'G2', bodyVolume: -12 },
    hat: { hp: 7000, closed: 0.05, open: 0.32, volume: -16 }, rim: 'E5', tom: { note: 'G2', decay: 0.4 },
    crash: { hp: 4500, decay: 1.4, volume: -20 }, clap: { bp: 1600, volume: -6 },
  },
  trap: {
    kick: { note: 'A0', pitchDecay: 0.08, octaves: 7, decay: 0.9, volume: -2 },
    snare: { hp: 2200, decay: 0.12, volume: -8, noise: 'white', body: 'A2', bodyVolume: -12 },
    hat: { hp: 7000, closed: 0.03, open: 0.32, volume: -16 }, rim: 'E5', tom: { note: 'E2', decay: 0.4 },
    crash: { hp: 4500, decay: 1.4, volume: -20 }, clap: { bp: 1600, volume: -6 },
  },
  pop: {
    kick: { note: 'C1', pitchDecay: 0.05, octaves: 6, decay: 0.4, volume: -2 },
    snare: { hp: 1800, decay: 0.16, volume: -7, noise: 'white', body: 'A2', bodyVolume: -11 },
    hat: { hp: 7500, closed: 0.04, open: 0.3, volume: -17 }, rim: 'F5', tom: { note: 'A2', decay: 0.35 },
    crash: { hp: 4500, decay: 1.6, volume: -20 }, clap: { bp: 1800, volume: -5 },
  },
  rock: {
    kick: { note: 'D1', pitchDecay: 0.03, octaves: 4, decay: 0.3, volume: 0 },
    snare: { hp: 1000, decay: 0.25, volume: -6, noise: 'white', body: 'E2', bodyVolume: -9 },
    hat: { hp: 6500, closed: 0.06, open: 0.42, volume: -15 }, rim: 'D5', tom: { note: 'E2', decay: 0.5 },
    crash: { hp: 4000, decay: 1.8, volume: -17 }, clap: { bp: 1400, volume: -6 },
  },
  electro: {
    kick: { note: 'B0', pitchDecay: 0.06, octaves: 6, decay: 0.5, volume: -1 },
    snare: { hp: 2500, decay: 0.14, volume: -8, noise: 'white', body: 'D3', bodyVolume: -11 },
    hat: { hp: 9000, closed: 0.025, open: 0.25, volume: -15 }, rim: 'G5', tom: { note: 'C3', decay: 0.3 },
    crash: { hp: 5500, decay: 1.2, volume: -20 }, clap: { bp: 1200, volume: -4 },
  },
  jazz: {
    kick: { note: 'E1', pitchDecay: 0.02, octaves: 3, decay: 0.22, volume: -8 },
    snare: { hp: 600, decay: 0.35, volume: -14, noise: 'pink', body: 'C3', bodyVolume: -20 },
    hat: { hp: 8000, closed: 0.07, open: 0.5, volume: -20 }, rim: 'C5', tom: { note: 'F2', decay: 0.45 },
    crash: { hp: 6000, decay: 2.4, volume: -24 }, clap: { bp: 1500, volume: -10 },
  },
  latin: {
    kick: { note: 'D1', pitchDecay: 0.03, octaves: 4, decay: 0.3, volume: -2 },
    snare: { hp: 1600, decay: 0.14, volume: -8, noise: 'white', body: 'B2', bodyVolume: -10 },
    hat: { hp: 7000, closed: 0.04, open: 0.3, volume: -17 }, rim: 'A5', tom: { note: 'C3', decay: 0.35 },
    crash: { hp: 4500, decay: 1.5, volume: -20 }, clap: { bp: 1700, volume: -6 },
  },
};

/** Monophonic synths refuse two starts at the same instant; nudge repeats by a hair. */
function nudger() {
  const last = new Map<string, number>();
  return (name: string, time: number, span = 0) => {
    const prev = last.get(name) ?? -1;
    const t = time <= prev ? prev + 0.001 : time;
    last.set(name, t + span);
    return t;
  };
}

function drumVoice(bus: Tone.Gain, nodes: Tone.ToneAudioNode[], hit: DrumVoice['hit']): DrumVoice {
  return { kind: 'drums', output: bus, hit, dispose() { nodes.forEach((n) => n.dispose()); bus.dispose(); } };
}

/** A standard kit: kick, snare, clap, closed and open hat, rim, tom, crash. */
function standardKit(k: KitSound): DrumVoice {
  const bus = new Tone.Gain(0.9);
  const kick = new Tone.MembraneSynth({
    pitchDecay: k.kick.pitchDecay, octaves: k.kick.octaves,
    envelope: { attack: 0.001, decay: k.kick.decay, sustain: 0, release: 0.1 }, volume: k.kick.volume,
  }).connect(bus);
  const snareFilter = new Tone.Filter(k.snare.hp, 'highpass').connect(bus);
  const snare = new Tone.NoiseSynth({ noise: { type: k.snare.noise }, envelope: { attack: 0.001, decay: k.snare.decay, sustain: 0 }, volume: k.snare.volume }).connect(snareFilter);
  const snareBody = new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 2, envelope: { attack: 0.001, decay: 0.12, sustain: 0 }, volume: k.snare.bodyVolume }).connect(bus);
  const clapFilter = new Tone.Filter(k.clap.bp, 'bandpass').connect(bus);
  const clap = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.08, sustain: 0 }, volume: k.clap.volume }).connect(clapFilter);
  const hatFilter = new Tone.Filter(k.hat.hp, 'highpass').connect(bus);
  const hatClosed = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: k.hat.closed, sustain: 0 }, volume: k.hat.volume }).connect(hatFilter);
  const hatOpen = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: k.hat.open, sustain: 0 }, volume: k.hat.volume - 2 }).connect(hatFilter);
  const rim = new Tone.MembraneSynth({ pitchDecay: 0.004, octaves: 1, envelope: { attack: 0.001, decay: 0.05, sustain: 0 }, volume: -10 }).connect(bus);
  const tom = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 3, envelope: { attack: 0.001, decay: k.tom.decay, sustain: 0 }, volume: -6 }).connect(bus);
  const crashFilter = new Tone.Filter(k.crash.hp, 'highpass').connect(bus);
  const crash = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: k.crash.decay, sustain: 0 }, volume: k.crash.volume }).connect(crashFilter);
  const at = nudger();
  return drumVoice(bus, [kick, snare, snareFilter, snareBody, clap, clapFilter, hatClosed, hatOpen, hatFilter, rim, tom, crash, crashFilter], (voice, time, vel) => {
    switch (voice) {
      case 'kick': kick.triggerAttackRelease(k.kick.note, '8n', at('kick', time), vel); break;
      case 'snare':
        snare.triggerAttackRelease('16n', at('snare', time), vel);
        snareBody.triggerAttackRelease(k.snare.body, '16n', at('snareBody', time), vel);
        break;
      case 'clap': {
        const t = at('clap', time, 0.024);
        clap.triggerAttackRelease(0.01, t, vel * 0.7);
        clap.triggerAttackRelease(0.01, t + 0.012, vel * 0.8);
        clap.triggerAttackRelease(0.08, t + 0.024, vel);
        break;
      }
      case 'hatClosed': hatClosed.triggerAttackRelease('32n', at('hatClosed', time), vel); break;
      case 'hatOpen': hatOpen.triggerAttackRelease('8n', at('hatOpen', time), vel); break;
      case 'rim': rim.triggerAttackRelease(k.rim, '32n', at('rim', time), vel); break;
      case 'tom': tom.triggerAttackRelease(k.tom.note, '8n', at('tom', time), vel); break;
      case 'crash': crash.triggerAttackRelease('2n', at('crash', time), vel); break;
      default: break;
    }
  });
}

/** Orchestral percussion: bass drum, concert snare, tambourine, triangle, suspended cymbal, woodblock, timpani, cymbals. */
function orchestralKit(): DrumVoice {
  const bus = new Tone.Gain(0.9);
  const bassDrum = new Tone.MembraneSynth({ pitchDecay: 0.1, octaves: 2, envelope: { attack: 0.004, decay: 1.1, sustain: 0, release: 0.4 }, volume: 0 }).connect(bus);
  const snareFilter = new Tone.Filter(2500, 'highpass').connect(bus);
  const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.22, sustain: 0 }, volume: -9 }).connect(snareFilter);
  const snareBody = new Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 1.5, envelope: { attack: 0.001, decay: 0.08, sustain: 0 }, volume: -14 }).connect(bus);
  const jingle = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.18, release: 0.05 }, harmonicity: 5.1, modulationIndex: 32, resonance: 5000, octaves: 1.5, volume: -26 }).connect(bus);
  jingle.frequency.value = 600;
  const shakeFilter = new Tone.Filter(6000, 'highpass').connect(bus);
  const shake = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 0.12, sustain: 0 }, volume: -18 }).connect(shakeFilter);
  const triangle = new Tone.FMSynth({ harmonicity: 2.76, modulationIndex: 2, envelope: { attack: 0.001, decay: 2.5, sustain: 0, release: 1 }, modulationEnvelope: { attack: 0.001, decay: 1.5, sustain: 0, release: 1 }, volume: -20 }).connect(bus);
  const susFilter = new Tone.Filter(5000, 'highpass').connect(bus);
  const suspended = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.15, decay: 2.5, sustain: 0 }, volume: -22 }).connect(susFilter);
  const woodblock = new Tone.MembraneSynth({ pitchDecay: 0.002, octaves: 1, envelope: { attack: 0.001, decay: 0.06, sustain: 0 }, volume: -8 }).connect(bus);
  const timpani = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 1.2, envelope: { attack: 0.003, decay: 1.6, sustain: 0, release: 0.6 }, volume: -2 }).connect(bus);
  const cymFilter = new Tone.Filter(3500, 'highpass').connect(bus);
  const cymbals = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 2.2, sustain: 0 }, volume: -16 }).connect(cymFilter);
  const at = nudger();
  return drumVoice(bus, [bassDrum, snare, snareFilter, snareBody, jingle, shake, shakeFilter, triangle, suspended, susFilter, woodblock, timpani, cymbals, cymFilter], (voice, time, vel) => {
    switch (voice) {
      case 'bassDrum': bassDrum.triggerAttackRelease('C1', '4n', at('bassDrum', time), vel); break;
      case 'snareOrch':
        snare.triggerAttackRelease('16n', at('snare', time), vel);
        snareBody.triggerAttackRelease('D3', '32n', at('snareBody', time), vel);
        break;
      case 'tambourine':
        jingle.triggerAttackRelease('16n', at('jingle', time), vel);
        shake.triggerAttackRelease('16n', at('shake', time), vel);
        break;
      case 'triangle': triangle.triggerAttackRelease('A6', '2n', at('triangle', time), vel); break;
      case 'suspendedCymbal': suspended.triggerAttackRelease('1n', at('suspended', time), vel); break;
      case 'woodblock': woodblock.triggerAttackRelease('A5', '32n', at('woodblock', time), vel); break;
      case 'timpani': timpani.triggerAttackRelease('F2', '2n', at('timpani', time), vel); break;
      case 'cymbals': cymbals.triggerAttackRelease('1n', at('cymbals', time), vel); break;
      default: break;
    }
  });
}

/** Latin hand percussion: tumba, conga, bongo, güiro, maracas, clave, timbale, cowbell. */
function latinPercussion(): DrumVoice {
  const bus = new Tone.Gain(0.9);
  const drum = (decay: number, volume: number) =>
    new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 1.5, envelope: { attack: 0.001, decay, sustain: 0 }, volume }).connect(bus);
  const congaLow = drum(0.35, -4);
  const congaHigh = drum(0.28, -5);
  const bongo = drum(0.15, -6);
  const guiroFilter = new Tone.Filter({ frequency: 3000, type: 'bandpass', Q: 3 }).connect(bus);
  const guiro = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.012, sustain: 0 }, volume: -4 }).connect(guiroFilter);
  const maracaFilter = new Tone.Filter(6000, 'highpass').connect(bus);
  const maracas = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.003, decay: 0.05, sustain: 0 }, volume: -14 }).connect(maracaFilter);
  const clave = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 }, volume: -8 }).connect(bus);
  const timbale = new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 1, envelope: { attack: 0.001, decay: 0.3, sustain: 0 }, volume: -8 }).connect(bus);
  const shellFilter = new Tone.Filter(3000, 'highpass').connect(bus);
  const shell = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.1, sustain: 0 }, volume: -18 }).connect(shellFilter);
  const bellFilter = new Tone.Filter({ frequency: 900, type: 'bandpass', Q: 1.5 }).connect(bus);
  const bellA = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.05 }, volume: -12 }).connect(bellFilter);
  const bellB = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.05 }, volume: -12 }).connect(bellFilter);
  const at = nudger();
  return drumVoice(bus, [congaLow, congaHigh, bongo, guiro, guiroFilter, maracas, maracaFilter, clave, timbale, shell, shellFilter, bellA, bellB, bellFilter], (voice, time, vel) => {
    switch (voice) {
      case 'congaLow': congaLow.triggerAttackRelease('F3', '8n', at('congaLow', time), vel); break;
      case 'congaHigh': congaHigh.triggerAttackRelease('C4', '8n', at('congaHigh', time), vel); break;
      case 'bongo': bongo.triggerAttackRelease('G4', '16n', at('bongo', time), vel); break;
      case 'guiro': {
        // A scrape: a quick run of tiny noise bursts.
        const t = at('guiro', time, 0.14);
        for (let i = 0; i < 8; i++) guiro.triggerAttackRelease(0.008, t + i * 0.018, vel * (0.6 + i * 0.05));
        break;
      }
      case 'maracas': maracas.triggerAttackRelease('32n', at('maracas', time), vel); break;
      case 'clave': clave.triggerAttackRelease(2500, '32n', at('clave', time), vel); break;
      case 'timbale':
        timbale.triggerAttackRelease('A4', '16n', at('timbale', time), vel);
        shell.triggerAttackRelease('16n', at('shell', time), vel);
        break;
      case 'cowbell': {
        const t = at('cowbell', time);
        bellA.triggerAttackRelease(540, '16n', t, vel);
        bellB.triggerAttackRelease(800, '16n', t, vel);
        break;
      }
      default: break;
    }
  });
}

export const DRUM_KITS = [...Object.keys(KIT_SOUNDS), 'orch', 'latinPerc'];

/** A synthesized drum kit, by the kit id in its catalog manifest. */
export function createDrumKit(kit: string): DrumVoice {
  if (kit === 'orch') return orchestralKit();
  if (kit === 'latinPerc') return latinPercussion();
  return standardKit(KIT_SOUNDS[kit] ?? KIT_SOUNDS.boomBap);
}
