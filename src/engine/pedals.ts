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
function blended(chain: Tone.ToneAudioNode[], apply: (p: Record<string, number>) => number, extra: Tone.ToneAudioNode[] = [], dryDelay = 0): Pedal {
  const input = new Tone.Gain(1);
  const fade = new Tone.CrossFade(0);
  // A compressor delays its output by about 6 ms; the dry side waits the same so a parallel blend does not comb.
  const late = dryDelay > 0 ? new Tone.Delay(dryDelay, dryDelay) : null;
  if (late) { input.connect(late); late.connect(fade.a); extra = [...extra, late]; } else input.connect(fade.a);
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

/* ---------------------------------------------------------------- studio gear */

/** A transfer curve for a wave shaper, sampled over -1..1. */
function shape(fn: (x: number) => number, n = 2048): Float32Array {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = fn((i / (n - 1)) * 2 - 1);
  return c;
}

/** Clean (solid state): straight until near the top, then a firm knee. Transformer: soft and round. Tube: soft and lopsided (even harmonics). */
const PREAMP_CURVES = [
  shape((x) => (Math.abs(x) < 0.7 ? x : Math.sign(x) * (0.7 + 0.3 * Math.tanh((Math.abs(x) - 0.7) / 0.3)))),
  shape((x) => Math.tanh(1.4 * x) / Math.tanh(1.4)),
  (() => {
    const k = 1.6;
    const b = 0.22;
    const off = Math.tanh(k * b);
    const top = Math.max(Math.abs(Math.tanh(k * (1 + b)) - off), Math.abs(Math.tanh(k * (-1 + b)) - off));
    return shape((x) => (Math.tanh(k * (x + b)) - off) / top);
  })(),
];
const softClip = shape((x) => Math.tanh(1.2 * x) / Math.tanh(1.2));
const tubeClip = PREAMP_CURVES[2];
const hardClip = shape((x) => Math.tanh(2.5 * x) / Math.tanh(2.5));

const idx = (p: Record<string, number>, name: string, n: number, fallback: number) =>
  Math.max(0, Math.min(n - 1, Math.round(num(p, name, fallback))));

/**
 * Amp voicings: how hard each stage is pushed, the filter between stages, and a biquad fit of each tone stack
 * (Fender scoops deep and low, Marshall shallower and higher; the mid knob moves the notch, it never boosts).
 */
const AMP_MODELS = [
  /* clean, American */ { tight: 70, pre: 12, pre2: 0, inter: 9000, bassF: 120, midF: 550, midQ: 0.6, midDb: -9, trebleF: 3000, curve: softClip, curve2: softClip, trim: 6 },
  /* crunch, British */ { tight: 80, pre: 28, pre2: 8, inter: 7000, bassF: 150, midF: 720, midQ: 0.7, midDb: -5, trebleF: 2500, curve: tubeClip, curve2: softClip, trim: -6 },
  /* high gain */ { tight: 180, pre: 30, pre2: 22, inter: 8000, bassF: 120, midF: 420, midQ: 0.6, midDb: -6, trebleF: 3000, curve: tubeClip, curve2: hardClip, trim: -9 },
  /* bass */ { tight: 35, pre: 16, pre2: 0, inter: 6000, bassF: 150, midF: 700, midQ: 0.6, midDb: -4, trebleF: 2500, curve: tubeClip, curve2: softClip, trim: -1 },
];

/** Speaker cabinets as a microphone hears them, fitted to measured cabinet responses: low cut, box bump, mid dip, presence, top cliff. */
const CABS = [
  /* 1x12 open back */ { hp: 95, res: 150, resDb: 1, resQ: 1, mid: 700, midDb: -6, midQ: 0.7, pres: 3200, presDb: 4, lp: 5000 },
  /* 2x12 */ { hp: 70, res: 200, resDb: 2, resQ: 1, mid: 1500, midDb: -3, midQ: 0.8, pres: 3000, presDb: 1.5, lp: 4600 },
  /* 4x12 closed back */ { hp: 75, res: 110, resDb: 3, resQ: 1, mid: 600, midDb: -4, midQ: 0.8, pres: 2600, presDb: 3, lp: 5500 },
  /* bass 8x10 */ { hp: 50, res: 100, resDb: 2, resQ: 1, mid: 500, midDb: -2, midQ: 0.8, pres: 2500, presDb: 2, lp: 5000 },
  /* bass 1x15 */ { hp: 45, res: 150, resDb: 2, resQ: 1, mid: 1000, midDb: -6, midQ: 0.7, pres: 2000, presDb: 2, lp: 3500 },
];

/** Compressor styles: fast and gritty, slow and smooth, or gentle glue for a whole group. */
const COMP_STYLES = [
  { attack: 0.0006, release: 0.06, knee: 2, ratio: (a: number) => 4 + 16 * a, threshold: (a: number) => -8 - 30 * a, grit: true },
  { attack: 0.012, release: 0.45, knee: 14, ratio: (a: number) => 2.5 + 2 * a, threshold: (a: number) => -6 - 28 * a, grit: false },
  { attack: 0.03, release: 0.12, knee: 4, ratio: (a: number) => 2 + 2 * a, threshold: (a: number) => -4 - 20 * a, grit: false },
];

/** A dense burst of noise that stops dead: the room of the 80s gated drum sound. */
function gatedImpulse(seconds: number): AudioBuffer {
  const ctx = Tone.getContext().rawContext as BaseAudioContext;
  const rate = ctx.sampleRate;
  const n = Math.max(1, Math.round(rate * seconds));
  const buf = ctx.createBuffer(2, n, rate);
  const fade = Math.round(rate * 0.008);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      lp += 0.55 * ((Math.random() * 2 - 1) - lp); // a little darker than white noise
      const attack = Math.min(1, t / 0.004);
      const body = Math.exp(-t / (seconds * 1.6));
      const tail = i > n - fade ? (n - i) / fade : 1;
      d[i] = lp * attack * body * tail * 0.5;
    }
  }
  return buf;
}

