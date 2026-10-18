import { effectParams, INSTRUMENTS, title as catalogTitle } from '../packs/core';
import { chordSymbol, diatonicTriads, SCALES, scaleSpellings, spellingToDisplay, tonicDisplay, TONICS } from '../theory';
import type { CatalogRef, Idea, Lang, Song, Track } from '../domain/types';
import { DEFAULT_SWING, defaultFxParams } from '../domain/factory';
import { namingFor, t } from './i18n';
import { Icon } from './ui';
import { chordAtBar, songKey, TierLegend } from './editors';


/* ---------------------------------------------------------------- producer: mix and pedals */

/** Back to where a new song starts. Disabled while the values are already there. */
function ResetButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className="btn icon ghost reset" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <Icon name="reset" size={18} />
    </button>
  );
}

const sameParams = (a: Record<string, number>, b: Record<string, number>) =>
  Object.keys(b).every((k) => Math.abs((a[k] ?? b[k]) - b[k]) < 1e-6);

export function MixerPanel({ song, track, lang, onGain, onMute, onSolo, onKit, onBypass, onParam, onSwing, onResetSwing, onResetFx }: {
  song: Song;
  track: Track;
  lang: Lang;
  onGain: (g: number) => void;
  onMute: () => void;
  onSolo: () => void;
  onKit: (r: CatalogRef) => void;
  onBypass: (slot: number, bypass: boolean) => void;
  onParam: (slot: number, name: string, value: number) => void;
  onSwing: (v: number) => void;
  onResetSwing: () => void;
  onResetFx: (slot: number) => void;
}) {
  const kits = INSTRUMENTS.filter((i) => (i.manifest as { type?: string }).type === 'drumkit');
  return (
    <section className="card stack" aria-label={t('mixer', lang)}>
      <div className="row">
        <span className="swatch" style={{ background: track.color }} />
        <h3 className="grow" style={{ fontSize: 16 }}>{track.name}: {t('mixer', lang).toLowerCase()}</h3>
        <button type="button" className="mini" aria-pressed={track.muted} onClick={onMute} aria-label={t('muteTrack', lang, { name: track.name })}>M</button>
        <button type="button" className="mini" aria-pressed={track.solo} onClick={onSolo} aria-label={t('soloTrack', lang, { name: track.name })}>S</button>
      </div>
      <label className="stack" style={{ gap: 4 }}>
        <span className="lbl">{t('volume', lang)} <span className="mono">{track.gain <= 0.0001 ? '-∞' : (20 * Math.log10(track.gain)).toFixed(1)} dB</span></span>
        <input type="range" min={0} max={1} step={0.01} value={track.gain} onChange={(e) => onGain(Number(e.target.value))} />
      </label>
      {track.kind === 'drums' && (
        <>
          <div className="stack" style={{ gap: 6 }}>
            <span className="lbl">{t('kit', lang)}</span>
            <div className="seg">
              {kits.map((k) => (
                <button key={k.key} type="button" aria-pressed={track.instrument?.key === k.key} onClick={() => onKit({ key: k.key, version: k.version })}>
                  {k.title[lang].replace(/^.*: /, '')}
                </button>
              ))}
            </div>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <div className="row">
              <label className="lbl grow" htmlFor="swing">{t('swing', lang)} <span className="mono">{Math.round(song.swing * 100)}%</span></label>
              <ResetButton label={`${t('reset', lang)} ${t('swing', lang)}`} disabled={song.swing === DEFAULT_SWING} onClick={onResetSwing} />
            </div>
            <input id="swing" type="range" min={0} max={0.75} step={0.01} value={song.swing} onChange={(e) => onSwing(Number(e.target.value))} />
          </div>
        </>
      )}
      {track.fx_chain.slots.map((slot, i) => (
        <div key={slot.effect.key} className="stack" style={{ gap: 6, padding: 12, borderRadius: 12, background: 'var(--raised)', opacity: slot.bypass ? 0.75 : 1 }}>
          <div className="row">
            <strong className="grow">{catalogTitle(slot.effect, lang)}</strong>
            {!slot.bypass && (
              <ResetButton label={`${t('reset', lang)} ${catalogTitle(slot.effect, lang)}`}
                disabled={sameParams(slot.params, defaultFxParams(slot.effect.key))} onClick={() => onResetFx(i)} />
            )}
            <button type="button" className="chip" aria-pressed={!slot.bypass} onClick={() => onBypass(i, !slot.bypass)}>
              {t(slot.bypass ? 'pedalOff' : 'pedalOn', lang)}
            </button>
          </div>
          {!slot.bypass && effectParams(slot.effect).map((p) => (
            <label key={p.name} className="stack" style={{ gap: 2 }}>
              <span className="lbl">{p.label[lang]} <span className="mono">{p.unit === 's' ? `${(slot.params[p.name] ?? p.default).toFixed(1)} s` : `${Math.round((slot.params[p.name] ?? p.default) * 100)}%`}</span></span>
              <input type="range" min={p.min} max={p.max} step={(p.max - p.min) / 100} value={slot.params[p.name] ?? p.default} onChange={(e) => onParam(i, p.name, Number(e.target.value))} />
            </label>
          ))}
        </div>
      ))}
    </section>
  );
}

