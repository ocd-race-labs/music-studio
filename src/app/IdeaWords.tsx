// Idea from words: a module of its own, general to specific (idea, form, chords, instruments, groove, summary).
// Each step shows three choices to hear and a box for the person's own words; the result is a new song whose idea
// holds everything. In profiles that may use Claude, step 1 can also hand a specific song to Claude through the
// project, and its answer (an idea file, version 2) becomes the first choice of each step.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  buildFromWords, chordPicks, choiceFromClaude, claudeRequest, feelFor, formBars, formPicks, formTime, groovePicks, ideaPicks,
  instName, instPicks, namesASong, previewFromWords, refineChords, refineForm, refineGroove, refineInst,
} from '../domain/words';
import type { ChordPick, FormPick, GroovePick, IdeaPick, InstPick, Refined, WordsChoice } from '../domain/words';
import { parseSongIdeasFile } from '../domain/files';
import { kindLabel, sectionColor } from '../domain/arrange';
import { grooveGrid } from '../domain/sketch';
import { chordSymbol, diatonicTriads, tonicDisplay } from '../theory';
import { engine } from '../engine/engine';
import type { Lang, Song } from '../domain/types';
import { namingFor, t } from './i18n';
import { Icon, InstBadge } from './ui';
import { instIcon } from './instIcon';

type Step = 1 | 2 | 3 | 4 | 5 | 6;
const STEPS: Step[] = [1, 2, 3, 4, 5, 6];
const stepLabel = (s: Step, lang: Lang) => t(`iwStep${s}` as 'iwStep1', lang);

