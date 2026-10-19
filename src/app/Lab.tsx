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
import { ENTRIES } from '../packs/collection';
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

  // The audio clock, live: if it stops while the audio says it runs, the connection to the speakers is stuck.
  const [clock, setClock] = useState<{ state: string; rate: number } | null>(null);
  useEffect(() => {
    if (!info) return;
    let alive = true;
    const loop = async () => {
      while (alive) {
        const r = await engine.clockRate(1000);
        if (alive) setClock(r);
      }
    };
    loop();
    return () => { alive = false; };
  }, [info]);
  const freshBeep = async () => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const c = new Ctx();
      await c.resume();
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.frequency.value = 660;
      g.gain.setValueAtTime(0.2, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
      osc.connect(g);
      g.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.32);
      setTimeout(() => { c.close().catch(() => undefined); }, 800);
    } catch (e) { showToast(String(e)); }
  };
  const rebuild = async () => {
    await engine.restart();
    setInfo(engine.latencyInfo());
    engine.previewClick();
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
              <tr><td className="muted">{t('labClock', lang)}</td><td className={`mono${clock && clock.state === 'running' && clock.rate < 0.5 ? ' warn' : ''}`}>
                {clock ? (clock.state === 'running' && clock.rate < 0.5 ? t('labClockStuck', lang) : `${clock.state} · ${t('labClockMoving', lang, { rate: clock.rate.toFixed(2) })}`) : '…'}
              </td></tr>
            </tbody></table>
          )}
          {info && <button type="button" className="btn" onClick={testTone}><Icon name="play" size={18} /> {t('playTestTone', lang)}</button>}
          {info && (
            <div className="row wrap" style={{ gap: 6 }}>
              <button type="button" className="btn small-btn" onClick={() => engine.directBeep()}>{t('labDirectBeep', lang)}</button>
              <button type="button" className="btn small-btn" onClick={freshBeep}>{t('labFreshBeep', lang)}</button>
              <button type="button" className="btn small-btn" onClick={rebuild}><Icon name="reset" size={16} /> {t('labRestart', lang)}</button>
            </div>
          )}
          {info && <p className="small muted" style={{ margin: 0 }}>{t('labBeepHint', lang)}</p>}
          {check && <p className="small" role="status" style={{ margin: 0 }}>{check}</p>}
          <p className="small" style={{ margin: 0 }}>
            {t('storageLabel', lang)} {storage?.persisted ? <span className="ok">{t('storageKeptShort', lang)}</span> : <span className="warn">{t('storageMayClearShort', lang)}</span>}
          </p>
          <p className="small muted mono" style={{ margin: 0, wordBreak: 'break-word' }}>{navigator.userAgent}</p>
        </Section>
        <LoadTest lang={lang} />
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

/* ---------------------------------------------------------------- load test */

/**
 * Many sounds in a row, the way a person browses them: whether the sound card ran dry (where the browser tells),
 * whether the page froze longer than the audio plans ahead (notes land late and click), and whether anything kept
 * sounding afterwards. Run it on each device.
 */
