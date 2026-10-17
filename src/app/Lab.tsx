// Phase 0 spikes, on the real devices: audio timing, tap latency, MIDI, recording, guide voice, idea files.

import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { engine } from '../engine/engine';
import { startRecording } from '../engine/recorder';
import type { ActiveRecording, Take } from '../engine/recorder';
import { parseIdeasFile } from '../domain/files';
import { newId } from '../domain/factory';
import { requestPersistence } from '../store/store';
import type { SongStore } from '../store/store';
import { CLAUDE_INSTRUCTIONS } from './panels';
import { downloadBlob, Icon, pickFile, useToast } from './ui';

type Info = ReturnType<typeof engine.latencyInfo>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card stack" style={{ flex: '1 1 340px' }}><h2 style={{ fontSize: 18 }}>{title}</h2>{children}</section>;
}

export default function Lab({ store, onHome }: { store: SongStore; onHome: () => void }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [storage, setStorage] = useState<{ persisted: boolean; usage?: number; quota?: number } | null>(null);
  const [toast, showToast] = useToast();

  useEffect(() => { requestPersistence().then(setStorage).catch(() => undefined); }, []);

  const [check, setCheck] = useState<string | null>(null);

  const startAudio = async () => {
    await engine.start();
    setInfo(engine.latencyInfo());
  };

  const testTone = async () => {
    setCheck('Playing A4 for one second…');
    const r = await engine.testTone();
    setInfo(engine.latencyInfo());
    setCheck(r.peak > 0.05
      ? `The app made sound (level ${Math.round(r.peak * 100)}%). If you heard nothing, check the device volume, silent mode and output.`
      : `The app made no sound (audio ${r.state}). Tap the button again; if it repeats, tell Claude this line.`);
  };

  return (
    <main className="home" style={{ gap: 24 }}>
      <header className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 12 }}>
          <button type="button" className="btn" onClick={onHome}><Icon name="home" size={18} /> Home</button>
          <h1 className="display" style={{ fontSize: 30 }}>Lab: device tests</h1>
        </div>
        <span className="muted small">Phase 0 spikes. Run them on the laptop (Chrome) and the iPad (Safari).</span>
      </header>
      <div className="cards" style={{ alignItems: 'flex-start' }}>
        <Section title="1. Device and audio timing">
          {!info ? <button type="button" className="btn primary" onClick={startAudio}><Icon name="play" /> Start audio</button> : (
            <table className="small" style={{ borderSpacing: '0 6px' }}><tbody>
              <tr><td className="muted">Audio</td><td className="mono">{info.state}</td></tr>
              <tr><td className="muted">Audio session</td><td className="mono">{info.session}</td></tr>
              <tr><td className="muted">Sample rate</td><td className="mono">{info.sampleRate} Hz</td></tr>
              <tr><td className="muted">Base latency</td><td className="mono">{info.baseLatencyMs?.toFixed(1) ?? 'not reported'} ms</td></tr>
              <tr><td className="muted">Output latency</td><td className="mono">{info.outputLatencyMs?.toFixed(1) ?? 'not reported'} ms</td></tr>
              <tr><td className="muted">Scheduling look-ahead</td><td className="mono">{info.lookAheadMs.toFixed(0)} ms</td></tr>
            </tbody></table>
          )}
          {info && <button type="button" className="btn" onClick={testTone}><Icon name="play" size={18} /> Play test tone</button>}
          {check && <p className="small" role="status" style={{ margin: 0 }}>{check}</p>}
          <p className="small" style={{ margin: 0 }}>
            Storage: {storage?.persisted ? <span className="ok">kept by the browser</span> : <span className="warn">may be cleared; add to Home Screen on the iPad</span>}
          </p>
          <p className="small muted mono" style={{ margin: 0, wordBreak: 'break-word' }}>{navigator.userAgent}</p>
        </Section>
        <TapTest />
        <MidiTest />
        <RecordTest store={store} showToast={showToast} />
        <VoiceTest />
        <IdeaFileTest showToast={showToast} />
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

/* ---------------------------------------------------------------- tap test */

