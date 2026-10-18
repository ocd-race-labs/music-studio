"""Electronic and hip hop kits for the Colección (standard rows: kick, snare, clap, hats, rim, tom, crash).

Same recipe keys as recipes.py, plus: rows='standard', layer [(source, piece, dB)] mixed under a piece,
sampler {rate, bits, filter_hz, drive_db} for vintage sampler grit (per kit or per piece).
Recipes follow research/studio.md Part C (subgenre drums and processing).
"""
from recipes import HP, LP, PK, LS, HS, db  # noqa: F401

CREDITS = {
    'machine808': {'license': 'Original (Music Studio)', 'credit': 'Analog-style drum machine, synthesized for Music Studio'},
    'machine909': {'license': 'Original (Music Studio)', 'credit': 'Analog-style drum machine, synthesized for Music Studio'},
    'sonicpi': {'license': 'CC0 1.0', 'credit': 'Sonic Pi sample pack (freesound contributors)'},
    'gogodze': {'license': 'CC0 1.0', 'credit': 'Gogodze Phu Vol II by Karoryfer Samples'},
}

SP1200 = {'rate': 26040, 'bits': 12, 'drive_db': 2}

KITS = [
    # ------------------------------------------------------------------ electronic
    {
        # House: the 909-style machine, four on the floor, offbeat open hats, clap on 2 and 4.
        'id': 'el-house', 'source': 'machine909', 'rows': 'standard',
        'verb': {'seconds': 0.6, 'predelay': 0.01, 'bright': 0.6, 'early': 0.6, 'width': 1.0},
        'pieces': {
            'kick': {'eq': [HP(30), PK(60, 2), PK(300, -3)], 'comp': (-8, 4, 10, 80, 2, 1)},
            'snare': {'eq': [HP(150)], 'send': db(-12)},
            'clap': {'eq': [HP(300), PK(1500, 2)], 'send': db(-8)},
            'hatClosed': {'eq': [HP(6000), LP(14000)]},
            'hatOpen': {'eq': [HP(5000), LP(14000)], 'send': db(-14)},
            'rim': {'send': db(-14)},
            'tom': {'send': db(-12)},
            'crash': {'eq': [HP(400)], 'send': db(-12)},
        },
        'bus': {'comp': (-10, 3, 15, 120, 2, 1), 'sat': (2, 0.05, 1), 'width': 1.0},
    },
    {
        # Deep house: a softer, rounder kick, rim shots, swung hats, everything low-passed and warm.
        'id': 'el-deephouse', 'source': 'machine808', 'rows': 'standard',
        'verb': {'seconds': 0.8, 'predelay': 0.015, 'bright': 0.35, 'early': 0.5, 'width': 1.0},
        'pieces': {
            'kick': {'decay': 0.4, 'eq': [HP(30), PK(70, 2)], 'comp': (-8, 3, 15, 100, 1, 1)},
            'snare': {'eq': [LP(7000)], 'send': db(-10)},
            'clap': {'eq': [HP(300), LP(6000)], 'send': db(-6), 'gain_db': -3},
            'hatClosed': {'eq': [LP(9000)], 'gain_db': -2},
            'hatOpen': {'eq': [LP(9000)], 'send': db(-12), 'gain_db': -2},
            'rim': {'eq': [LP(6000)], 'send': db(-8)},
            'tom': {'send': db(-10)},
            'crash': {'eq': [LP(8000)], 'send': db(-10)},
        },
        'bus': {'comp': (-12, 2.5, 25, 150, 1.5, 1), 'sat': (4, 0.1, 1), 'eq': [LP(10000)], 'width': 1.0},
    },
    {
        # Techno: a long, heavy, saturated kick with a dark low rumble behind it; driving metallic hats.
        'id': 'el-techno', 'source': 'machine909', 'rows': 'standard',
        'verb': {'seconds': 0.9, 'predelay': 0.01, 'bright': 0.5, 'early': 0.6, 'width': 1.0},
        'verb2': {'seconds': 2.5, 'predelay': 0.02, 'bright': 0.05, 'early': 0.2, 'width': 1.0},
        'pieces': {
            'kick': {'tune': -2, 'eq': [HP(28), PK(55, 3), PK(350, -4), PK(2500, 2)], 'sat': (6, 0.1, 1), 'comp': (-8, 4, 5, 80, 2, 1),
                     'send2': db(-6), 'max_s': 1.6},
            'snare': {'eq': [HP(200)], 'send': db(-8)},
            'clap': {'eq': [HP(400)], 'send': db(-4), 'sat': (4, 0, 0.5)},
            'hatClosed': {'eq': [HP(7000), PK(10000, 2)]},
            'hatOpen': {'eq': [HP(6000)], 'send': db(-12)},
            'rim': {'send': db(-6)},
            'tom': {'tune': -2, 'send': db(-8)},
            'crash': {'use': 'ride', 'eq': [HP(500)], 'send': db(-12)},
        },
        'bus': {'comp': (-10, 4, 10, 100, 2, 1), 'sat': (3, 0.05, 1), 'width': 1.0},
    },
    {
        # Dance / EDM: a layered punchy kick (punch plus sub plus click), stacked claps in a big reverb, loud.
        'id': 'el-edm', 'source': 'machine909', 'rows': 'standard',
        'verb': {'seconds': 1.6, 'predelay': 0.02, 'bright': 0.8, 'early': 0.4, 'width': 1.0},
        'pieces': {
            'kick': {'layer': [('machine808', 'kickLong', -8)], 'decay': 0.45, 'eq': [HP(30), PK(55, 3), PK(300, -5), PK(4000, 4)],
                     'transient': (4, -2), 'comp': (-10, 6, 3, 60, 3, 1)},
            'snare': {'layer': [('machine808', 'clap', -3)], 'eq': [HP(200), PK(2000, 2)], 'send': db(-6)},
            'clap': {'layer': [('machine808', 'clap', -2)], 'eq': [HP(300), PK(1800, 3), HS(8000, 2)], 'comp': (-10, 4, 2, 80, 2, 1), 'send': db(-4)},
            'hatClosed': {'eq': [HP(6000), HS(10000, 2)]},
            'hatOpen': {'eq': [HP(5000), HS(10000, 2)], 'send': db(-12)},
            'rim': {'send': db(-10)},
            'tom': {'send': db(-8)},
            'crash': {'eq': [HP(300), HS(9000, 2)], 'send': db(-8)},
        },
        'bus': {'comp': (-12, 4, 10, 100, 3, 1), 'eq': [HS(10000, 1.5)], 'width': 1.1},
    },
    {
        # Drum and bass: a tight, bright acoustic break kit at 174, snare tuned up, a sub under the kick.
        'id': 'el-dnb', 'source': 'muldjord', 'rows': 'standard', 'room_mic_db': -10,
        'verb': {'seconds': 0.6, 'predelay': 0.008, 'bright': 0.8, 'early': 0.8, 'width': 1.0},
        'pieces': {
            'kick': {'layer': [('machine808', 'kick', -6)], 'decay': 0.2, 'eq': [HP(35), PK(60, 3), PK(350, -5), PK(4000, 4)], 'comp': (-10, 4, 5, 60, 2, 1)},
            'snare': {'tune': 3, 'decay': 0.22, 'eq': [HP(150), PK(250, 2), PK(5000, 4)], 'comp': (-12, 6, 2, 80, 4, 1), 'send': db(-8)},
            'clap': {'source': 'machine909', 'eq': [HP(400)], 'send': db(-8)},
            'hatClosed': {'tune': 2, 'eq': [HP(500), HS(9000, 2)]},
            'hatOpen': {'tune': 2, 'decay': 0.4, 'eq': [HP(500), HS(9000, 2)]},
            'rim': {'source': 'drskit', 'use': 'snareRim', 'eq': [HP(200)]},
            'tom': {'use': 'tom1', 'tune': 2, 'decay': 0.4, 'send': db(-10)},
            'crash': {'eq': [HP(400)], 'send': db(-12)},
        },
        'bus': {'comp': (-14, 4, 3, 80, 3, 1), 'sat': (4, 0.05, 1), 'width': 1.0},
    },
    {
        # Jungle: old breaks sped up and crunched in a 12-bit sampler, everything tuned up.
        'id': 'el-jungle', 'source': 'smdrums', 'rows': 'standard', 'sampler': SP1200,
        'all': {'tune': 3},
        'verb': {'seconds': 0.5, 'predelay': 0.004, 'bright': 0.5, 'early': 1.0, 'width': 0.8},
        'pieces': {
            'kick': {'decay': 0.25, 'eq': [HP(40), PK(80, 3)], 'comp': (-10, 4, 5, 60, 2, 1), 'send': db(-14)},
            'snare': {'decay': 0.2, 'eq': [HP(150), PK(3000, 3)], 'comp': (-12, 6, 2, 60, 3, 1), 'send': db(-8)},
            'clap': {'use': 'snareRim', 'eq': [HP(300)], 'send': db(-8)},
            'hatClosed': {'eq': [HP(400)]},
            'hatOpen': {'decay': 0.5, 'eq': [HP(400)]},
            'rim': {'use': 'snareRim', 'tune': 5, 'decay': 0.1},
            'tom': {'use': 'tom1', 'decay': 0.35, 'send': db(-10)},
            'crash': {'eq': [HP(400)], 'send': db(-12)},
        },
        'bus': {'comp': (-14, 4, 5, 80, 3, 1), 'sat': (5, 0.08, 1), 'width': 0.8},
    },
    {
        # Dubstep: half time at 140, a heavy kick and a huge snare with a long tail.
        'id': 'el-dubstep', 'source': 'machine909', 'rows': 'standard',
        'verb': {'seconds': 1.4, 'predelay': 0.015, 'bright': 0.6, 'early': 0.6, 'width': 1.0},
        'pieces': {
            'kick': {'tune': -3, 'layer': [('machine808', 'kickLong', -6)], 'decay': 0.5, 'eq': [HP(28), PK(50, 4), PK(300, -5), PK(3500, 3)], 'comp': (-10, 6, 5, 80, 3, 1)},
            'snare': {'source': 'muldjord', 'layer': [('machine909', 'clap', -4)], 'eq': [HP(150), PK(200, 3), PK(5000, 3)], 'comp': (-12, 6, 3, 100, 4, 1), 'send': db(-2)},
            'clap': {'eq': [HP(400)], 'send': db(-4)},
            'hatClosed': {'eq': [HP(6000)], 'gain_db': -2},
            'hatOpen': {'eq': [HP(5000)], 'send': db(-10), 'gain_db': -2},
            'rim': {'send': db(-8)},
            'tom': {'tune': -3, 'send': db(-6)},
            'crash': {'eq': [HP(400)], 'send': db(-8)},
        },
        'bus': {'comp': (-12, 4, 10, 120, 3, 1), 'width': 1.0},
    },
    {
        # Ambient: soft, sparse sounds in a very long room.
        'id': 'el-ambient', 'source': 'machine808', 'rows': 'standard',
        'verb': {'seconds': 5.0, 'predelay': 0.04, 'bright': 0.3, 'early': 0.2, 'width': 1.0, 'density': 0.5},
        'all': {'max_s': 3.0},
        'pieces': {
            'kick': {'eq': [HP(35), LP(2000)], 'send': db(-10), 'gain_db': -3},
            'snare': {'eq': [LP(5000)], 'send': db(-3), 'gain_db': -4},
            'clap': {'eq': [LP(5000)], 'send': db(-2), 'gain_db': -4},
            'hatClosed': {'eq': [LP(8000)], 'send': db(-6), 'gain_db': -4},
            'hatOpen': {'eq': [LP(8000)], 'send': db(-4), 'gain_db': -4},
            'rim': {'eq': [LP(5000)], 'send': db(-2)},
            'tom': {'eq': [LP(3000)], 'send': db(-4)},
            'crash': {'eq': [LP(7000)], 'send': db(0), 'gain_db': -2},
        },
        'bus': {'comp': (-16, 2, 30, 300, 1, 1), 'width': 1.0},
    },
    # ------------------------------------------------------------------ hip hop
    {
        # Old school: the 808-style machine, dry and punchy, a little reverb on the snare.
        'id': 'hh-oldschool', 'source': 'machine808', 'rows': 'standard',
        'verb': {'seconds': 0.9, 'predelay': 0.01, 'bright': 0.6, 'early': 0.5, 'width': 1.0},
        'pieces': {
            'kick': {'decay': 0.5, 'eq': [HP(30)]},
            'snare': {'send': db(-8)},
            'clap': {'send': db(-10)},
            'hatClosed': {}, 'hatOpen': {}, 'rim': {}, 'tom': {}, 'crash': {'send': db(-12)},
        },
        'bus': {'comp': (-10, 3, 10, 100, 1.5, 1), 'width': 1.0},
    },
    {
        # Trap: a long tuned 808 boom as kick, a snappy snare and clap, crisp hats for rolls.
        'id': 'hh-trap', 'source': 'machine808', 'rows': 'standard',
        'verb': {'seconds': 0.8, 'predelay': 0.01, 'bright': 0.7, 'early': 0.5, 'width': 1.0},
        'pieces': {
            'kick': {'use': 'kickLong', 'decay': 1.4, 'eq': [HP(28)], 'sat': (5, 0.05, 0.6), 'max_s': 1.8},
            'snare': {'source': 'machine909', 'layer': [('machine808', 'clap', -2)], 'eq': [HP(200), PK(2500, 2)], 'comp': (-10, 4, 3, 80, 2, 1), 'send': db(-10)},
            'clap': {'layer': [('machine909', 'clap', -4)], 'eq': [HP(300)], 'send': db(-8)},
            'hatClosed': {'eq': [HP(7000), HS(10000, 2)]},
            'hatOpen': {'eq': [HP(6000)], 'send': db(-14)},
            'rim': {}, 'tom': {'send': db(-10)}, 'crash': {'send': db(-10)},
        },
        'bus': {'comp': (-10, 3, 10, 100, 2, 1), 'width': 1.0},
    },
    {
        # Drill: a sliding 808 carries the low end, so the kick is short; snares and rims placed off the beat.
        'id': 'hh-drill', 'source': 'machine808', 'rows': 'standard',
        'verb': {'seconds': 0.7, 'predelay': 0.01, 'bright': 0.6, 'early': 0.5, 'width': 1.0},
        'pieces': {
            'kick': {'decay': 0.6, 'eq': [HP(30), PK(3000, 2)]},
            'snare': {'source': 'machine909', 'eq': [HP(200), PK(3500, 3)], 'comp': (-10, 4, 3, 60, 2, 1), 'send': db(-8)},
            'clap': {'send': db(-8)},
            'hatClosed': {'eq': [HP(7000)]},
            'hatOpen': {'eq': [HP(6000)], 'send': db(-14)},
            'rim': {'send': db(-8)}, 'tom': {}, 'crash': {'send': db(-12)},
        },
        'bus': {'comp': (-10, 3, 10, 100, 2, 1), 'width': 1.0},
    },
]

