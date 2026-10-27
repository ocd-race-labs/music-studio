// The audio engine: reads the song, never edits it. One channel per track:
// voice -> pedals in the song's order -> channel (volume, pan, mute, solo) -> master.
// No AudioWorklets: they need blob: or same-origin module loads that some hosts block,
// and they cost the most CPU on a tablet.

import * as Tone from 'tone';
import { DRUM_VOICES, findByKey, findItem, FULL_KIT_VOICES, LATIN_VOICES, lowOf, ORCH_VOICES, resolveRow, rowsOf, rowVoice, STANDARD_ROWS } from '../packs/core';
import { chordMidi, diatonicTriads } from '../theory';
import type { ChordsContent, FxChain, NotesContent, PatternContent, Song, Track } from '../domain/types';
import { PPQ, STEP_TICKS } from '../domain/types';
import { defaultFxParams, loopSteps } from '../domain/factory';
import { createDrumKit, createMelodicVoice } from './voices';
import type { Voice } from './voices';
import { createSampledKit, loadKit } from './sampled';
import { createSampler, loadSampler } from './sampler';
import { SAMPLED_KITS, SAMPLERS } from '../packs/collection';
import type { ChainSpec, Groove, Phrase } from '../packs/collection';
import { createPedal } from './pedals';
import type { Pedal } from './pedals';
import { compSettings, consoleOf, driveCurve, echoSeconds, glueSettings, mixOf, qFor, ROOM_SECONDS, stripOf } from '../domain/mix';

/** The desk channel after a track's sound: gain, low cut, compressor, EQ, warmth, and the sends. */
interface StripNodes {
  trim: Tone.Gain;
  /** The low cut: two filters in series, 24 dB per octave. */
  hpf: Tone.BiquadFilter;
  hpf2: Tone.BiquadFilter;
  comp: Tone.Compressor;
  compTrim: Tone.Gain;
  eq: Tone.BiquadFilter[];
  bumps: Tone.BiquadFilter[];
  shaper: Tone.WaveShaper;
  driveSig: string;
  /** The compressor is in the path only while it works: off, it adds no look-ahead delay to live playing. */
  compOn: boolean;
  room: Tone.Gain;
  echo: Tone.Gain;
}

function createStrip(): StripNodes {
  const trim = new Tone.Gain(1);
  // Plain filters with fixed settings: the browser works out their curve once per block, not once per sample.
  const hpf = new Tone.BiquadFilter({ type: 'highpass', frequency: 5 });
  const hpf2 = new Tone.BiquadFilter({ type: 'highpass', frequency: 5 });
  const comp = new Tone.Compressor({ threshold: 0, ratio: 1, attack: 0.01, release: 0.3, knee: 6 });
  const compTrim = new Tone.Gain(1);
  const eq = [
    new Tone.BiquadFilter({ type: 'lowshelf', frequency: 100, gain: 0 }),
    new Tone.BiquadFilter({ type: 'peaking', frequency: 400, gain: 0, Q: 0.9 }),
    new Tone.BiquadFilter({ type: 'peaking', frequency: 2500, gain: 0, Q: 0.9 }),
    new Tone.BiquadFilter({ type: 'highshelf', frequency: 10000, gain: 0 }),
  ];
  const bumps = [new Tone.BiquadFilter({ type: 'peaking', frequency: 200, gain: 0, Q: 1 }), new Tone.BiquadFilter({ type: 'peaking', frequency: 5000, gain: 0, Q: 1 })];
  const shaper = new Tone.WaveShaper(driveCurve('clean', 0), 2048);
  shaper.oversample = 'none';
  trim.chain(hpf, hpf2, compTrim, ...eq, ...bumps, shaper);
  comp.connect(compTrim);
  return { trim, hpf, hpf2, comp, compTrim, eq, bumps, shaper, driveSig: 'clean:0', compOn: false, room: new Tone.Gain(0), echo: new Tone.Gain(0) };
}
const disposeStrip = (x: StripNodes) => [x.trim, x.hpf, x.hpf2, x.comp, x.compTrim, ...x.eq, ...x.bumps, x.shaper, x.room, x.echo].forEach((n) => n.dispose());

/** A soft ceiling after the limiter: flat until 0.98, then a gentle knee, so nothing ever clips hard. */
function softClipCurve(size = 2048): Float32Array<ArrayBuffer> {
  const c = new Float32Array(new ArrayBuffer(size * 4));
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    const a = Math.abs(x);
    c[i] = a <= 0.98 ? x : Math.sign(x) * (0.98 + 0.02 * Math.tanh((a - 0.98) / 0.02));
  }
  return c;
}

interface TrackChannel {
  instrumentKey: string;
  /** The instrument plus whether a saved sound replaces its gear: a change rebuilds the voice. */
  voiceKey: string;
  voice: Voice;
  /** The pedal chain, in the song's order; rebuilt when pedals are added, removed or moved. */
  pedals: { key: string; pedal: Pedal | null; on: boolean }[];
  /** Where the chain meets the desk channel: a new chain fades in here while the old one fades out. */
  chainOut: Tone.Gain;
  chainSig: string;
  strip: StripNodes;
  channel: Tone.Channel;
  meter: Tone.Meter;
}

type AudioSessionNav = Navigator & { audioSession?: { type: string } };


/** How long a sound takes to fade when it is switched or taken away: short enough to feel instant, long enough not to click. */
const FADE_MS = 15;
const FADE = FADE_MS / 1000;
/**
 * How far ahead the song's notes are planned. A moment when the page is busy (building a sound, loading samples)
 * shorter than this costs nothing; longer, notes land late and click. Live pads and keys never wait for it.
 */
const LOOK_AHEAD = 0.1;
/** Instruments kept ready for previews outside the song. */
const PREVIEWS_KEPT = 4;

const gainToDb = (g: number) => (g <= 0.0001 ? -Infinity : 20 * Math.log10(g));

/**
 * Move a setting only when it changes. While a setting glides the browser works it out sample by sample, which
 * for a filter is costly, so a mix applied again with the same values must leave every setting still.
 */
type Knob = { value: unknown; rampTo(v: number, t: number): unknown; linearRampTo(v: number, t: number): unknown };
function glide(p: Knob, v: number, linear = false): void {
  if (Math.abs(Number(p.value) - v) < 1e-4) return;
  if (linear) p.linearRampTo(v, 0.05); else p.rampTo(v, 0.05);
}
function set(p: { value: unknown }, v: number): void {
  if (Math.abs(Number(p.value) - v) >= 1e-4) p.value = v;
}

