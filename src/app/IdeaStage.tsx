// The musician's first step: the idea. The form as a strip of parts, chords bar by bar for the part in hand, its
// rhythm by genre and style, and the instruments that play the idea. Everything here is heard right away; when it
// sounds right, it is accepted and written into the detail.

import { useEffect, useState } from 'react';
import type { Lang, SectionKind, Sketch, SketchGroove, Song } from '../domain/types';
import * as S from '../domain/sketch';
import type { Feel, Place } from '../domain/sketch';
import { kindLabel, SECTION_COLORS } from '../domain/arrange';
import { GENRES, GROUPS } from '../packs/collection';
import type { Genre } from '../packs/collection';
import { chordMidi, chordSymbol, diatonicTriads } from '../theory';
import { engine } from '../engine/engine';
import { songKey } from './editors';
import { songDuration } from './Arrange';
import { namingFor, t } from './i18n';
import type { StringKey } from './i18n';
import { Icon } from './ui';
import { templateFor } from './rack';
import { InstPicker } from './InstPicker';

const FEEL_LABEL: Record<Feel, StringKey> = { soft: 'feelSoft', normal: 'feelNormal', strong: 'feelStrong', half: 'feelHalf' };
const TEMPLATE_LABEL: Record<string, StringKey> = { song: 'tplSong', short: 'tplShort', beat: 'tplBeat', loop: 'tplLoop' };
const genreOfGroup = (g: string): Genre => GROUPS.find((x) => x.id === g)?.genre ?? 'rock';

