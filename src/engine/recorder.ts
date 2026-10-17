// Recording through the app's own audio path, so Chrome and Safari save the same format.
// The microphone feeds an AudioWorklet that hands us raw samples; we write a WAV file.

import * as Tone from 'tone';
import { encodeWav } from './wav';

const WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
`;

let workletReady: Promise<void> | null = null;

async function ensureWorklet(ctx: AudioContext): Promise<void> {
  if (!workletReady) {
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    workletReady = ctx.audioWorklet.addModule(url);
  }
  return workletReady;
}

export interface Take {
  wav: Blob;
  sampleRate: number;
  durationMs: number;
  peak: number;
}

export interface ActiveRecording {
  level(): number;
  stop(): Promise<Take>;
}

/** Start recording from the microphone. Processing is turned off so instruments sound natural. */
export async function startRecording(monitor = false): Promise<ActiveRecording> {
  await Tone.start();
  const ctx = Tone.getContext().rawContext as AudioContext;
  await ensureWorklet(ctx);
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const source = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'pcm-capture');
  const chunks: Float32Array[] = [];
  let lastPeak = 0;
  node.port.onmessage = (e: MessageEvent<Float32Array>) => {
    chunks.push(e.data);
    let p = 0;
    for (let i = 0; i < e.data.length; i++) p = Math.max(p, Math.abs(e.data[i]));
    lastPeak = p;
  };
  source.connect(node);
  // The worklet must reach the output graph to keep running; send it through a silent gain.
  const silent = ctx.createGain();
  silent.gain.value = 0;
  node.connect(silent).connect(ctx.destination);
  if (monitor) source.connect(ctx.destination);

  return {
    level: () => lastPeak,
    async stop() {
      source.disconnect();
      node.disconnect();
      silent.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      const length = chunks.reduce((n, c) => n + c.length, 0);
      const samples = new Float32Array(length);
      let off = 0;
      let peak = 0;
      for (const c of chunks) {
        samples.set(c, off);
        off += c.length;
      }
      for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
      return { wav: encodeWav(samples, ctx.sampleRate), sampleRate: ctx.sampleRate, durationMs: Math.round((length / ctx.sampleRate) * 1000), peak };
    },
  };
}
