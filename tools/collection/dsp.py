"""Offline drum processing: the studio work that turns a natural kit into the sound of a style and an era."""
from fractions import Fraction

import numpy as np
import soundfile as sf
from scipy.signal import fftconvolve, resample_poly, butter, sosfilt
from pedalboard import (Pedalboard, Compressor, HighpassFilter, LowpassFilter, LowShelfFilter, HighShelfFilter,
                        PeakFilter)

SR = 44100
RNG = np.random.default_rng(7)


def load(path):
    x, sr = sf.read(path, dtype='float32', always_2d=True)
    if sr != SR:
        raise ValueError(f'{path}: {sr} Hz')
    if x.shape[1] == 1:
        x = np.repeat(x, 2, axis=1)
    return x


def pad(x, n):
    return x if len(x) >= n else np.vstack([x, np.zeros((n - len(x), x.shape[1]), dtype=x.dtype)])


def mix(*parts):
    parts = [p for p in parts if p is not None]
    n = max(len(p) for p in parts)
    return sum(pad(p, n) for p in parts)


def tune(x, semis):
    """Pitch by resampling, as a sampler does: up is shorter and brighter, down is longer and darker."""
    if not semis:
        return x
    f = Fraction(2 ** (-semis / 12)).limit_denominator(400)
    return resample_poly(x, f.numerator, f.denominator, axis=0).astype(np.float32)


def env_decay(x, tau, hold=0.015):
    """Damping (a towel, gaffer tape, a smaller drum): an extra exponential decay after the attack."""
    if not tau:
        return x
    t = np.arange(len(x)) / SR
    e = np.where(t < hold, 1.0, np.exp(-(t - hold) / tau))
    return (x * e[:, None]).astype(np.float32)


def gate(x, open_s, close_s=0.03):
    """A noise gate that closes after open_s: the sound stops dead (80s gated drums)."""
    t = np.arange(len(x)) / SR
    e = np.clip(1 - (t - open_s) / close_s, 0, 1)
    return (x * e[:, None]).astype(np.float32)


def board(x, plugins):
    if not plugins:
        return x
    y = Pedalboard(plugins)(x.T.copy(), SR)
    return y.T.astype(np.float32)


def eq(x, bands):
    """bands: list of (kind, freq, gain_db, q) with kind in hp, lp, ls, hs, pk."""
    plugins = []
    for kind, f, g, q in bands:
        if kind == 'hp':
            plugins.append(HighpassFilter(cutoff_frequency_hz=f))
        elif kind == 'lp':
            plugins.append(LowpassFilter(cutoff_frequency_hz=f))
        elif kind == 'ls':
            plugins.append(LowShelfFilter(cutoff_frequency_hz=f, gain_db=g, q=q or 0.707))
        elif kind == 'hs':
            plugins.append(HighShelfFilter(cutoff_frequency_hz=f, gain_db=g, q=q or 0.707))
        elif kind == 'pk':
            plugins.append(PeakFilter(cutoff_frequency_hz=f, gain_db=g, q=q or 1.0))
    return board(x, plugins)


def hp24(x, f):
    sos = butter(4, f, 'highpass', fs=SR, output='sos')
    return sosfilt(sos, x, axis=0).astype(np.float32)


def lp24(x, f):
    sos = butter(4, f, 'lowpass', fs=SR, output='sos')
    return sosfilt(sos, x, axis=0).astype(np.float32)


def comp(x, thr, ratio, attack_ms, release_ms, makeup=0.0, mix_wet=1.0):
    y = board(x, [Compressor(threshold_db=thr, ratio=ratio, attack_ms=attack_ms, release_ms=release_ms)])
    y = y * 10 ** (makeup / 20)
    return (x * (1 - mix_wet) + y * mix_wet).astype(np.float32)


def sat(x, drive_db, bias=0.0, mix_wet=1.0):
    """Tape or console saturation: soft clipping, a touch lopsided with bias (even harmonics)."""
    if drive_db <= 0:
        return x
    g = 10 ** (drive_db / 20)
    off = np.tanh(bias)
    y = (np.tanh(g * x + bias) - off) / g
    return (x * (1 - mix_wet) + y * mix_wet).astype(np.float32)


