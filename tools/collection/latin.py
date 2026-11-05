"""Real recordings for the latin percussion and the unplugged kit (cajón), from VCSL (CC0 1.0, Versilian Studios).

    python3 -I latin.py <vcsl clone> <repo>

Clone VCSL with --filter=blob:none --no-checkout and check out only the folders named below. Every hit is trimmed
to its attack, cut to a short length with a fade, and levelled per piece (the hardest layer at the same loudness
for every piece, softer layers keeping their real difference). Encoded to MP3 under public/collection/drums/<kit>/;
the kit specs are merged into src/packs/collection-drums.json.
"""
import json, os, subprocess, sys, tempfile
import numpy as np, soundfile as sf, pyloudnorm as pyln
from scipy.signal import resample_poly

SR = 44100
I = "Idiophones/Struck Idiophones/"
M = "Membranophones/Struck Membranophones/"

def vl(folder, stem, vs, rrs=("rr1", "rr2"), tail="_Mid"):
    return [[f"{folder}{stem}_v{v}_{rr}{tail}.wav" for rr in rrs] for v in vs]

CAJON = I + "Cajon/"
KITS = {
    # A standard kit's rows, played by hand: cajón, shaker, tambourine, claves, tumba and a suspended cymbal.
    "unplugged": {
        "kick": dict(layers=[[CAJON + f"Cajon_hit2_{d}_{r}.wav" for r in ("rr1", "rr2")] for d in ("pp", "mp", "f")], length=0.9, gain=0),
        "snare": dict(layers=[[CAJON + f"Cajon_hit1_{d}_{r}.wav" for r in ("rr1", "rr2")] for d in ("mp", "f", "fff")], length=0.8, gain=-1),
        "clap": dict(layers=[[I + f"Claps/Clap_rr{n}.wav" for n in range(1, 7)]], length=0.6, gain=-3),
        "hatClosed": dict(layers=[[I + f"Shaker, Small/Mid_ShakerHighFaster_{d}_{r}.wav" for d in ("Down", "Up") for r in ("rr1", "rr2")]], length=0.35, gain=-6),
        "hatOpen": dict(layers=[[I + "Tambourine 1/Tamb1_Hit_v1_rr1_Mid.wav"], [I + "Tambourine 1/Tamb1_Hit_v2_rr1_Mid.wav"]], length=1.0, gain=-5),
        "rim": dict(layers=[[I + f"Claves/Claves1_Hit_v{v}_rr1_Mid.wav"] for v in (1, 2, 3)], length=0.5, gain=-5),
        "tom": dict(layers=vl(M + "Conga/", "Tumba_HitN", (1, 2, 3, 4), tail="_Sum"), length=0.9, gain=-2),
        "crash": dict(layers=[[I + f"Suspended Cymbal 1/susCymb1_hit_{d}1.wav"] for d in ("mp", "f", "fff")], length=3.0, gain=-6),
    },
    # Latin hand percussion, in the latin rows: tumba, conga, bongó, güiro, shaker, clave, agogó, two cencerros.
    "latin-perc": {
        "congaLow": dict(layers=vl(M + "Conga/", "Tumba_HitN", (1, 2, 3, 4), tail="_Sum"), length=0.9, gain=0),
        "congaHigh": dict(layers=vl(M + "Conga/", "Conga_HitN", (1, 2, 3), tail="_Sum"), length=0.8, gain=0),
        "bongo": dict(layers=vl(M + "Bongos/", "BongoH_Hit1", (1, 2, 3)), length=0.7, gain=-1),
        "guiro": dict(layers=[[I + "Guiro/Guiro_Hit_rr1_Mid.wav", I + "Guiro/Guiro_Hit_rr2_Mid.wav"]], length=0.6, gain=-5),
        "maracas": dict(layers=[[I + f"Shaker, Small/Mid_ShakerHighFaster_{d}_{r}.wav" for d in ("Down", "Up") for r in ("rr1", "rr2")]], length=0.35, gain=-6),
        "clave": dict(layers=[[I + f"Claves/Claves2_Hit_v{v}_rr1_Mid.wav"] for v in (1, 2, 3)], length=0.5, gain=-4),
        "agogo": dict(layers=[[I + f"Agogo Bells/Agogo_High_v{v}_rr1_Mid.wav"] for v in (1, 2, 3)], length=0.9, gain=-6),
        # Two bells, as on a timbal stand: the low mambo bell (about 460 Hz) and the high cha-cha bell (about 690 Hz).
        "cowbell": dict(layers=[[I + f"Cowbells/Cowbell2_Normal_v{v}_rr1_Mid.wav"] for v in (2, 3)], length=0.9, gain=-6),
        "cowbellHigh": dict(layers=[[I + f"Cowbells/Cowbell1_Normal_v{v}_rr1_Mid.wav"] for v in (2, 3)], length=0.8, gain=-2),
    },
}
TRIM_TO = -21.0  # LUFS of the kit's test groove, like every other instrument