export default function IdeaWords({ lang, owner, claude, onCreate, onClose }: {
  lang: Lang;
  owner: string;
  /** Whether this profile may hand a song to Claude (never in a child's profile, never for guests). */
  claude: boolean;
  onCreate: (song: Song, accepted: boolean) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [text, setText] = useState('');
  const [asked, setAsked] = useState('');
  const [sel, setSel] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [mine, setMine] = useState<{ 2?: FormPick; 3?: ChordPick; 4?: InstPick; 5?: GroovePick }>({});
  const [free, setFree] = useState<Record<number, string>>({});
  const [said, setSaid] = useState<Record<number, string>>({});
  const [fromClaude, setFromClaude] = useState<WordsChoice[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const naming = namingFor(lang);

  useEffect(() => () => { engine.stop(); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* ---------- the choices of each step, from what came before */
  const read = useMemo(() => (asked ? ideaPicks(asked) : null), [asked]);
  const ideas: IdeaPick[] = useMemo(() => {
    const rules = read?.picks ?? [];
    return [...fromClaude.map((c) => c.idea), ...rules].slice(0, 3);
  }, [read, fromClaude]);
  const idea = ideas[sel[1]] ?? ideas[0];
  const claudeOne = idea?.claude ? fromClaude[ideas.indexOf(idea)] : undefined;
  const lists = useMemo(() => {
    if (!idea) return null;
    const withMine = <P,>(list: P[], own?: P) => (own ? [...list, own] : list);
    return {
      2: withMine([...(claudeOne ? [claudeOne.form] : []), ...formPicks(idea)].slice(0, 3), mine[2]),
      3: withMine([...(claudeOne ? [claudeOne.chords] : []), ...chordPicks(idea)].slice(0, 3), mine[3]),
      4: withMine([...(claudeOne ? [claudeOne.inst] : []), ...instPicks(idea, read?.parsed.wants)].slice(0, 3), mine[4]),
      5: withMine([...(claudeOne ? [claudeOne.groove] : []), ...groovePicks(idea)].slice(0, 3), mine[5]),
    };
  }, [idea, claudeOne, mine, read]);
  const choice: WordsChoice | null = idea && lists ? {
    idea,
    form: lists[2][sel[2]] ?? lists[2][0],
    chords: lists[3][sel[3]] ?? lists[3][0],
    inst: lists[4][sel[4]] ?? lists[4][0],
    groove: lists[5][sel[5]] ?? lists[5][0],
  } : null;

  const understand = (value = text) => {
    if (!value.trim()) return;
    setAsked(value);
    setSel([0, 0, 0, 0, 0, 0]);
    setMine({});
    setSaid({});
    setNote(null);
  };
  const pick = (s: number, i: number) => {
    setSel((cur) => {
      const next = [...cur];
      next[s] = i;
      // A new idea starts the later steps again from their first choice.
      if (s === 1) for (let k = 2; k <= 5; k++) next[k] = 0;
      return next;
    });
    if (s === 1) { setMine({}); setSaid({}); }
  };

  /* ---------- hearing a choice */
  const stopHearing = () => { engine.stop(); setPlaying(null); };
  const hear = async (id: string, c: WordsChoice, scope: 'loop' | 'pair' | 'full') => {
    if (playing === id) { stopHearing(); return; }
    engine.stop();
    engine.setRange(null);
    engine.setSong(previewFromWords(c, owner, lang, scope));
    setPlaying(id);
    await engine.play(0);
  };

  /* ---------- free text on steps 2 to 5 */
  const refine = (s: 2 | 3 | 4 | 5) => {
    if (!choice || !lists) return;
    const words = free[s] ?? '';
    let r: Refined<FormPick | ChordPick | InstPick | GroovePick>;
    if (s === 2) r = refineForm(words, choice.form, lang);
    else if (s === 3) r = refineChords(words, choice.chords, lang);
    else if (s === 4) r = refineInst(words, choice.inst, lang);
    else r = refineGroove(words, choice.groove, lang);
    if (r.missed || !r.pick) { setSaid((x) => ({ ...x, [s]: t('iwMissed', lang) })); return; }
    setMine((m) => ({ ...m, [s]: r.pick }));
    setSel((cur) => { const next = [...cur]; next[s] = lists[s].filter((p) => p !== mine[s]).length; return next; });
    setSaid((x) => ({ ...x, [s]: t('iwApplied', lang, { what: r.understood.join(', ') }) }));
  };

  /* ---------- Claude */
  const copyForClaude = async () => {
    try { await navigator.clipboard.writeText(claudeRequest(text || asked)); setNote(t('iwClaudeCopied', lang)); } catch { setNote(claudeRequest(text || asked)); }
  };
  const importClaude = async (file: File) => {
    const parsed = parseSongIdeasFile(await file.text());
    if (!parsed.ok) { setNote(t('iwClaudeBad', lang, { err: parsed.errors.slice(0, 2).join('; ') })); return; }
    const list = parsed.value.map((x) => choiceFromClaude(x.payload, x.title));
    setFromClaude(list);
    if (!asked) setAsked(text || list[0].idea.title[lang]);
    setSel([0, 0, 0, 0, 0, 0]);
    setMine({});
    setNote(t('iwClaudeLoaded', lang, { n: list.length }));
  };

  /* ---------- how things read */
  const keyName = (p: IdeaPick) => t(p.mode === 'minor' ? 'iwMinor' : 'iwMajor', lang, { tonic: tonicDisplay(p.tonic, naming) });
  const ideaMeta = (p: IdeaPick) => [`${p.tempo} BPM`, keyName(p), p.swing > 0 ? t('iwSwing', lang) : ''].filter(Boolean).join(' · ');
  const triads = idea ? diatonicTriads({ tonic: idea.tonic, mode: idea.mode }) : [];
  const chordOf = (d: number) => (triads[d] ? chordSymbol(triads[d], naming) : '·');
  const romanOf = (d: number) => triads[d]?.roman ?? '';
  const romans = (list: number[]) => list.slice(0, 4).map(romanOf).join(' · ');
  const understoodLine = useMemo(() => {
    if (!read) return '';
    const p = read.parsed;
    const bits: string[] = [];
    if (read.matched && ideas[0]) bits.push(ideas[0].title[lang]);
    if (p.pace) bits.push(t(p.pace === 'slow' ? 'beatSlow' : 'beatFast', lang).toLowerCase());
    if (p.mood) bits.push(t(p.mood === 'dark' ? 'beatDark' : 'beatBright', lang).toLowerCase());
    if (p.tempo) bits.push(`${p.tempo} BPM`);
    return bits.join(', ');
  }, [read, ideas, lang]);

  // Without an idea yet only the first step can show.
  const view: Step = choice ? step : 1;

  /* ---------- pieces */
  const card = (s: number, i: number, selected: boolean, title: string, meta: string, body: ReactNode, onHear: () => void, claudeMark?: boolean) => {
    const id = `${s}-${i}`;
    return (
      <div key={id} className={`iw-card${selected ? ' on' : ''}`}>
        <button type="button" className="iw-pick" aria-pressed={selected} onClick={() => pick(s, i)}>
          <span className="iw-title"><span className="iw-radio" aria-hidden="true" />{title}</span>
          {claudeMark && <span className="iw-claude">{t('iwFromClaude', lang)}</span>}
          {meta && <span className="mono small muted">{meta}</span>}
          {body}
        </button>
        <button type="button" className={`btn icon iw-hear${playing === id ? ' primary' : ''}`} onClick={onHear}
          aria-label={playing === id ? t('stop', lang) : t('listenTo', lang, { name: title })}>
          <Icon name={playing === id ? 'stop' : 'play'} size={18} />
        </button>
      </div>
    );
  };
  const freeBox = (s: 2 | 3 | 4 | 5) => (
    <div className="stack iw-free" style={{ gap: 6 }}>
      <label className="lbl" htmlFor={`iw-free-${s}`}>{t('iwFree', lang)}</label>
      <div className="row wrap" style={{ gap: 8 }}>
        <input id={`iw-free-${s}`} className="field grow" value={free[s] ?? ''} placeholder={t(`iwFreePh${s}` as 'iwFreePh2', lang)}
          onChange={(e) => setFree((x) => ({ ...x, [s]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') refine(s); }} />
        <button type="button" className="btn" disabled={!(free[s] ?? '').trim()} onClick={() => refine(s)}>{t('iwApply', lang)}</button>
      </div>
      {said[s] && <p className="small muted" role="status" style={{ margin: 0 }}>{said[s]}</p>}
    </div>
  );
  const with_ = (patch: Partial<WordsChoice>): WordsChoice => ({ ...choice!, ...patch });

  const summary = choice ? [
    { s: 1 as Step, label: stepLabel(1, lang), value: `${choice.idea.title[lang]} · ${ideaMeta(choice.idea)}` },
    { s: 2 as Step, label: stepLabel(2, lang), value: `${choice.form.title[lang]} · ${t('iwBars', lang, { n: formBars(choice.form), time: formTime(choice.form, choice.idea.tempo) })}` },
    { s: 3 as Step, label: stepLabel(3, lang), value: `${choice.chords.title[lang]} · ${romans(choice.chords.verse)}` },
    { s: 4 as Step, label: stepLabel(4, lang), value: [choice.inst.chords, choice.inst.drums, choice.inst.bass].filter(Boolean).map((k) => instName(k, lang)).join(', ') },
    { s: 5 as Step, label: stepLabel(5, lang), value: choice.groove.title[lang] },
  ] : [];

  const create = (accept: boolean) => {
    if (!choice) return;
    stopHearing();
    onCreate(buildFromWords(choice, owner, lang, t('iwSongTitle', lang, { style: choice.idea.title[lang] }), accept), accept);
  };

  return (
    <div className="iw-screen" role="dialog" aria-modal="true" aria-label={t('iwOpen', lang)}>
      <div className="iw-wrap">
        <header className="iw-head">
          <button type="button" className="btn" onClick={() => { stopHearing(); onClose(); }}><Icon name="back" size={18} /> {t('iwBack', lang)}</button>
          <div className="stack" style={{ gap: 2 }}>
            <h1 className="display iw-h1">{t('iwOpen', lang)}</h1>
            <p className="small muted" style={{ margin: 0 }}>{t('iwIntro', lang)}</p>
          </div>
        </header>

        <nav className="iw-steps" aria-label={t('iwOpen', lang)}>
          {STEPS.map((s) => (
            <button key={s} type="button" className={`iw-step${s === view ? ' on' : ''}${s < view ? ' done' : ''}`} aria-current={s === view ? 'step' : undefined}
              disabled={s > 1 && !choice} onClick={() => { stopHearing(); setStep(s); }}>
              <span className="iw-num mono">{s < view ? <Icon name="check" size={14} /> : s}</span>{stepLabel(s, lang)}
            </button>
          ))}
        </nav>

        <div className="iw-body">
          <main className="iw-main">
            <div className="stack" style={{ gap: 4 }}>
              <span className="mono small muted">{view < 6 ? t('iwStepOf', lang, { n: view }) : stepLabel(6, lang)}</span>
              <h2 className="display iw-q">{t(`iwQ${view}` as 'iwQ1', lang)}</h2>
              <p className="muted" style={{ margin: 0 }}>{t(`iwH${view}` as 'iwH1', lang, { key: idea ? keyName(idea) : '' })}</p>
            </div>

            {view === 1 && (
              <>
                <div className="stack" style={{ gap: 6 }}>
                  <label className="lbl" htmlFor="iw-text">{t('iwTell', lang)}</label>
                  <textarea id="iw-text" className="field iw-text" rows={3} maxLength={300} value={text} placeholder={t('iwPlaceholder', lang)}
                    onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); understand(); } }} />
                  <div className="row wrap" style={{ gap: 8, justifyContent: 'space-between' }}>
                    {read ? (
                      <p className="small iw-understood" role="status">
                        <Icon name="check" size={16} /> {read.matched ? t('iwUnderstood', lang, { what: understoodLine }) : t('iwNoStyle', lang)}
                        {namesASong(asked) ? ` ${t('iwNamedSong', lang)}` : ''}
                      </p>
                    ) : <span />}
                    <button type="button" className="btn primary" disabled={!text.trim() || text === asked} onClick={() => understand()}>{t('iwUnderstand', lang)}</button>
                  </div>
                </div>
                {ideas.length > 0 && (
                  <>
                    <h3 className="iw-sub">{t('iwThreeWays', lang)}</h3>
                    <div className="iw-cards">
                      {ideas.map((p, i) => card(1, i, i === sel[1], p.title[lang], ideaMeta(p), <span className="small">{p.note[lang]}</span>,
                        () => hear(`1-${i}`, { ...choice!, idea: p, ...(p.claude ? fromClaude[i] : { form: formPicks(p)[0], chords: chordPicks(p)[0], inst: instPicks(p, read?.parsed.wants)[0], groove: groovePicks(p)[0] }) }, 'pair'), p.claude))}
                    </div>
                  </>
                )}
                {claude && asked && (
                  <section className="iw-claudebox" aria-labelledby="iw-claude-h">
                    <div className="stack" style={{ gap: 4, flex: '999 1 320px', minWidth: 0 }}>
                      <h3 id="iw-claude-h" className="iw-sub">{t('iwClaudeTitle', lang)}</h3>
                      <p className="small" style={{ margin: 0 }}>{t('iwClaudeText', lang)}</p>
                    </div>
                    <div className="row wrap" style={{ gap: 8, flex: '1 1 220px' }}>
                      <button type="button" className="btn primary" onClick={copyForClaude}><Icon name="copy" size={18} /> {t('iwClaudeCopy', lang)}</button>
                      <button type="button" className="btn" onClick={() => fileRef.current?.click()}><Icon name="upload" size={18} /> {t('iwClaudeImport', lang)}</button>
                      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importClaude(f); e.target.value = ''; }} />
                    </div>
                  </section>
                )}
                {note && <p className="small iw-note" role="status">{note}</p>}
              </>
            )}

            {view === 2 && choice && lists && (
              <>
                <div className="iw-cards">
                  {lists[2].map((f, i) => card(2, i, i === sel[2], f.title[lang], t('iwBars', lang, { n: formBars(f), time: formTime(f, choice.idea.tempo) }), (
                    <>
                      <span className="iw-form" aria-hidden="true">
                        {f.parts.map((p, k) => <span key={k} style={{ flexGrow: p.bars, background: sectionColor({ kind: p.kind }) }}>{kindLabel(p.kind, lang).slice(0, 1)}</span>)}
                      </span>
                      <span className="small muted">{f.parts.map((p) => `${kindLabel(p.kind, lang)} ${p.bars}`).join(' · ')}</span>
                      <span className="small">{f.note[lang]}</span>
                    </>
                  ), () => hear(`2-${i}`, with_({ form: f }), 'full'), f.claude))}
                </div>
                {freeBox(2)}
              </>
            )}

            {view === 3 && choice && lists && (
              <>
                <div className="iw-cards">
                  {lists[3].map((c, i) => card(3, i, i === sel[3], c.title[lang], romans(c.verse), (
                    <>
                      {([['iwVerse', c.verse], ['iwChorus', c.chorus]] as const).map(([label, list]) => (
                        <span key={label} className="stack" style={{ gap: 4 }}>
                          <span className="small muted">{t(label, lang)}</span>
                          <span className={`iw-chords${label === 'iwChorus' ? ' chorus' : ''}`}>
                            {Array.from({ length: 4 }, (_, k) => list[k % list.length]).map((d, k) => (
                              <span key={k}><strong>{chordOf(d)}</strong><span className="mono">{romanOf(d)}</span></span>
                            ))}
                          </span>
                        </span>
                      ))}
                      <span className="small">{c.note[lang]}</span>
                    </>
                  ), () => hear(`3-${i}`, with_({ chords: c }), 'pair'), c.claude))}
                </div>
                {freeBox(3)}
              </>
            )}

            {view === 4 && choice && lists && (
              <>
                <div className="iw-cards">
                  {lists[4].map((p, i) => card(4, i, i === sel[4], p.title[lang], '', (
                    <>
                      <span className="small">{p.note[lang]}</span>
                      {([['beatChords', p.chords], ['beatDrums', p.drums], ['beatBass', p.bass]] as const).map(([label, key]) => (
                        <span key={label} className="iw-inst">
                          <InstBadge icon={key ? instIcon(key) : 'close'} size="sm" />
                          <span className="stack" style={{ gap: 0 }}><span className="small muted">{t(label, lang)}</span><span>{key ? instName(key, lang) : t('iwNone', lang)}</span></span>
                        </span>
                      ))}
                    </>
                  ), () => hear(`4-${i}`, with_({ inst: p }), 'loop'), p.claude))}
                </div>
                {freeBox(4)}
              </>
            )}

            {view === 5 && choice && lists && (
              <>
                <div className="iw-cards">
                  {lists[5].map((g, i) => {
                    const grid = grooveGrid(g.group, feelFor(g, { kind: 'verse', bars: 8, letter: 'v' }, 1));
                    return card(5, i, i === sel[5], g.title[lang], '', (
                      <>
                        <span className="iw-grid" aria-hidden="true">
                          {(['low', 'back', 'top'] as const).map((lane) => (
                            <span key={lane} className="iw-laneRow">
                              <span className="iw-laneName">{t(lane === 'low' ? 'iwLaneLow' : lane === 'back' ? 'iwLaneBack' : 'iwLaneTop', lang)}</span>
                              <span className="iw-lane">{grid[lane].map((on, k) => <span key={k} className={`${on ? 'on' : ''}${k % 4 === 0 ? ' beat' : ''}`} />)}</span>
                            </span>
                          ))}
                        </span>
                        <span className="small">{g.note[lang]}</span>
                      </>
                    ), () => hear(`5-${i}`, with_({ groove: g }), 'pair'), g.claude);
                  })}
                </div>
                {freeBox(5)}
              </>
            )}

            {view === 6 && choice && (
              <>
                <dl className="iw-sum">
                  {summary.map((r) => (
                    <div key={r.s}>
                      <dt>{r.label}</dt><dd>{r.value}</dd>
                      <button type="button" className="btn small-btn" onClick={() => setStep(r.s)}>{t('iwChange', lang)}</button>
                    </div>
                  ))}
                </dl>
                <div className="row wrap" style={{ gap: 10 }}>
                  <button type="button" className="btn primary iw-accept" onClick={() => create(true)}><Icon name="check" size={20} /> {t('iwAccept', lang)}</button>
                  <button type="button" className="btn" onClick={() => create(false)}><Icon name="bulb" size={18} /> {t('iwOnlyIdea', lang)}</button>
                  <button type="button" className={`btn icon${playing === 'all' ? ' primary' : ''}`} onClick={() => hear('all', choice, 'full')}
                    aria-label={playing === 'all' ? t('stop', lang) : t('listenTo', lang, { name: t('iwQ6', lang) })}><Icon name={playing === 'all' ? 'stop' : 'play'} size={18} /></button>
                </div>
                <p className="small muted" style={{ margin: 0 }}>{t('iwAcceptNote', lang)}</p>
              </>
            )}

            <div className="iw-nav">
              {view > 1 ? <button type="button" className="btn" onClick={() => { stopHearing(); setStep((view - 1) as Step); }}><Icon name="back" size={18} /> {t('iwPrev', lang)}</button> : <span />}
              {view < 6 && (
                <button type="button" className="btn primary" disabled={!choice} onClick={() => { stopHearing(); setStep((view + 1) as Step); }}>
                  {view < 5 ? t('iwNext', lang, { step: stepLabel((view + 1) as Step, lang) }) : t('iwSeeSummary', lang)} <Icon name="arrow" size={18} />
                </button>
              )}
            </div>
          </main>

          {view < 6 && choice && (
            <aside className="iw-side" aria-labelledby="iw-side-h">
              <h2 id="iw-side-h" className="iw-sub">{t('iwSoFar', lang)}</h2>
              {summary.map((r) => (
                <div key={r.s} className={`stack${r.s > view ? ' muted' : ''}`} style={{ gap: 1 }}>
                  <span className="small muted">{r.label}</span><span className="small">{r.value}</span>
                </div>
              ))}
              <p className="small muted iw-sidenote">{t('iwSoFarNote', lang)}</p>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
