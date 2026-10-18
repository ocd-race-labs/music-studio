import { useState } from 'react';
import { EFFECTS, effectParams, INSTRUMENTS, KITS, PEDAL_GROUPS, pedalGroup, swapsFor, title as catalogTitle } from '../packs/core';
import type { ParamDef } from '../packs/core';
import { chordSymbol, diatonicTriads, SCALES, scaleSpellings, spellingToDisplay, tonicDisplay, TONICS } from '../theory';
import type { CatalogRef, Idea, Lang, Song, Track } from '../domain/types';
import { DEFAULT_SWING, defaultFxParams } from '../domain/factory';
import { namingFor, t } from './i18n';
import type { StringKey } from './i18n';
import { Icon, TrackBadge } from './ui';
import { dbLabel, dbOfGain, FADER_MAX_DB, FADER_MIN_DB, gainOfDb } from './levels';
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

/** What each pedal does, in a line; real terms, explained where they appear. */
export const PEDAL_BLURB: Record<string, { en: string; es: string }> = {
  'effect.drive': { en: 'Pushes the sound until it gets gritty, like an amp turned up.', es: 'Empuja el sonido hasta que se ensucia, como un amplificador a tope.' },
  'effect.delay': { en: 'Echoes that repeat in time with the beat.', es: 'Ecos que se repiten a tiempo con el beat.' },
  'effect.reverb': { en: 'The room: from a small studio to a cathedral.', es: 'La sala: de un estudio chico a una catedral.' },
  'effect.chorus': { en: 'Doubles the sound slightly out of tune: wide and shimmering, 80s and dream pop.', es: 'Duplica el sonido un poco desafinado: ancho y brillante, de los 80 y el dream pop.' },
  'effect.phaser': { en: 'A slow swirl that sweeps through the sound; psychedelic and funky.', es: 'Un remolino lento que recorre el sonido; psicodélico y funky.' },
  'effect.filter-sweep': { en: 'A filter that opens and closes by itself; the classic electronic build.', es: 'Un filtro que se abre y se cierra solo; el clásico de la electrónica.' },
  'effect.pump': { en: 'Ducks on every beat and swells back, as if the kick pushed the track. House and EDM.', es: 'Baja en cada tiempo y vuelve a subir, como si el bombo empujara la pista. House y EDM.' },
  'effect.pingpong': { en: 'Echoes that bounce left and right.', es: 'Ecos que rebotan de izquierda a derecha.' },
  'effect.lofi': { en: 'Fewer bits and a darker tone: an old sampler or a cassette. Lo-fi hip hop.', es: 'Menos bits y un tono más oscuro: un sampler antiguo o un cassette. Lo-fi hip hop.' },
  'effect.radio': { en: 'Only the middle of the sound, like a phone or an old radio. Great on vocals.', es: 'Solo el centro del sonido, como un teléfono o una radio antigua. Ideal en voces.' },
  'effect.octave': { en: 'Adds the same notes higher or lower; up for sparkle, down for weight.', es: 'Suma las mismas notas más agudas o más graves; arriba da brillo, abajo da peso.' },
  'effect.tremolo': { en: 'The volume pulses up and down; surf guitar and vintage keys.', es: 'El volumen late arriba y abajo; guitarra surf y teclados vintage.' },
  'effect.compressor': { en: 'Evens out loud and soft so the track sounds closer and punchier.', es: 'Empareja lo fuerte y lo suave para que la pista suene más cerca y con más golpe.' },
  'effect.eq': { en: 'More or less lows, mids and highs.', es: 'Más o menos graves, medios y agudos.' },
  'effect.widener': { en: 'Spreads the sound wider across left and right.', es: 'Abre el sonido más ancho entre izquierda y derecha.' },
  'effect.preamp': { en: 'The first stage of a mixing desk: clean, round like a transformer, or warm like a tube when pushed.', es: 'La primera etapa de una consola: limpia, redonda como un transformador o cálida como una válvula cuando se empuja.' },
  'effect.comp-studio': { en: 'Three classic compressors: fast and gritty for punch, smooth for voices, gentle glue for a whole kit. Mix blends it in parallel.', es: 'Tres compresores clásicos: rápido y con carácter para el golpe, suave para voces, pegamento para todo un kit. La mezcla lo suma en paralelo.' },
  'effect.amp': { en: 'A guitar or bass amplifier: how hard it is pushed and its bass, middle and treble knobs.', es: 'Un amplificador de guitarra o bajo: cuánto se empuja y sus perillas de graves, medios y agudos.' },
  'effect.cab': { en: 'The speaker box after the amp, as a microphone hears it; toward the edge sounds darker.', es: 'La caja de parlantes después del amplificador, como la escucha un micrófono; hacia el borde suena más oscuro.' },
  'effect.tape': { en: 'Recording to tape: soft saturation, a bump in the lows and gentler highs.', es: 'Grabar en cinta: saturación suave, un realce en los graves y agudos más suaves.' },
  'effect.gated-room': { en: 'A big room cut off sharply after each hit: the 80s drum sound.', es: 'Una sala grande que se corta en seco después de cada golpe: el sonido de batería de los 80.' },
};

