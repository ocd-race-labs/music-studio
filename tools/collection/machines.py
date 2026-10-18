"""Original analog drum machine sounds, synthesized from scratch the way the classic machines make them
(808-style: bridged-T drums and six square oscillators for metal; 909-style: swept sine kick with click,
noisier snare and clap). Writes sources machine808 and machine909 in the prepared one-shot format (hard_1 only).

usage: python3 -I machines.py <drums dir>
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

SR = 44100
RNG = np.random.default_rng(808)
OUT = os.path.join(sys.argv[1], 'src')


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def env(t, tau, attack=0.0005):
    return np.minimum(1, t / max(attack, 1e-6)) * np.exp(-t / tau)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'highpass', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'lowpass', fs=SR, output='sos'), x)


def sweep_sine(t, f_end, f_start, sweep_tau):
    f = f_end + (f_start - f_end) * np.exp(-t / sweep_tau)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def noise(n):
    return RNG.standard_normal(n)


def metal(t, freqs=(205.3, 304.4, 369.6, 522.7, 540.0, 800.0)):
    """Six detuned square waves: the metallic source of 808-style hats and cymbals."""
    return sum(np.sign(np.sin(2 * np.pi * f * t + RNG.uniform(0, 6.28))) for f in freqs) / len(freqs)


def fade_end(x, ms=8):
    n = min(len(x), int(SR * ms / 1000))
    x = x.copy()
    x[-n:] *= np.linspace(1, 0, n)
    return x


# ---------------------------------------------------------------- 808-style

def k808(long=False):
    t = t_axis(2.6 if long else 0.9)
    body = sweep_sine(t, 49, 120, 0.012) * env(t, 0.9 if long else 0.22, 0.001)
    click = lp(noise(len(t)), 2500) * env(t, 0.002) * 0.25
    return body + click


def s808():
    t = t_axis(0.45)
    tone = (np.sin(2 * np.pi * 180 * t) * 0.7 + np.sin(2 * np.pi * 330 * t) * 0.45) * env(t, 0.06)
    snap = hp(noise(len(t)), 1200) * env(t, 0.09) * 0.55
    return tone + snap


def clap(bright=1.0, tail=0.16):
    t = t_axis(0.5)
    n = bp(noise(len(t)), 900 * bright, 2600 * bright)
    e = np.zeros_like(t)
    for k, d in enumerate((0, 0.009, 0.018, 0.027)):
        e += np.where(t >= d, np.exp(-(t - d) / 0.006), 0) * (0.8 if k < 3 else 1.0)
    e += np.where(t >= 0.027, np.exp(-(t - 0.027) / tail) * 0.5, 0)
    return n * e


def hat808(open_=False):
    t = t_axis(0.9 if open_ else 0.2)
    m = metal(t)
    m = bp(m, 3400, 7200) * 0.5 + hp(m, 7000) * 0.7
    return hp(m, 6000) * env(t, 0.32 if open_ else 0.032)


def cym808():
    t = t_axis(2.4)
    m = metal(t)
    return (hp(bp(m, 5000, 11000), 4500) * 0.8 + hp(noise(len(t)), 7000) * 0.15) * env(t, 0.75)


def rim808():
    t = t_axis(0.08)
    return (np.sin(2 * np.pi * 1700 * t) * 0.6 + np.sin(2 * np.pi * 500 * t) * 0.5) * env(t, 0.008)


def tom808(f=120):
    t = t_axis(0.8)
    return sweep_sine(t, f, f * 1.25, 0.05) * env(t, 0.22) + lp(noise(len(t)), 2000) * env(t, 0.01) * 0.1


def cowbell808():
    t = t_axis(0.5)
    x = np.sign(np.sin(2 * np.pi * 540 * t)) + np.sign(np.sin(2 * np.pi * 800 * t))
    return bp(x, 500, 3000) * (env(t, 0.02) * 0.6 + env(t, 0.18) * 0.4) * 0.5


# ---------------------------------------------------------------- 909-style

def k909():
    t = t_axis(0.7)
    body = sweep_sine(t, 52, 230, 0.018) * env(t, 0.28, 0.001)
    body = np.tanh(2.2 * body) / np.tanh(2.2)
    click = hp(noise(len(t)), 3000) * env(t, 0.0025) * 0.45
    return body + click


def s909():
    t = t_axis(0.5)
    tone = (np.sin(2 * np.pi * 190 * t) + 0.5 * np.sin(2 * np.pi * 345 * t)) * env(t, 0.045) * 0.7
    snap = hp(lp(noise(len(t)), 9000), 1800) * env(t, 0.13) * 0.8
    return tone + snap


def hat909(open_=False):
    # The real machine played short sampled hats; a noisier metallic blend gets close in character.
    t = t_axis(0.9 if open_ else 0.15)
    m = metal(t, (263, 400, 421, 474, 587, 845)) * 0.6 + noise(len(t)) * 0.5
    x = hp(m, 7500, 4)
    return x * env(t, 0.28 if open_ else 0.035)


def ride909():
    t = t_axis(2.2)
    m = metal(t, (420, 580, 735, 900, 1250, 1560))
    return (hp(bp(m, 3000, 9000), 2500) * 0.7 + hp(noise(len(t)), 6000) * 0.12) * (env(t, 0.04) * 0.3 + env(t, 0.9) * 0.7)


def crash909():
    t = t_axis(2.4)
    x = hp(noise(len(t)), 4000) * 0.6 + hp(metal(t, (300, 470, 640, 810, 1110, 1430)), 3000) * 0.5
    return x * env(t, 0.65, 0.002)


def rim909():
    t = t_axis(0.06)
    return hp(np.sin(2 * np.pi * 1900 * t) + noise(len(t)) * 0.3, 800) * env(t, 0.006)


def tom909(f=140):
    t = t_axis(0.7)
    return sweep_sine(t, f, f * 1.6, 0.03) * env(t, 0.18) + hp(noise(len(t)), 1500) * env(t, 0.02) * 0.25


# ---------------------------------------------------------------- write

def write(source, title, pieces, notes):
    root = os.path.join(OUT, source)
    allx = {k: fade_end(v) for k, v in pieces.items()}
    top = max(np.abs(v).max() for v in allx.values())
    g = 10 ** (-1 / 20) / top
    meta = {'source': source, 'title': title, 'license': 'Original, synthesized for Music Studio',
            'credit': 'Music Studio (original synthesis)', 'url': '', 'room': False, 'notes': notes, 'pieces': {}}
    for name, x in allx.items():
        os.makedirs(os.path.join(root, name), exist_ok=True)
        st = np.stack([x * g, x * g], axis=1).astype(np.float32)
        sf.write(os.path.join(root, name, 'hard_1.wav'), st, SR, subtype='FLOAT')
        meta['pieces'][name] = {'description': name, 'files': [f'{name}/hard_1.wav'], 'origin': {}}
    json.dump(meta, open(os.path.join(root, 'meta.json'), 'w'), indent=1)
    print(source, len(allx), 'pieces')


def balance(d, db):
    return {k: v * 10 ** (db.get(k, 0) / 20) for k, v in d.items()}


write('machine808', 'Analog drum machine, 808-style (original synthesis)', balance({
    'kick': k808(), 'kickLong': k808(long=True), 'snare': s808(), 'clap': clap(1.0), 'hatClosed': hat808(), 'hatOpen': hat808(True),
    'rim': rim808(), 'tom': tom808(), 'crash': cym808(), 'cowbell': cowbell808(),
}, {'hatClosed': -10, 'hatOpen': -9, 'crash': -9, 'cowbell': -6, 'rim': -4, 'snare': -2, 'clap': -1}),
    'Bridged-T style drums (swept sines), six square oscillators through band-pass filters for metal. One sample per sound.')

write('machine909', 'Analog drum machine, 909-style (original synthesis)', balance({
    'kick': k909(), 'snare': s909(), 'clap': clap(1.25, 0.12), 'hatClosed': hat909(), 'hatOpen': hat909(True),
    'rim': rim909(), 'tom': tom909(), 'crash': crash909(), 'ride': ride909(),
}, {'hatClosed': -10, 'hatOpen': -8, 'crash': -9, 'ride': -11, 'rim': -5, 'snare': -1, 'clap': 0}),
    'Swept, saturated sine kick with a click; tone plus noise snare; metallic noise hats and cymbals. One sample per sound.')
