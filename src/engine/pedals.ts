// Pedals: one small sound processor per effect in a track's chain. Each takes its settings from the song and
// can be switched off without leaving the chain. No AudioWorklets (see the engine header), so lo-fi is built
// from a wave shaper instead of Tone's BitCrusher.

import * as Tone from 'tone';

export interface Pedal {
  input: Tone.ToneAudioNode;
  output: Tone.ToneAudioNode;
  set(params: Record<string, number>, bypass: boolean): void;
  /** Called on every beat while playing; the sidechain pump uses it to duck in time. */
  onBeat?(time: number, beatSec: number): void;
  /** Called on Stop, so nothing stays ducked. */
  rest?(): void;
  dispose(): void;
}

const num = (p: Record<string, number>, name: string, fallback: number) => (Number.isFinite(p[name]) ? p[name] : fallback);

/** For a Tone effect with a wet control: off means fully dry. */
function effect<E extends Tone.ToneAudioNode & { wet: Tone.Signal<'normalRange'> }>(node: E, apply: (p: Record<string, number>) => number): Pedal {
  return {
    input: node,
    output: node,
    set(p, bypass) {
      const mix = apply(p);
      node.wet.rampTo(bypass ? 0 : mix, 0.03);
    },
    dispose() { node.dispose(); },
  };
}

/** For processors without a wet control: a crossfade between the dry signal and the processed one. */
function blended(chain: Tone.ToneAudioNode[], apply: (p: Record<string, number>) => number, extra: Tone.ToneAudioNode[] = []): Pedal {
  const input = new Tone.Gain(1);
  const fade = new Tone.CrossFade(0);
  input.connect(fade.a);
  let prev: Tone.ToneAudioNode = input;
  for (const n of chain) { prev.connect(n); prev = n; }
  prev.connect(fade.b);
  return {
    input,
    output: fade,
    set(p, bypass) {
      const mix = apply(p);
      fade.fade.rampTo(bypass ? 0 : mix, 0.03);
    },
    dispose() { [input, fade, ...chain, ...extra].forEach((n) => n.dispose()); },
  };
}

const quantize = (bits: number) => {
  const levels = Math.pow(2, Math.max(1, Math.round(bits)) - 1);
  return (x: number) => Math.round(x * levels) / levels;
};

