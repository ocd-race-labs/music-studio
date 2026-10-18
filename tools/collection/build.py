"""Build the Colección rock kits: process prepared one-shots (drums/src/<source>) into each kit's sound,
encode to MP3 into the app's public folder, and write the kit specs the app reads (src/packs/collection-drums.json).

usage: python3 -I build.py <scratch drums dir> <app repo dir> [kit ...]
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import pyloudnorm as pyln
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dsp  # noqa: E402
from recipes import KITS as ROCK, CREDITS as ROCK_CREDITS, BALANCE  # noqa: E402
from recipes_beats import KITS as BEATS, CREDITS as BEAT_CREDITS  # noqa: E402

KITS = ROCK + BEATS
CREDITS = {**ROCK_CREDITS, **BEAT_CREDITS}

DRUMS, APP = sys.argv[1], sys.argv[2]
ONLY = set(sys.argv[3:])
PIECES_FULL = ['kick', 'snare', 'tom1', 'tom2', 'hatClosed', 'hatOpen', 'ride', 'crash', 'china']
# Electronic and hip hop kits use the standard rows: kick, snare, clap, hats, rim, one tom, crash.
PIECES_STANDARD = ['kick', 'snare', 'clap', 'hatClosed', 'hatOpen', 'rim', 'tom', 'crash']
LAYERS = ['soft', 'mid', 'hard']
MAX_S = {'kick': 1.3, 'snare': 1.6, 'tom1': 1.9, 'tom2': 2.3, 'hatClosed': 0.7, 'hatOpen': 1.7, 'ride': 2.6, 'crash': 3.0, 'china': 2.6,
         'clap': 1.2, 'rim': 0.6, 'tom': 1.6}
# Soft, middle and hard where the touch changes the sound most; middle and hard for toms and cymbals (keeps kits small).
LAYERS_OF = {'kick': ['soft', 'mid', 'hard'], 'snare': ['soft', 'mid', 'hard'], 'hatClosed': ['soft', 'mid', 'hard']}
TWO = ['mid', 'hard']
ROUND_ROBINS = {'kick': 2, 'snare': 2, 'hatClosed': 2}
TARGET_LUFS = -21.0  # the level every instrument and kit in the app is trimmed to
SPEC_PATH = os.path.join(APP, 'src/packs/collection-drums.json')


def src_file(source, piece, layer, rr, room=False, mic=None):
    """A prepared hit: dry, its room mics, or another mic mix the library offers (e.g. 'retro')."""
    base = os.path.join(DRUMS, 'src', source, piece)
    suffix = '.room' if room else (f'.{mic}' if mic else '')
    for r in (rr, 1):
        p = os.path.join(base, f'{layer}_{r}{suffix}.wav')
        if os.path.exists(p):
            return p
    return src_file(source, piece, layer, rr) if mic else None


def rr_for(kit, piece):
    pc = dict(kit.get('all', {}))
    pc.update(kit['pieces'].get(piece, {}))
    source = pc.get('source', kit['source'])
    name = pc.get('use', piece)
    has2 = os.path.exists(os.path.join(DRUMS, 'src', source, name, 'hard_2.wav'))
    return ROUND_ROBINS.get(piece, 1) if has2 else 1


def layers_for(kit, piece):
    """Soft, middle and hard when the recording has them; one layer for one-shot sources (drum machines)."""
    pc = dict(kit.get('all', {}))
    pc.update(kit['pieces'].get(piece, {}))
    source = pc.get('source', kit['source'])
    name = pc.get('use', piece)
    if not os.path.exists(os.path.join(DRUMS, 'src', source, name, 'mid_1.wav')):
        return ['hard']
    return LAYERS_OF.get(piece, TWO)


def process(kit, piece, layer, rr):
    """One hit through the kit's chain: source, tuning, room mics, EQ, dynamics, room, bus."""
    pc = dict(kit.get('all', {}))
    pc.update(kit['pieces'].get(piece, {}))
    source = pc.get('source', kit['source'])
    name = pc.get('use', piece)  # e.g. snareAlt or snareRim instead of snare
    use_layer = pc.get('layers', {}).get(layer, layer)  # e.g. a "triggered" kick plays the hard sample at every level
    dry_p = src_file(source, name, use_layer, rr, mic=pc.get('mic', kit.get('mic')))
    if dry_p is None:
        raise FileNotFoundError(f'{kit["id"]}: {source}/{name}/{use_layer}_{rr}')
    # Libraries that normalize every piece get a mixing balance first (a hi-hat is not as loud as a snare).
    bal = BALANCE.get(source, {}).get(name, 0) + pc.get('dry_db', 0)
    x = dsp.load(dry_p) * 10 ** (bal / 20)
    # Layers from other sources (a sub under a kick, a clap under a snare), mixed before any processing.
    for lsrc, lname, ldb in pc.get('layer', []):
        lp_ = src_file(lsrc, lname, use_layer, rr) or src_file(lsrc, lname, 'hard', 1)
        lx = dsp.load(lp_) * 10 ** ((ldb + BALANCE.get(lsrc, {}).get(lname, 0)) / 20)
        if use_layer != 'hard' and not os.path.exists(os.path.join(DRUMS, 'src', lsrc, lname, f'{use_layer}_1.wav')):
            lx = lx * 10 ** ({'soft': -10, 'mid': -4}.get(use_layer, 0) / 20)  # one-shot layers follow the touch by level
        x = dsp.mix(x, lx)
    room_p = src_file(source, name, use_layer, rr, room=True)
    room_db = pc.get('room_mic_db', kit.get('room_mic_db'))
    if room_p and room_db is not None:
        x = dsp.mix(x, dsp.load(room_p) * 10 ** (room_db / 20))
    semis = pc.get('tune', 0)
    if pc.get('pitch'):
        # Aim the drum at a fundamental (Hz), measured on this kit's hard hit so every layer moves the same.
        ref_p = src_file(source, name, 'hard', 1)
        lo, hi = pc['pitch'] * 0.6, pc['pitch'] * 1.6
        f0 = dsp.fundamental(dsp.load(ref_p), lo, hi)
        if f0:
            semis = float(np.clip(12 * np.log2(pc['pitch'] / f0), -4, 4))
    x = dsp.tune(x, semis)
    x = dsp.env_decay(x, pc.get('damp'))
    x = dsp.set_decay(x, pc.get('decay'))
    x = dsp.eq(x, pc.get('eq', []))
    if pc.get('transient'):
        x = dsp.transient(x, *pc['transient'])
    if pc.get('comp'):
        # Thresholds are relative to this piece's hardest hit, so every layer meets the same compressor.
        ref_db = dsp.peak_db(dsp.load(src_file(source, name, 'hard', 1))) + bal
        thr, *rest = pc['comp']
        x = dsp.comp(x, ref_db + thr, *rest)
    if pc.get('sat'):
        x = dsp.sat(x, *pc['sat'])
    if pc.get('gate'):
        x = dsp.gate(x, *pc['gate'])
    smp = pc.get('sampler', kit.get('sampler'))
    if smp:
        x = dsp.vintage_sampler(x, **smp)
    x = dsp.pan(x, pc.get('pan', 0))
    x = x * 10 ** (pc.get('gain_db', 0) / 20)
    # The room: a send into the kit's reverb (natural room or gated room).
    send = pc.get('send', 0)
    if send and kit.get('verb') is not None:
        wet = dsp.convolve(x * send, kit['_ir'])
        x = dsp.mix(x, wet)
    if kit.get('verb2') is not None and pc.get('send2'):
        x = dsp.mix(x, dsp.convolve(x * pc['send2'], kit['_ir2']))
    if kit.get('slap') and pc.get('slap', True):
        x = dsp.slapback(x, *kit['slap'])
    bus = kit.get('bus', {})
    if bus.get('comp'):
        # The bus threshold is relative to the kit's hardest snare hit, as a real bus compressor would see the kit.
        thr, *rest = bus['comp']
        x = dsp.comp(x, kit['_ref'] + thr, *rest)
    if bus.get('sat'):
        x = dsp.sat(x, *bus['sat'])
    x = dsp.eq(x, bus.get('eq', []))
    x = dsp.width(x, bus.get('width', 1.0))
    return dsp.finish(x, pc.get('max_s', MAX_S[piece]))


