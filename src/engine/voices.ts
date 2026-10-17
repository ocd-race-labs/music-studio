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

export function createMelodicVoice(voice: string): MelodicVoice {
  switch (voice) {
    case 'bass808': {
      const s = new Tone.MembraneSynth({
        pitchDecay: 0.03,
        octaves: 1.5,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.002, decay: 0.9, sustain: 0.5, release: 0.5 },
        volume: -4,
      });
      return monoVoice(s, s);
    }
    case 'keysEp': {
      const s = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3,
        modulationIndex: 8,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.004, decay: 1.1, sustain: 0.25, release: 1.0 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.4 },
        volume: -12,
      });
      return polyVoice(s, s);
    }
    case 'padWarm': {
      const filter = new Tone.Filter(1400, 'lowpass');
      const s = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 28 },
        envelope: { attack: 0.35, decay: 0.3, sustain: 0.7, release: 1.4 },
        volume: -20,
      }).connect(filter);
      return polyVoice(s, filter, [filter]);
    }
    case 'leadBright': {
      const s = new Tone.MonoSynth({
        oscillator: { type: 'square' },
        filter: { Q: 2, type: 'lowpass', rolloff: -24 },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.25 },
        filterEnvelope: { attack: 0.01, decay: 0.25, sustain: 0.4, release: 0.3, baseFrequency: 500, octaves: 3 },
        volume: -14,
      });
      return monoVoice(s, s);
    }
    case 'strings': {
      const filter = new Tone.Filter(2400, 'lowpass');
      const s = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsawtooth', count: 5, spread: 16 },
        envelope: { attack: 0.22, decay: 0.2, sustain: 0.85, release: 1.1 },
        volume: -22,
      }).connect(filter);
      return polyVoice(s, filter, [filter]);
    }
    default:
      throw new Error(`Unknown voice: ${voice}`);
  }
}

/** A synthesized drum kit. "boomBap" is warm and punchy; "trap" has a long boomy kick and crisp hats. */
export function createDrumKit(kit: string): DrumVoice {
  const trap = kit === 'trap';
  const bus = new Tone.Gain(0.9);

  const kick = new Tone.MembraneSynth({
    pitchDecay: trap ? 0.08 : 0.04,
    octaves: trap ? 7 : 5,
    envelope: { attack: 0.001, decay: trap ? 0.9 : 0.35, sustain: 0, release: 0.1 },
    volume: -2,
  }).connect(bus);

  const snareFilter = new Tone.Filter(trap ? 2200 : 1400, 'highpass').connect(bus);
  const snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: trap ? 0.12 : 0.18, sustain: 0 },
    volume: -8,
  }).connect(snareFilter);
  const snareBody = new Tone.MembraneSynth({
    pitchDecay: 0.01, octaves: 2, envelope: { attack: 0.001, decay: 0.12, sustain: 0 }, volume: -12,
  }).connect(bus);

  const clapFilter = new Tone.Filter(1600, 'bandpass').connect(bus);
  const clap = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.001, decay: 0.08, sustain: 0 }, volume: -6 }).connect(clapFilter);

  const hatFilter = new Tone.Filter(7000, 'highpass').connect(bus);
  const hatClosed = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: trap ? 0.03 : 0.05, sustain: 0 }, volume: -16 }).connect(hatFilter);
  const hatOpen = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.32, sustain: 0 }, volume: -18 }).connect(hatFilter);

  const rim = new Tone.MembraneSynth({
    pitchDecay: 0.004, octaves: 1, envelope: { attack: 0.001, decay: 0.05, sustain: 0 }, volume: -10,
  }).connect(bus);
  const tom = new Tone.MembraneSynth({
    pitchDecay: 0.05, octaves: 3, envelope: { attack: 0.001, decay: 0.4, sustain: 0 }, volume: -6,
  }).connect(bus);

  const crashFilter = new Tone.Filter(4500, 'highpass').connect(bus);
  const crash = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.002, decay: 1.4, sustain: 0 }, volume: -20 }).connect(crashFilter);

  const nodes: Tone.ToneAudioNode[] = [kick, snare, snareFilter, snareBody, clap, clapFilter, hatClosed, hatOpen, hatFilter, rim, tom, crash, crashFilter, bus];

  // Monophonic synths refuse two starts at the same instant; nudge repeats by a hair.
  const last = new Map<string, number>();
  const at = (name: string, time: number) => {
    const prev = last.get(name) ?? -1;
    const t = time <= prev ? prev + 0.001 : time;
    last.set(name, t);
    return t;
  };

  return {
    kind: 'drums',
    output: bus,
    hit(voice, time, vel) {
      switch (voice) {
        case 'kick': kick.triggerAttackRelease(trap ? 'A0' : 'C1', '8n', at('kick', time), vel); break;
        case 'snare':
          snare.triggerAttackRelease('16n', at('snare', time), vel);
          snareBody.triggerAttackRelease(trap ? 'A2' : 'G2', '16n', at('snareBody', time), vel);
          break;
        case 'clap': {
          const t = at('clap', time);
          clap.triggerAttackRelease(0.01, t, vel * 0.7);
          clap.triggerAttackRelease(0.01, t + 0.012, vel * 0.8);
          clap.triggerAttackRelease(0.08, t + 0.024, vel);
          last.set('clap', t + 0.024);
          break;
        }
        case 'hatClosed': hatClosed.triggerAttackRelease('32n', at('hatClosed', time), vel); break;
        case 'hatOpen': hatOpen.triggerAttackRelease('8n', at('hatOpen', time), vel); break;
        case 'rim': rim.triggerAttackRelease('E5', '32n', at('rim', time), vel); break;
        case 'tom': tom.triggerAttackRelease(trap ? 'E2' : 'G2', '8n', at('tom', time), vel); break;
        case 'crash': crash.triggerAttackRelease('2n', at('crash', time), vel); break;
        default: break;
      }
    },
    dispose() {
      nodes.forEach((n) => n.dispose());
    },
  };
}
