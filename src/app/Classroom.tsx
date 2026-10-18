import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Lang, Profile } from '../domain/types';
import { ask, SUGGESTIONS } from '../classroom/assistant';
import type { ReplyKind } from '../classroom/assistant';
import { clock, cueAt, cuesFor, durationOf, hasVideo, LESSONS, lessonById } from '../classroom/lessons';
import type { Lesson, LessonId } from '../classroom/lessons';
import { canReadAloud, hush, speak, unlockVoice } from '../classroom/speech';
import { t } from './i18n';
import type { Mode } from './prefs';
import { Icon, LangToggle, ModeSwitch } from './ui';

const READ_KEY = 'ms.classroom.readAloud';
const readPref = (): boolean => { try { return localStorage.getItem(READ_KEY) === '1'; } catch { return false; } };

type Tab = 'lessons' | 'ask';

export default function Classroom({ profile, lang, onLang, mode, onToggleMode, onStudio }: {
  profile: Profile;
  lang: Lang;
  onLang: (l: Lang) => void;
  mode: Mode;
  onToggleMode: () => void;
  onStudio: () => void;
}) {
  const [tab, setTab] = useState<Tab>('lessons');
  const [open, setOpen] = useState<LessonId | null>(null);
  const [readAloud, setReadAloudState] = useState(readPref);
  const setReadAloud = (on: boolean) => {
    setReadAloudState(on);
    try { localStorage.setItem(READ_KEY, on ? '1' : '0'); } catch { /* lasts this visit */ }
    if (!on) hush();
  };
  useEffect(() => () => hush(), []);

  const openLesson = (id: LessonId) => { hush(); setTab('lessons'); setOpen(id); window.scrollTo({ top: 0 }); };

  return (
    <main className="classroom" onClickCapture={unlockVoice}>
      <header className="cl-head">
        <button type="button" className="btn" onClick={() => { hush(); onStudio(); }}><Icon name="back" size={18} /> {t('clBackStudio', lang)}</button>
        <div className="cl-brand">
          <span className="cl-badge" aria-hidden="true"><Icon name="classroom" size={26} /></span>
          <div className="stack" style={{ gap: 0 }}>
            <span className="small muted">{profile.name}</span>
            <h1 className="display">Music Studio Classroom</h1>
          </div>
        </div>
        <div className="row">
          <LangToggle lang={lang} onLang={onLang} />
          <ModeSwitch mode={mode} onToggle={onToggleMode} lang={lang} />
        </div>
      </header>

      <div className="seg cl-tabs" role="tablist" aria-label="Classroom">
        <button type="button" role="tab" aria-selected={tab === 'lessons'} aria-pressed={tab === 'lessons'} onClick={() => setTab('lessons')}><Icon name="play" size={14} /> {t('clLessons', lang)}</button>
        <button type="button" role="tab" aria-selected={tab === 'ask'} aria-pressed={tab === 'ask'} onClick={() => { hush(); setTab('ask'); }}><Icon name="chat" size={16} /> {t('clAsk', lang)}</button>
      </div>

      {tab === 'lessons' && !open && <LessonGrid lang={lang} onOpen={openLesson} />}
      {tab === 'lessons' && open && (
        <LessonPlayer key={open} lesson={lessonById(open)!} lang={lang} readAloud={readAloud} onReadAloud={setReadAloud}
          onBack={() => { hush(); setOpen(null); }} onOpen={openLesson} />
      )}
      {tab === 'ask' && <AskClave lang={lang} onLesson={openLesson} />}
    </main>
  );
}

