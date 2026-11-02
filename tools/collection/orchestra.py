"""Real recordings for the core acoustic instruments (piano, strings, winds, brass, vibraphone, upright bass).

Sources (both CC0 1.0, recorded by Versilian Studios and friends):
  VSCO 2 Community Edition  https://github.com/sgossner/VSCO-2-CE
  Versilian Community Sample Library (VCSL)  https://github.com/sgossner/VCSL

    python3 -I orchestra.py select <vsco clone> <vcsl clone> <out list.json>   # which files to fetch
    python3 -I orchestra.py build  <vsco clone> <vcsl clone> <repo>            # process, encode, write the specs

`select` only reads file names (clones made with --filter=blob:none --no-checkout); fetch the chosen files with
`git checkout HEAD -- <files>` in each clone, then `build`. Every note is measured for its real pitch (the libraries
name octaves differently), trimmed, evened out in loudness within its layer, and, for bowed and blown instruments,
given a longer sustain by crossfading its steady middle, so held notes do not stop short. Encoded to MP3 under
public/collection/strings/<set>/<layer>/; the specs go into src/packs/collection-strings.json.
"""
import json, os, re, subprocess, sys, tempfile
import numpy as np, soundfile as sf
from scipy.signal import resample_poly

SR = 44100
NOTE_RE = r"([A-G]#?)(-?\d)"
PCS = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
NAMES = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"]

# set: (library, folder, filename regex with groups note, octave, layer?, {layer tag: our layer}, kind, options)
SETS = {
    "piano": dict(lib="vcsl", folder="Chordophones/Zithers/Grand Piano, Steinway B/Sus",
                  rx=r"JHPiano_Sus_Close_" + NOTE_RE + r"_vl(\d)_rr1\.wav", layers={"2": "mf", "4": "f"},
                  kind="decay", length=6.0, stereo=True, every=3, release=0.35,
                  credit="Steinway B grand piano from the Versilian Community Sample Library"),
    "violin": dict(lib="vsco", folder="Strings/Solo Violin/Arco Vib",
                   rx=r"LLVln_ArcoVib_" + NOTE_RE + r"_(p|f)\.wav", layers={"p": "mf", "f": "f"},
                   kind="sustain", length=6.5, stereo=False, release=0.3,
                   credit="Solo violin from VSCO 2 Community Edition"),
    "strings": dict(lib="vsco", folder="Strings/Violin Section/susVib",
                    rx=r"VlnEns_susVib_" + NOTE_RE + r"_v(\d)\.wav", layers={"1": "mf", "2": "f"},
                    kind="sustain", length=6.5, stereo=True, release=0.45,
                    low=dict(folder="Strings/Cello Section/susvib", rx=r"susvib_" + NOTE_RE + r"_v(\d)_1\.wav", layers={"1": "mf", "3": "f"}),
                    credit="Violin and cello sections from VSCO 2 Community Edition"),
    "cello": dict(lib="vsco", folder="Strings/Cello Section/susvib",
                  rx=r"susvib_" + NOTE_RE + r"_v(\d)_1\.wav", layers={"1": "mf", "3": "f"},
                  kind="sustain", length=6.5, stereo=True, release=0.4,
                  credit="Cello section from VSCO 2 Community Edition"),
    "upright": dict(lib="vsco", folder="Strings/Solo Contrabass/Pizz",
                    rx=r"BKCtbss_Pizz_" + NOTE_RE + r"_v(\d)_rr1\.wav", layers={"1": "mf", "3": "f"},
                    kind="decay", length=2.6, stereo=False, mono=True, release=0.08,
                    credit="Solo contrabass (pizzicato) from VSCO 2 Community Edition"),
    "flute": dict(lib="vsco", folder="Woodwinds/Flute/susvib",
                  rx=r"LDFlute_susvib_" + NOTE_RE + r"_v1_1\.wav", layers={"": "mf"},
                  kind="sustain", length=6.5, stereo=False, release=0.25,
                  credit="Flute from VSCO 2 Community Edition"),
    "trumpet": dict(lib="vsco", folder="Brass/Trumpet/sus",
                    rx=r"Sum_SHTrumpet_sus_" + NOTE_RE + r"_v(\d)_rr1\.wav", layers={"1": "mf", "3": "f"},
                    kind="sustain", length=6.0, stereo=False, release=0.22,
                    credit="Trumpet from VSCO 2 Community Edition"),
    "trumpetMute": dict(lib="vsco", folder="Brass/Trumpet/straightM-sus",
                        rx=r"Sum_SHTrumpet_straightM-sus_" + NOTE_RE + r"_v(\d)_rr1\.wav", layers={"1": "mf", "3": "f"},
                        kind="sustain", length=6.0, stereo=False, release=0.22,
                        credit="Trumpet with straight mute from VSCO 2 Community Edition"),
    "horns": dict(lib="vsco", folder="Brass/F Horn/sus",
                  rx=r"MOHorn_sus_" + NOTE_RE + r"_v(\d)_1\.wav", layers={"1": "mf", "3": "f"},
                  kind="sustain", length=6.0, stereo=False, release=0.3,
                  credit="French horn from VSCO 2 Community Edition"),
    "sax": dict(lib="vcsl", folder="Aerophones/Reed Aerophones/Tenor Saxophone/Vibrato",
                rx=r"BrettTenor_Vib_Main_" + NOTE_RE + r"_var\d\.wav", layers={"": "mf"},
                kind="sustain", length=6.0, stereo=False, release=0.2,
                credit="Tenor saxophone from the Versilian Community Sample Library"),
    "vibes": dict(lib="vcsl", folder="Idiophones/Struck Idiophones/Vibraphone/Soft Mallets",
                  rx=r"Vibes_soft_" + NOTE_RE + r"_v(\d)_rr1_Main\.wav", layers={"1": "mf", "2": "f"},
                  kind="decay", length=5.0, stereo=True, release=0.5,
                  credit="Vibraphone (soft mallets) from the Versilian Community Sample Library"),
}
LIB_URL = {"vsco": "https://github.com/sgossner/VSCO-2-CE", "vcsl": "https://github.com/sgossner/VCSL"}