def transient(x, attack_db=0.0, sustain_db=0.0):
    """Transient designer: more (or less) attack and sustain, from a fast and a slow envelope."""
    if not attack_db and not sustain_db:
        return x
    mono = np.abs(x).max(axis=1)

    def follow(a_ms, r_ms):
        a = np.exp(-1 / (SR * a_ms / 1000))
        r = np.exp(-1 / (SR * r_ms / 1000))
        e = np.zeros_like(mono)
        v = 0.0
        for i, s in enumerate(mono):
            c = a if s > v else r
            v = c * v + (1 - c) * s
            e[i] = v
        return e

    fast = follow(0.3, 30)
    slow = follow(15, 60)
    att = np.clip((fast - slow) / (fast + 1e-6), 0, 1)
    sus = np.clip(slow / (fast + 1e-6), 0, 1)
    gdb = att * attack_db + sus * sustain_db
    return (x * (10 ** (gdb / 20))[:, None]).astype(np.float32)


def room_ir(seconds, predelay=0.012, bright=0.5, early=0.6, width=1.0, density=1.0):
    """A synthetic room: early reflections, then decorrelated noise whose highs die faster than its lows."""
    n = int(SR * (seconds * 1.4 + predelay)) + 1
    ir = np.zeros((n, 2), dtype=np.float32)
    p0 = int(predelay * SR)
    # early reflections
    for k in range(int(10 * density)):
        d = p0 + int(RNG.uniform(0.002, 0.045) * SR)
        g = early * RNG.uniform(0.25, 0.8) * (1 - k / (12 * density))
        ir[d, 0] += g * RNG.choice([-1, 1])
        d2 = p0 + int(RNG.uniform(0.002, 0.045) * SR)
        ir[d2, 1] += g * RNG.choice([-1, 1])
    # late tail: three bands with different decay (lows longest)
    t = np.arange(n - p0) / SR
    tail = np.zeros((n - p0, 2), dtype=np.float32)
    for lo, hi, mult in ((None, 400, 1.0), (400, 3000, 0.75), (3000, None, 0.35 + 0.5 * bright)):
        noise = RNG.standard_normal((n - p0, 2)).astype(np.float32)
        if lo and hi:
            sos = butter(2, [lo, hi], 'bandpass', fs=SR, output='sos')
        elif hi:
            sos = butter(2, hi, 'lowpass', fs=SR, output='sos')
        else:
            sos = butter(2, lo, 'highpass', fs=SR, output='sos')
        band = sosfilt(sos, noise, axis=0)
        rt = max(0.05, seconds * mult)
        band *= np.exp(-6.9 * t / rt)[:, None]
        tail += band.astype(np.float32)
    onset = np.clip(t / 0.01, 0, 1)
    tail *= onset[:, None] * 0.12
    ir[p0:] += tail
    if width < 1:
        mid = ir.mean(axis=1, keepdims=True)
        ir = mid + (ir - mid) * width
    return ir


def gated_ir(length, predelay=0.006):
    """Dense flat-ish noise that stops dead: the gated room of the 80s."""
    n = int(SR * (length + predelay))
    p0 = int(predelay * SR)
    t = np.arange(n - p0) / SR
    noise = RNG.standard_normal((n - p0, 2)).astype(np.float32)
    noise = sosfilt(butter(2, [250, 7000], 'bandpass', fs=SR, output='sos'), noise, axis=0)
    e = np.minimum(1, t / 0.004) * np.exp(-t / (length * 2.2))
    fade = np.clip((length - t) / 0.012, 0, 1)
    ir = np.zeros((n, 2), dtype=np.float32)
    ir[p0:] = noise * (e * fade)[:, None] * 0.16
    return ir


def convolve(x, ir):
    y = np.stack([fftconvolve(x[:, 0], ir[:, 0]), fftconvolve(x[:, 1], ir[:, 1])], axis=1)
    return y.astype(np.float32)