KITS += [
    {
        # Downtempo / trip hop: a slow heavy break on a vintage kit, through a 12-bit sampler and tape.
        'id': 'el-triphop', 'source': 'gogodze', 'rows': 'standard', 'room_mic_db': -4, 'sampler': SP1200,
        'verb': {'seconds': 1.2, 'predelay': 0.015, 'bright': 0.4, 'early': 0.6, 'width': 1.0},
        'pieces': {
            'kick': {'tune': -2, 'eq': [HP(35), PK(60, 4), PK(300, -3)], 'comp': (-10, 4, 15, 120, 3, 1)},
            'snare': {'tune': -1, 'eq': [HP(100), PK(200, 3), PK(2500, 2), LP(8000)], 'comp': (-10, 4, 8, 120, 3, 1), 'send': db(-8)},
            'clap': {'source': 'machine808', 'eq': [HP(300), LP(6000)], 'send': db(-4)},
            'hatClosed': {'eq': [HP(300), LP(9000)], 'gain_db': -2},
            'hatOpen': {'eq': [HP(300), LP(9000)], 'send': db(-12)},
            'rim': {'eq': [LP(7000)], 'send': db(-10)},
            'tom': {'tune': -2, 'send': db(-10)},
            'crash': {'source': 'smdrums', 'eq': [HP(300), LP(8000)], 'send': db(-8)},
        },
        'bus': {'comp': (-14, 4, 15, 150, 3, 1), 'sat': (5, 0.1, 1), 'eq': [LP(9000)], 'width': 0.9},
    },
    {
        # IDM: small machine hits crushed to 8 bits at a low rate, tuned oddly: brittle, glitchy detail.
        'id': 'el-idm', 'source': 'machine909', 'rows': 'standard', 'sampler': {'rate': 16000, 'bits': 8, 'drive_db': 3},
        'verb': {'seconds': 0.5, 'predelay': 0.005, 'bright': 0.8, 'early': 0.8, 'width': 1.0},
        'pieces': {
            'kick': {'tune': -3, 'decay': 0.18, 'eq': [HP(35)]},
            'snare': {'source': 'machine808', 'tune': 4, 'decay': 0.12, 'send': db(-10)},
            'clap': {'tune': -5, 'send': db(-8)},
            'hatClosed': {'source': 'machine808', 'tune': 7, 'decay': 0.04},
            'hatOpen': {'tune': 5, 'decay': 0.25},
            'rim': {'source': 'machine808', 'tune': 3},
            'tom': {'source': 'machine808', 'tune': 5, 'decay': 0.12},
            'crash': {'use': 'ride', 'tune': -4, 'send': db(-12)},
        },
        'bus': {'comp': (-12, 3, 5, 80, 2, 1), 'width': 1.0},
    },
    {
        # Boom bap: a dusty kit chopped into a 12-bit sampler: low boom kick, cracking snare, steady hats.
        'id': 'hh-boombap', 'source': 'gogodze', 'rows': 'standard', 'room_mic_db': -6, 'sampler': SP1200,
        'verb': {'seconds': 0.5, 'predelay': 0.006, 'bright': 0.4, 'early': 0.9, 'width': 0.8},
        'pieces': {
            'kick': {'tune': -1, 'eq': [HP(35), PK(55, 4), PK(350, -3)], 'comp': (-10, 4, 12, 100, 3, 1)},
            'snare': {'eq': [HP(120), PK(200, 2), PK(2000, 3), LP(9000)], 'comp': (-12, 5, 3, 90, 4, 1), 'send': db(-10)},
            'clap': {'source': 'machine808', 'eq': [HP(300), LP(7000)], 'send': db(-10)},
            'hatClosed': {'eq': [HP(400), LP(9000)]},
            'hatOpen': {'eq': [HP(400), LP(9000)]},
            'rim': {'eq': [LP(8000)]},
            'tom': {'send': db(-12)},
            'crash': {'source': 'smdrums', 'eq': [HP(300), LP(8000)], 'send': db(-10)},
        },
        'bus': {'comp': (-14, 4, 10, 120, 3, 1), 'sat': (3, 0.08, 1), 'eq': [LP(11000)], 'width': 0.8},
    },
    {
        # Lo-fi: the same vintage kit through its old "retro" mic, soft and worn: side-stick, quiet hats, tape.
        'id': 'hh-lofi', 'source': 'gogodze', 'rows': 'standard', 'mic': 'retro', 'sampler': {'rate': 22050, 'bits': 12, 'drive_db': 3},
        'verb': {'seconds': 0.7, 'predelay': 0.01, 'bright': 0.25, 'early': 0.7, 'width': 0.9},
        'pieces': {
            'kick': {'layers': {'hard': 'mid'}, 'eq': [HP(35), PK(70, 3), LP(4000)]},
            'snare': {'layers': {'hard': 'mid'}, 'eq': [HP(150), LP(6000)], 'send': db(-8), 'gain_db': -2},
            'clap': {'source': 'machine808', 'eq': [HP(400), LP(5000)], 'send': db(-6), 'gain_db': -4},
            'hatClosed': {'eq': [HP(500), LP(7000)], 'gain_db': -4},
            'hatOpen': {'eq': [HP(500), LP(7000)], 'gain_db': -4},
            'rim': {'eq': [LP(6000)], 'send': db(-10)},
            'tom': {'eq': [LP(5000)], 'send': db(-10)},
            'crash': {'source': 'smdrums', 'eq': [HP(400), LP(6000)], 'send': db(-8), 'gain_db': -4},
        },
        'bus': {'comp': (-16, 3, 20, 200, 2, 1), 'sat': (6, 0.12, 1), 'eq': [LP(7500)], 'width': 0.85},
    },
    {
        # West coast: drum machines with a heavy snare in a plate and a deep kick, laid back.
        'id': 'hh-westcoast', 'source': 'machine808', 'rows': 'standard',
        'verb': {'seconds': 1.4, 'predelay': 0.03, 'bright': 0.8, 'early': 0.0, 'width': 1.0},
        'pieces': {
            'kick': {'decay': 0.6, 'eq': [HP(30), PK(60, 3)]},
            'snare': {'source': 'machine909', 'layer': [('machine808', 'clap', -6)], 'eq': [HP(150), PK(200, 3)], 'comp': (-10, 4, 5, 100, 3, 1), 'send': db(-4)},
            'clap': {'send': db(-6)},
            'hatClosed': {'eq': [HP(5000)], 'gain_db': -2},
            'hatOpen': {'eq': [HP(5000)], 'send': db(-14)},
            'rim': {}, 'tom': {'send': db(-10)}, 'crash': {'send': db(-10)},
        },
        'bus': {'comp': (-12, 3, 15, 150, 2, 1), 'width': 1.0},
    },
]