def ls(clone, folder):
    out = subprocess.run(["git", "-C", clone, "ls-tree", "--name-only", f"HEAD:{folder}"], capture_output=True, text=True).stdout
    return [x for x in out.splitlines() if x.lower().endswith(".wav")]


def named_midi(note, octave):
    return 12 * (int(octave) + 1) + PCS[note]


def candidates(clone, folder, rx, layers):
    """(file path, named midi, our layer) for every file that matches, one per note and layer."""
    found = {}
    for f in ls(clone, folder):
        m = re.fullmatch(rx, f)
        if not m:
            continue
        tag = m.group(3) if m.lastindex and m.lastindex >= 3 else ""
        layer = layers.get(tag)
        if layer is None:
            continue
        key = (named_midi(m.group(1), m.group(2)), layer)
        found.setdefault(key, f"{folder}/{f}")
    return [(p, n, l) for (n, l), p in sorted(found.items())]


def thin(items, every):
    """Keep about one note every `every` semitones per layer (the sampler bends the notes between)."""
    out = []
    for layer in sorted({l for _, _, l in items}):
        notes = sorted([(n, p) for p, n, l in items if l == layer])
        last = -99
        for n, p in notes:
            if n - last >= every or n == notes[-1][0]:
                out.append((p, n, layer)); last = n
    return out


def selection(vsco, vcsl):
    clones = {"vsco": vsco, "vcsl": vcsl}
    sel = {}
    for name, s in SETS.items():
        clone = clones[s["lib"]]
        items = thin(candidates(clone, s["folder"], s["rx"], s["layers"]), s.get("every", 1))
        if "low" in s:
            lo = s["low"]
            main_low = min(n for _, n, _ in items) if items else 999
            items += [x for x in thin(candidates(clone, lo["folder"], lo["rx"], lo["layers"]), 2) if x[1] < main_low]
        sel[name] = [{"lib": s["lib"], "path": p, "named": n, "layer": l} for p, n, l in items]
    return sel