/* ---------------------------------------------------------------- musician: theory */

export function TheoryPanel({ song, lang, focusBar, onKey }: {
  song: Song;
  lang: Lang;
  focusBar: number;
  onKey: (tonic: string, mode: string) => void;
}) {
  const key = songKey(song);
  const chord = chordAtBar(song, focusBar);
  const naming = namingFor(lang);
  return (
    <section className="card stack" aria-label={t('key', lang)}>
      <h3 style={{ fontSize: 16 }}>{t('key', lang)}</h3>
      <div className="row wrap">
        <select className="field" aria-label={t('tonic', lang)} value={song.key_tonic} onChange={(e) => onKey(e.target.value, song.key_mode)}>
          {TONICS.map((tn) => <option key={tn} value={tn}>{tonicDisplay(tn, naming)}</option>)}
        </select>
        <select className="field grow" aria-label={t('scale', lang)} value={song.key_mode} onChange={(e) => onKey(song.key_tonic, e.target.value)}>
          {SCALES.map((s) => <option key={s.id} value={s.id}>{s.name[lang]}</option>)}
        </select>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        {scaleSpellings(key).map((s) => spellingToDisplay(s, naming)).join('  ')}
      </p>
      <TierLegend lang={lang} />
      <div className="stack" style={{ gap: 6 }}>
        <span className="lbl">{t('chordsOfKey', lang)}</span>
        <div className="row wrap" style={{ gap: 6 }}>
          {diatonicTriads(key).map((c) => (
            <span key={c.degree} className="chip" aria-pressed={chord?.degree === c.degree} style={{ flexDirection: 'column', gap: 0, minHeight: 48, justifyContent: 'center' }}>
              <strong>{chordSymbol(c, naming)}</strong><span className="small muted">{c.roman}</span>
            </span>
          ))}
        </div>
        {chord && <span className="small muted">{t('barChord', lang, { n: focusBar + 1, chord: chordSymbol(chord, naming) })}</span>}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- ideas tray */

export const CLAUDE_INSTRUCTIONS = `Write ideas for my Music Studio app as a JSON file, using exactly this format:

{
  "format": "music-studio.ideas",
  "version": 1,
  "song_title": "<song name>",
  "ideas": [
    {
      "kind": "melody",            // melody | clip | pattern | chords
      "title": "Short name of the idea",
      "prompt": "What I asked for",
      "target_instrument": { "key": "instrument.lead-bright", "version": "1.0.0" },
      "payload": { "notes": [ { "tick": 0, "dur": 480, "midi": 65, "vel": 0.8 } ] }
    }
  ]
}

Rules:
- Time is in ticks: 960 per quarter note, 240 per sixteenth, 3840 per bar of 4/4. Keep notes inside the loop length I give you.
- "midi" is the MIDI note number (60 = middle C). "vel" goes from 0 to 1.
- Instruments: instrument.bass-808, instrument.keys-ep, instrument.pad-warm, instrument.lead-bright, instrument.strings-ensemble, instrument.drums-boom-bap, instrument.drums-trap (all version 1.0.0).
- A "pattern" payload is { "steps": 32, "rows": [ { "sound": { "key": "sound.kick", "version": "1.0.0" }, "hits": [ { "step": 0, "vel": 1 } ] } ] } with sounds sound.kick, sound.snare, sound.clap, sound.hat-closed, sound.hat-open, sound.rim, sound.tom, sound.crash; steps are sixteenths.
- A "chords" payload is { "chords": [ { "tick": 0, "dur": 3840, "degree": 0 } ] }, where degree 0 to 6 is the chord built on that note of the key (0 = I).
- Give 2 or 3 options when it makes sense. Reply with the JSON file only.`;

export function IdeasTray({ ideas, tracks, lang, onImport, onListen, onKeep, onDismiss, onCopyHelp }: {
  ideas: Idea[];
  tracks: Track[];
  lang: Lang;
  onImport: () => void;
  onListen: (idea: Idea) => void;
  onKeep: (idea: Idea, trackId: string) => void;
  onDismiss: (idea: Idea) => void;
  onCopyHelp: () => void;
}) {
  const open = ideas.filter((i) => i.status === 'proposed');
  const fits = (idea: Idea, tr: Track) => {
    const p = idea.payload as Record<string, unknown>;
    const kind = tr.clips[0]?.kind;
    return (Array.isArray(p.notes) && kind === 'notes') || (Array.isArray(p.rows) && kind === 'pattern') || (Array.isArray(p.chords) && kind === 'chords');
  };
  return (
    <section className="card stack" aria-label={t('ideas', lang)}>
      <div className="row">
        <h3 className="grow" style={{ fontSize: 16 }}>{t('ideas', lang)}</h3>
        <button type="button" className="btn" onClick={onImport}><Icon name="upload" size={18} /> {t('importIdeas', lang)}</button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>{t('ideasHint', lang)}</p>
      <button type="button" className="btn ghost" onClick={onCopyHelp} style={{ justifyContent: 'flex-start' }}>{t('copyFormat', lang)}</button>
      {open.map((idea) => {
        const options = tracks.filter((tr) => fits(idea, tr));
        const preferred = options.find((tr) => tr.instrument?.key === idea.target_instrument?.key) ?? options[0];
        return (
          <div key={idea.id} className="stack" style={{ gap: 8, padding: 12, borderRadius: 12, background: 'var(--raised)' }}>
            <strong>{idea.title}</strong>
            {idea.prompt && <span className="small muted">“{idea.prompt}”</span>}
            {idea.validation && <span className="small warn">{idea.validation.join(' ')}</span>}
            {options.length > 0 ? (
              <label className="row small">
                <span className="muted">{t('into', lang)}</span>
                <select className="field grow" id={`target-${idea.id}`} defaultValue={preferred?.id}>
                  {options.map((tr) => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
                </select>
              </label>
            ) : <span className="small warn">{t('noTrackFits', lang)}</span>}
            <div className="row">
              <button type="button" className="btn grow" onClick={() => onListen(idea)}>{t('listen', lang)}</button>
              <button type="button" className="btn primary grow" disabled={!options.length} onClick={() => {
                const sel = document.getElementById(`target-${idea.id}`) as HTMLSelectElement | null;
                onKeep(idea, sel?.value ?? preferred!.id);
              }}>{t('keep', lang)}</button>
              <button type="button" className="btn ghost" onClick={() => onDismiss(idea)}>{t('dismiss', lang)}</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
