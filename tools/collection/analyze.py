"""Print measurable traits of built kits: decay, brightness, pitch, width, so recipes can be checked against the research."""
import os, subprocess, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dsp

APP = sys.argv[1]
kits = sys.argv[2:]
spec = json.load(open(os.path.join(APP, 'src/packs/collection-drums.json')))

def decode(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '2', '-ar', '44100', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2)

def centroid(x):
    m = x.mean(axis=1)[: int(0.3 * 44100)]
    s = np.abs(np.fft.rfft(m * np.hanning(len(m))))
    f = np.fft.rfftfreq(len(m), 1 / 44100)
    return float((s * f).sum() / max(s.sum(), 1e-9))

def widthr(x):
    mid = (x[:, 0] + x[:, 1]) / 2; side = (x[:, 0] - x[:, 1]) / 2
    return float(np.sqrt((side ** 2).mean() / max((mid ** 2).mean(), 1e-12)))

for k in kits:
    s = spec[k]
    print(f'== {k}  trim {s["trimDb"]}  {s["bytes"]//1024} KB')
    for piece, ps in s['pieces'].items():
        f = ps['layers'][-1][0]
        x = decode(os.path.join(APP, 'public/collection/drums', k, f))
        x = x[np.argmax(np.abs(x).max(axis=1) > 0.002):]
        lo, hi = {'kick': (35, 120), 'snare': (150, 350), 'tom1': (80, 220), 'tom2': (50, 140)}.get(piece, (0, 0))
        f0 = dsp.fundamental(x, lo, hi) if hi else None
        print(f'  {piece:10s} peak {dsp.peak_db(x):6.1f}  decay40 {dsp.decay40(x):5.2f}s  centroid {centroid(x):6.0f} Hz  width {widthr(x):4.2f}' + (f'  f0 {f0:5.0f}' if f0 else '') + f'  len {len(x)/44100:4.2f}s')