export class StudioEngine {
  private song: Song | null = null;
  private channels = new Map<string, TrackChannel>();
  private master: Tone.Limiter | null = null;
  private meter: Tone.Meter | null = null;
  /** The master bus: every channel and return goes here, then glue, tone, the limiter and a soft ceiling. */
  private bus: Tone.Gain | null = null;
  private glue: Tone.Compressor | null = null;
  private glueOn = false;
  private glueTrim: Tone.Gain | null = null;
  private body: Tone.BiquadFilter | null = null;
  private air: Tone.BiquadFilter | null = null;
  private limiterTrim: Tone.Gain | null = null;
  private roomIn: Tone.Gain | null = null;
  private reverb: Tone.Reverb | null = null;
  private roomOut: Tone.Gain | null = null;
  private roomDecay = 0;
  private echoIn: Tone.Gain | null = null;
  private delay: Tone.FeedbackDelay | null = null;
  private echoOut: Tone.Gain | null = null;
  private analyser: Tone.Analyser | null = null;
  private lufsFrames: { t: number; ms: number }[] = [];
  private lufsAll: { sum: number; n: number } = { sum: 0, n: 0 };
  /** When set, only this track sounds: a listening aid, never saved in the song. */
  private focusId: string | null = null;
  private unlockBound = false;
  private repeatId: number | null = null;
  /** What plays: the whole song, or one section on repeat. In steps; null means the whole song. */
  private range: { start: number; length: number } | null = null;
  private nextStep = 0;
  private stepListeners = new Set<(step: number) => void>();
  started = false;

  /**
   * Audio can only start after a tap (iPad rule). Call from a click handler, before any await.
   * Builds the sound graph right away and resolves true once the device is really playing.
   */
  async start(): Promise<boolean> {
    const resumed = this.ensure();
    if (this.running) return true;
    await Promise.race([resumed, new Promise((r) => setTimeout(r, 1500))]);
    return this.running;
  }

  /** Synchronous part of start: unlock audio inside the tap and build the graph. */
  private ensure(): Promise<void> {
    unlockMediaSession();
    if (!this.started) {
      // iPhone and iPad: a context created inside the tap starts reliably; the one Tone made at page load may stay suspended.
      try {
        // Chrome and Edge: a plain browser connection to the speakers, the same kind the Lab's "new connection" beep
        // uses. Safari keeps the audio library's own, which smooths over its differences.
        const webkitOnly = /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg|CriOS/.test(navigator.userAgent);
        Tone.setContext(webkitOnly || typeof window.AudioContext !== 'function'
          ? new Tone.Context({ latencyHint: 'interactive', lookAhead: LOOK_AHEAD })
          : new Tone.Context({ context: new window.AudioContext(), lookAhead: LOOK_AHEAD }), true);
      } catch { /* keep the existing context */ }
    }
    const resumed = Tone.start().catch(() => undefined);
    kickWebKit();
    this.bindUnlock();
    if (!this.started) {
      Tone.getContext().lookAhead = LOOK_AHEAD;
      this.meter = new Tone.Meter({ smoothing: 0.5 });
      this.master = new Tone.Limiter(-1);
      // The limiter's own makeup pushes peaks past its ceiling; this trim takes it back, a soft knee catches the rest.
      this.limiterTrim = new Tone.Gain(Tone.dbToGain(-0.57));
      const clip = new Tone.WaveShaper(softClipCurve(), 2048);
      this.master.chain(this.limiterTrim, clip);
      clip.connect(this.meter);
      clip.toDestination();
      // Loudness as people hear it: K-weighting (a high shelf and a low cut), then the level over time.
      this.analyser = new Tone.Analyser({ type: 'waveform', size: 2048 });
      const kShelf = new Tone.BiquadFilter({ type: 'highshelf', frequency: 1682, gain: 4 });
      const kCut = new Tone.BiquadFilter({ type: 'highpass', frequency: 38, Q: 0.5 });
      clip.chain(kShelf, kCut, this.analyser);
      this.bus = new Tone.Gain(1);
      this.glue = new Tone.Compressor({ threshold: 0, ratio: 1, attack: 0.03, release: 0.3, knee: 0 });
      this.glueTrim = new Tone.Gain(1);
      this.body = new Tone.BiquadFilter({ type: 'lowshelf', frequency: 100, gain: 0 });
      this.air = new Tone.BiquadFilter({ type: 'highshelf', frequency: 10000, gain: 0 });
      this.bus.connect(this.glueTrim);
      this.glue.chain(this.glueTrim, this.body, this.air, this.master);
      // Shared returns: a room and an echo, each kept out of the lows and the very top so they never muddy the mix.
      this.roomIn = new Tone.Gain(1);
      this.reverb = new Tone.Reverb({ decay: 1.8, preDelay: 0.02, wet: 1 });
      this.roomDecay = 1.8;
      this.roomOut = new Tone.Gain(0.8);
      this.roomIn.chain(this.reverb, new Tone.BiquadFilter({ type: 'highpass', frequency: 150 }), new Tone.BiquadFilter({ type: 'lowpass', frequency: 8000 }), this.roomOut, this.bus);
      this.echoIn = new Tone.Gain(1);
      this.delay = new Tone.FeedbackDelay({ delayTime: 0.5, feedback: 0.3, wet: 1, maxDelay: 4 });
      this.echoOut = new Tone.Gain(0.7);
      this.echoIn.chain(this.delay, new Tone.BiquadFilter({ type: 'lowpass', frequency: 4500 }), new Tone.BiquadFilter({ type: 'highpass', frequency: 150 }), this.echoOut, this.bus);
      this.started = true;
      // The song's sounds are built once the audio runs, and a sound that fails to build never silences the rest.
      if (Tone.getContext().state === 'running') { if (this.song) this.sync(this.song); }
      else resumed.then(() => { if (this.song) this.sync(this.song); });
      this.watchClock();
      this.watchDevice();
    }
    return resumed;
  }

  /**
   * When the speakers fail while sound is rendered (a device change, an overload), the browser keeps rendering into
   * nowhere: the meter moves and nothing is heard. Browsers that report it fire 'error' on the context; the audio is
   * then built again on a new connection.
   */
  private watched = new WeakSet<object>();
  private watchDevice(): void {
    const raw = Tone.getContext().rawContext as unknown as EventTarget;
    if (this.watched.has(raw) || typeof raw.addEventListener !== 'function') return;
    this.watched.add(raw);
    raw.addEventListener('error', (ev) => {
      console.warn('[music-studio] the audio device failed; building the audio again', ev);
      this.problem('audio', 'device');
      void this.restart();
    });
  }

  /** Someone rebuilt the audio (by hand or after a failure): screens drop their playing state. */
  private restartFns = new Set<() => void>();
  onRestart(fn: () => void): () => void {
    this.restartFns.add(fn);
    return () => { this.restartFns.delete(fn); };
  }

  /**
   * A connection to the speakers can get stuck: the audio says it runs but its clock stops, nothing is heard and
   * the meter shows the last sound frozen. Checked every second while the page is in view; when the clock has not
   * moved for two seconds the audio is built again on a new connection.
   */
  private clockWatch: number | undefined;
  private watchClock(): void {
    if (this.clockWatch !== undefined || typeof window === 'undefined') return;
    let last = -1;
    let still = 0;
    this.clockWatch = window.setInterval(() => {
      const raw = Tone.getContext().rawContext as unknown as BaseAudioContext;
      if (raw.state !== 'running' || document.hidden) { last = -1; still = 0; return; }
      const now = raw.currentTime;
      still = last >= 0 && now - last < 0.05 ? still + 1 : 0;
      last = now;
      if (still >= 2) {
        still = 0;
        last = -1;
        console.warn('[music-studio] the audio clock stopped; building the audio again');
        this.problem('audio', 'stuck');
        void this.restart();
      }
    }, 1000);
  }

