# Colección drum kits

How the rock kits in `public/collection/drums/` are made. Nothing here runs in the app.

1. **Prepare each library** (SM Drums, Big Rusty Drums, MuldjordKit, DRSKit) into a common set of stereo one-shots,
   following `SOURCE-SPEC.md`: pieces kick, snare, tom1, tom2, hatClosed, hatOpen, ride, crash, china; soft, mid and
   hard layers; round robins; dry and (when the library has them) room files; one global gain per library.
2. **Build the kits:** `python3 -I build.py <drums dir with src/<library>/> <repo>`. Each recipe in `recipes.py`
   (one per kit, from the per-era research) tunes, damps, equalizes, compresses and places every piece in a
   generated room, then the kit bus; files are encoded to MP3 and `src/packs/collection-drums.json` gets each kit's
   files, layers and loudness trim (the test groove plays at -21 LUFS like every other instrument).
3. **Check:** `python3 -I analyze.py <repo> <kit ...>` prints decay, brightness, pitch and width per piece.

Needs ffmpeg (libmp3lame) and Python with numpy, scipy, soundfile, pyloudnorm and pedalboard.
Credits and licenses: `public/collection/drums/CREDITS.txt`.

# Real recordings for the core instruments

`orchestra.py` turns two CC0 libraries (VSCO 2 Community Edition and VCSL, both by Versilian Studios) into the
sampler sets behind the app's own piano, violin, strings, cello, upright bass, flute, trumpet, muted trumpet, horns,
tenor sax and vibraphone.

1. Clone both repos with `--filter=blob:none --no-checkout`, run `python3 -I orchestra.py select <vsco> <vcsl> list.json`,
   then `git checkout HEAD -- <files>` in each clone for the chosen files only.
2. `python3 -I orchestra.py build <vsco> <vcsl> <repo>`: every note is pitch-measured (YIN, to fix octave naming),
   trimmed, given a longer sustain by crossfading its steady middle, faded, levelled per layer (mf at -20 LUFS, f louder)
   and encoded to MP3 under `public/collection/strings/<set>/<layer>/`. Specs go to `src/packs/collection-strings.json`.

Credits: `public/collection/strings/CREDITS.txt`.
