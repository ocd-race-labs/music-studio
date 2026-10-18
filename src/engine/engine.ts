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
  hpf: Tone.Filter;
  comp: Tone.Compressor;
  compTrim: Tone.Gain;
  eq: Tone.Filter[];
  bumps: Tone.Filter[];
  shaper: Tone.WaveShaper;
  driveSig: string;
  /** The compressor is in the path only while it works: off, it adds no look-ahead delay to live playing. */
  compOn: boolean;
  room: Tone.Gain;
  echo: Tone.Gain;
}

function createStrip(): StripNodes {
  const trim = new Tone.Gain(1);
  const hpf = new Tone.Filter({ type: 'highpass', frequency: 5, rolloff: -24 });
  const comp = new Tone.Compressor({ threshold: 0, ratio: 1, attack: 0.01, release: 0.3, knee: 6 });
  const compTrim = new Tone.Gain(1);
  const eq = [
    new Tone.Filter({ type: 'lowshelf', frequency: 100, gain: 0 }),
    new Tone.Filter({ type: 'peaking', frequency: 400, gain: 0, Q: 0.9 }),
    new Tone.Filter({ type: 'peaking', frequency: 2500, gain: 0, Q: 0.9 }),
    new Tone.Filter({ type: 'highshelf', frequency: 10000, gain: 0 }),
  ];
  const bumps = [new Tone.Filter({ type: 'peaking', frequency: 200, gain: 0, Q: 1 }), new Tone.Filter({ type: 'peaking', frequency: 5000, gain: 0, Q: 1 })];
  const shaper = new Tone.WaveShaper(driveCurve('clean', 0), 2048);
  shaper.oversample = 'none';
  trim.chain(hpf, compTrim, ...eq, ...bumps, shaper);
  comp.connect(compTrim);
  return { trim, hpf, comp, compTrim, eq, bumps, shaper, driveSig: 'clean:0', compOn: false, room: new Tone.Gain(0), echo: new Tone.Gain(0) };
}
const disposeStrip = (x: StripNodes) => [x.trim, x.hpf, x.comp, x.compTrim, ...x.eq, ...x.bumps, x.shaper, x.room, x.echo].forEach((n) => n.dispose());

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
  pedals: { key: string; pedal: Pedal | null }[];
  chainSig: string;
  strip: StripNodes;
  channel: Tone.Channel;
  meter: Tone.Meter;
}

type AudioSessionNav = Navigator & { audioSession?: { type: string } };