const STUDIO: Record<string, () => Pedal> = {
  'effect.preamp': () => {
    const cut = new Tone.Filter({ type: 'highpass', frequency: 30, Q: 0.7 });
    const push = new Tone.Gain(1);
    const sat = new Tone.WaveShaper(PREAMP_CURVES[2]);
    sat.oversample = '4x';
    const back = new Tone.Gain(1);
    let character = -1;
    return blended([cut, push, sat, back], (p) => {
      const c = idx(p, 'character', 3, 2);
      if (c !== character) { character = c; sat.curve = PREAMP_CURVES[c]; }
      const drive = num(p, 'drive', 0.3);
      push.gain.rampTo(Tone.dbToGain(drive * 30), 0.05);
      back.gain.rampTo(Tone.dbToGain(-drive * 25), 0.05);
      cut.frequency.rampTo(num(p, 'lowcut', 30), 0.05);
      return 1;
    });
  },
  'effect.comp-studio': () => {
    const comp = new Tone.Compressor({ threshold: -20, ratio: 6, attack: 0.001, release: 0.08, knee: 3 });
    const grit = new Tone.WaveShaper(softClip);
    const makeup = new Tone.Gain(1);
    return blended([comp, grit, makeup], (p) => {
      const st = COMP_STYLES[idx(p, 'style', 3, 0)];
      const a = num(p, 'amount', 0.5);
      comp.attack.value = st.attack;
      comp.release.value = st.release;
      comp.knee.value = st.knee;
      comp.ratio.value = st.ratio(a);
      comp.threshold.value = st.threshold(a);
      grit.curve = st.grit ? softClip : shape((x) => x, 2);
      makeup.gain.value = Tone.dbToGain(-st.threshold(a) * 0.35);
      return num(p, 'mix', 1);
    }, [], 0.006);
  },
  'effect.amp': () => {
    const tight = new Tone.Filter({ type: 'highpass', frequency: 90, Q: 0.7 });
    const pre = new Tone.Gain(1);
    const stage1 = new Tone.WaveShaper(tubeClip);
    const inter = new Tone.Filter({ type: 'lowpass', frequency: 5600, Q: 0.6 });
    const pre2 = new Tone.Gain(1);
    const stage2 = new Tone.WaveShaper(softClip);
    const low = new Tone.Filter({ type: 'lowshelf', frequency: 120 });
    const mid = new Tone.Filter({ type: 'peaking', frequency: 720, Q: 0.7 });
    const high = new Tone.Filter({ type: 'highshelf', frequency: 2500 });
    const power = new Tone.WaveShaper(softClip);
    const out = new Tone.Gain(1);
    stage1.oversample = '4x';
    stage2.oversample = '2x';
    let model = -1;
    return blended([tight, pre, stage1, inter, pre2, stage2, low, mid, high, power, out], (p) => {
      const m = idx(p, 'model', 4, 1);
      const v = AMP_MODELS[m];
      if (m !== model) {
        model = m;
        stage1.curve = v.curve;
        stage2.curve = v.curve2;
        tight.frequency.value = v.tight;
        inter.frequency.value = v.inter;
        low.frequency.value = v.bassF;
        mid.frequency.value = v.midF;
        mid.Q.value = v.midQ;
        high.frequency.value = v.trebleF;
      }
      const g = num(p, 'gain', 0.5);
      pre.gain.rampTo(Tone.dbToGain(v.pre * g), 0.05);
      pre2.gain.rampTo(Tone.dbToGain(v.pre2 * g), 0.05);
      low.gain.value = num(p, 'bass', 0);
      // The mid knob makes the notch shallower or deeper; at full it is nearly flat, never a boost.
      mid.gain.value = Math.min(0, v.midDb + num(p, 'mid', 0) * 0.75);
      high.gain.value = num(p, 'treble', 0);
      out.gain.rampTo(Tone.dbToGain(num(p, 'level', 0) + v.trim - g * 4), 0.05);
      return 1;
    });
  },
  'effect.cab': () => {
    const hp = new Tone.Filter({ type: 'highpass', frequency: 70, Q: 0.7 });
    const res = new Tone.Filter({ type: 'peaking', frequency: 100, Q: 1.4 });
    const mid = new Tone.Filter({ type: 'peaking', frequency: 450, Q: 0.9 });
    const pres = new Tone.Filter({ type: 'peaking', frequency: 2600, Q: 1.1 });
    // Two 12 dB/octave stages each side: the steep low cut and the cliff above 5 kHz that hides amp fizz.
    const hp2 = new Tone.Filter({ type: 'highpass', frequency: 70, Q: 0.7 });
    const lp1 = new Tone.Filter({ type: 'lowpass', frequency: 5600, Q: 0.54 });
    const lp2 = new Tone.Filter({ type: 'lowpass', frequency: 5600, Q: 1.31 });
    return blended([hp, hp2, res, mid, pres, lp1, lp2], (p) => {
      const c = CABS[idx(p, 'model', CABS.length, 2)];
      const mic = num(p, 'mic', 0.3);
      hp.frequency.value = c.hp;
      hp2.frequency.value = c.hp;
      res.frequency.value = c.res;
      res.gain.value = c.resDb;
      res.Q.value = c.resQ;
      mid.frequency.value = c.mid;
      mid.gain.value = c.midDb;
      mid.Q.value = c.midQ;
      // Mic at the center of the cone is brighter; toward the edge the presence fades and the top end darkens.
      pres.frequency.value = c.pres;
      pres.gain.value = c.presDb + 2 - 6 * mic;
      const top = c.lp * (1 - 0.35 * mic);
      lp1.frequency.value = top;
      lp2.frequency.value = top;
      return 1;
    });
  },
  'effect.tape': () => {
    const push = new Tone.Gain(1);
    const sat = new Tone.WaveShaper(shape((x) => (Math.tanh(1.3 * (x + 0.05)) - Math.tanh(1.3 * 0.05)) / Math.tanh(1.3)));
    sat.oversample = '2x';
    const back = new Tone.Gain(1);
    const bump = new Tone.Filter({ type: 'peaking', frequency: 60, Q: 1.0 });
    const floor = new Tone.Filter({ type: 'highpass', frequency: 22, Q: 0.7 });
    const top = new Tone.Filter({ type: 'highshelf', frequency: 9000 });
    const air = new Tone.Filter({ type: 'lowpass', frequency: 17000, Q: 0.7 });
    return blended([push, sat, back, bump, floor, top, air], (p) => {
      const fast = idx(p, 'speed', 2, 0) === 1;
      const d = num(p, 'drive', 0.4);
      push.gain.rampTo(Tone.dbToGain(d * 18), 0.05);
      back.gain.rampTo(Tone.dbToGain(-d * 15), 0.05);
      bump.frequency.value = fast ? 110 : 60;
      bump.gain.value = fast ? 1.5 : 2.5;
      top.gain.value = -(fast ? 0.8 : 2) * (0.4 + d);
      air.frequency.value = fast ? 20000 : 16500;
      return num(p, 'mix', 1);
    });
  },
  'effect.gated-room': () => {
    const input = new Tone.Gain(1);
    const out = new Tone.Gain(1);
    const conv = new Tone.Convolver();
    const wet = new Tone.Gain(0);
    input.connect(out);
    input.connect(conv);
    conv.connect(wet);
    wet.connect(out);
    let length = -1;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const build = (s: number) => { conv.buffer = new Tone.ToneAudioBuffer(gatedImpulse(s)); };
    return {
      input,
      output: out,
      set(p, bypass) {
        const next = Math.max(0.1, Math.min(1, num(p, 'length', 0.32)));
        if (length < 0) { length = next; build(next); }
        else if (Math.abs(next - length) > 0.01) {
          length = next;
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => { timer = null; build(next); }, 200);
        }
        wet.gain.rampTo(bypass ? 0 : num(p, 'mix', 0.35) * 1.4, 0.03);
      },
      dispose() { if (timer) clearTimeout(timer); [input, out, conv, wet].forEach((n) => n.dispose()); },
    };
  },
};
Object.assign(PEDALS, STUDIO);

export const PEDAL_KEYS = Object.keys(PEDALS);

export function createPedal(key: string): Pedal | null {
  return PEDALS[key]?.() ?? null;
}