function LessonGrid({ lang, onOpen }: { lang: Lang; onOpen: (id: LessonId) => void }) {
  return (
    <section className="stack" style={{ gap: 14 }}>
      <p className="muted cl-intro">{t('clLessonsIntro', lang)}</p>
      <div className="cl-grid">
        {LESSONS.map((l, i) => {
          const ready = hasVideo(l.id);
          return (
            <button key={l.id} type="button" className="cl-card" onClick={() => onOpen(l.id)} disabled={!ready}>
              <div className="cl-poster">
                {ready ? <img src={`classroom/${l.id}.jpg`} alt="" loading="lazy" /> : <span className="small muted">{t('clSoon', lang)}</span>}
                <span className="cl-num mono">{i + 1}</span>
                {ready && <span className="cl-dur mono">{clock(durationOf(l.id))}</span>}
                {ready && <span className="cl-playmark" aria-hidden="true"><Icon name="play" size={22} /></span>}
              </div>
              <div className="stack" style={{ gap: 4, padding: '12px 14px 14px' }}>
                <strong className="cl-title">{l.title[lang]}</strong>
                <span className="small muted">{l.blurb[lang]}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function LessonPlayer({ lesson, lang, readAloud, onReadAloud, onBack, onOpen }: {
  lesson: Lesson;
  lang: Lang;
  readAloud: boolean;
  onReadAloud: (on: boolean) => void;
  onBack: () => void;
  onOpen: (id: LessonId) => void;
}) {
  const cues = cuesFor(lesson.id);
  const video = useRef<HTMLVideoElement>(null);
  const [at, setAt] = useState(-1);
  const last = useRef(-1);
  const waiting = useRef(false); // paused by us while a caption is read aloud
  const [ended, setEnded] = useState(false);
  const readRef = useRef(readAloud);
  useEffect(() => { readRef.current = readAloud; }, [readAloud]);
  const list = useRef<HTMLOListElement>(null);
  const index = LESSONS.findIndex((l) => l.id === lesson.id);
  const next = LESSONS[index + 1];

  const reading = useRef(0); // which spoken caption is current; an older one finishing must not restart the video
  const [voice, setVoice] = useState<'idle' | 'reading'>('idle');
  const [trouble, setTrouble] = useState(false); // the device did not speak: silent mode or no voice
  const readCue = useCallback((i: number) => {
    const v = video.current;
    if (!v || i < 0) return;
    const token = ++reading.current;
    // Paused by us; on iPhone the voice starting would pause it anyway, and that must not count as her pause.
    waiting.current = true;
    v.pause();
    setVoice('reading');
    speak(cues[i][lang], lang, {
      onStart: () => setTrouble(false),
      onEnd: (how) => {
        if (token !== reading.current) return;
        setVoice('idle');
        if (how === 'failed') setTrouble(true);
        if (!waiting.current) return;
        waiting.current = false;
        v.play().catch(() => undefined);
      },
    });
  }, [cues, lang]);
  const quiet = () => { reading.current++; hush(); setVoice('idle'); };

  const onTime = () => {
    const v = video.current;
    if (!v) return;
    const i = cueAt(cues, v.currentTime);
    if (i === last.current) return;
    last.current = i;
    setAt(i);
    if (readRef.current && !v.paused && i >= 0) readCue(i);
  };

  // Keep the caption being shown in view in the list.
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`[data-i="${at}"]`);
    if (el && list.current) list.current.scrollTop = el.offsetTop - list.current.offsetTop - 8;
  }, [at]);

  const seek = (i: number) => {
    const v = video.current;
    if (!v) return;
    quiet();
    waiting.current = false;
    setEnded(false);
    v.currentTime = cues[i].t + 0.02;
    last.current = i;
    setAt(i);
    if (readRef.current) { v.play().then(() => readCue(i)).catch(() => undefined); }
    else v.play().catch(() => undefined);
  };

  const toggleRead = () => {
    const on = !readAloud;
    onReadAloud(on);
    if (!on) { quiet(); waiting.current = false; setTrouble(false); return; }
    // On iPhone and iPad the first spoken line must start inside this tap.
    unlockVoice();
    const v = video.current;
    if (v && !v.paused && at >= 0) { readCue(at); return; }
    const token = ++reading.current;
    setVoice('reading');
    speak(at >= 0 ? cues[at][lang] : lesson.title[lang], lang, {
      onStart: () => setTrouble(false),
      onEnd: (how) => { if (token !== reading.current) return; setVoice('idle'); if (how === 'failed') setTrouble(true); },
    });
  };

  return (
    <section className="cl-player">
      <div className="row wrap" style={{ gap: 10 }}>
        <button type="button" className="btn ghost" onClick={onBack}><Icon name="back" size={18} /> {t('clAllLessons', lang)}</button>
        <h2 className="display grow" style={{ fontSize: 24 }}><span className="muted mono" style={{ fontSize: 16 }}>{index + 1}.</span> {lesson.title[lang]}</h2>
        {canReadAloud() && (
          <button type="button" className="btn" aria-pressed={readAloud} onClick={toggleRead}><Icon name="speaker" size={18} /> {t('clReadAloud', lang)}</button>
        )}
      </div>
      <div className="cl-stage">
        <div className="stack" style={{ gap: 10, minWidth: 0 }}>
          <div className="cl-video">
            <video ref={video} src={`classroom/${lesson.id}.mp4`} poster={`classroom/${lesson.id}.jpg`} controls playsInline preload="metadata"
              onTimeUpdate={onTime} onSeeked={onTime}
              onPlay={() => { setEnded(false); if (waiting.current) { waiting.current = false; quiet(); } else if (voice === 'reading') quiet(); }}
              onPause={() => { if (!waiting.current) quiet(); }}
              onEnded={() => { quiet(); setEnded(true); }} />
            {ended && (
              <div className="cl-done">
                <strong className="display" style={{ fontSize: 26 }}>{t('clDone', lang)}</strong>
                <span>{t('clDoneBody', lang)}</span>
                <div className="row wrap" style={{ justifyContent: 'center' }}>
                  <button type="button" className="btn" onClick={() => seek(0)}><Icon name="reset" size={18} /> {t('clAgain', lang)}</button>
                  {next && hasVideo(next.id) && <button type="button" className="btn primary" onClick={() => onOpen(next.id)}>{t('clNext', lang)}: {next.title[lang]} <Icon name="arrow" size={18} /></button>}
                </div>
              </div>
            )}
          </div>
          <p className={`cl-caption${voice === 'reading' ? ' reading' : ''}`} aria-live="polite">
            {voice === 'reading' && <span className="cl-reading" aria-label={t('clReadingNow', lang)}><Icon name="speaker" size={18} /></span>}
            {at >= 0 ? cues[at][lang] : t('clPressPlay', lang)}
          </p>
          {readAloud && trouble && <p className="cl-trouble small" role="status"><Icon name="warning" size={16} /> {t('clVoiceTrouble', lang)}</p>}
        </div>
        <aside className="card stack cl-side">
          <span className="lbl">{t('clExamples', lang)}</span>
          <ul className="cl-examples">{lesson.examples[lang].map((x) => <li key={x}>{x}</li>)}</ul>
          <span className="lbl">{t('clSteps', lang)}</span>
          <ol className="cl-cues" ref={list}>
            {cues.map((c, i) => (
              <li key={i} data-i={i}>
                <button type="button" aria-current={i === at ? 'step' : undefined} onClick={() => seek(i)}>
                  <span className="mono small">{clock(c.t)}</span><span>{c[lang]}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </section>
  );
}

interface Msg { from: 'me' | 'clave'; text: string; kind?: ReplyKind; lesson?: string }

function AskClave({ lang, onLesson }: { lang: Lang; onLesson: (id: LessonId) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>(() => [{ from: 'clave', text: ask('', lang).text, kind: 'hello' }]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [voiceTrouble, setVoiceTrouble] = useState(false);
  const listen = (text: string) => {
    unlockVoice();
    speak(text, lang, { onStart: () => setVoiceTrouble(false), onEnd: (how) => { if (how === 'failed') setVoiceTrouble(true); } });
  };
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [msgs, thinking]);

  const send = (text: string) => {
    const q = text.trim().slice(0, 200);
    if (!q || thinking) return;
    setMsgs((m) => [...m, { from: 'me', text: q }]);
    setDraft('');
    setThinking(true);
    window.setTimeout(() => {
      const r = ask(q, lang);
      setMsgs((m) => [...m, { from: 'clave', text: r.text, kind: r.kind, lesson: r.lesson }]);
      setThinking(false);
      input.current?.focus();
    }, 450);
  };
  const onSubmit = (e: FormEvent) => { e.preventDefault(); send(draft); };

  return (
    <section className="cl-chat card">
      <div className="cl-msgs" aria-live="polite">
        {msgs.map((m, i) => {
          const lesson = m.lesson ? lessonById(m.lesson) : undefined;
          return (
            <div key={i} className={`cl-msg ${m.from}${m.kind ? ` k-${m.kind}` : ''}`}>
              {m.from === 'clave' && <span className="cl-avatar" aria-hidden="true"><Icon name="music" size={18} /></span>}
              <div className="cl-bubble">
                {m.from === 'clave' && <span className="cl-who">Clave</span>}
                <p>{m.text}</p>
                {m.from === 'clave' && (
                  <div className="row wrap" style={{ gap: 6 }}>
                    {lesson && hasVideo(lesson.id) && (
                      <button type="button" className="chip" onClick={() => onLesson(lesson.id)}><Icon name="play" size={12} /> {t('clSeeLesson', lang)}: {lesson.title[lang]}</button>
                    )}
                    {canReadAloud() && <button type="button" className="chip" onClick={() => listen(m.text)} aria-label={t('clListen', lang)}><Icon name="speaker" size={14} /> {t('clListen', lang)}</button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {thinking && <div className="cl-msg clave"><span className="cl-avatar" aria-hidden="true"><Icon name="music" size={18} /></span><div className="cl-bubble"><p className="cl-dots" aria-label={t('clThinking', lang)}><i /><i /><i /></p></div></div>}
        <div ref={end} />
      </div>
      <div className="row wrap cl-suggest">
        {SUGGESTIONS[lang].map((s) => <button key={s} type="button" className="chip" onClick={() => send(s)} disabled={thinking}>{s}</button>)}
      </div>
      {voiceTrouble && <p className="cl-trouble small" role="status"><Icon name="warning" size={16} /> {t('clVoiceTrouble', lang)}</p>}
      <form className="cl-ask" onSubmit={onSubmit}>
        <input ref={input} className="field" value={draft} maxLength={200} onChange={(e) => setDraft(e.target.value)}
          placeholder={t('clAskPlaceholder', lang)} aria-label={t('clAskPlaceholder', lang)} enterKeyHint="send" autoComplete="off" />
        <button type="submit" className="btn primary" disabled={!draft.trim() || thinking}>{t('clSend', lang)} <Icon name="arrow" size={18} /></button>
      </form>
      <p className="small muted" style={{ margin: 0 }}>{t('clAskNote', lang)}</p>
    </section>
  );
}
