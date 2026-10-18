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
import { t } from './i18n';
import type { Lang } from '../domain/types';
import { downloadBlob, Icon, pickFile, useToast } from './ui';

type Info = ReturnType<typeof engine.latencyInfo>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="card stack" style={{ flex: '1 1 340px' }}><h2 style={{ fontSize: 18 }}>{title}</h2>{children}</section>;
}

export default function Lab({ store, lang, onHome }: { store: SongStore; lang: Lang; onHome: () => void }) {
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
    setCheck(t('testTonePlaying', lang));
    const r = await engine.testTone();
    setInfo(engine.latencyInfo());
    setCheck(r.peak > 0.05
      ? t('testToneOk', lang, { n: Math.round(r.peak * 100) })
      : t('testToneSilent', lang, { state: r.state }));
  };

  return (
    <main className="home" style={{ gap: 24 }}>
      <header className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 12 }}>
          <button type="button" className="btn" onClick={onHome}><Icon name="home" size={18} /> {t('home', lang)}</button>
          <h1 className="display" style={{ fontSize: 30 }}>{t('labTitle', lang)}</h1>
        </div>
        <span className="muted small">{t('labIntro', lang)}</span>
      </header>
      <div className="cards" style={{ alignItems: 'flex-start' }}>
        <Section title={t('labAudio', lang)}>
          {!info ? <button type="button" className="btn primary" onClick={startAudio}><Icon name="play" /> {t('startAudio', lang)}</button> : (
            <table className="small" style={{ borderSpacing: '0 6px' }}><tbody>
              <tr><td className="muted">{t('audio', lang)}</td><td className="mono">{info.state}</td></tr>
              <tr><td className="muted">{t('audioSession', lang)}</td><td className="mono">{info.session}</td></tr>
              <tr><td className="muted">{t('sampleRate', lang)}</td><td className="mono">{info.sampleRate} Hz</td></tr>
              <tr><td className="muted">{t('baseLatency', lang)}</td><td className="mono">{info.baseLatencyMs !== null ? `${info.baseLatencyMs.toFixed(1)} ms` : t('notReported', lang)}</td></tr>
              <tr><td className="muted">{t('outputLatency', lang)}</td><td className="mono">{info.outputLatencyMs !== null ? `${info.outputLatencyMs.toFixed(1)} ms` : t('notReported', lang)}</td></tr>
              <tr><td className="muted">{t('lookAhead', lang)}</td><td className="mono">{info.lookAheadMs.toFixed(0)} ms</td></tr>
              <tr><td className="muted">{t('audioModeTitle', lang)}</td><td className="mono">{t(info.mode === 'stable' ? 'audioStable' : 'audioFast', lang)}</td></tr>
              <tr><td className="muted">{t('audioClock', lang)}</td><td className="mono">{info.clock}</td></tr>
            </tbody></table>
          )}
          {info && <button type="button" className="btn" onClick={testTone}><Icon name="play" size={18} /> {t('playTestTone', lang)}</button>}
          {check && <p className="small" role="status" style={{ margin: 0 }}>{check}</p>}
          <p className="small" style={{ margin: 0 }}>
            {t('storageLabel', lang)} {storage?.persisted ? <span className="ok">{t('storageKeptShort', lang)}</span> : <span className="warn">{t('storageMayClearShort', lang)}</span>}
          </p>
          <p className="small muted mono" style={{ margin: 0, wordBreak: 'break-word' }}>{navigator.userAgent}</p>
        </Section>
        <TapTest lang={lang} />
        <MidiTest lang={lang} />
        <RecordTest store={store} lang={lang} showToast={showToast} />
        <VoiceTest lang={lang} />
        <IdeaFileTest lang={lang} showToast={showToast} />
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

/* ---------------------------------------------------------------- tap test */

function TapTest({ lang }: { lang: Lang }) {
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
    <Section title={t('labTap', lang)}>
      <p className="small muted" style={{ margin: 0 }}>{t('labTapHint', lang)}</p>
      <div className="row">
        <button type="button" className="btn" onClick={run} disabled={running}>{t('start', lang)}</button>
        <button type="button" className="pad grow" style={{ minHeight: 90 }} onPointerDown={(e) => { e.preventDefault(); tap(); }}>{running ? t('tapNow', lang) : t('pad', lang)}</button>
      </div>
      {result && <p style={{ margin: 0 }}>{t('tapResult', lang, { mean: result.mean.toFixed(0), spread: result.spread.toFixed(0), n: result.n })}
        {' '}{Math.abs(result.mean) < 40 ? <span className="ok">{t('feelsTight', lang)}</span> : <span className="warn">{t('noticeable', lang)}</span>}</p>}
    </Section>
  );
}

/* ---------------------------------------------------------------- MIDI */

function MidiTest({ lang }: { lang: Lang }) {
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
          setLast(t('midiNote', lang, { note: d[1], vel: d[2], device: inp.name ?? 'MIDI' }));
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
    <Section title={t('labMidi', lang)}>
      {supported ? (
        <>
          <button type="button" className="btn" onClick={connect}>{t('connectMidi', lang)}</button>
          <p className="small" style={{ margin: 0 }}>{inputs.length ? t('midiInputs', lang, { list: inputs.join(', ') }) : t('midiPlugIn', lang)}</p>
          {last && <p className="ok small" style={{ margin: 0 }}>{last}</p>}
        </>
      ) : <p className="warn small" style={{ margin: 0 }}>{t('midiNone', lang)}</p>}
    </Section>
  );
}