def load(path):
    x, sr = sf.read(path, always_2d=True)
    x = x.T.astype(np.float64)
    if x.shape[0] == 1:
        x = np.vstack([x, x])
    if sr != SR:
        x = resample_poly(x, SR, sr, axis=1)
    return x

def trim(x, length):
    env = np.abs(x).max(0)
    start = int(np.argmax(env > 0.02 * env.max()))
    start = max(0, start - int(SR * 0.0008))
    y = x[:, start:start + int(SR * length)].copy()
    n = min(y.shape[1], int(SR * min(0.25, length * 0.4)))
    y[:, -n:] *= np.linspace(1, 0, n) ** 2
    return y

def peak_db(x):
    return 20 * np.log10(np.abs(x).max() + 1e-9)

def encode(x, out):
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav") as w:
        sf.write(w.name, np.clip(x.T, -1, 1), SR, subtype="PCM_16")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", w.name, "-c:a", "libmp3lame", "-b:a", "112k", out], check=True)

def groove(pieces):
    """Two bars of eighths through every piece, for the loudness trim."""
    bar = int(SR * 60 / 100 * 4)
    out = np.zeros((2, bar * 2 + SR * 3))
    names = list(pieces)
    for i in range(16):
        x = pieces[names[i % len(names)]][-1][0]
        at = i * bar // 8
        out[:, at:at + x.shape[1]] += x[:, : out.shape[1] - at]
    return out

def build(vcsl, repo):
    specs_path = os.path.join(repo, "src/packs/collection-drums.json")
    specs = json.load(open(specs_path))
    for kit, pieces in KITS.items():
        folder = os.path.join(repo, "public/collection/drums", kit)
        made, spec = {}, {}
        for name, p in pieces.items():
            layers = [[trim(load(os.path.join(vcsl, f)), p["length"]) for f in layer] for layer in p["layers"]]
            # Alternate takes of one layer play at one level (the shakes up and down differ by up to 15 dB).
            layers = [[x * 10 ** ((max(peak_db(y) for y in layer) - peak_db(x)) / 20) for x in layer] for layer in layers]
            g = 10 ** ((-3 + p["gain"] - peak_db(np.hstack(layers[-1]))) / 20)
            layers = [[x * g for x in layer] for layer in layers]
            made[name] = layers
            files = []
            for li, layer in enumerate(layers):
                tag = "smh"[li] if len(layers) <= 3 else f"v{li + 1}"
                names = []
                for ri, x in enumerate(layer):
                    fn = f"{name}-{tag}{ri + 1}.mp3"
                    encode(x, os.path.join(folder, fn))
                    names.append(fn)
                files.append(names)
            spec[name] = {"layers": files}
        loud = pyln.Meter(SR).integrated_loudness(groove(made).T)
        specs[kit] = {"id": kit, "trimDb": round(TRIM_TO - loud, 1), "pieces": spec,
                      "license": "CC0 1.0", "source": "Versilian Community Sample Library (VCSL)",
                      "bytes": sum(os.path.getsize(os.path.join(folder, f)) for f in os.listdir(folder))}
        print(kit, "groove", round(loud, 1), "LUFS → trim", specs[kit]["trimDb"])
    json.dump(specs, open(specs_path, "w"), indent=1, ensure_ascii=False)

if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