function TapTest() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ mean: number; spread: number; n: number } | null>(null);
  const beats = useRef<number[]>([]);
  const taps = useRef<number[]>([]);

  const run = async () => {
    await engine.start();
    const ctx = Tone.getContext().rawContext as AudioContext;
    const click = new Tone.MembraneSynth({ envelope: { attack: 0.001, decay: 0.08, sustain: 0 }, volume: -6 }).toDestination();
    const beat = 60 / 90;
    const t0 = ctx.currentTime + 0.6;
    beats.current = Array.from({ length: 12 }, (_, i) => t0 + i * beat);
    beats.current.forEach((t, i) => click.triggerAttackRelease(i % 4 === 0 ? 'C5' : 'C4', '32n', t));
    taps.current = [];
    setResult(null);
    setRunning(true);
    window.setTimeout(() => {
      click.dispose();
      setRunning(false);
      const out = (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
      const offsets = taps.current.map((tap) => {
        const nearest = beats.current.reduce((a, b) => (Math.abs(b + out - tap) < Math.abs(a + out - tap) ? b : a));
        return (tap - (nearest + out)) * 1000;
      }).filter((o) => Math.abs(o) < 250);
      if (!offsets.length) return;
      const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length;
      const spread = Math.sqrt(offsets.reduce((a, b) => a + (b - mean) ** 2, 0) / offsets.length);
      setResult({ mean, spread, n: offsets.length });
    }, (12 * beat + 1.2) * 1000);
  };

  const tap = () => {
    const ctx = Tone.getContext().rawContext as AudioContext;
    taps.current.push(ctx.currentTime);
  };

  return (
    <Section title="2. Tap along (latency feel)">
      <p className="small muted" style={{ margin: 0 }}>Press start, then tap the big pad on every click, twelve times. Positive means you hear the click late or tap late.</p>
      <div className="row">
        <button type="button" className="btn" onClick={run} disabled={running}>Start</button>
        <button type="button" className="pad grow" style={{ minHeight: 90 }} onPointerDown={(e) => { e.preventDefault(); tap(); }}>{running ? 'Tap!' : 'Pad'}</button>
      </div>
      {result && <p style={{ margin: 0 }}>Average offset <strong className="mono">{result.mean.toFixed(0)} ms</strong>, spread <span className="mono">{result.spread.toFixed(0)} ms</span> over {result.n} taps.
        {' '}{Math.abs(result.mean) < 40 ? <span className="ok">Feels tight.</span> : <span className="warn">Noticeable; try headphones or the laptop.</span>}</p>}
    </Section>
  );
}

/* ---------------------------------------------------------------- MIDI */

function MidiTest() {
  const supported = typeof navigator.requestMIDIAccess === 'function';
  const [inputs, setInputs] = useState<string[]>([]);
  const [last, setLast] = useState<string>('');
  const connect = async () => {
    const access = await navigator.requestMIDIAccess();
    const names: string[] = [];
    access.inputs.forEach((inp) => {
      names.push(inp.name ?? 'MIDI input');
      inp.onmidimessage = (e: MIDIMessageEvent) => {
        const d = e.data;
        if (d && (d[0] & 0xf0) === 0x90 && d[2] > 0) {
          setLast(`Note ${d[1]} velocity ${d[2]} from ${inp.name ?? 'device'}`);
          engine.start().then(() => {
            const s = new Tone.Synth().toDestination();
            s.triggerAttackRelease(Tone.Frequency(d[1], 'midi').toFrequency(), '8n');
            window.setTimeout(() => s.dispose(), 800);
          });
        }
      };
    });
    setInputs(names);
  };
  return (
    <Section title="3. MIDI keyboard or e-drums">
      {supported ? (
        <>
          <button type="button" className="btn" onClick={connect}>Connect MIDI</button>
          <p className="small" style={{ margin: 0 }}>{inputs.length ? `Inputs: ${inputs.join(', ')}` : 'Plug in the device, then connect.'}</p>
          {last && <p className="ok small" style={{ margin: 0 }}>{last}</p>}
        </>
      ) : <p className="warn small" style={{ margin: 0 }}>This browser has no MIDI support (expected on the iPad). Use the laptop in Chrome.</p>}
    </Section>
  );
}

/* ---------------------------------------------------------------- recording */