const gainToDb = (g: number) => (g <= 0.0001 ? -Infinity : 20 * Math.log10(g));

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
  private body: Tone.Filter | null = null;
  private air: Tone.Filter | null = null;
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
        Tone.setContext(new Tone.Context({ latencyHint: 'interactive', lookAhead: 0.05 }), true);
      } catch { /* keep the existing context */ }
    }
    const resumed = Tone.start().catch(() => undefined);
    kickWebKit();
    this.bindUnlock();
    if (!this.started) {
      Tone.getContext().lookAhead = 0.05;
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
      const kShelf = new Tone.Filter({ type: 'highshelf', frequency: 1682, gain: 4 });
      const kCut = new Tone.Filter({ type: 'highpass', frequency: 38, Q: 0.5 });
      clip.chain(kShelf, kCut, this.analyser);
      this.bus = new Tone.Gain(1);
      this.glue = new Tone.Compressor({ threshold: 0, ratio: 1, attack: 0.03, release: 0.3, knee: 0 });
      this.glueTrim = new Tone.Gain(1);
      this.body = new Tone.Filter({ type: 'lowshelf', frequency: 100, gain: 0 });
      this.air = new Tone.Filter({ type: 'highshelf', frequency: 10000, gain: 0 });
      this.bus.connect(this.glueTrim);
      this.glue.chain(this.glueTrim, this.body, this.air, this.master);
      // Shared returns: a room and an echo, each kept out of the lows and the very top so they never muddy the mix.
      this.roomIn = new Tone.Gain(1);
      this.reverb = new Tone.Reverb({ decay: 1.8, preDelay: 0.02, wet: 1 });
      this.roomDecay = 1.8;
      this.roomOut = new Tone.Gain(0.8);
      this.roomIn.chain(this.reverb, new Tone.Filter({ type: 'highpass', frequency: 150 }), new Tone.Filter({ type: 'lowpass', frequency: 8000 }), this.roomOut, this.bus);
      this.echoIn = new Tone.Gain(1);
      this.delay = new Tone.FeedbackDelay({ delayTime: 0.5, feedback: 0.3, wet: 1, maxDelay: 4 });
      this.echoOut = new Tone.Gain(0.7);
      this.echoIn.chain(this.delay, new Tone.Filter({ type: 'lowpass', frequency: 4500 }), new Tone.Filter({ type: 'highpass', frequency: 150 }), this.echoOut, this.bus);
      this.started = true;
      // The song's sounds are built once the audio runs, and a sound that fails to build never silences the rest.
      if (Tone.getContext().state === 'running') { if (this.song) this.sync(this.song); }
      else resumed.then(() => { if (this.song) this.sync(this.song); });
    }
    return resumed;
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
          this.disposeChannel(ch);
          ch = undefined;
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
    this.body.gain.linearRampTo(m.body_db, 0.05);
    this.air.gain.linearRampTo(m.air_db, 0.05);
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
    const ch: TrackChannel = { instrumentKey: t.instrument?.key ?? '', voiceKey: voiceKey(t), voice, pedals: [], chainSig: '', strip, channel, meter };
    this.buildChain(ch, t);
    return ch;
  }

  /**
   * Wire voice -> saved sound's studio chain -> pedals -> channel for the track's current chains.
   * Unknown pedals (from a newer file) keep their place in the list but pass the sound through.
   */
  private buildChain(ch: TrackChannel, t: Track): void {
    ch.voice.output.disconnect();
    ch.pedals.forEach(({ pedal }) => pedal?.dispose());
    const slots = [...(t.sound?.chain.slots ?? []), ...t.fx_chain.slots];
    ch.pedals = slots.map((slot) => ({ key: slot.effect.key, pedal: createPedal(slot.effect.key) }));
    let prev: Tone.ToneAudioNode = ch.voice.output;
    for (const { pedal } of ch.pedals) if (pedal) { prev.connect(pedal.input); prev = pedal.output; }
    prev.connect(ch.strip.trim);
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
    x.trim.gain.rampTo(Tone.dbToGain(s.trim_db), 0.05);
    x.hpf.frequency.rampTo(s.hpf_hz > 0 ? s.hpf_hz : 5, 0.05);
    const k = compSettings(c, s.comp);
    if ((k.ratio > 1) !== x.compOn) {
      x.compOn = k.ratio > 1;
      x.hpf.disconnect();
      x.hpf.connect(x.compOn ? x.comp : x.compTrim);
    }
    x.comp.threshold.value = k.threshold;
    x.comp.ratio.value = k.ratio;
    x.comp.attack.value = k.attack;
    x.comp.release.value = k.release;
    x.comp.knee.value = k.knee;
    x.compTrim.gain.rampTo(Tone.dbToGain(k.trimDb), 0.05);
    const [low, lmid, hmid, high] = x.eq;
    low.frequency.rampTo(s.low_hz, 0.05); low.gain.linearRampTo(s.low_db, 0.05);
    lmid.frequency.rampTo(s.lmid_hz, 0.05); lmid.gain.linearRampTo(c.bands.lmid.hidden ? 0 : s.lmid_db, 0.05); lmid.Q.value = qFor(c, s.lmid_db);
    hmid.frequency.rampTo(s.hmid_hz, 0.05); hmid.gain.linearRampTo(s.hmid_db, 0.05); hmid.Q.value = qFor(c, s.hmid_db);
    high.frequency.rampTo(s.high_hz, 0.05); high.gain.linearRampTo(s.high_db, 0.05);
    // Classic shelves dip a little before they rise (and the reverse): a small opposite bump next to each.
    x.bumps[0].frequency.value = Math.min(2000, s.low_hz * 2); x.bumps[0].gain.linearRampTo(c.shelfBump ? -s.low_db / 6 : 0, 0.05);
    x.bumps[1].frequency.value = Math.max(500, s.high_hz / 2); x.bumps[1].gain.linearRampTo(c.shelfBump ? -s.high_db / 6 : 0, 0.05);
    const sig = `${c.drive}:${s.drive.toFixed(3)}`;
    if (sig !== x.driveSig) {
      x.shaper.curve = driveCurve(c.drive, s.drive);
      // Oversampling only matters while the curve bends; flat, the channel passes untouched.
      x.shaper.oversample = s.drive > 0 ? '2x' : 'none';
      x.driveSig = sig;
    }
    x.room.gain.rampTo(s.send_room, 0.05);
    x.echo.gain.rampTo(s.send_echo, 0.05);
  }

  private disposeChannel(ch: TrackChannel): void {
    ch.voice.dispose();
    ch.pedals.forEach(({ pedal }) => pedal?.dispose());
    disposeStrip(ch.strip);
    ch.channel.dispose();
    ch.meter.dispose();
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
  async play(fromStep = 0): Promise<boolean> {
    const ok = await this.start();
    if (!this.song) return ok;
    const transport = Tone.getTransport();
    if (this.repeatId !== null) transport.clear(this.repeatId);
    this.nextStep = fromStep;
    this.lufsAll = { sum: 0, n: 0 };
    // Count sixteenths ourselves: swing moves the off-beats in time, so deriving the step from time is fragile.
    let counter = 0;
    this.repeatId = transport.scheduleRepeat((time) => {
      const song = this.song;
      if (!song) return;
      counter++;
      const { start, end } = this.bounds(song);
      let step = this.nextStep;
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
    if (ch?.voice.kind === 'melodic') ch.voice.play(midi, 0.4, Tone.now(), 0.8, this.song?.tuning_a4_hz ?? 440);
  }

  async previewDrum(trackId: string, soundKey: string): Promise<void> {
    this.ensure();
    const ch = this.channels.get(trackId);
    const name = ch && rowVoice(ch.instrumentKey, soundKey);
    if (ch?.voice.kind === 'drums' && name) ch.voice.hit(name, Tone.now(), 1);
  }

  /** Hear an idea before keeping it: notes (seconds from now) on a melodic track. */
  async previewNotes(trackId: string, items: { midi: number; at: number; dur: number; vel: number }[]): Promise<void> {
    this.ensure();
    const ch = this.channels.get(trackId);
    if (ch?.voice.kind !== 'melodic') return;
    const t0 = Tone.now() + 0.05;
    for (const n of items) ch.voice.play(n.midi, n.dur, t0 + n.at, n.vel, this.song?.tuning_a4_hz ?? 440);
  }

  /** Hear a drum idea: sound keys at seconds from now. */
  async previewHits(trackId: string, items: { soundKey: string; at: number; vel: number }[]): Promise<void> {
    this.ensure();
    const ch = this.channels.get(trackId);
    if (ch?.voice.kind !== 'drums') return;
    const t0 = Tone.now() + 0.05;
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
    const t0 = Tone.now() + 0.05;
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

  /** The instrument built to be heard outside the song (Colección, kit builder), made once and kept. */
  private previewVoice(instrumentKey: string): Voice | null {
    if (!this.master) return null;
    let voice = this.previews.get(instrumentKey);
    if (!voice) {
      voice = buildVoice(findByKey(instrumentKey)?.manifest);
      voice.output.connect(this.master);
      this.previews.set(instrumentKey, voice);
    }
    return voice;
  }

  private groove: Voice | null = null;
  private grooveToken = 0;

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
    // Through a studio chain when one is being shaped (Colección rack), straight to the speakers otherwise.
    this.groovePedals = (chain?.slots ?? []).map((slot) => {
      const pedal = createPedal(slot.effect.key);
      pedal?.set(slot.params, slot.bypass);
      return pedal;
    });
    this.grooveKeys = (chain?.slots ?? []).map((x) => x.effect.key);
    let prev: Tone.ToneAudioNode = voice.output;
    for (const pedal of this.groovePedals) if (pedal) { prev.connect(pedal.input); prev = pedal.output; }
    prev.connect(this.master);
    const step = 60 / tempo / 4;
    const t0 = Tone.now() + 0.08;
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

  private groovePedals: (Pedal | null)[] = [];

  /** Follow the knobs while a groove plays through a chain being shaped. Same pedals in the same order only. */
  updatePreviewChain(chain: FxChain): void {
    if (this.groovePedals.length !== chain.slots.length || chain.slots.some((x, i) => this.grooveKeys[i] !== x.effect.key)) {
      this.rewirePreview(chain);
      return;
    }
    chain.slots.forEach((slot, i) => this.groovePedals[i]?.set(slot.params, slot.bypass));
  }

  private grooveKeys: string[] = [];

  /**
   * Swap the chain a groove plays through without stopping it: listen up to one stage, add or take out a unit,
   * compare with the original. The old units ring out for a moment before they go.
   */
  rewirePreview(chain: FxChain): void {
    const voice = this.groove;
    if (!voice || !this.master) return;
    const old = this.groovePedals;
    const pedals = chain.slots.map((slot) => {
      const pedal = createPedal(slot.effect.key);
      pedal?.set(slot.params, slot.bypass);
      return pedal;
    });
    voice.output.disconnect();
    let prev: Tone.ToneAudioNode = voice.output;
    for (const pedal of pedals) if (pedal) { prev.connect(pedal.input); prev = pedal.output; }
    prev.connect(this.master);
    this.groovePedals = pedals;
    this.grooveKeys = chain.slots.map((x) => x.effect.key);
    setTimeout(() => old.forEach((p) => p?.dispose()), 400);
  }

  /** Hear one piece of a kit (the snare, the china). */
  async previewPiece(instrumentKey: string, voiceName: string): Promise<void> {
    this.ensure();
    const voice = this.previewVoice(instrumentKey);
    if (voice?.kind !== 'drums') return;
    const asked = performance.now();
    await loadInstrument(findByKey(instrumentKey)?.manifest);
    if (performance.now() - asked < 1500) voice.hit(voiceName, Tone.now() + 0.01, 0.9);
  }

  /** Stop a groove being previewed. */
  stopPreview(): void {
    this.grooveToken++;
    const v = this.groove;
    const pedals = this.groovePedals;
    this.groove = null;
    this.groovePedals = [];
    this.grooveKeys = [];
    v?.dispose();
    // Let the last echoes ring out before the chain goes away.
    setTimeout(() => pedals.forEach((p) => p?.dispose()), 400);
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
const chainSig = (t: Track): string =>
  [...(t.sound?.chain.slots ?? []).map((x) => `s:${x.effect.key}`), ...t.fx_chain.slots.map((x) => x.effect.key)].join('|');

type Manifest = { type?: string; kit?: string; voice?: string; set?: string; mono?: boolean; chain?: ChainSpec; trimDb?: number } | undefined;

/** The recorded kit behind a Colección drum instrument, if it is one. */
const sampledSpec = (m: Record<string, unknown> | undefined) => {
  const x = m as Manifest;
  return x?.type === 'drumkit' && x.kit === 'sampled' && x.set ? SAMPLED_KITS[x.set] : undefined;
};

/** Load the recordings an instrument needs (none for synthesized ones). False when they could not load. */
async function loadInstrument(manifest: Record<string, unknown> | undefined): Promise<boolean> {
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
function buildVoice(manifest: Record<string, unknown> | undefined, ownGear = true): Voice {
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