def groove_render(hits_by_piece, bpm=100):
    """The loudness test pattern the app uses for every kit: kick 1, 3, 3+; snare 2 and 4; hi-hat eighths."""
    step = 60 / bpm / 4
    n = int(dsp.SR * (32 * step + 2.5))
    out = np.zeros((n, 2), dtype=np.float32)

    def put(piece, s, vel):
        layers = hits_by_piece[piece]
        if len(layers) == 3:
            layer = 2 if vel >= 0.8 else (1 if vel >= 0.5 else 0)
            top = [0.5, 0.8, 1][layer]
        elif len(layers) == 2:
            layer, top = (1, 1) if vel >= 0.5 else (0, 0.5)
        else:
            layer, top = 0, 1
        g = max(0.3, (vel / top) ** 0.9)
        x = layers[layer] * g
        at = int(dsp.SR * (0.05 + s * step))
        m = min(len(x), n - at)
        out[at:at + m] += x[:m]

    for bar in range(2):
        for s in range(16):
            i = bar * 16 + s
            if s in (0, 8, 10):
                put('kick', i, 1)
            if s in (4, 12):
                put('snare', i, 1)
            if s % 2 == 0:
                put('hatClosed', i, 0.8)
    return out


def build(kit):
    kid = kit['id']
    print(f'== {kid}', flush=True)
    v = kit.get('verb')
    if v:
        kit['_ir'] = dsp.gated_ir(v['length']) if v.get('kind') == 'gated' else dsp.room_ir(**{k: x for k, x in v.items() if k != 'kind'})
    v2 = kit.get('verb2')
    if v2:
        kit['_ir2'] = dsp.gated_ir(v2['length']) if v2.get('kind') == 'gated' else dsp.room_ir(**{k: x for k, x in v2.items() if k != 'kind'})
    # Unit-energy rooms, so a send of 0.3 puts the room about 10 dB under the drum.
    for key in ('_ir', '_ir2'):
        if key in kit:
            kit[key] = kit[key] / np.sqrt((kit[key] ** 2).sum(axis=0).mean())
    snare_src = kit['pieces'].get('snare', {}).get('source', kit['source'])
    snare_name = kit['pieces'].get('snare', {}).get('use', 'snare')
    kit['_ref'] = dsp.peak_db(dsp.load(src_file(snare_src, snare_name, 'hard', 1))) + BALANCE.get(snare_src, {}).get(snare_name, 0) \
        + kit.get('all', {}).get('dry_db', 0)
    pieces_list = PIECES_STANDARD if kit.get('rows') == 'standard' else PIECES_FULL
    rendered = {}
    for piece in pieces_list:
        rendered[piece] = {}
        for li, layer in enumerate(layers_for(kit, piece)):
            for rr in range(1, rr_for(kit, piece) + 1):
                rendered[piece][(li, rr)] = process(kit, piece, layer, rr)
    meter = pyln.Meter(dsp.SR)

    def level():
        # One gain for the whole kit: loudest file at -1 dBFS (the MP3 keeps headroom), then the trim that brings
        # the test groove to the app's level.
        top = max(np.abs(x).max() for p in rendered.values() for x in p.values())
        g = 10 ** (-1 / 20) / top
        for p in rendered.values():
            for k in p:
                p[k] = p[k] * g
        test = groove_render({p: [rendered[p][(li, 1)] for li in range(len(layers_for(kit, p)))] for p in ('kick', 'snare', 'hatClosed')})
        lm = meter.integrated_loudness(test) - 3.01  # the app measured its mono kits on one channel
        return round(TARGET_LUFS - lm, 1), lm

    trim, lufs_mono_equiv = level()
    # Kits with very sharp peaks (short dry kicks) would need gain the master limiter then has to take back:
    # limit the peaks of every hit instead, the way these records were mixed, until the trim is small.
    for _ in range(4):
        if trim <= 1.0:
            break
        from pedalboard import Limiter
        thr = -1 - (trim - 0.5)
        for p in rendered.values():
            for k in p:
                p[k] = dsp.board(p[k], [Limiter(threshold_db=thr, release_ms=80)])
        trim, lufs_mono_equiv = level()
    out_dir = os.path.join(APP, 'public/collection/drums', kid)
    os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        os.remove(os.path.join(out_dir, f))
    pieces = {}
    total = 0
    with tempfile.TemporaryDirectory() as tmp:
        for piece in pieces_list:
            layers = []
            for li, layer in enumerate(layers_for(kit, piece)):
                takes = []
                for rr in range(1, rr_for(kit, piece) + 1):
                    name = f'{piece}-{layer[0]}{rr}.mp3'
                    wav = os.path.join(tmp, name + '.wav')
                    sf.write(wav, rendered[piece][(li, rr)], dsp.SR, subtype='FLOAT')
                    mp3 = os.path.join(out_dir, name)
                    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', kit.get('kbps', '112k'),
                                    '-ar', '44100', mp3], check=True)
                    total += os.path.getsize(mp3)
                    takes.append(name)
                layers.append(takes)
            spec = {'layers': layers}
            if piece == 'hatClosed':
                spec['chokes'] = ['hatOpen']
            pieces[piece] = spec
    sources = sorted({kit['source'], *[pc.get('source', kit['source']) for pc in kit['pieces'].values()],
                      *[l[0] for pc in kit['pieces'].values() for l in pc.get('layer', [])]})
    print(f'   trim {trim:+.1f} dB ({lufs_mono_equiv:.1f} LUFS before), {total / 1024:.0f} KB, sources {sources}', flush=True)
    return {
        'id': kid, 'trimDb': trim, 'pieces': pieces,
        'license': ' + '.join(dict.fromkeys(CREDITS[s]['license'] for s in sources)),
        'source': '; '.join(dict.fromkeys(CREDITS[s]['credit'] for s in sources)),
        'bytes': total,
    }


def main():
    specs = {}
    if os.path.exists(SPEC_PATH):
        try:
            specs = json.load(open(SPEC_PATH))
        except json.JSONDecodeError:
            specs = {}
    for kit in KITS:
        if ONLY and kit['id'] not in ONLY:
            continue
        specs[kit['id']] = build(kit)
    specs = {k: specs[k] for k in [k['id'] for k in KITS] if k in specs}
    with open(SPEC_PATH, 'w') as f:
        json.dump(specs, f, indent=1)
    print('total', sum(s['bytes'] for s in specs.values()) // 1024, 'KB')


main()