  /** How fast the audio clock moves against real time over a moment: about 1 while sound flows, 0 when stuck. */
  async clockRate(ms = 1000): Promise<{ state: string; rate: number }> {
    const raw = Tone.getContext().rawContext as unknown as BaseAudioContext;
    const a0 = raw.currentTime;
    const w0 = performance.now();
    await new Promise((r) => setTimeout(r, ms));
    const dw = (performance.now() - w0) / 1000;
    return { state: raw.state, rate: dw > 0 ? (raw.currentTime - a0) / dw : 0 };
  }

  /** Times the sound card ran dry since the audio started, where the browser tells (Chrome); null elsewhere. */
  underruns(): number | null {
    const raw = Tone.getContext().rawContext as unknown as { playbackStats?: { underrunEvents?: number } };
    return typeof raw.playbackStats?.underrunEvents === 'number' ? raw.playbackStats.underrunEvents : null;
  }

  /** A short beep straight to the speakers, outside the studio's chain: tells a stuck chain from a silent device. */
  directBeep(): void {
    try {
      const raw = Tone.getContext().rawContext as unknown as AudioContext;
      const osc = raw.createOscillator();
      const g = raw.createGain();
      osc.frequency.value = 880;
      g.gain.setValueAtTime(0.2, raw.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, raw.currentTime + 0.3);
      osc.connect(g);
      g.connect(raw.destination);
      osc.start();
      osc.stop(raw.currentTime + 0.32);
    } catch (e) { this.problem('beep', e); }
  }

  /** Throw the audio away and build it again on a new connection: the song's sounds come back as they were. */
  async restart(): Promise<boolean> {
    try { Tone.getTransport().stop(); } catch { /* the old clock may be gone */ }
    this.repeatId = null;
    this.stopPreview();
    this.channels.clear();
    this.previews.clear();
    this.glueOn = false;
    this.reported.clear();
    this.started = false;
    this.stepListeners.forEach((fn) => fn(-1));
    const ok = await this.start();
    this.restartFns.forEach((fn) => fn());
    return ok;
  }