/* ---------------------------------------------------------------- recording */

function RecordTest({ store, lang, showToast }: { store: SongStore; lang: Lang; showToast: (m: string) => void }) {
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
      setError(t('micUnavailable', lang, { error: (e as Error).message }));
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
    showToast(t('takeSaved', lang));
  };

  return (
    <Section title={t('labRecord', lang)}>
      <label className="row small"><input type="checkbox" checked={monitor} onChange={(e) => setMonitor(e.target.checked)} /> {t('monitorHint', lang)}</label>
      <div className="row">
        {!rec ? <button type="button" className="btn primary" onClick={start}><Icon name="mic" size={18} /> {t('recordMic', lang)}</button>
          : <button type="button" className="btn primary" onClick={stop}><Icon name="stop" size={18} /> {t('stop', lang)}</button>}
        <div className="meter grow" aria-label={t('inputLevel', lang)}><div style={{ width: `${Math.min(100, level * 100)}%` }} /></div>
      </div>
      {error && <p className="warn small" style={{ margin: 0 }}>{error}</p>}
      {take && url && (
        <div className="stack" style={{ gap: 8 }}>
          <audio controls src={url} style={{ width: '100%' }} />
          <span className="small muted">{(take.durationMs / 1000).toFixed(1)} s · {(take.wav.size / 1024).toFixed(0)} KB WAV · {take.sampleRate} Hz · {t('peak', lang)} {(20 * Math.log10(Math.max(take.peak, 1e-6))).toFixed(1)} dB</span>
          <div className="row">
            <button type="button" className="btn" onClick={keep}>{t('keepTake', lang)}</button>
            <button type="button" className="btn ghost" onClick={() => downloadBlob(`take-${Date.now()}.wav`, take.wav)}><Icon name="download" size={18} /> {t('download', lang)}</button>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ---------------------------------------------------------------- guide voice */

function VoiceTest({ lang: uiLang }: { lang: Lang }) {
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
    <Section title={t('labVoice', uiLang)}>
      {!supported ? <p className="warn small">{t('noVoices', uiLang)}</p> : (
        <>
          <div className="row wrap">
            <div className="seg"><button type="button" aria-pressed={lang === 'es'} onClick={() => setLang('es')}>Español</button><button type="button" aria-pressed={lang === 'en'} onClick={() => { setLang('en'); setText('Dancing in the morning light'); }}>English</button></div>
            <select className="field grow" value={voice} onChange={(e) => setVoice(e.target.value)} aria-label={t('voice', uiLang)}>
              {list.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
            </select>
          </div>
          <span className="small muted">{t('voicesCount', uiLang, { n: list.length, language: t(lang === 'es' ? 'langSpanish' : 'langEnglish', uiLang) })}</span>
          <textarea className="field" value={text} onChange={(e) => setText(e.target.value)} aria-label={t('lyricLine', uiLang)} />
          <label className="stack" style={{ gap: 2 }}><span className="lbl">{t('speed', uiLang, { n: rate.toFixed(1) })}</span>
            <input type="range" min={0.6} max={1.6} step={0.1} value={rate} onChange={(e) => setRate(Number(e.target.value))} /></label>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => { window.speechSynthesis.cancel(); speak(text); }}>{t('speak', uiLang)}</button>
            <button type="button" className="btn" onClick={rap}>{t('rapOnBeat', uiLang)}</button>
          </div>
          <p className="small muted" style={{ margin: 0 }}>{t('voiceNote', uiLang)}</p>
        </>
      )}
    </Section>
  );
}

/* ---------------------------------------------------------------- idea files */

function IdeaFileTest({ lang, showToast }: { lang: Lang; showToast: (m: string) => void }) {
  const [result, setResult] = useState<string[] | null>(null);
  const check = async () => {
    const f = await pickFile('.json,application/json');
    if (!f) return;
    const parsed = parseIdeasFile(await f.text(), 'lab', null);
    setResult(parsed.ok ? parsed.value.map((i) => t('fileOk', lang, { kind: i.kind, title: i.title })) : parsed.errors.map((e) => t('fileProblem', lang, { error: e })));
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(CLAUDE_INSTRUCTIONS); showToast(t('formatCopied', lang)); } catch { showToast(t('copyFailed', lang)); }
  };
  return (
    <Section title={t('labIdeas', lang)}>
      <p className="small muted" style={{ margin: 0 }}>{t('labIdeasHint', lang)}</p>
      <div className="row wrap"><button type="button" className="btn" onClick={copy}>{t('copyFormatShort', lang)}</button><button type="button" className="btn ghost" onClick={check}><Icon name="upload" size={18} /> {t('checkFile', lang)}</button></div>
      <pre className="small mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto', background: 'var(--raised)', padding: 10, borderRadius: 10, margin: 0 }}>{CLAUDE_INSTRUCTIONS}</pre>
      {result && <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{result.map((r, i) => <li key={i} className={r.startsWith('OK') ? 'ok' : 'warn'}>{r}</li>)}</ul>}
    </Section>
  );
}