# ---------------------------------------------------------------- analysis

def f0(x, sr):
    """Fundamental frequency of the steady part (YIN-style difference function)."""
    n = len(x)
    seg = x[int(n * 0.25): int(n * 0.25) + min(int(sr * 0.25), n // 2)]
    if len(seg) < 2048:
        seg = x[: min(n, 8192)]
    seg = seg - seg.mean()
    tmin, tmax = int(sr / 2200), int(sr / 25)
    w = len(seg) - tmax - 1
    if w < 512:
        return None
    d = np.array([np.sum((seg[:w] - seg[t:t + w]) ** 2) for t in range(tmin, tmax)])
    cmnd = d * np.arange(1, len(d) + 1) / np.maximum(np.cumsum(d), 1e-12)
    below = np.where(cmnd < 0.15)[0]
    i = below[0] if len(below) else int(np.argmin(cmnd))
    while i + 1 < len(cmnd) and cmnd[i + 1] < cmnd[i]:
        i += 1
    return sr / (i + tmin)


def midi_of(freq):
    return 69 + 12 * np.log2(freq / 440.0)


def octave_shift(notes):
    """The libraries name octaves differently: the offset (a multiple of 12) between names and measured pitch."""
    diffs = [round((m - n) / 12) * 12 for n, m in notes if m is not None and abs((m - n) - round((m - n) / 12) * 12) < 0.6]
    if not diffs:
        return 0
    vals, counts = np.unique(diffs, return_counts=True)
    return int(vals[np.argmax(counts)])


def load(path, stereo):
    x, sr = sf.read(path, always_2d=True, dtype="float32")
    if sr != SR:
        g = np.gcd(sr, SR)
        x = resample_poly(x, SR // g, sr // g, axis=0).astype("float32")
    if not stereo or x.shape[1] == 1:
        x = x.mean(axis=1, keepdims=True)
    return x[:, :2]


def trim_start(x):
    env = np.abs(x).max(axis=1)
    peak = env.max() or 1
    i = int(np.argmax(env > peak * 0.03))
    return x[max(0, i - int(SR * 0.004)):]


def quick_speak(x):
    """Bowed and blown notes swell in slowly; start where the note is almost at full level, so short notes speak."""
    e = np.sqrt(np.convolve((x ** 2).mean(axis=1), np.ones(int(SR * 0.02)) / int(SR * 0.02), mode="same"))
    steady = float(np.median(e[int(SR * 0.8):int(SR * 2.5)])) if len(e) > SR * 2.5 else float(e.max())
    i = int(np.argmax(e > steady * 0.35))
    i = max(0, min(i - int(SR * 0.015), int(SR * 0.6)))
    return fade(x[i:], 0.012, at_end=False)


def fade(x, secs, at_end=True):
    n = min(len(x), int(SR * secs))
    if n <= 1:
        return x
    curve = np.linspace(1, 0, n)[:, None] if at_end else np.linspace(0, 1, n)[:, None]
    y = x.copy()
    if at_end:
        y[-n:] *= curve
    else:
        y[:n] *= curve
    return y


def extend_sustain(x, length):
    """Hold the note longer: crossfade copies of its steady middle until it lasts `length` seconds."""
    target = int(SR * length)
    if len(x) >= target:
        return x[:target]
    n = len(x)
    a, b = int(n * 0.35), int(n * 0.85)
    if b - a < int(SR * 0.5):
        a, b = int(n * 0.2), int(n * 0.9)
    loop = x[a:b]
    xf = min(int(SR * 0.15), len(loop) // 3)
    out = x[:b]
    while len(out) < target + xf:
        t = np.linspace(0, np.pi / 2, xf)[:, None]
        head = out[-xf:] * np.cos(t) + loop[:xf] * np.sin(t)
        out = np.concatenate([out[:-xf], head, loop[xf:]])
    return out[:target]


def lufs(x):
    import pyloudnorm as pyln
    seg = x[: int(SR * 1.5)]
    if len(seg) < int(SR * 0.45):
        seg = np.pad(seg, ((0, int(SR * 0.45) - len(seg)), (0, 0)))
    try:
        v = pyln.Meter(SR).integrated_loudness(seg if seg.shape[1] > 1 else seg[:, 0])
    except Exception:
        v = -70
    return v if np.isfinite(v) else -70


def encode(x, out_path, stereo):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav") as w:
        sf.write(w.name, np.clip(x, -1, 1), SR, subtype="PCM_16")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", w.name, "-c:a", "libmp3lame", "-b:a", "112k" if stereo else "80k",
                        "-ac", "2" if stereo else "1", out_path], check=True)


def build(vsco, vcsl, repo):
    clones = {"vsco": vsco, "vcsl": vcsl}
    sel = selection(vsco, vcsl)
    spec_path = os.path.join(repo, "src", "packs", "collection-strings.json")
    specs = json.load(open(spec_path))
    out_root = os.path.join(repo, "public", "collection", "strings")
    report = {}
    for name, items in sel.items():
        s = SETS[name]
        stereo = s["stereo"]
        notes = []
        for it in items:
            p = os.path.join(clones[it["lib"]], it["path"])
            if not os.path.exists(p):
                print("missing", p); continue
            x = trim_start(load(p, stereo))
            fr = f0(x[:, 0], SR)
            notes.append(dict(it, x=x, measured=midi_of(fr) if fr else None))
        if not notes:
            print(name, "nothing to build"); continue
        shift = octave_shift([(n["named"], n["measured"]) for n in notes])
        for n in notes:
            n["midi"] = n["named"] + shift
            x = n["x"]
            if s["kind"] == "sustain":
                x = fade(extend_sustain(quick_speak(x), s["length"]), 0.25)
            else:
                x = fade(x[: int(SR * s["length"])], 0.3)
            n["x"] = fade(x, 0.002, at_end=False)
            n["lufs"] = lufs(n["x"])
        # Even each layer out (a register never jumps out), keeping the step between soft and loud.
        by_layer = {}
        for n in notes:
            by_layer.setdefault(n["layer"], []).append(n)
        med = {l: float(np.median([n["lufs"] for n in v])) for l, v in by_layer.items()}
        step = float(np.clip(med.get("f", med.get("mf", -20)) - med.get("mf", -20), 2.5, 7)) if "f" in med and "mf" in med else 0
        layers = {}
        folder = os.path.join(out_root, name)
        for l, v in by_layer.items():
            goal = -20.0 + (step if l == "f" else 0)
            for n in v:
                g = 10 ** ((goal - n["lufs"]) / 20)
                y = n["x"] * g
                pk = np.abs(y).max()
                if pk > 0.97:
                    y *= 0.97 / pk
                fname = f"{NAMES[n['midi'] % 12]}{n['midi'] // 12 - 1}.mp3"
                encode(y, os.path.join(folder, l, fname), stereo)
                layers.setdefault(l, {})[str(n["midi"])] = f"{l}/{fname}"
        layers = {l: dict(sorted(v.items(), key=lambda kv: int(kv[0]))) for l, v in layers.items()}
        specs[name] = {"folder": name, "layers": layers, "release": s["release"], "split": 0.85, "license": "CC0 1.0", "credit": s["credit"], "url": LIB_URL[s["lib"]]}
        lo, hi = min(n["midi"] for n in notes), max(n["midi"] for n in notes)
        report[name] = dict(notes=len(notes), shift=shift, range=[lo, hi], step_db=round(step, 1))
        print(name, report[name])
    json.dump(specs, open(spec_path, "w"), indent=1)
    open(spec_path, "a").write("\n")
    return report


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "select":
        sel = selection(sys.argv[2], sys.argv[3])
        json.dump(sel, open(sys.argv[4], "w"), indent=1)
        for k, v in sel.items():
            print(k, len(v))
    elif cmd == "build":
        build(sys.argv[2], sys.argv[3], sys.argv[4])
