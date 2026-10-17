# Music Studio

A family web app to make music: a Musician hat (notes, keys, chords, scale colors) and a Producer hat (beats, sounds, mix, pedals). It runs in the browser on a tablet or a laptop. No account, no server; songs stay on the device.

## What v1 has

- 2 drum kits, synthesized in the browser: boom bap and trap (kick, snare, clap, closed hat, open hat, rim, tom, crash)
- 5 instruments: 808 bass, electric piano, warm pad, bright lead, strings
- 3 pedals per track: drive, delay, reverb
- Key and scale selector; notes are colored as chord tone, in the scale, or outside
- Loops of 1, 2, 4 or 8 bars, swing, mute and solo, undo and redo
- Ideas from Claude arrive as a file (`music-studio.ideas` v1); import, listen, keep or dismiss
- Song files (`.mstudio.json`), versions, and a full backup
- Lab page for device tests: audio timing, tap latency, MIDI, mic recording to WAV, guide voice

No samples are downloaded and nothing needs a license: every sound is made by code.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # theory, domain, store and WAV tests
npm run build      # production build in dist/
```

Node 22 or newer.

## How it is built

- `src/theory`: music theory as pure functions (spelling, scales, chords, note tiers)
- `src/packs`: the catalog of instruments, sounds and effects, each with a key and a pinned version
- `src/domain`: song types, commands (the only way to change a song), file formats and schemas
- `src/store`: one song store interface; IndexedDB for profiles, memory for guests
- `src/engine`: Tone.js voices, the playback engine, and the WAV recorder
- `src/app`: the screens
- `db/`: the future database schema (not used by v1)

Units: 960 ticks per quarter note, MIDI pitch with spelled names (`Db4`), linear gain shown in dB.

## Deploy

Every push to `main` builds and publishes to GitHub Pages through `.github/workflows/deploy.yml`. In the repository settings, Pages must use "GitHub Actions" as the source.

## Privacy

Profiles are created on first run and stored only in that browser. The code holds no personal data.