def width(x, w):
    if w == 1:
        return x
    mid = x.mean(axis=1, keepdims=True)
    return (mid + (x - mid) * w).astype(np.float32)


def pan(x, p):
    """Constant-power pan of a stereo file, -1 left to 1 right."""
    if not p:
        return x
    a = (p + 1) * np.pi / 4
    gl, gr = np.cos(a) * np.sqrt(2), np.sin(a) * np.sqrt(2)
    return (x * np.array([gl, gr], dtype=np.float32)).astype(np.float32)


def finish(x, max_s, floor_db=-62.0, fade_s=0.05):
    """Cut the tail where it falls below the floor (or at max_s) with a short fade."""
    x = x[: int(max_s * SR)]
    a = np.abs(x).max(axis=1)
    thr = 10 ** (floor_db / 20) * max(a.max(), 1e-9)
    above = np.nonzero(a > thr)[0]
    end = min(len(x), (above[-1] + int(0.03 * SR)) if len(above) else len(x))
    x = x[:end].copy()
    f = min(int(fade_s * SR), len(x))
    x[-f:] *= np.linspace(1, 0, f, dtype=np.float32)[:, None]
    return x


def peak_db(x):
    return 20 * np.log10(max(np.abs(x).max(), 1e-9))


def envelope_db(x, win=0.005):
    a = np.abs(x).max(axis=1)
    n = max(1, int(win * SR))
    k = np.ones(n) / n
    e = np.convolve(a, k, mode='same')
    return 20 * np.log10(np.maximum(e, 1e-9))


def decay40(x):
    """Seconds from the peak until the level falls 40 dB below it (and stays there)."""
    e = envelope_db(x)
    p = int(np.argmax(e))
    above = np.nonzero(e[p:] > e[p] - 40)[0]
    return (above[-1] if len(above) else 0) / SR


def set_decay(x, target):
    """Shorten a drum to ring for about `target` seconds to -40 dB (never lengthens it)."""
    if not target:
        return x
    nat = decay40(x)
    if nat <= target * 1.05:
        return x
    tn, tc = nat / 4.6, target / 4.6
    tx = 1 / (1 / tc - 1 / tn)
    return env_decay(x, tx, hold=0.008)


def fundamental(x, lo, hi):
    """Strongest frequency between lo and hi Hz in the body of the hit (20 to 400 ms)."""
    m = x.mean(axis=1)[int(0.02 * SR): int(0.4 * SR)]
    if len(m) < 1024:
        return None
    n = 1 << 16
    spec = np.abs(np.fft.rfft(m * np.hanning(len(m)), n))
    f = np.fft.rfftfreq(n, 1 / SR)
    band = (f >= lo) & (f <= hi)
    if not band.any():
        return None
    return float(f[band][np.argmax(spec[band])])


def slapback(x, delay_s, repeats=1, level_db=-12.0, lp=4000):
    """Tape slapback echo: a few darker repeats."""
    out = x
    d = int(delay_s * SR)
    g = 10 ** (level_db / 20)
    echo = lp24(x, lp)
    for r in range(1, repeats + 1):
        shifted = np.vstack([np.zeros((d * r, 2), dtype=np.float32), echo * (g ** r)])
        out = mix(out, shifted)
    return out


def vintage_sampler(x, rate=26040, bits=12, filter_hz=None, drive_db=0.0):
    """An old sampler: drive into the converter, hold each sample (no anti-alias, no reconstruction filter),
    fewer bits. 26.04 kHz / 12-bit is the classic boom bap sampler; 28 kHz / 8-bit the early drum machines."""
    if drive_db:
        x = sat(x, drive_db)
    if filter_hz:
        x = lp24(x, filter_hz)
    step = SR / rate
    idx = (np.floor(np.arange(len(x)) / step) * step).astype(int)
    held = x[np.clip(idx, 0, len(x) - 1)]
    q = 2 ** (bits - 1)
    return (np.round(held * q) / q).astype(np.float32)