function LoadTest({ lang }: { lang: Lang }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [result, setResult] = useState<{ sounds: number; stalls: number; worst: number; underruns: number | null; leftover: boolean; leftDb: number; clock: number } | null>(null);
  const picks = ENTRIES.filter((_, i) => i % 3 === 0).slice(0, 20);
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const run = async () => {
    await engine.start();
    setRunning(true); setResult(null); setDone(0);
    const u0 = engine.underruns();
    let stalls = 0;
    let worst = 0;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const late = now - last - 50;
      if (late > 100) stalls++;
      worst = Math.max(worst, late);
      last = now;
    }, 50);
    for (let i = 0; i < picks.length; i++) {
      const e = picks[i];
      void engine.previewGroove(e.instrument, e.groove, e.tempo, undefined, 1, e.phrase);
      setDone(i + 1);
      await wait(1500);
    }
    engine.stopPreview();
    window.clearInterval(id);
    await wait(2000);
    const u1 = engine.underruns();
    const level = engine.outputLevel();
    const leftover = level > 0.05;
    // How loud what is left is: a faint tail near -50 dB is not the same as a sound that never stopped.
    const leftDb = Math.round(level * 54 - 54);
    // Below 1x the audio cannot render as fast as it plays: the sound cuts and crackles.
    const clock = (await engine.clockRate(1000)).rate;
    setResult({ sounds: picks.length, stalls, worst: Math.max(0, Math.round(worst)), underruns: u0 === null || u1 === null ? null : u1 - u0, leftover, leftDb, clock });
    setRunning(false);
  };
  const clean = result && !result.stalls && !result.leftover && !result.underruns && result.clock > 0.97;
  return (
    <Section title={t('labLoadTitle', lang)}>
      <p className="small muted" style={{ margin: 0 }}>{t('labLoadHint', lang, { n: picks.length })}</p>
      <button type="button" className="btn" disabled={running} onClick={run}>
        <Icon name="play" size={18} /> {running ? t('labLoadRunning', lang, { n: done, of: picks.length }) : t('labLoadRun', lang)}
      </button>
      {result && (
        <table className="small" style={{ borderSpacing: '0 6px' }}><tbody>
          <tr><td className="muted">{t('labLoadSounds', lang)}</td><td className="mono">{result.sounds}</td></tr>
          <tr><td className="muted">{t('labLoadUnderruns', lang)}</td><td className="mono">{result.underruns === null ? t('labLoadNotTold', lang) : result.underruns}</td></tr>
          <tr><td className="muted">{t('labLoadStalls', lang)}</td><td className="mono">{result.stalls} · {t('labLoadWorst', lang, { ms: result.worst })}</td></tr>
          <tr><td className="muted">{t('labLoadClock', lang)}</td><td className="mono">{result.clock.toFixed(2)}×</td></tr>
          <tr><td className="muted">{t('labLoadLeftover', lang)}</td><td className="mono">{t(result.leftover ? 'yes' : 'no', lang)}{result.leftover ? ` (${result.leftDb} dB)` : ''}</td></tr>
        </tbody></table>
      )}
      {result && <p className="small" role="status" style={{ margin: 0 }}>{t(clean ? 'labLoadClean' : 'labLoadTrouble', lang)}</p>}
    </Section>
  );
}

/* ---------------------------------------------------------------- tap test */

function TapTest({ lang }: { lang: Lang }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ mean: number; spread: number; n: number } | { wrong: 'many' | 'few'; n: number } | null>(null);
  const [beat, setBeat] = useState(0);
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
    setBeat(0);
    setRunning(true);
    // The pad lights with each click and counts them, so it is clear the taps go along with the clicks.
    let frame = 0;
    const follow = () => {
      const n = beats.current.filter((t) => ctx.currentTime >= t).length;
      setBeat(n);
      if (n < beats.current.length) frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    window.setTimeout(() => {
      cancelAnimationFrame(frame);
      click.dispose();
      setRunning(false);
      if (taps.current.length > beats.current.length * 1.5) { setResult({ wrong: 'many', n: taps.current.length }); return; }
      const out = (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
      const offsets = taps.current.map((tap) => {
        const nearest = beats.current.reduce((a, b) => (Math.abs(b + out - tap) < Math.abs(a + out - tap) ? b : a));
        return (tap - (nearest + out)) * 1000;
      }).filter((o) => Math.abs(o) < 250);
      if (offsets.length < 6) { setResult({ wrong: 'few', n: offsets.length }); return; }
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
        <button type="button" className={`pad grow${running && beat > 0 ? ' tap-beat' : ''}`} key={running ? beat : 'idle'} style={{ minHeight: 90 }} onPointerDown={(e) => { e.preventDefault(); tap(); }}>
          {running ? (beat > 0 ? t('tapCount', lang, { n: beat }) : t('tapNow', lang)) : t('pad', lang)}
        </button>
      </div>
      {result && 'wrong' in result && <p className="warn" style={{ margin: 0 }}>{t(result.wrong === 'many' ? 'tapTooMany' : 'tapTooFew', lang, { n: result.n })}</p>}
      {result && !('wrong' in result) && <p style={{ margin: 0 }}>{t('tapResult', lang, { mean: result.mean.toFixed(0), spread: result.spread.toFixed(0), n: result.n })}
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