export function formatParam(p: ParamDef, v: number): string {
  switch (p.unit) {
    case 's': return `${v.toFixed(1)} s`;
    case 'Hz': return v >= 100 ? `${Math.round(v)} Hz` : `${v.toFixed(1)} Hz`;
    case 'dB': return `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
    case 'st': return `${v > 0 ? '+' : ''}${Math.round(v)} st`;
    case 'bits': return `${Math.round(v)} bits`;
    default: return `${Math.round(v * 100)}%`;
  }
}

export function MixerPanel({ song, track, lang, onGain, onMute, onSolo, onKit, onBypass, onParam, onSwing, onResetSwing, onResetFx, onAddFx, onRemoveFx }: {
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
  onAddFx: (key: string) => void;
  onRemoveFx: (slot: number) => void;
}) {
  const swaps = track.instrument ? swapsFor(track.instrument.key) : [];
  return (
    <section className="card stack" aria-label={t('mixer', lang)}>
      <div className="row">
        <TrackBadge track={track} size="sm" />
        <h3 className="grow" style={{ fontSize: 16 }}>{track.name}: {t('mixer', lang).toLowerCase()}</h3>
        <button type="button" className="mini" aria-pressed={track.muted} onClick={onMute} aria-label={t('muteTrack', lang, { name: track.name })} title={t('muteHint', lang)}>M</button>
        <button type="button" className="mini" aria-pressed={track.solo} onClick={onSolo} aria-label={t('soloTrack', lang, { name: track.name })} title={t('soloHint', lang)}>S</button>
      </div>
      <label className="stack" style={{ gap: 4 }}>
        <span className="lbl">{t('volume', lang)} <span className="mono">{dbLabel(track.gain)} dB</span></span>
        <input type="range" min={FADER_MIN_DB} max={FADER_MAX_DB} step={0.5} value={dbOfGain(track.gain)} onChange={(e) => onGain(gainOfDb(Number(e.target.value)))} />
      </label>
      {swaps.length > 1 && (
        <label className="stack" style={{ gap: 4 }}>
          <span className="lbl">{t(track.kind === 'drums' ? 'kit' : 'instrument', lang)}</span>
          <select className="field" value={track.instrument?.key} onChange={(e) => {
            const pick = swaps.find((i) => i.key === e.target.value);
            if (pick) onKit({ key: pick.key, version: pick.version });
          }}>
            {swaps.some((i) => i.pack === 'collection') ? (
              <>
                <optgroup label={t('instrumentsCore', lang)}>
                  {swaps.filter((i) => i.pack !== 'collection').map((i) => <option key={i.key} value={i.key}>{i.title[lang]}</option>)}
                </optgroup>
                <optgroup label={t('collection', lang)}>
                  {swaps.filter((i) => i.pack === 'collection').map((i) => <option key={i.key} value={i.key}>{i.title[lang]}</option>)}
                </optgroup>
              </>
            ) : swaps.map((i) => <option key={i.key} value={i.key}>{i.title[lang]}</option>)}
          </select>
        </label>
      )}
      {track.kind === 'drums' && (
        <>
          <div className="stack" style={{ gap: 4 }}>
            <div className="row">
              <label className="lbl grow" htmlFor="swing">{t('swing', lang)} <span className="mono">{Math.round(song.swing * 100)}%</span></label>
              <ResetButton label={`${t('reset', lang)} ${t('swing', lang)}`} disabled={song.swing === DEFAULT_SWING} onClick={onResetSwing} />
            </div>
            <input id="swing" type="range" min={0} max={0.75} step={0.01} value={song.swing} onChange={(e) => onSwing(Number(e.target.value))} />
          </div>
        </>
      )}
      <Pedalboard track={track} lang={lang} onBypass={onBypass} onParam={onParam} onResetFx={onResetFx} onAddFx={onAddFx} onRemoveFx={onRemoveFx} />
    </section>
  );
}

/**
 * Pedals grouped by what they do, as a row of small stompboxes per group: the light turns a pedal on or off,
 * its name opens its knobs. Only one pedal is open at a time, so the panel stays short however many there are.
 */
function Pedalboard({ track, lang, onBypass, onParam, onResetFx, onAddFx, onRemoveFx }: {
  track: Track;
  lang: Lang;
  onBypass: (slot: number, bypass: boolean) => void;
  onParam: (slot: number, name: string, value: number) => void;
  onResetFx: (slot: number) => void;
  onAddFx: (key: string) => void;
  onRemoveFx: (slot: number) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const slots = track.fx_chain.slots.map((slot, i) => ({ slot, i }));
  const available = EFFECTS.filter((e) => !track.fx_chain.slots.some((x) => x.effect.key === e.key));
  return (
    <div className="stack" style={{ gap: 10 }}>
      <h4 style={{ fontSize: 14, margin: '4px 0 0' }}>{t('pedals', lang)} <span className="muted small">· {t('pedalsHint', lang)}</span></h4>
      {PEDAL_GROUPS.map((g) => {
        const items = slots.filter(({ slot }) => pedalGroup(slot.effect.key) === g);
        if (!items.length) return null;
        const opened = items.find(({ slot }) => slot.effect.key === open);
        return (
          <div key={g} className="pedal-group">
            <span className="lbl">{t(`group_${g}` as StringKey, lang)}</span>
            <div className="stomps">
              {items.map(({ slot, i }) => {
                const name = catalogTitle(slot.effect, lang);
                return (
                  <div key={slot.effect.key} className={`stomp${slot.bypass ? '' : ' on'}${open === slot.effect.key ? ' open' : ''}`}>
                    <button type="button" className="led" aria-pressed={!slot.bypass} onClick={() => onBypass(i, !slot.bypass)}
                      aria-label={`${name}: ${t(slot.bypass ? 'pedalOff' : 'pedalOn', lang)}`} title={t(slot.bypass ? 'turnOn' : 'turnOff', lang)} />
                    <button type="button" className="stomp-name" aria-expanded={open === slot.effect.key}
                      onClick={() => setOpen(open === slot.effect.key ? null : slot.effect.key)}>{name}</button>
                  </div>
                );
              })}
            </div>
            {opened && (
              <PedalEditor slot={opened.slot} lang={lang}
                onBypass={(b) => onBypass(opened.i, b)} onParam={(n, v) => onParam(opened.i, n, v)}
                onReset={() => onResetFx(opened.i)} onRemove={() => { onRemoveFx(opened.i); setOpen(null); }} onClose={() => setOpen(null)} />
            )}
          </div>
        );
      })}
      {available.length > 0 && (
        <label className="stack" style={{ gap: 4 }}>
          <span className="lbl">{t('addPedal', lang)}</span>
          <select className="field" value="" onChange={(e) => { if (e.target.value) { onAddFx(e.target.value); setOpen(e.target.value); } }}>
            <option value="">{t('choosePedal', lang)}</option>
            {PEDAL_GROUPS.map((g) => {
              const list = available.filter((x) => pedalGroup(x.key) === g);
              return list.length ? (
                <optgroup key={g} label={t(`group_${g}` as StringKey, lang)}>
                  {list.map((x) => <option key={x.key} value={x.key}>{x.title[lang]}</option>)}
                </optgroup>
              ) : null;
            })}
          </select>
        </label>
      )}
    </div>
  );
}

/** A setting with named values (amp model, compressor style): one button per value. */
export function ChoiceParam({ p, value, lang, disabled, onChange }: { p: ParamDef; value: number; lang: Lang; disabled?: boolean; onChange: (v: number) => void }) {
  return (
    <div className="stack" style={{ gap: 4 }} role="group" aria-label={p.label[lang]}>
      <span className="lbl">{p.label[lang]}</span>
      <div className="row wrap" style={{ gap: 4 }}>
        {p.choices!.map((c, i) => (
          <button key={c.en} type="button" className="chip" disabled={disabled} aria-pressed={Math.round(value) === i} onClick={() => onChange(i)}>{c[lang]}</button>
        ))}
      </div>
    </div>
  );
}

function PedalEditor({ slot, lang, onBypass, onParam, onReset, onRemove, onClose }: {
  slot: Track['fx_chain']['slots'][number];
  lang: Lang;
  onBypass: (bypass: boolean) => void;
  onParam: (name: string, value: number) => void;
  onReset: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const name = catalogTitle(slot.effect, lang);
  return (
    <div className="stack pedal" style={{ opacity: slot.bypass ? 0.8 : 1 }}>
      <div className="row" style={{ gap: 6 }}>
        <strong className="grow">{name}</strong>
        <button type="button" className="chip" aria-pressed={!slot.bypass} onClick={() => onBypass(!slot.bypass)}>
          {t(slot.bypass ? 'pedalOff' : 'pedalOn', lang)}
        </button>
        <ResetButton label={`${t('reset', lang)} ${name}`} disabled={sameParams(slot.params, defaultFxParams(slot.effect.key))} onClick={onReset} />
        <button type="button" className="btn icon ghost reset" onClick={onClose} aria-label={t('close', lang)} title={t('close', lang)}>
          <Icon name="close" size={16} />
        </button>
      </div>
      {PEDAL_BLURB[slot.effect.key] && <span className="small muted">{PEDAL_BLURB[slot.effect.key][lang]}</span>}
      {effectParams(slot.effect).map((p) => {
        const v = slot.params[p.name] ?? p.default;
        if (p.choices) return <ChoiceParam key={p.name} p={p} value={v} lang={lang} disabled={slot.bypass} onChange={(x) => onParam(p.name, x)} />;
        return (
          <label key={p.name} className="stack" style={{ gap: 2 }}>
            <span className="lbl">{p.label[lang]} <span className="mono">{formatParam(p, v)}</span></span>
            <input type="range" min={p.min} max={p.max} step={p.step ?? (p.max - p.min) / 100} value={v} disabled={slot.bypass}
              onChange={(e) => onParam(p.name, Number(e.target.value))} />
          </label>
        );
      })}
      <button type="button" className="btn ghost small-btn" style={{ alignSelf: 'flex-start' }} onClick={onRemove}>
        <Icon name="trash" size={16} /> {t('removePedal', lang, { name })}
      </button>
    </div>
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
      <TierLegend lang={lang} tonic={tonicDisplay(song.key_tonic, naming)} />
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
- Instruments (all version 1.0.0): ${INSTRUMENTS.map((i) => i.key).join(', ')}.
- Kits by genre (role: instrument): ${KITS.map((k) => `${k.title.en}: ${(k.manifest.slots as { role: string; instrument: string }[]).map((x) => `${x.role} ${x.instrument.replace('instrument.', '')}`).join(', ')}`).join('; ')}. Write each idea for the instrument of the song's kit that plays that role.
- A "pattern" payload is { "steps": 32, "rows": [ { "sound": { "key": "sound.kick", "version": "1.0.0" }, "hits": [ { "step": 0, "vel": 1 } ] } ] } with sounds sound.kick, sound.snare, sound.clap, sound.hat-closed, sound.hat-open, sound.rim, sound.tom, sound.crash (orchestral and latin percussion use the same eight places: a kick idea plays the bass drum or the low conga); steps are sixteenths.
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