  /** A track whose sound could not be built: the rest keep playing, and the app can say which one. */
  private problemFns = new Set<(trackName: string, error: string) => void>();
  onProblem(fn: (trackName: string, error: string) => void): () => void {
    this.problemFns.add(fn);
    return () => { this.problemFns.delete(fn); };
  }
  private reported = new Set<string>();
  private problem(where: string, e: unknown): void {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[music-studio] ${where}:`, e);
    const sig = `${where}:${msg}`;
    if (this.reported.has(sig)) return;
    this.reported.add(sig);
    this.problemFns.forEach((fn) => fn(where, msg));
  }

  /** True when the device is producing audio. */
  get running(): boolean {
    return Tone.getContext().state === 'running';
  }

  /** Browsers can suspend audio again (phone call, tab in background); any later tap brings it back. */
  private bindUnlock(): void {
    if (this.unlockBound || typeof document === 'undefined') return;
    this.unlockBound = true;
    const unlock = () => {
      if (Tone.getContext().state !== 'running') {
        unlockMediaSession();
        Tone.getContext().resume().catch(() => undefined);
        kickWebKit();
      }
    };
    for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(ev, unlock, { capture: true, passive: true });
    // Out of sight (another app, the screen locked, the tab hidden) the studio goes quiet and the audio sleeps.
    // On iPhone and iPad the silent keep-alive would otherwise hold the audio open and the whole graph (rooms,
    // echoes, every track's chain) would keep running in the background, draining the battery. The next tap wakes it.
    // On a computer a song that is playing keeps playing in another tab; a quiet studio still sleeps.
    const touch = 'ontouchend' in document;
    const hide = () => { if (touch || Tone.getTransport().state !== 'started') this.sleep(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
    window.addEventListener('pagehide', () => this.sleep());
  }

  /** Stops the song, lets go of the device's audio and suspends the sound graph until the next tap. */
  sleep(): void {
    if (!this.started) return;
    const wasPlaying = Tone.getTransport().state === 'started';
    try { this.stop(); } catch { /* nothing playing */ }
    if (wasPlaying) this.endedFns.forEach((fn) => fn());
    try { silentAudio?.pause(); } catch { /* best effort */ }
    try { (Tone.getContext().rawContext as unknown as AudioContext).suspend?.().catch(() => undefined); } catch { /* best effort */ }
  }

  /** One second of A4, for the Lab sound check. Resolves with the loudest output level seen. */
  async testTone(): Promise<{ state: string; peak: number }> {
    await this.start();
    if (!this.master) return { state: Tone.getContext().state, peak: 0 };
    const tone = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.2 }, volume: -6 });
    tone.connect(this.master);
    tone.triggerAttackRelease('A4', 1, Tone.now() + 0.05);
    let peak = 0;
    const started = performance.now();
    await new Promise<void>((done) => {
      const poll = () => {
        peak = Math.max(peak, this.outputLevel());
        if (performance.now() - started < 1300) setTimeout(poll, 30); else done();
      };
      poll();
    });
    setTimeout(() => tone.dispose(), 500);
    return { state: Tone.getContext().state, peak };
  }

  /** A short soft tick so a person knows the sound is on. */
  previewClick(): void {
    if (!this.master) return;
    const blip = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.05 }, volume: -14 });
    blip.connect(this.master);
    blip.triggerAttackRelease('A5', 0.06, Tone.now() + 0.02);
    setTimeout(() => blip.dispose(), 600);
  }

  /** Listen to one track alone (or everything again with null). Mute and solo in the song stay as they are. */
  setFocus(trackId: string | null): void {
    if (this.focusId === trackId) return;
    this.focusId = trackId;
    if (this.song && this.started) this.sync(this.song);
  }

  /** Output level 0..1 for the meter next to Play. */
  outputLevel(): number {
    if (!this.meter) return 0;
    const db = this.meter.getValue() as number;
    return Number.isFinite(db) ? Math.max(0, Math.min(1, (db + 54) / 54)) : 0;
  }

  onStep(fn: (step: number) => void): () => void {
    this.stepListeners.add(fn);
    return () => this.stepListeners.delete(fn);
  }

  get playing(): boolean {
    return Tone.getTransport().state === 'started';
  }

  /** Give the engine the latest song after every change; it adjusts sounds and mix live. */
  setSong(song: Song): void {
    this.song = playedSong(song);
    if (this.started) this.sync(this.song);
  }

  private sync(song: Song): void {
    try {
      const transport = Tone.getTransport();
      transport.bpm.value = song.tempo_bpm;
      transport.swing = song.swing;
      transport.swingSubdivision = '16n';
      this.applyMaster(song);
    } catch (e) { this.problem('master', e); }

    const seen = new Set<string>();
    for (const t of song.tracks) {
      seen.add(t.id);
      try {
        const key = voiceKey(t);
        let ch = this.channels.get(t.id);
        if (ch && ch.voiceKey !== key) {
          // A new instrument on the same track: the desk channel stays, the instrument and its chain cross-fade.
          const item = t.instrument ? findItem(t.instrument) : undefined;
          ch.instrumentKey = t.instrument?.key ?? '';
          ch.voiceKey = key;
          this.buildChain(ch, t, buildVoice(item?.manifest, !t.sound));
        }
        if (!ch) {
          ch = this.createChannel(t);
          this.channels.set(t.id, ch);
        }
        this.applyMix(ch, t);
      } catch (e) { this.problem(t.name, e); }
    }
    for (const [id, ch] of this.channels) {
      if (!seen.has(id)) {
        this.disposeChannel(ch);
        this.channels.delete(id);
      }
    }
  }

  /** The song's desk: glue, master tone, ceiling and the shared room and echo. */
  private applyMaster(song: Song): void {
    if (!this.glue || !this.glueTrim || !this.body || !this.air || !this.master || !this.limiterTrim) return;
    const m = mixOf(song);
    const g = glueSettings(m.glue_model, m.glue);
    // Like the channel compressor, the glue is in the path only while it works.
    if ((g.ratio > 1) !== this.glueOn && this.bus) {
      this.glueOn = g.ratio > 1;
      this.bus.disconnect();
      this.bus.connect(this.glueOn ? this.glue : this.glueTrim);
    }
    this.glue.threshold.value = g.threshold;
    this.glue.ratio.value = g.ratio;
    this.glue.attack.value = g.attack;
    this.glue.release.value = g.release;
    this.glue.knee.value = g.knee;
    this.glueTrim.gain.rampTo(Tone.dbToGain(g.trimDb), 0.05);
    glide(this.body.gain, m.body_db, true);
    glide(this.air.gain, m.air_db, true);
    this.master.threshold.value = m.ceiling_db;
    this.limiterTrim.gain.value = Tone.dbToGain(-0.6 * Math.abs(m.ceiling_db) * (1 - 1 / 20));
    const decay = ROOM_SECONDS[m.room_kind];
    if (this.reverb && decay !== this.roomDecay) { this.roomDecay = decay; this.reverb.decay = decay; }
    this.roomOut?.gain.rampTo(m.room_level, 0.05);
    if (this.delay) {
      this.delay.delayTime.rampTo(echoSeconds(m.echo_time, song.tempo_bpm), 0.05);
      this.delay.feedback.rampTo(m.echo_feedback, 0.05);
    }
    this.echoOut?.gain.rampTo(m.echo_level, 0.05);
  }

  /** How loud the song sounds (LUFS, K-weighted): the last 0.4 s, the last 3 s, and everything since Play. */
  loudness(): { momentary: number; short: number; integrated: number } {
    const none = { momentary: -Infinity, short: -Infinity, integrated: -Infinity };
    if (!this.analyser) return none;
    const data = this.analyser.getValue() as Float32Array;
    let ms = 0;
    for (let i = 0; i < data.length; i++) ms += data[i] * data[i];
    ms /= data.length;
    const t = performance.now();
    this.lufsFrames.push({ t, ms });
    while (this.lufsFrames.length && t - this.lufsFrames[0].t > 3000) this.lufsFrames.shift();
    const avg = (span: number) => {
      const f = this.lufsFrames.filter((x) => t - x.t <= span);
      return f.length ? f.reduce((a, b) => a + b.ms, 0) / f.length : 0;
    };
    // Two equal channels downmixed to one: add back the 3 dB of the second channel.
    const lufs = (v: number) => (v > 1e-10 ? -0.691 + 10 * Math.log10(2 * v) : -Infinity);
    const momentary = lufs(avg(400));
    if (this.playing && momentary > -70) { this.lufsAll.sum += avg(400); this.lufsAll.n++; }
    return { momentary, short: lufs(avg(3000)), integrated: this.lufsAll.n ? lufs(this.lufsAll.sum / this.lufsAll.n) : -Infinity };
  }

  /** Gain reduction in dB of one channel's compressor, and of the master's glue. */
  trackReduction(trackId: string): number { return this.channels.get(trackId)?.strip.comp.reduction ?? 0; }
  glueReduction(): number { return this.glue?.reduction ?? 0; }

  private createChannel(t: Track): TrackChannel {
    const item = t.instrument ? findItem(t.instrument) : undefined;
    const voice = buildVoice(item?.manifest, !t.sound);
    const channel = new Tone.Channel({ volume: 0, pan: 0 });
    const meter = new Tone.Meter({ smoothing: 0.6 });
    const strip = createStrip();
    strip.shaper.connect(channel);
    channel.connect(this.bus!);
    channel.connect(meter);
    channel.connect(strip.room);
    channel.connect(strip.echo);
    strip.room.connect(this.roomIn!);
    strip.echo.connect(this.echoIn!);
    const ch: TrackChannel = { instrumentKey: t.instrument?.key ?? '', voiceKey: voiceKey(t), voice, pedals: [], chainOut: new Tone.Gain(0), chainSig: '', strip, channel, meter };
    ch.chainOut.connect(strip.trim);
    this.buildChain(ch, t);
    return ch;
  }

  /**
   * Wire voice -> saved sound's studio chain -> pedals -> channel for the track's current chains.
   * Unknown pedals (from a newer file) keep their place in the list but pass the sound through.
   */
  private buildChain(ch: TrackChannel, t: Track, voice: Voice = ch.voice): void {
    // A switch never cuts the sound mid-wave (that is the click of a loose cable): the new path fades in over a few
    // milliseconds while the old one fades out, and the old units go once they are silent.
    const oldOut = ch.chainOut;
    const oldPedals = ch.pedals;
    const oldVoice = voice !== ch.voice ? ch.voice : null;
    const slots = [...(t.sound?.chain.slots ?? []), ...t.fx_chain.slots];
    const pedals = slots.map((slot) => ({ key: slot.effect.key, pedal: createPedal(slot.effect.key), on: !slot.bypass }));
    const out = new Tone.Gain(0);
    out.connect(ch.strip.trim);
    let prev: Tone.ToneAudioNode = voice.output;
    // A pedal switched off is left out of the path: it costs nothing, and switching it on rebuilds the chain.
    pedals.forEach(({ pedal }, i) => { if (pedal && !slots[i].bypass) { prev.connect(pedal.input); prev = pedal.output; } });
    prev.connect(out);
    const now = Tone.immediate();
    out.gain.setValueAtTime(0, now);
    out.gain.linearRampToValueAtTime(1, now + FADE);
    oldOut.gain.cancelScheduledValues(now);
    oldOut.gain.setValueAtTime(oldOut.gain.value, now);
    oldOut.gain.linearRampToValueAtTime(0, now + FADE);
    const firstOld = oldPedals.find((x) => x.pedal && x.on)?.pedal;
    window.setTimeout(() => {
      // A new instrument takes the old one away with its chain; the same instrument only leaves its old chain.
      if (oldVoice) oldVoice.dispose();
      else { try { voice.output.disconnect(firstOld ? firstOld.input : oldOut); } catch { /* never joined */ } }
      oldPedals.forEach(({ pedal }) => pedal?.dispose());
      oldOut.dispose();
    }, FADE_MS * 3);
    ch.voice = voice;
    ch.pedals = pedals;
    ch.chainOut = out;
    ch.chainSig = chainSig(t);
  }

  private applyMix(ch: TrackChannel, t: Track): void {
    ch.channel.volume.rampTo(gainToDb(t.gain), 0.05);
    ch.channel.pan.rampTo(t.pan, 0.05);
    const focus = this.focusId !== null && this.song?.tracks.some((x) => x.id === this.focusId) ? this.focusId : null;
    ch.channel.mute = focus ? t.id !== focus : t.muted;
    ch.channel.solo = focus ? false : t.solo;
    if (ch.chainSig !== chainSig(t)) this.buildChain(ch, t);
    [...(t.sound?.chain.slots ?? []), ...t.fx_chain.slots].forEach((slot, i) => ch.pedals[i]?.pedal?.set(slot.params, slot.bypass));
    this.applyStrip(ch, t);
  }

  /** The desk channel, read from the track and shaped by the song's console. */
  private applyStrip(ch: TrackChannel, t: Track): void {
    const s = stripOf(t);
    const c = consoleOf(mixOf(this.song ?? ({} as Song)).console);
    const x = ch.strip;
    glide(x.trim.gain, Tone.dbToGain(s.trim_db));
    const cut = s.hpf_hz > 0 ? s.hpf_hz : 5;
    glide(x.hpf.frequency, cut); glide(x.hpf2.frequency, cut);
    const k = compSettings(c, s.comp);
    if ((k.ratio > 1) !== x.compOn) {
      x.compOn = k.ratio > 1;
      x.hpf2.disconnect();
      x.hpf2.connect(x.compOn ? x.comp : x.compTrim);
    }
    x.comp.threshold.value = k.threshold;
    x.comp.ratio.value = k.ratio;
    x.comp.attack.value = k.attack;
    x.comp.release.value = k.release;
    x.comp.knee.value = k.knee;
    x.compTrim.gain.rampTo(Tone.dbToGain(k.trimDb), 0.05);
    const [low, lmid, hmid, high] = x.eq;
    glide(low.frequency, s.low_hz); glide(low.gain, s.low_db, true);
    glide(lmid.frequency, s.lmid_hz); glide(lmid.gain, c.bands.lmid.hidden ? 0 : s.lmid_db, true); set(lmid.Q, qFor(c, s.lmid_db));
    glide(hmid.frequency, s.hmid_hz); glide(hmid.gain, s.hmid_db, true); set(hmid.Q, qFor(c, s.hmid_db));
    glide(high.frequency, s.high_hz); glide(high.gain, s.high_db, true);
    // Classic shelves dip a little before they rise (and the reverse): a small opposite bump next to each.
    set(x.bumps[0].frequency, Math.min(2000, s.low_hz * 2)); glide(x.bumps[0].gain, c.shelfBump ? -s.low_db / 6 : 0, true);
    set(x.bumps[1].frequency, Math.max(500, s.high_hz / 2)); glide(x.bumps[1].gain, c.shelfBump ? -s.high_db / 6 : 0, true);
    const sig = `${c.drive}:${s.drive.toFixed(3)}`;
    if (sig !== x.driveSig) {
      x.shaper.curve = driveCurve(c.drive, s.drive);
      // Oversampling only matters while the curve bends; flat, the channel passes untouched.
      x.shaper.oversample = s.drive > 0 ? '2x' : 'none';
      x.driveSig = sig;
    }
    glide(x.room.gain, s.send_room);
    glide(x.echo.gain, s.send_echo);
  }

  private disposeChannel(ch: TrackChannel): void {
    // Fade the track out before it goes, so a track taken away never clicks.
    const now = Tone.immediate();
    ch.chainOut.gain.cancelScheduledValues(now);
    ch.chainOut.gain.setValueAtTime(ch.chainOut.gain.value, now);
    ch.chainOut.gain.linearRampToValueAtTime(0, now + FADE);
    window.setTimeout(() => {
      ch.voice.dispose();
      ch.pedals.forEach(({ pedal }) => pedal?.dispose());
      ch.chainOut.dispose();
      disposeStrip(ch.strip);
      ch.channel.dispose();
      ch.meter.dispose();
    }, FADE_MS * 3);
  }

  /** Level 0..1 of one track after its fader, for the mixer. */
  trackLevel(trackId: string): number {
    const m = this.channels.get(trackId)?.meter;
    if (!m) return 0;
    const db = m.getValue() as number;
    return Number.isFinite(db) ? Math.max(0, Math.min(1, (db + 54) / 54)) : 0;
  }

  /** Play one part on repeat (start and length in steps), or the whole song with null. Takes effect at once. */
  setRange(range: { start: number; length: number } | null): void {
    this.range = range && range.length > 0 ? range : null;
  }

  private bounds(song: Song): { start: number; end: number } {
    const total = loopSteps(song);
    if (!this.range) return { start: 0, end: total };
    const start = Math.min(Math.max(0, this.range.start), total - 1);
    return { start, end: Math.min(total, start + this.range.length) };
  }

  /** Move the playhead while playing; the next step played is this one. */
  seek(step: number): void {
    this.nextStep = Math.max(0, step);
  }

  /** Start playing; `fromStep` picks where (inside the part on repeat, or anywhere in the song). */
  async play(fromStep = 0, opts: { once?: boolean } = {}): Promise<boolean> {
    const ok = await this.start();
    if (!this.song) return ok;
    const transport = Tone.getTransport();
    if (this.repeatId !== null) transport.clear(this.repeatId);
    this.nextStep = fromStep;
    this.lufsAll = { sum: 0, n: 0 };
    // Count sixteenths ourselves: swing moves the off-beats in time, so deriving the step from time is fragile.
    let counter = 0;
    let ending = false;
    this.once = !!opts.once;
    this.repeatId = transport.scheduleRepeat((time) => {
      const song = this.song;
      if (!song || ending) return;
      counter++;
      const { start, end } = this.bounds(song);
      let step = this.nextStep;
      // Played once: at the end it stops (what still rings rings out) instead of starting again from the top.
      if (this.once && step >= end && counter > 1) {
        ending = true;
        Tone.getDraw().schedule(() => { this.stop(); this.endedFns.forEach((fn) => fn()); }, time);
        return;
      }
      if (step < start || step >= end) step = start;
      this.nextStep = step + 1;
      this.playStep(song, step, time);
      Tone.getDraw().schedule(() => this.stepListeners.forEach((fn) => fn(step)), time);
    }, '16n', 0);
    transport.position = 0;
    transport.start('+0.05');
    // Some hosts block the clock's background worker without an error; fall back to timers.
    setTimeout(() => {
      const ctx = Tone.getContext();
      if (this.repeatId !== null && counter === 0 && this.running && ctx instanceof Tone.Context && ctx.clockSource === 'worker') {
        ctx.clockSource = 'timeout';
      }
    }, 600);
    return ok;
  }

  /** Play once and stop at the end, instead of starting again; can change while playing. */
  private once = false;
  setOnce(once: boolean): void { this.once = once; }

  /** Playback that reached its end and stopped by itself (played once). */
  private endedFns = new Set<() => void>();
  onEnded(fn: () => void): () => void {
    this.endedFns.add(fn);
    return () => { this.endedFns.delete(fn); };
  }

  stop(): void {
    const transport = Tone.getTransport();
    transport.stop();
    if (this.repeatId !== null) transport.clear(this.repeatId);
    this.repeatId = null;
    Tone.getDraw().cancel(0); // drop playhead moves already queued, or the playhead lingers after Stop
    for (const ch of this.channels.values()) ch.pedals.forEach(({ pedal }) => pedal?.rest?.());
    this.stepListeners.forEach((fn) => fn(-1));
  }

  private secondsFor(ticks: number, song: Song): number {
    return (ticks / PPQ) * (60 / song.tempo_bpm);
  }

  private playStep(song: Song, step: number, time: number): void {
    const stepStart = step * STEP_TICKS;
    if (step % 4 === 0) {
      const beat = 60 / song.tempo_bpm;
      for (const ch of this.channels.values()) ch.pedals.forEach(({ pedal }) => pedal?.onBeat?.(time, beat));
    }
    const key = { tonic: song.key_tonic, mode: song.key_mode };
    for (const t of song.tracks) {
      try {
        const ch = this.channels.get(t.id);
        const clip = t.clips[0];
        if (!ch || !clip) continue;
        if (clip.kind === 'pattern' && ch.voice.kind === 'drums') {
          const p = clip.content as PatternContent;
          for (const row of p.rows) {
            const hit = row.hits.find((h) => h.step === step);
            const name = hit && rowVoice(ch.instrumentKey, row.sound.key);
            if (hit && name) ch.voice.hit(name, time, hit.vel);
          }
        } else if (clip.kind === 'notes' && ch.voice.kind === 'melodic') {
          for (const n of (clip.content as NotesContent).notes) {
            if (n.tick >= stepStart && n.tick < stepStart + STEP_TICKS) {
              const offset = this.secondsFor(n.tick - stepStart, song);
              ch.voice.play(n.midi, this.secondsFor(n.dur, song) * 0.95, time + offset, n.vel, song.tuning_a4_hz);
            }
          }
        } else if (clip.kind === 'chords' && ch.voice.kind === 'melodic') {
          const triads = diatonicTriads(key);
          for (const c of (clip.content as ChordsContent).chords) {
            if (c.tick >= stepStart && c.tick < stepStart + STEP_TICKS && triads[c.degree]) {
              const dur = this.secondsFor(c.dur, song) * 0.98;
              for (const m of chordMidi(triads[c.degree], 52)) ch.voice.play(m, dur, time, 0.6, song.tuning_a4_hz);
            }
          }
        }
      } catch (e) { this.problem(t.name, e); }
    }
  }

  /** Tap a pad or a key: hear it now. */
  async previewNote(trackId: string, midi: number): Promise<void> {
    this.ensure();
    const ch = this.channels.get(trackId);
    // Live playing sounds right away; only the song is planned ahead.
    if (ch?.voice.kind === 'melodic') ch.voice.play(midi, 0.4, Tone.immediate(), 0.8, this.song?.tuning_a4_hz ?? 440);
  }

  async previewDrum(trackId: string, soundKey: string): Promise<void> {
    this.ensure();
    const ch = this.channels.get(trackId);
    const name = ch && rowVoice(ch.instrumentKey, soundKey);
    if (ch?.voice.kind === 'drums' && name) ch.voice.hit(name, Tone.immediate(), 1);
  }

  /** Hear an idea before keeping it: notes (seconds from now) on a melodic track. */
  async previewNotes(trackId: string, items: { midi: number; at: number; dur: number; vel: number }[]): Promise<void> {
    this.ensure();
    const ch = this.channels.get(trackId);
    if (ch?.voice.kind !== 'melodic') return;
    const t0 = Tone.immediate() + 0.03;
    for (const n of items) ch.voice.play(n.midi, n.dur, t0 + n.at, n.vel, this.song?.tuning_a4_hz ?? 440);
  }

  /** Hear a drum idea: sound keys at seconds from now. */
  async previewHits(trackId: string, items: { soundKey: string; at: number; vel: number }[]): Promise<void> {
    this.ensure();
    const ch = this.channels.get(trackId);
    if (ch?.voice.kind !== 'drums') return;
    const t0 = Tone.immediate() + 0.03;
    for (const h of items) {
      const name = rowVoice(ch.instrumentKey, h.soundKey);
      if (name) ch.voice.hit(name, t0 + h.at, h.vel);
    }
  }

  private previews = new Map<string, Voice>();

  /** Hear any instrument from the catalog, even one no track uses yet: a short phrase or a short beat. */
  previewInstrument(instrumentKey: string): void {
    this.ensure();
    if (!this.master) return;
    const voice = this.previewVoice(instrumentKey);
    if (!voice) return;
    const t0 = Tone.immediate() + 0.03;
    const beat = 0.18;
    if (voice.kind === 'drums') {
      const rows = rowsOf(instrumentKey);
      const voiceOf = (i: number) => findByKey(resolveRow(rows, STANDARD_ROWS[i]) ?? rows[i])?.manifest.voice as string;
      [[0, 0], [3, 1], [1, 2], [3, 3], [0, 4], [5, 5], [1, 6], [7, 7]].forEach(([row, at]) => voice!.kind === 'drums' && voice!.hit(voiceOf(row), t0 + at * beat, 0.9));
    } else {
      const root = Math.ceil(lowOf(instrumentKey) / 12) * 12;
      [0, 4, 7, 12].forEach((iv, i) => voice!.kind === 'melodic' && voice!.play(root + iv, beat * 1.6, t0 + i * beat * 1.5, 0.8, this.song?.tuning_a4_hz ?? 440));
    }
  }

  /**
   * The instruments built to be heard outside the song (the idea's picker, the kit builder): the last few are kept
   * ready, older ones go, so trying many sounds never piles instruments up on the speakers.
   */
  private previewVoice(instrumentKey: string): Voice | null {
    if (!this.master) return null;
    let voice = this.previews.get(instrumentKey);
    if (voice) {
      this.previews.delete(instrumentKey);
    } else {
      voice = buildVoice(findByKey(instrumentKey)?.manifest);
      voice.output.connect(this.master);
    }
    this.previews.set(instrumentKey, voice);
    while (this.previews.size > PREVIEWS_KEPT) {
      const [oldest, v] = this.previews.entries().next().value as [string, Voice];
      this.previews.delete(oldest);
      window.setTimeout(() => v.dispose(), 2500); // whatever it still plays rings out first
    }
    return voice;
  }

  private groove: Voice | null = null;
  private grooveToken = 0;
  /** The groove's path: instrument -> fade -> units -> fade -> speakers, so it starts, swaps and stops without clicks. */
  private grooveIn: Tone.Gain | null = null;
  private groovePedals: (Pedal | null)[] = [];
  private grooveOut: Tone.Gain | null = null;
  private grooveKeys: string[] = [];

  /** Units for a preview, from the fade after the instrument to a fresh output fade on the speakers. */
  private wirePreview(chain: FxChain | undefined, fadeIn: boolean): { pedals: (Pedal | null)[]; out: Tone.Gain } {
    const pedals = (chain?.slots ?? []).map((slot) => {
      const pedal = createPedal(slot.effect.key);
      pedal?.set(slot.params, slot.bypass);
      return pedal;
    });
    const out = new Tone.Gain(fadeIn ? 0 : 1);
    out.connect(this.master!);
    let prev: Tone.ToneAudioNode = this.grooveIn!;
    pedals.forEach((pedal, i) => { if (pedal && !chain?.slots[i].bypass) { prev.connect(pedal.input); prev = pedal.output; } });
    prev.connect(out);
    if (fadeIn) { const now = Tone.immediate(); out.gain.setValueAtTime(0, now); out.gain.linearRampToValueAtTime(1, now + FADE); }
    return { pedals, out };
  }

  /**
   * Hear a Colección sound in context: its groove at its tempo. Waits for recorded kits to load (only the first
   * time). Resolves with how long it plays, in seconds; 0 when it was stopped or could not load.
   */
  async previewGroove(instrumentKey: string, groove: Groove, tempo: number, chain?: FxChain, repeats = 1, phrase?: Phrase): Promise<number> {
    this.ensure();
    if (!this.master) return 0;
    this.stopPreview();
    const token = ++this.grooveToken;
    if (!(await loadInstrument(findByKey(instrumentKey)?.manifest))) return 0;
    if (token !== this.grooveToken) return 0;
    // A chain being shaped (or a saved sound) replaces the instrument's own gear, as it does on a track.
    const voice = buildVoice(findByKey(instrumentKey)?.manifest, !chain);
    this.groove = voice;
    this.grooveIn = new Tone.Gain(1);
    voice.output.connect(this.grooveIn);
    const wired = this.wirePreview(chain, false);
    this.groovePedals = wired.pedals;
    this.grooveOut = wired.out;
    this.grooveKeys = (chain?.slots ?? []).map(slotSig);
    const step = 60 / tempo / 4;
    const t0 = Tone.immediate() + 0.1;
    if (voice.kind === 'melodic') {
      if (!phrase) return 0;
      const span = phrase.bars * 16;
      for (let r = 0; r < repeats; r++) {
        for (const n of phrase.notes) {
          // Strummed chords: each string a few milliseconds after the last, as a pick crosses them.
          n.midi.forEach((m, i) => voice.play(m, n.len * step * 0.95, t0 + (r * span + n.at) * step + i * 0.006, n.vel ?? 0.85, this.song?.tuning_a4_hz ?? 440));
        }
      }
      return repeats * span * step + 0.8;
    }
    const span = groove.bars * 16;
    const swing = Math.max(0, (groove.swing ?? 0.5) - 0.5) * 2 * step;
    // A rhythm names standard pieces; each plays on this kit's piece in the same place, as a song's beat does
    // (kick on the low conga or the bass drum), so any kit can play any sample rhythm.
    const kitVoice = (name: string) => {
      const piece = VOICE_PIECE.get(name);
      return (piece && rowVoice(instrumentKey, piece)) ?? name;
    };
    for (let r = 0; r < repeats; r++) {
      for (const [name, steps] of Object.entries(groove.steps)) {
        const played = kitVoice(name);
        for (const s of steps ?? []) {
          const soft = groove.soft?.[name]?.includes(s);
          voice.hit(played, t0 + (r * span + s) * step + (s % 2 === 1 ? swing : 0), soft ? 0.42 : s % 4 === 0 ? 0.95 : 0.8);
        }
      }
    }
    return repeats * span * step + 0.6;
  }

  /** Follow the knobs while a groove plays through a chain being shaped. Same pedals in the same order only. */
  updatePreviewChain(chain: FxChain): void {
    if (this.groovePedals.length !== chain.slots.length || chain.slots.some((x, i) => this.grooveKeys[i] !== slotSig(x))) {
      this.rewirePreview(chain);
      return;
    }
    chain.slots.forEach((slot, i) => this.groovePedals[i]?.set(slot.params, slot.bypass));
  }

  /**
   * Swap the chain a groove plays through without stopping it: listen up to one stage, add or take out a unit,
   * compare with the original. The new chain fades in as the old one fades out.
   */
  rewirePreview(chain: FxChain): void {
    if (!this.groove || !this.grooveIn || !this.grooveOut || !this.master) return;
    const oldPedals = this.groovePedals;
    const oldOut = this.grooveOut;
    const input = this.grooveIn;
    const wired = this.wirePreview(chain, true);
    const now = Tone.immediate();
    oldOut.gain.cancelScheduledValues(now);
    oldOut.gain.setValueAtTime(oldOut.gain.value, now);
    oldOut.gain.linearRampToValueAtTime(0, now + FADE);
    const oldKeys = this.grooveKeys;
    const firstOld = oldPedals.find((p, i) => p && !oldKeys[i]?.endsWith(':off'));
    window.setTimeout(() => {
      try { input.disconnect(firstOld ? firstOld.input : oldOut); } catch { /* already gone */ }
      oldPedals.forEach((p) => p?.dispose());
      oldOut.dispose();
    }, FADE_MS * 3);
    this.groovePedals = wired.pedals;
    this.grooveOut = wired.out;
    this.grooveKeys = chain.slots.map(slotSig);
  }

  /** Hear one piece of a kit (the snare, the china). */
  async previewPiece(instrumentKey: string, voiceName: string): Promise<void> {
    this.ensure();
    const voice = this.previewVoice(instrumentKey);
    if (voice?.kind !== 'drums') return;
    const asked = performance.now();
    await loadInstrument(findByKey(instrumentKey)?.manifest);
    if (performance.now() - asked < 1500) voice.hit(voiceName, Tone.immediate() + 0.01, 0.9);
  }

  /** Stop a groove being previewed: the notes fade at once, the echoes and rooms die away, then everything goes. */
  stopPreview(): void {
    this.grooveToken++;
    const v = this.groove;
    const input = this.grooveIn;
    const out = this.grooveOut;
    const pedals = this.groovePedals;
    this.groove = null;
    this.grooveIn = null;
    this.grooveOut = null;
    this.groovePedals = [];
    this.grooveKeys = [];
    if (!v) return;
    const now = Tone.immediate();
    if (input) { input.gain.cancelScheduledValues(now); input.gain.setValueAtTime(input.gain.value, now); input.gain.linearRampToValueAtTime(0, now + FADE); }
    if (out) { out.gain.cancelScheduledValues(now); out.gain.setValueAtTime(out.gain.value, now); out.gain.linearRampToValueAtTime(0, now + 0.3); }
    window.setTimeout(() => {
      v.dispose();
      input?.dispose();
      pedals.forEach((p) => p?.dispose());
      out?.dispose();
    }, 360);
  }

  /** Free the instruments built only to be previewed. */
  disposePreviews(): void {
    for (const v of this.previews.values()) v.dispose();
    this.previews.clear();
  }

  /** What the device reports about its audio timing, for the Phase 0 latency spike. */
  latencyInfo(): { state: string; session: string; sampleRate: number; baseLatencyMs: number | null; outputLatencyMs: number | null; lookAheadMs: number } {
    const raw = Tone.getContext().rawContext as AudioContext;
    return {
      state: Tone.getContext().state,
      session: (navigator as AudioSessionNav).audioSession?.type ?? 'not available',
      sampleRate: raw.sampleRate,
      baseLatencyMs: typeof raw.baseLatency === 'number' ? raw.baseLatency * 1000 : null,
      outputLatencyMs: typeof raw.outputLatency === 'number' ? raw.outputLatency * 1000 : null,
      lookAheadMs: Tone.getContext().lookAhead * 1000,
    };
  }
}

/** The song as it sounds: each track with the sound chosen for it, the musician's or the producer's. */
/** Every drum piece by the voice that plays it: 'kick' → sound.kick, 'congaLow' → sound.conga-low. */
const VOICE_PIECE = new Map<string, string>(
  [...DRUM_VOICES, ...FULL_KIT_VOICES, ...ORCH_VOICES, ...LATIN_VOICES].map((i) => [String(i.manifest.voice), i.key]),
);

function playedSong(song: Song): Song {
  if (!song.tracks.some((t) => t.producer && t.voice_from === 'producer')) return song;
  return {
    ...song,
    tracks: song.tracks.map((t) => (t.producer && t.voice_from === 'producer'
      ? { ...t, instrument: t.producer.instrument, sound: t.producer.sound }
      : t)),
  };
}

/** What decides a track's voice: its instrument, and whether a saved sound replaces the instrument's own gear. */
const voiceKey = (t: Track): string => `${t.instrument?.key ?? ''}${t.sound ? '+sound' : ''}`;

/** What decides the wiring of a track: its saved sound's chain, then its pedals. */
/** A unit as the wiring sees it: which effect, and whether it is in the path. */
const slotSig = (x: { effect: { key: string }; bypass: boolean }) => `${x.effect.key}${x.bypass ? ':off' : ''}`;

const chainSig = (t: Track): string =>
  [...(t.sound?.chain.slots ?? []).map((x) => `s:${x.effect.key}${x.bypass ? ':off' : ''}`), ...t.fx_chain.slots.map((x) => `${x.effect.key}${x.bypass ? ':off' : ''}`)].join('|');

type Manifest = { type?: string; kit?: string; voice?: string; set?: string; mono?: boolean; chain?: ChainSpec; trimDb?: number } | undefined;

/** The recorded kit behind a Colección drum instrument, if it is one. */
const sampledSpec = (m: Record<string, unknown> | undefined) => {
  const x = m as Manifest;
  return x?.type === 'drumkit' && x.kit === 'sampled' && x.set ? SAMPLED_KITS[x.set] : undefined;
};

/** Load the recordings an instrument needs (none for synthesized ones). False when they could not load. */
export async function loadInstrument(manifest: Record<string, unknown> | undefined): Promise<boolean> {
  const m = (manifest ?? {}) as NonNullable<Manifest>;
  const kit = sampledSpec(manifest);
  if (kit) return (await loadKit(kit)) > 0;
  if (m.type === 'sampler' && m.set && SAMPLERS[m.set]) return (await loadSampler(SAMPLERS[m.set])) > 0;
  return true;
}

/**
 * An instrument's own gear (a Colección guitar's amp and cabinet): pedals after the voice, part of the instrument.
 * The track's saved sound and its pedals come after.
 */
function withGear(voice: Voice, chain: ChainSpec | undefined, trimDb: number): Voice {
  const pedals = (chain ?? []).map(([key, on, params]) => {
    const pedal = createPedal(key);
    pedal?.set({ ...defaultFxParams(key), ...params }, !on);
    return pedal;
  });
  if (!pedals.some(Boolean) && !trimDb) return voice;
  let prev: Tone.ToneAudioNode = voice.output;
  for (const p of pedals) if (p) { prev.connect(p.input); prev = p.output; }
  const out = new Tone.Gain(Tone.dbToGain(trimDb));
  prev.connect(out);
  const inner = voice.dispose.bind(voice);
  return { ...voice, output: out, dispose() { inner(); pedals.forEach((p) => p?.dispose()); out.dispose(); } } as Voice;
}

/**
 * The voice that plays an instrument: a recorded kit, a recorded guitar or bass, or a synthesized voice, each
 * through its own gear. A saved sound brings its own chain, which replaces that gear (ownGear false).
 */
export function buildVoice(manifest: Record<string, unknown> | undefined, ownGear = true): Voice {
  const m = (manifest ?? {}) as NonNullable<Manifest>;
  const spec = sampledSpec(manifest);
  if (spec) return createSampledKit(spec);
  if (m.type === 'drumkit') return createDrumKit(m.kit ?? 'boomBap');
  const voice = m.type === 'sampler' && m.set && SAMPLERS[m.set]
    ? createSampler(SAMPLERS[m.set], { mono: m.mono, release: m.mono ? 0.06 : 0.14 })
    : createMelodicVoice(m.voice ?? 'keysEp');
  return withGear(voice, ownGear ? m.chain : undefined, m.trimDb ?? 0);
}

export const engine = new StudioEngine();
// For checking a device from the browser's console: __musicStudio.engine.clockRate(), .restart().
if (typeof window !== 'undefined') (window as unknown as { __musicStudio?: unknown }).__musicStudio = { engine, Tone };

/**
 * iPhone and iPad mute web audio in silent mode unless the page asks for playback.
 * Safari 16.4+ has navigator.audioSession; older versions switch when an <audio> element plays.
 */
let silentAudio: HTMLAudioElement | null = null;
function unlockMediaSession(): void {
  if (typeof navigator === 'undefined') return;
  const session = (navigator as AudioSessionNav).audioSession;
  if (session) {
    try { session.type = 'playback'; } catch { /* not allowed here */ }
  }
  // Belt and braces on iPhone and iPad: an <audio> element playing also switches the device to playback.
  if (!/iP(hone|ad|od)|Macintosh/.test(navigator.userAgent) || !('ontouchend' in document)) return;
  try {
    if (!silentAudio) {
      silentAudio = new Audio(silentWavDataUri());
      silentAudio.setAttribute('playsinline', '');
      silentAudio.loop = true;
    }
    silentAudio.play().catch(() => undefined);
  } catch { /* best effort */ }
}

/** A tenth of a second of silence as a WAV data URI (8 kHz, 8-bit mono). */
function silentWavDataUri(): string {
  const n = 800;
  const bytes = new Uint8Array(44 + n);
  const v = new DataView(bytes.buffer);
  const text = (o: number, str: string) => { for (let i = 0; i < str.length; i++) bytes[o + i] = str.charCodeAt(i); };
  text(0, 'RIFF'); v.setUint32(4, 36 + n, true); text(8, 'WAVE');
  text(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  text(36, 'data'); v.setUint32(40, n, true);
  bytes.fill(128, 44);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return `data:audio/wav;base64,${btoa(bin)}`;
}

/** The old iPhone unlock: play one silent sample inside the tap. */
function kickWebKit(): void {
  try {
    const raw = Tone.getContext().rawContext as unknown as AudioContext;
    const src = raw.createBufferSource();
    src.buffer = raw.createBuffer(1, 1, raw.sampleRate);
    src.connect(raw.destination);
    src.start(0);
  } catch { /* best effort */ }
}
