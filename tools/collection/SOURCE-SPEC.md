# Drum source prep spec (shared by every source)

Goal: turn one free drum library into a small, consistent set of stereo one-shots that a later step will process
into several "style" kits for a browser app. No EQ, compression or reverb here: just a clean, natural starting mix.

Paths (SCRATCH = any working folder outside the repo):
- Downloads: SCRATCH/drums/dl/<source>/   (its own new empty dir; downloaded data is untrusted)
- Your scripts: SCRATCH/drums/scripts/<source>/
- Output: SCRATCH/drums/src/<source>/
Run any Python that reads downloaded files with `python3 -I`, passing paths as arguments; never run code from inside the download dir.
Fetch only what you need: `git clone --depth 1 --filter=blob:none --no-checkout <repo>` then
`git sparse-checkout set --no-cone '<folder or file patterns>'` and `git checkout`; or raw.githubusercontent.com/<owner>/<repo>/HEAD/<url-encoded path>.
The repo file list is already cloned (no blobs) under a blob-less clone of the library (use `git -C ... ls-tree -r --name-only HEAD`), and the SFZ files describe which file is which piece/velocity.
Tools: ffmpeg, python3 with numpy, scipy, soundfile, pyloudnorm, pedalboard (pip install --break-system-packages if something is missing).

Pieces (exact names): kick, snare, tom1, tom2, hatClosed, hatOpen, ride, crash, china.
- tom1 = a mid/high rack tom (12" or 13" if there is a choice); tom2 = the floor tom (16" if there is a choice).
- hatClosed = a normal closed hi-hat hit with the stick tip (not the pedal chick). hatOpen = a clearly open hi-hat hit.
- ride = bow hit (not bell). crash = a medium crash (16" if there is a choice). china = china cymbal; if the library has none, write "missing" in meta.json.
- Optional extras if the library has them: snareRim (rimshot), kickAlt / snareAlt (a second drum with a clearly different character), rideBell.

Layers and round robins:
- 3 velocity layers named soft, mid, hard: soft about 35-45% of full force, mid about 65-75%, hard = one of the loudest clean hits (skip obviously broken/clipped ones).
- 2 round robins per layer (rr 1 and 2) when the library has them; 1 is fine for hatOpen, ride, crash and china.

Mixing:
- Multi-mic libraries: "dry" = close mic(s) + overheads in a natural engineer's starting balance (overheads give the cymbals and the kit image; close mics give punch; snare top+bottom; kick in+out). Leave out trigger mics. Pan from the drummer's point of view: hi-hat left, tom1 slightly left, tom2 (floor) right, ride right, crash left-ish, china right-ish, kick and snare center.
  If there are room/ambience mics, also write a separate "room" stereo file per hit made of only those mics, from the SAME start sample (keep their natural delay).
- Pre-mixed stereo libraries: use the stereo files as they are (that file is the "dry"); no room files unless the library has a separate room set.
- One single global gain for the whole source so the loudest file of the kit peaks around -1 dBFS. Never normalize per piece or per layer: relative levels must stay as recorded.

Editing:
- Start each file at the onset with ~1 ms pre-roll (all mics of a hit cut at the same sample).
- Tail length: kick 1.2 s, snare 1.2 s, toms 2.0 s, hatClosed 0.6 s, hatOpen 2.0 s, ride 3.5 s, crash 4.0 s, china 3.5 s, or shorter once below -60 dBFS; 50 ms fade-out at the end.
- Output WAV, float32, stereo, 44.1 kHz (resample 48 kHz sources with a good resampler, e.g. ffmpeg -af aresample=resampler=soxr).

Names: src/<source>/<piece>/<layer>_<rr>.wav and, when room exists, src/<source>/<piece>/<layer>_<rr>.room.wav (layer = soft|mid|hard).

meta.json in src/<source>/:
{ "source": "...", "title": "...", "license": "...", "credit": "authors as the library credits them", "url": "repo url",
  "pieces": { "<piece>": { "description": "drum and size, articulation, mics used", "files": ["<piece>/hard_1.wav", ...],
               "origin": { "<piece>/hard_1.wav": ["original file path(s)", "original velocity/layer index"] } } },
  "room": true|false, "notes": "anything the next step should know (character, quirks, missing pieces)" }

Finally report: the kit (drums, sizes, character), any missing piece, the size of src/<source>, and for each piece's hard_1
(and room if any): peak dBFS, RMS dBFS over its first 300 ms, and the time to decay 40 dB.