function RecordTest({ store, showToast }: { store: SongStore; showToast: (m: string) => void }) {
  const [rec, setRec] = useState<ActiveRecording | null>(null);
  const [level, setLevel] = useState(0);
  const [take, setTake] = useState<Take | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [monitor, setMonitor] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rec) return;
    const id = window.setInterval(() => setLevel(rec.level()), 80);
    return () => window.clearInterval(id);
  }, [rec]);

  const start = async () => {
    setError(null);
    try {
      setRec(await startRecording(monitor));
    } catch (e) {
      setError(`Microphone not available: ${(e as Error).message}`);
    }
  };
  const stop = async () => {
    if (!rec) return;
    const tk = await rec.stop();
    setRec(null);
    setLevel(0);
    setTake(tk);
    if (url) URL.revokeObjectURL(url);
    setUrl(URL.createObjectURL(tk.wav));
  };
  const keep = async () => {
    if (!take) return;
    const id = newId();
    await store.saveRecording({
      id, profile_id: 'lab', song_id: null, storage_path: `local/${id}.wav`, mime_type: 'audio/wav', sample_rate: take.sampleRate,
      channels: 1, duration_ms: take.durationMs, bytes: take.wav.size, source: 'mic', origin: 'person', created_at: new Date().toISOString(),
    }, take.wav);
    showToast('Take saved in this browser');
  };

  return (
    <Section title="4. Record (one format for Chrome and Safari)">
      <label className="row small"><input type="checkbox" checked={monitor} onChange={(e) => setMonitor(e.target.checked)} /> Hear yourself while recording (use headphones)</label>
      <div className="row">
        {!rec ? <button type="button" className="btn primary" onClick={start}><Icon name="mic" size={18} /> Record</button>
          : <button type="button" className="btn primary" onClick={stop}><Icon name="stop" size={18} /> Stop</button>}
        <div className="meter grow" aria-label="Input level"><div style={{ width: `${Math.min(100, level * 100)}%` }} /></div>
      </div>
      {error && <p className="warn small" style={{ margin: 0 }}>{error}</p>}
      {take && url && (
        <div className="stack" style={{ gap: 8 }}>
          <audio controls src={url} style={{ width: '100%' }} />
          <span className="small muted">{(take.durationMs / 1000).toFixed(1)} s · {(take.wav.size / 1024).toFixed(0)} KB WAV · {take.sampleRate} Hz · peak {(20 * Math.log10(Math.max(take.peak, 1e-6))).toFixed(1)} dB</span>
          <div className="row">
            <button type="button" className="btn" onClick={keep}>Keep take</button>
            <button type="button" className="btn ghost" onClick={() => downloadBlob(`take-${Date.now()}.wav`, take.wav)}><Icon name="download" size={18} /> Download</button>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ---------------------------------------------------------------- guide voice */

function VoiceTest() {
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState('');
  const [text, setText] = useState('Bailo con la luz de la mañana');
  const [rate, setRate] = useState(1);
  const supported = typeof window.speechSynthesis !== 'undefined';

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [supported]);

  const list = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
  const speak = (words: string, r = rate) => {
    const u = new SpeechSynthesisUtterance(words);
    const v = list.find((x) => x.name === voice) ?? list[0];
    if (v) u.voice = v;
    u.lang = v?.lang ?? (lang === 'es' ? 'es-ES' : 'en-US');
    u.rate = r;
    window.speechSynthesis.speak(u);
  };
  const rap = () => {
    window.speechSynthesis.cancel();
    const words = text.split(/\s+/).filter(Boolean);
    const beat = (60 / 90) * 1000 / 2;
    words.forEach((w, i) => window.setTimeout(() => speak(w, 1.3), i * beat));
  };

  return (
    <Section title="5. Guide voice (free, in the browser)">
      {!supported ? <p className="warn small">This browser has no speech voices.</p> : (
        <>
          <div className="row wrap">
            <div className="seg"><button type="button" aria-pressed={lang === 'es'} onClick={() => setLang('es')}>Español</button><button type="button" aria-pressed={lang === 'en'} onClick={() => { setLang('en'); setText('Dancing in the morning light'); }}>English</button></div>
            <select className="field grow" value={voice} onChange={(e) => setVoice(e.target.value)} aria-label="Voice">
              {list.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
            </select>
          </div>
          <span className="small muted">{list.length} {lang === 'es' ? 'Spanish' : 'English'} voices on this device</span>
          <textarea className="field" value={text} onChange={(e) => setText(e.target.value)} aria-label="Lyric line" />
          <label className="stack" style={{ gap: 2 }}><span className="lbl">Speed {rate.toFixed(1)}</span>
            <input type="range" min={0.6} max={1.6} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} /></label>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => { window.speechSynthesis.cancel(); speak(text); }}>Speak</button>
            <button type="button" className="btn" onClick={rap}>Rap on the beat (90 BPM)</button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>Test result to note: timing on the beat, and that this voice plays beside the music but can't be recorded or mixed yet.</p>
        </>
      )}
    </Section>
  );
}

/* ---------------------------------------------------------------- idea files */

function IdeaFileTest({ showToast }: { showToast: (m: string) => void }) {
  const [result, setResult] = useState<string[] | null>(null);
  const check = async () => {
    const f = await pickFile('.json,application/json');
    if (!f) return;
    const parsed = parseIdeasFile(await f.text(), 'lab', null);
    setResult(parsed.ok ? parsed.value.map((i) => `OK: ${i.kind} “${i.title}”`) : parsed.errors.map((e) => `Problem: ${e}`));
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(CLAUDE_INSTRUCTIONS); showToast('Format copied for Claude'); } catch { showToast('Copy failed; select the text instead'); }
  };
  return (
    <Section title="6. Idea files from Claude">
      <p className="small muted" style={{ margin: 0 }}>Paste this format into your Claude project with a request, save Claude's answer as a .json file, then check it here or import it in the studio's ideas tray.</p>
      <div className="row"><button type="button" className="btn" onClick={copy}>Copy the format</button><button type="button" className="btn ghost" onClick={check}><Icon name="upload" size={18} /> Check a file</button></div>
      <pre className="small mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto', background: 'var(--raised)', padding: 10, borderRadius: 10, margin: 0 }}>{CLAUDE_INSTRUCTIONS}</pre>
      {result && <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{result.map((r, i) => <li key={i} className={r.startsWith('OK') ? 'ok' : 'warn'}>{r}</li>)}</ul>}
    </Section>
  );
}