const PEDALS: Record<string, () => Pedal> = {
  'effect.drive': () => {
    const d = new Tone.Distortion(0.35);
    return effect(d, (p) => { d.distortion = num(p, 'amount', 0.35); return 1; });
  },
  'effect.delay': () => {
    const d = new Tone.FeedbackDelay('8n.', 0.35);
    return effect(d, (p) => { d.feedback.value = num(p, 'feedback', 0.35); return num(p, 'mix', 0.25); });
  },
  'effect.reverb': () => {
    const r = new Tone.Reverb({ decay: 2.5, preDelay: 0.01, wet: 0 });
    let size = 2.5;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const base = effect(r, (p) => {
      const next = Math.max(0.3, Math.min(8, num(p, 'size', 2.5)));
      if (Math.abs(next - size) > 0.04) {
        // A new size rebuilds the room's echo; wait until the slider rests.
        size = next;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { timer = null; r.decay = next; }, 250);
      }
      return num(p, 'mix', 0.3);
    });
    return { ...base, dispose() { if (timer) clearTimeout(timer); r.dispose(); } };
  },
  'effect.chorus': () => {
    const c = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, spread: 180 }).start();
    return effect(c, (p) => { c.frequency.value = num(p, 'rate', 1.5); c.depth = num(p, 'depth', 0.7); return num(p, 'mix', 0.5); });
  },
  'effect.phaser': () => {
    const ph = new Tone.Phaser({ frequency: 0.5, octaves: 3, baseFrequency: 350 });
    return effect(ph, (p) => { ph.frequency.value = num(p, 'rate', 0.5); ph.octaves = 1 + num(p, 'depth', 0.5) * 5; return num(p, 'mix', 0.5); });
  },
  'effect.filter-sweep': () => {
    const f = new Tone.AutoFilter({ frequency: 0.5, baseFrequency: 200, octaves: 4 }).start();
    return effect(f, (p) => { f.frequency.value = num(p, 'rate', 0.5); f.octaves = 1 + num(p, 'depth', 0.6) * 6; return num(p, 'mix', 1); });
  },
  'effect.pingpong': () => {
    const d = new Tone.PingPongDelay('8n', 0.35);
    return effect(d, (p) => { d.feedback.value = num(p, 'feedback', 0.35); return num(p, 'mix', 0.3); });
  },
  'effect.widener': () => {
    // Most of our instruments are mono, so a mid/side widener would only make them quieter. Instead the right
    // side hears the sound a few milliseconds late (the Haas effect): the same notes, wider, at the same level.
    const late = new Tone.Delay(0.012);
    const merge = new Tone.Merge();
    const split = new Tone.Gain(1);
    split.connect(merge, 0, 0);
    split.connect(late);
    late.connect(merge, 0, 1);
    const pedal = blended([split, merge], (p) => {
      const w = num(p, 'width', 0.7);
      late.delayTime.rampTo(0.004 + 0.018 * w, 0.05);
      return w > 0 ? 1 : 0;
    }, [late]);
    return pedal;
  },
  'effect.tremolo': () => {
    const tr = new Tone.Tremolo(6, 0.6).start();
    return effect(tr, (p) => { tr.frequency.value = num(p, 'rate', 6); tr.depth.value = num(p, 'depth', 0.6); return 1; });
  },
  'effect.octave': () => {
    const ps = new Tone.PitchShift({ pitch: 12, windowSize: 0.08 });
    return effect(ps, (p) => { ps.pitch = Math.round(num(p, 'pitch', 12)); return num(p, 'mix', 0.4); });
  },
  'effect.lofi': () => {
    let bits = 6;
    const shaper = new Tone.WaveShaper(quantize(bits), 4096);
    const tone = new Tone.Filter(3500, 'lowpass');
    return blended([shaper, tone], (p) => {
      const b = Math.round(num(p, 'bits', 6));
      if (b !== bits) { bits = b; shaper.setMap(quantize(b)); }
      tone.frequency.rampTo(num(p, 'tone', 3500), 0.05);
      return num(p, 'mix', 1);
    });
  },
  'effect.radio': () => {
    const band = new Tone.Filter({ frequency: 1200, type: 'bandpass', Q: 1.4 });
    const grit = new Tone.Distortion(0.25);
    const lift = new Tone.Gain(Tone.dbToGain(4));
    return blended([band, grit, lift], (p) => { band.frequency.rampTo(num(p, 'focus', 1200), 0.05); return num(p, 'mix', 1); });
  },
  'effect.compressor': () => {
    const comp = new Tone.Compressor({ threshold: -18, ratio: 4, attack: 0.008, release: 0.2, knee: 6 });
    const makeup = new Tone.Gain(1);
    return blended([comp, makeup], (p) => {
      const a = num(p, 'amount', 0.5);
      comp.threshold.value = -6 - 30 * a;
      comp.ratio.value = 2 + 6 * a;
      makeup.gain.value = Tone.dbToGain(5 * a);
      return 1;
    });
  },
  'effect.eq': () => {
    // Shelves and a bell in series: flat when every band is at 0 dB.
    const low = new Tone.Filter({ type: 'lowshelf', frequency: 220 });
    const mid = new Tone.Filter({ type: 'peaking', frequency: 1000, Q: 0.8 });
    const high = new Tone.Filter({ type: 'highshelf', frequency: 4000 });
    return blended([low, mid, high], (p) => {
      low.gain.value = num(p, 'low', 0);
      mid.gain.value = num(p, 'mid', 0);
      high.gain.value = num(p, 'high', 0);
      return 1;
    });
  },
  'effect.pump': () => {
    // Sidechain pump: the volume ducks on every beat and swells back, like a kick pushing the track.
    const g = new Tone.Gain(1);
    let depth = 0.6;
    let release = 0.6;
    let on = true;
    return {
      input: g,
      output: g,
      set(p, bypass) {
        depth = num(p, 'depth', 0.6);
        release = num(p, 'release', 0.6);
        on = !bypass;
        if (!on) g.gain.cancelScheduledValues(Tone.now()).rampTo(1, 0.03);
      },
      onBeat(time, beatSec) {
        if (!on || depth <= 0) return;
        g.gain.cancelScheduledValues(time);
        g.gain.setValueAtTime(1 - depth, time);
        g.gain.linearRampToValueAtTime(1, time + Math.max(0.05, beatSec * release));
      },
      rest() { g.gain.cancelScheduledValues(Tone.now()); g.gain.value = 1; },
      dispose() { g.dispose(); },
    };
  },
};

export const PEDAL_KEYS = Object.keys(PEDALS);

export function createPedal(key: string): Pedal | null {
  return PEDALS[key]?.() ?? null;
}