export default function IdeaStage({ song, idea, lang, playing, step, detailDiffers, onSketch, onPlace, onAccept, onDetail }: {
  song: Song;
  /** The idea rendered as a song: what is heard. */
  idea: Song;
  lang: Lang;
  playing: boolean;
  step: number;
  /** The detail was changed by hand and no longer matches the idea. */
  detailDiffers?: boolean;
  onSketch: (fn: (s: Sketch) => Sketch | null) => void;
  /** Play one place of the form on repeat (or the whole idea with null). */
  onPlace: (p: Place | null) => void;
  onAccept: (blockId?: string) => void;
  onDetail: () => void;
}) {
  const naming = namingFor(lang);
  const sketch = song.sketch ?? S.newSketch(song);
  const minor = S.isMinorKey(song);
  const places = S.layout(sketch);
  const [selIndex, setSelIndex] = useState(0);
  const sel = places[Math.min(selIndex, places.length - 1)];
  const block = sel ? sketch.blocks.find((b) => b.id === sel.blockId) : undefined;
  const [slot, setSlot] = useState(0);
  const [adding, setAdding] = useState(false);
  const [looping, setLooping] = useState<string | null>(null);
  const [pendingTpl, setPendingTpl] = useState<string | null>(null);
  useEffect(() => { setSlot(0); }, [block?.id]);
  useEffect(() => { if (!playing) setLooping(null); }, [playing]);
  const triads = diatonicTriads(songKey(song));
  const chordsTrack = idea.tracks.find((tr) => tr.clips[0]?.kind === 'chords');
  const hearChord = (deg: number) => {
    const c = triads[deg];
    if (c && chordsTrack) engine.previewNotes(chordsTrack.id, chordMidi(c, 52).map((m) => ({ midi: m, at: 0, dur: 0.9, vel: 0.6 })));
  };
  const playingBar = step >= 0 ? Math.floor(step / 16) : -1;
  const total = S.totalBars(sketch);
  const uses = (id: string) => sketch.order.filter((x) => x === id).length;
  const letter = (id: string) => String.fromCharCode(65 + sketch.blocks.findIndex((b) => b.id === id));

  const listen = (key: string) => {
    const e = templateFor(key);
    if (e) engine.previewGroove(key, e.groove, song.tempo_bpm, undefined, 1, e.phrase);
    else engine.previewInstrument(key);
  };

  const changed = !!sketch.accepted_at && sketch.updated_at > sketch.accepted_at;
  const follows = S.detailFollowsForm(song);
  const when = sketch.accepted_at
    ? new Date(sketch.accepted_at).toLocaleString(lang === 'es' ? 'es-CL' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  /* ---------------------------------------------------------------- empty: pick a form to start from */
  if (!places.length) {
    return (
      <section className="idea idea-empty" aria-label={t('ideaTitle', lang)}>
        <div className="stack" style={{ gap: 6, maxWidth: 680 }}>
          <h2 className="display" style={{ fontSize: 26 }}>{t('ideaStartTitle', lang)}</h2>
          <p className="muted" style={{ margin: 0 }}>{t('ideaStartBody', lang)}</p>
        </div>
        <div className="tpl-grid">
          {S.TEMPLATES.map((tpl) => (
            <button key={tpl.id} type="button" className="tpl-card" onClick={() => onSketch((s) => S.applyTemplate(s, tpl.id, minor))}>
              <strong>{t(TEMPLATE_LABEL[tpl.id], lang)}</strong>
              <span className="tpl-strip" aria-hidden="true">
                {tpl.parts.map(([kind, bars], i) => <span key={i} style={{ flexGrow: bars, background: SECTION_COLORS[kind] }} />)}
              </span>
              <span className="small muted">{tpl.parts.map(([kind]) => kindLabel(kind, lang)).join(' · ')}</span>
            </button>
          ))}
          <button type="button" className="tpl-card blank" onClick={() => onSketch((s) => S.addBlock(s, 'verse', 8, minor))}>
            <strong>{t('tplBlank', lang)}</strong>
            <span className="small muted">{t('tplBlankHint', lang)}</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="idea" aria-label={t('ideaTitle', lang)}>
      {/* ---------------------------------------------------------------- what the idea sounds with, and accepting it */}
      <div className="idea-card idea-bar" role="group" aria-label={t('ideaInstruments', lang)}>
        <span className="lbl idea-bar-lbl">{t('ideaSoundsWith', lang)}</span>
        <div className="idea-picks">
          <InstPicker role="chords" label={t('ideaChordsWith', lang)} value={sketch.chords_instrument?.key ?? null} lang={lang} onListen={listen}
            onPick={(k) => k && onSketch((s) => S.setIdeaInstruments(s, { chords_instrument: { key: k, version: '1.0.0' } }))} />
          <InstPicker role="drums" label={t('ideaDrumsWith', lang)} value={sketch.drums_instrument?.key ?? null} lang={lang} onListen={listen}
            onPick={(k) => k && onSketch((s) => S.setIdeaInstruments(s, { drums_instrument: { key: k, version: '1.0.0' } }))} />
          <InstPicker role="bass" label={t('ideaBassWith', lang)} value={sketch.bass_instrument?.key ?? null} lang={lang} onListen={listen} allowNone
            onPick={(k) => onSketch((s) => S.setIdeaInstruments(s, { bass_instrument: k ? { key: k, version: '1.0.0' } : null }))} />
        </div>
        {!sketch.accepted_at ? (
          <button type="button" className="btn primary idea-go" onClick={() => onAccept()} title={t('ideaDraftNote', lang)}>
            <Icon name="check" size={18} /> {t('ideaAcceptShort', lang)}
          </button>
        ) : changed ? (
          <button type="button" className="btn primary idea-go" onClick={() => onAccept()} title={t('ideaChangedNote', lang)}>
            <Icon name="check" size={18} /> {t('ideaWriteAgain', lang)}
          </button>
        ) : (
          <div className="row wrap idea-go" style={{ gap: 8 }}>
            {detailDiffers && (
              <button type="button" className="btn" onClick={() => onAccept()} title={t('ideaRewriteNote', lang)}>
                <Icon name="reset" size={18} /> {t('ideaRewrite', lang)}
              </button>
            )}
            <button type="button" className="btn" onClick={onDetail} title={t('ideaAcceptedNote', lang, { when })}>
              {t('ideaToDetail', lang)} <Icon name="arrow" size={18} />
            </button>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- the form */}
      <div className="idea-card">
        <div className="row wrap" style={{ gap: 8 }}>
          <h3 className="sub grow">{t('ideaForm', lang)} <span className="muted ui-font" style={{ textTransform: 'none', letterSpacing: 0 }}>· {t('timelineLength', lang, { bars: total, time: songDuration(idea) })}</span></h3>
          <select className="field small-field" value="" onChange={(e) => setPendingTpl(e.target.value || null)} aria-label={t('tplPick', lang)}>
            <option value="">{t('tplPick', lang)}</option>
            {S.TEMPLATES.map((tpl) => <option key={tpl.id} value={tpl.id}>{t(TEMPLATE_LABEL[tpl.id], lang)}</option>)}
          </select>
        </div>
        {pendingTpl && (
          <div className="row wrap warn-box" role="alert" style={{ alignItems: 'center' }}>
            <Icon name="warning" size={22} />
            <span className="grow">{t('tplReplaceQ', lang, { name: t(TEMPLATE_LABEL[pendingTpl], lang) })}</span>
            <button type="button" className="btn small-btn ghost" onClick={() => setPendingTpl(null)}>{t('cancel', lang)}</button>
            <button type="button" className="btn small-btn danger" onClick={() => { onSketch((s) => S.applyTemplate(s, pendingTpl, minor)); setPendingTpl(null); setSelIndex(0); }}>{t('tplReplace', lang)}</button>
          </div>
        )}
        <div className="form-strip" role="listbox" aria-label={t('ideaForm', lang)}>
          {places.map((p) => {
            const b = sketch.blocks.find((x) => x.id === p.blockId)!;
            const on = playingBar >= p.startBar && playingBar < p.startBar + p.bars;
            return (
              <button key={`${p.blockId}-${p.occ}`} type="button" role="option" aria-selected={sel?.index === p.index}
                className={`form-tile${sel?.index === p.index ? ' sel' : ''}${sel && sel.blockId === p.blockId && sel.index !== p.index ? ' twin' : ''}${on ? ' now' : ''}`}
                style={{ flexGrow: p.bars, ['--sec' as string]: SECTION_COLORS[b.kind] }} onClick={() => setSelIndex(p.index)}>
                <span className="ft-name">{S.blockName(b, lang)}</span>
                <span className="ft-meta mono">{p.bars}{uses(b.id) > 1 ? ` · ${letter(b.id)}` : ''}</span>
                {on && <span className="ft-head" style={{ left: `${((step / 16 - p.startBar) / p.bars) * 100}%` }} aria-hidden="true" />}
              </button>
            );
          })}
          <button type="button" className={`form-add${adding ? ' on' : ''}`} onClick={() => setAdding((a) => !a)} aria-label={t('ideaAddPart', lang)} title={t('ideaAddPart', lang)}>
            <Icon name="plus" size={18} />
          </button>
        </div>
        {adding && (
          <div className="form-menu">
            <span className="lbl">{t('ideaNewPart', lang)}</span>
            <div className="row wrap" style={{ gap: 6 }}>
              {S.BLOCK_KINDS.map((k) => (
                <button key={k} type="button" className="chip sec" style={{ ['--sec' as string]: SECTION_COLORS[k] }}
                  onClick={() => { onSketch((s) => S.addBlock(s, k, k === 'intro' || k === 'outro' || k === 'break' ? 4 : 8, minor)); setSelIndex(places.length); setAdding(false); }}>
                  {kindLabel(k, lang)}
                </button>
              ))}
            </div>
            <span className="lbl">{t('ideaRepeatPart', lang)}</span>
            <div className="row wrap" style={{ gap: 6 }}>
              {sketch.blocks.map((b) => (
                <button key={b.id} type="button" className="chip sec" style={{ ['--sec' as string]: SECTION_COLORS[b.kind] }}
                  onClick={() => { onSketch((s) => S.repeatBlock(s, b.id)); setSelIndex(places.length); setAdding(false); }}>
                  <Icon name="reset" size={14} /> {S.blockName(b, lang)}
                </button>
              ))}
            </div>
          </div>
        )}
        {sel && block && (
          <div className="row wrap form-actions">
            <button type="button" className="btn small-btn ghost" disabled={sel.index === 0} onClick={() => { onSketch((s) => S.moveAt(s, sel.index, -1)); setSelIndex(sel.index - 1); }}>← {t('cdEarlier', lang)}</button>
            <button type="button" className="btn small-btn ghost" disabled={sel.index === places.length - 1} onClick={() => { onSketch((s) => S.moveAt(s, sel.index, 1)); setSelIndex(sel.index + 1); }}>{t('cdLater', lang)} →</button>
            <button type="button" className="btn small-btn" onClick={() => { onSketch((s) => S.repeatBlock(s, block.id, sel.index + 1)); setSelIndex(sel.index + 1); }} title={t('ideaRepeatHint', lang)}>
              <Icon name="reset" size={16} /> {t('ideaRepeatHere', lang)}
            </button>
            <button type="button" className="btn small-btn" onClick={() => { onSketch((s) => S.copyBlock(s, block.id, sel.index + 1)); setSelIndex(sel.index + 1); }} title={t('ideaCopyHint', lang)}>
              <Icon name="copy" size={16} /> {t('ideaCopyNew', lang)}
            </button>
            <span className="grow" />
            <button type="button" className="btn small-btn ghost" onClick={() => { onSketch((s) => S.removeAt(s, sel.index)); setSelIndex(Math.max(0, sel.index - 1)); }}>
              <Icon name="trash" size={16} /> {t('ideaRemovePlace', lang)}
            </button>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- the part in hand */}
      {sel && block && (
        <div className="idea-card part-card" style={{ ['--sec' as string]: SECTION_COLORS[block.kind] }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <input key={`${block.id}-${S.blockName(block, lang)}`} className="field sec-name" defaultValue={S.blockName(block, lang)} maxLength={40} aria-label={t('sectionName', lang)}
              onBlur={(e) => { const v = e.target.value.trim(); if (v !== S.blockName(block, lang)) onSketch((s) => S.renameBlock(s, block.id, v === `${kindLabel(block.kind, lang)} ${block.n}` ? '' : v)); }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
            <select className="field" value={block.kind} aria-label={t('sectionKind', lang)} onChange={(e) => onSketch((s) => S.setBlockKind(s, block.id, e.target.value as SectionKind))}>
              {S.BLOCK_KINDS.map((k) => <option key={k} value={k}>{kindLabel(k, lang)}</option>)}
            </select>
            <div className="stepper" role="group" aria-label={t('bars', lang)}>
              <span className="muted small">{t('bars', lang)}</span>
              <button type="button" className="btn icon" onClick={() => onSketch((s) => S.setBlockBars(s, block.id, block.bars - 1))} disabled={block.bars <= 1} aria-label={t('barsFewer', lang)}>−</button>
              <span className="mono step-n">{block.bars}</span>
              <button type="button" className="btn icon" onClick={() => onSketch((s) => S.setBlockBars(s, block.id, block.bars + 1))} aria-label={t('barsMore', lang)}>+</button>
            </div>
            {uses(block.id) > 1 && <span className="tag">{t('ideaUsedTimes', lang, { n: uses(block.id) })}</span>}
            <span className="grow" />
            {sketch.accepted_at && changed && follows && (
              <button type="button" className="btn small-btn" onClick={() => onAccept(block.id)} title={t('ideaChangedNote', lang)}>
                <Icon name="check" size={16} /> {t('ideaWriteBlock', lang, { name: S.blockName(block, lang) })}
              </button>
            )}
            <button type="button" className={`btn${looping === block.id && playing ? ' primary' : ''}`}
              onClick={() => { if (looping === block.id && playing) { onPlace(null); setLooping(null); } else { onPlace(sel); setLooping(block.id); } }}>
              <Icon name={looping === block.id && playing ? 'stop' : 'play'} size={18} /> {t(looping === block.id && playing ? 'stop' : 'ideaPlayPart', lang)}
            </button>
          </div>

          <div className="stack" style={{ gap: 6 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <span className="lbl grow">{t('ideaChords', lang)}</span>
              <label className="row small" style={{ gap: 6 }}>
                <input type="checkbox" checked={!!block.split} onChange={(e) => onSketch((s) => S.setSplit(s, block.id, e.target.checked))} />
                {t('ideaTwoPerBar', lang)}
              </label>
              <select className="field small-field" value="" aria-label={t('ideaFill', lang)} onChange={(e) => {
                const p = S.PROGRESSIONS.find((x) => x.id === e.target.value);
                if (p) onSketch((s) => S.fillChords(s, block.id, p.degrees));
              }}>
                <option value="">{t('ideaFill', lang)}</option>
                {S.PROGRESSIONS.filter((p) => !!p.minor === minor).map((p) => (
                  <option key={p.id} value={p.id}>{p.degrees.map((d) => (triads[d] ? chordSymbol(triads[d], naming) : '?')).join(' – ')} ({p.id})</option>
                ))}
              </select>
            </div>
            <div className={`chord-bars${block.split ? ' split' : ''}`}>
              {Array.from({ length: block.bars }, (_, bar) => (
                <div key={bar} className={`chord-bar${sel && playingBar === sel.startBar + bar ? ' now' : ''}`}>
                  <span className="cb-n mono">{bar + 1}</span>
                  <div className="cb-slots">
                    {Array.from({ length: block.split ? 2 : 1 }, (_, h) => {
                      const i = bar * (block.split ? 2 : 1) + h;
                      const deg = block.chords[i];
                      const c = deg === null || deg === undefined ? null : triads[deg];
                      return (
                        <button key={h} type="button" className={`cb-slot${slot === i ? ' sel' : ''}${c ? '' : ' empty'}`} aria-pressed={slot === i}
                          onClick={() => { setSlot(i); if (deg !== null && deg !== undefined) hearChord(deg); }}
                          aria-label={`${t('bar', lang)} ${bar + 1}: ${c ? chordSymbol(c, naming) : t('noChord', lang)}`}>
                          {c ? <><strong>{chordSymbol(c, naming)}</strong><small>{c.roman}</small></> : <small>·</small>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="chordbar">
              {triads.map((c) => (
                <button key={c.degree} type="button" className="chordbtn" aria-pressed={block.chords[slot] === c.degree}
                  onClick={() => { onSketch((s) => S.setChordAt(s, block.id, slot, c.degree)); hearChord(c.degree); setSlot((x) => Math.min(block.chords.length - 1, x + 1)); }}>
                  <span>{chordSymbol(c, naming)}</span><small>{c.roman}</small>
                </button>
              ))}
              <button type="button" className="chordbtn" onClick={() => { onSketch((s) => S.setChordAt(s, block.id, slot, null)); setSlot((x) => Math.min(block.chords.length - 1, x + 1)); }}>
                <span>—</span><small>{t('noChord', lang)}</small>
              </button>
            </div>
          </div>

          <RhythmPicker groove={block.groove} fallback={sketch.style_group} lang={lang}
            onGroove={(g) => onSketch((s) => S.setGroove(s, block.id, g))}
            onEverywhere={(group) => onSketch((s) => S.setStyleEverywhere(s, group))} />
        </div>
      )}

    </section>
  );
}

function RhythmPicker({ groove, fallback, lang, onGroove, onEverywhere }: {
  groove: SketchGroove | null;
  fallback: string;
  lang: Lang;
  onGroove: (g: SketchGroove | null) => void;
  onEverywhere: (group: string) => void;
}) {
  const group = groove?.group ?? fallback;
  const genre = genreOfGroup(group);
  const feel: Feel = groove?.feel ?? 'normal';
  return (
    <div className="stack rhythm" style={{ gap: 8 }}>
      <div className="row wrap" style={{ gap: 8 }}>
        <span className="lbl grow">{t('ideaRhythm', lang)}</span>
        <label className="row small" style={{ gap: 6 }}>
          <input type="checkbox" checked={!groove} onChange={(e) => onGroove(e.target.checked ? null : { group, feel })} />
          {t('ideaNoDrums', lang)}
        </label>
      </div>
      {groove && (<>
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="seg" aria-label={t('genre', lang)}>
            {GENRES.map((g) => (
              <button key={g.id} type="button" aria-pressed={genre === g.id} onClick={() => onGroove({ group: S.STYLE_GROUPS(g.id)[0]?.id ?? group, feel })}>{g.title[lang]}</button>
            ))}
          </div>
          <select className="field" value={group} aria-label={t('ideaStyle', lang)} onChange={(e) => onGroove({ group: e.target.value, feel })}>
            {S.STYLE_GROUPS(genre).map((g) => <option key={g.id} value={g.id}>{g.title[lang]}</option>)}
          </select>
          <button type="button" className="btn small-btn ghost" onClick={() => onEverywhere(group)}>{t('ideaStyleAll', lang)}</button>
        </div>
        <div className="seg" aria-label={t('ideaFeel', lang)}>
          {S.FEELS.map((f) => <button key={f} type="button" aria-pressed={feel === f} onClick={() => onGroove({ group, feel: f })}>{t(FEEL_LABEL[f], lang)}</button>)}
        </div>
      </>)}
    </div>
  );
}
