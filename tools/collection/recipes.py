"""How each Colección rock kit is produced: which recorded kit, and the studio work on each piece and on the bus.

Recipes follow the per-era research in research/studio.md (Part B). Piece keys:
  source, use (another prepared piece, e.g. snareAlt), layers (remap soft/mid/hard), dry_db, room_mic_db,
  pitch (target fundamental Hz) or tune (semitones), damp (s), decay (s to -40 dB), eq [(kind, Hz, dB, Q)],
  transient (attack dB, sustain dB), comp (thr dB below the piece's hardest hit, ratio, att ms, rel ms, makeup dB, mix),
  sat (drive dB, bias, mix), gate (open s, close s), pan, gain_db, send (room, linear: 1 = as loud as the drum),
  send2, slap (False to skip the kit's slapback), max_s.
Kit keys: source, room_mic_db, verb / verb2 (room_ir kwargs or {'kind': 'gated', 'length'}), slap (delay s, repeats,
  level dB, lowpass Hz), bus {comp, sat, eq, width}.
"""

CREDITS = {
    'smdrums': {'license': 'Public domain (free use)', 'credit': 'SM Drums by Scott McLean, Tod Stillwell and Suleiman Ali'},
    'bigrusty': {'license': 'CC0 1.0', 'credit': 'Big Rusty Drums by Karoryfer Samples'},
    'muldjord': {'license': 'CC-BY 4.0', 'credit': 'MuldjordKit by Lars Muldjord / DrumGizmo'},
    'drskit': {'license': 'CC-BY 4.0', 'credit': 'DRSKit by DrumGizmo (Lars Muldjord, Bent Bisballe Nyeng) and Jes Eiler / DRSDrums'},
}

# SM Drums peak-normalizes every piece; this is the balance a mix engineer would start from (dB, snare = 0).
BALANCE = {
    'smdrums': {'kick': 0, 'snare': 0, 'snareAlt': 0, 'snareRim': 0, 'tom1': -2, 'tom2': -2, 'hatClosed': -11, 'hatOpen': -9,
                'ride': -10, 'rideBell': -9, 'crash': -7, 'china': -8},
}


def db(x):
    return 10 ** (x / 20)


HP = lambda f: ('hp', f, 0, 0)  # noqa: E731
LP = lambda f: ('lp', f, 0, 0)  # noqa: E731
PK = lambda f, g, q=1.0: ('pk', f, g, q)  # noqa: E731
LS = lambda f, g: ('ls', f, g, 0.707)  # noqa: E731
HS = lambda f, g: ('hs', f, g, 0.707)  # noqa: E731

KITS = [
    # ------------------------------------------------------------------ classic rock
    {
        # 1960s British beat: dead, papery drums under bright pumping cymbals; mono-ish; tape.
        'id': 'rock-studio-60', 'source': 'smdrums',
        'verb': {'seconds': 1.0, 'predelay': 0.02, 'bright': 0.7, 'early': 0.0, 'width': 0.5},  # a plate on the snare
        'pieces': {
            'kick': {'pitch': 65, 'decay': 0.2, 'eq': [HP(40), PK(80, 3), PK(350, -4), LP(6000)]},
            'snare': {'pitch': 200, 'decay': 0.16, 'eq': [PK(200, 2), PK(3000, 3), LP(10000)], 'send': db(-18)},
            'tom1': {'pitch': 140, 'decay': 0.25, 'eq': [PK(140, 2), PK(500, -3), LP(8000)]},
            'tom2': {'pitch': 90, 'decay': 0.35, 'eq': [PK(90, 3), PK(400, -3)]},
            'hatClosed': {'decay': 0.08, 'eq': [HP(300), PK(6000, 2), LP(10000)]},
            'hatOpen': {'decay': 0.55, 'eq': [HP(300), PK(6000, 2), LP(10000)]},
            'ride': {'eq': [HP(300), LP(10000)]},
            'crash': {'decay': 1.8, 'eq': [HP(300), LP(10000)], 'gain_db': -3},
            'china': {'decay': 1.5, 'eq': [HP(400), LP(8000)], 'gain_db': -5},
        },
        # Fast, high-ratio bus compression so the kick pumps the cymbals; lows and 5 kHz lifted after; tape; narrow.
        'bus': {'comp': (-14, 6, 5, 80, 5, 1), 'eq': [LS(80, 3), PK(5000, 3), LP(10000)], 'sat': (5, 0.08, 1), 'width': 0.3},
    },
    {
        # 1970s big room: two distant room mics up a stone stairwell, crushed, with tape slap; pitched down a bit.
        'id': 'rock-stairwell-70', 'source': 'bigrusty',
        'verb': {'seconds': 2.2, 'predelay': 0.022, 'bright': 0.7, 'early': 1.0, 'width': 1.0, 'density': 0.6},
        'slap': (0.095, 2, -12, 4000),
        'all': {'max_s': 2.4},
        # The library has no room mics: the generated stairwell carries the sound, about 5 dB over the close mics.
        'pieces': {
            'kick': {'pitch': 50, 'eq': [PK(55, 4), PK(300, -2), PK(2000, 2)], 'comp': (-8, 4, 20, 120, 2, 1), 'send': db(5)},
            'snare': {'pitch': 240, 'eq': [PK(220, 3), PK(5000, 3)], 'comp': (-8, 4, 10, 100, 2, 1), 'send': db(5)},
            'tom1': {'pitch': 115, 'eq': [PK(110, 3), PK(400, -3), PK(4000, 2)], 'send': db(5)},
            'tom2': {'pitch': 72, 'eq': [PK(75, 4), PK(350, -3)], 'send': db(5)},
            'hatClosed': {'eq': [HP(250), PK(8000, 2)], 'send': db(-1), 'max_s': 1.0},
            'hatOpen': {'eq': [HP(250), PK(8000, 2)], 'send': db(-1)},
            'ride': {'eq': [HP(250)], 'send': db(-1)},
            'crash': {'eq': [HP(250), LP(12000)], 'send': db(2)},
            'china': {'eq': [HP(400)], 'send': db(2)},
        },
        'bus': {'comp': (-20, 20, 15, 150, 9, 0.8), 'sat': (3, 0.08, 1), 'width': 1.0},
    },
    {
        # 1980s gated room: snare and toms bloom and stop dead; cymbals kept out of the gate.
        'id': 'rock-arena-80', 'source': 'smdrums',
        'verb': {'kind': 'gated', 'length': 0.32},
        'pieces': {
            'kick': {'pitch': 52, 'decay': 0.28, 'eq': [PK(60, 3), PK(400, -5), PK(3500, 4)], 'comp': (-10, 4, 5, 80, 3, 1), 'send': db(-10)},
            'snare': {'pitch': 220, 'decay': 0.22, 'eq': [PK(200, 3), PK(5000, 4), HS(10000, 2)], 'comp': (-12, 6, 3, 80, 4, 1), 'send': db(1)},
            'tom1': {'pitch': 130, 'decay': 0.45, 'eq': [PK(130, 4), PK(500, -4), PK(4000, 3)], 'comp': (-10, 4, 5, 100, 3, 1), 'send': db(0)},
            'tom2': {'pitch': 85, 'decay': 0.55, 'eq': [PK(85, 4), PK(400, -4), PK(4000, 2)], 'comp': (-10, 4, 5, 100, 3, 1), 'send': db(0)},
            'hatClosed': {'decay': 0.05, 'eq': [HP(400), PK(10000, 3)]},
            'hatOpen': {'decay': 0.4, 'eq': [HP(400), PK(10000, 3)]},
            'ride': {'eq': [HP(300)]},
            'crash': {'decay': 1.8, 'eq': [HP(300), HS(12000, 2)]},
            'china': {'decay': 1.0, 'eq': [HP(500)]},
        },
        'bus': {'comp': (-12, 3, 10, 120, 2, 1), 'eq': [HS(10000, 1.5)], 'width': 1.1},
    },
    # ------------------------------------------------------------------ contemporary rock
    {
        # 1990s alternative: loud natural kit in a good live room, room mic squashed hard.
        'id': 'rock-grunge-90', 'source': 'bigrusty', 'room_mic_db': -3,
        'verb': {'seconds': 1.0, 'predelay': 0.01, 'bright': 0.7, 'early': 0.9, 'width': 1.0},
        'pieces': {
            'kick': {'pitch': 55, 'decay': 0.32, 'eq': [PK(70, 3), PK(350, -4), PK(2500, 2)], 'comp': (-10, 4, 10, 100, 2, 1), 'send': db(-6)},
            'snare': {'pitch': 200, 'decay': 0.3, 'eq': [PK(200, 3), PK(3000, 3), PK(8000, 2)], 'comp': (-10, 4, 10, 120, 2, 1), 'send': db(0)},
            'tom1': {'pitch': 105, 'decay': 0.7, 'eq': [PK(100, 3), PK(400, -4), PK(4000, 2)], 'send': db(-3)},
            'tom2': {'pitch': 72, 'decay': 0.9, 'eq': [PK(70, 4), PK(350, -4)], 'send': db(-3)},
            'hatClosed': {'eq': [HP(300), PK(8000, 2)], 'send': db(-6)},
            'hatOpen': {'decay': 0.65, 'eq': [HP(300), PK(8000, 2)], 'send': db(-6)},
            'ride': {'eq': [HP(300)], 'send': db(-6)},
            'crash': {'eq': [HP(300)], 'send': db(-3)},
            'china': {'decay': 1.8, 'eq': [HP(500)], 'send': db(-6)},
        },
        'bus': {'comp': (-12, 4, 10, 200, 3, 1), 'sat': (2, 0.05, 1), 'width': 1.0},
    },
    {
        # 2000s radio rock: polished but real; tight clicky kick, fat bright snare, parallel crush, controlled room.
        'id': 'rock-alt-2000', 'source': 'muldjord', 'room_mic_db': -9,
        'verb': {'seconds': 0.75, 'predelay': 0.008, 'bright': 0.8, 'early': 0.8, 'width': 1.0},
        'verb2': {'seconds': 1.5, 'predelay': 0.03, 'bright': 0.9, 'early': 0.0, 'width': 1.0},  # plate on the snare
        'pieces': {
            'kick': {'pitch': 58, 'decay': 0.26, 'eq': [HP(30), PK(60, 3), PK(350, -6), PK(4000, 4)], 'comp': (-10, 4, 8, 80, 3, 1), 'send': db(-12)},
            'snare': {'pitch': 200, 'decay': 0.24, 'eq': [HP(80), PK(220, 3), PK(1000, 2), PK(5000, 3), HS(10000, 2)], 'comp': (-12, 4, 10, 100, 3, 1),
                      'send': db(-6), 'send2': db(-18)},
            'tom1': {'pitch': 125, 'decay': 0.5, 'eq': [PK(125, 3), PK(400, -5), PK(4000, 3)], 'comp': (-10, 4, 10, 150, 2, 1), 'send': db(-6)},
            'tom2': {'pitch': 80, 'decay': 0.75, 'eq': [PK(80, 4), PK(350, -5)], 'comp': (-10, 4, 10, 150, 2, 1), 'send': db(-6)},
            'hatClosed': {'eq': [HP(400), PK(10000, 2)], 'send': db(-12)},
            'hatOpen': {'eq': [HP(400), PK(10000, 2)], 'send': db(-12)},
            'ride': {'eq': [HP(300)], 'send': db(-12)},
            'crash': {'eq': [HP(300), PK(12000, 2)], 'send': db(-9)},
            'china': {'eq': [HP(500)], 'send': db(-9)},
        },
        # The "crush" bus blended under the kit, a little solid-state drive in it.
        'bus': {'comp': (-22, 20, 1, 60, 12, 0.25), 'sat': (2, 0.0, 1), 'width': 1.0},
    },
    {
        # 2000s garage revival: cramped room, old tape, kick up front, mono and trashy.
        'id': 'rock-garage', 'source': 'drskit', 'room_mic_db': 0,
        'verb': {'seconds': 0.5, 'predelay': 0.003, 'bright': 0.4, 'early': 1.0, 'width': 0.6},
        'pieces': {
            'kick': {'pitch': 58, 'decay': 0.3, 'eq': [PK(70, 4), PK(400, -3), PK(2000, 2), LP(6000)], 'comp': (-12, 8, 10, 100, 4, 1), 'send': db(-12), 'gain_db': 2},
            'snare': {'pitch': 220, 'eq': [PK(200, 2), PK(3000, 3), LP(9000)], 'send': db(0)},
            'tom1': {'pitch': 120, 'decay': 0.5, 'eq': [PK(120, 3), PK(450, -3)], 'send': db(0)},
            'tom2': {'pitch': 80, 'decay': 0.7, 'eq': [PK(80, 3), PK(400, -3)], 'send': db(0)},
            'hatClosed': {'eq': [HP(300), LP(9000)], 'send': db(0)},
            'hatOpen': {'decay': 0.6, 'eq': [HP(300), LP(9000)], 'send': db(0)},
            'ride': {'eq': [HP(300), LP(9000)], 'send': db(0)},
            'crash': {'decay': 2.0, 'eq': [HP(300), LP(9000)], 'sat': (6, 0.1, 0.5), 'send': db(0)},
            'china': {'source': 'smdrums', 'decay': 1.5, 'eq': [HP(400), LP(8000)], 'send': db(0)},
        },
        # Tape at a slow speed, hard compression, mono.
        'bus': {'comp': (-16, 6, 10, 100, 5, 1), 'sat': (7, 0.15, 1), 'eq': [HP(60), PK(70, 2), LP(9000)], 'width': 0.15},
    },
    # ------------------------------------------------------------------ metal
    {
        # 1980s thrash: dry, fast, clicky double kick, ringing higher snare, no reverb at all.
        'id': 'metal-thrash-80', 'source': 'muldjord', 'room_mic_db': -18,
        'pieces': {
            'kick': {'pitch': 60, 'decay': 0.15, 'eq': [HP(40), PK(60, 2), PK(300, -6, 0.9), PK(4000, 6, 1.2)], 'transient': (3, -2), 'comp': (-10, 4, 3, 60, 3, 1)},
            'snare': {'pitch': 280, 'decay': 0.24, 'eq': [HP(100), PK(250, 2), PK(1500, 2), PK(6000, 3)], 'comp': (-10, 4, 5, 80, 3, 1)},
            'tom1': {'pitch': 130, 'eq': [PK(130, 3), PK(400, -4), PK(5000, 4)], 'gate': (0.3, 0.06)},
            'tom2': {'pitch': 80, 'eq': [PK(80, 3), PK(350, -4), PK(5000, 3)], 'gate': (0.4, 0.08)},
            'hatClosed': {'decay': 0.05, 'eq': [HP(400), PK(8000, 3)]},
            'hatOpen': {'decay': 0.45, 'eq': [HP(400), PK(8000, 3)]},
            'ride': {'eq': [HP(300)]},
            'crash': {'decay': 1.8, 'eq': [HP(300)]},
            'china': {'decay': 1.5, 'eq': [HP(500), PK(3000, 2)]},
        },
        'bus': {'comp': (-12, 4, 10, 150, 2, 1), 'eq': [HP(40)], 'width': 1.0},
    },
    {
        # Modern metal: machine-consistent clicky kick, tight snare, huge short toms, trashy china.
        'id': 'metal-modern', 'source': 'muldjord', 'room_mic_db': -14,
        'verb': {'seconds': 0.5, 'predelay': 0.006, 'bright': 0.8, 'early': 0.8, 'width': 1.0},
        'verb2': {'seconds': 1.0, 'predelay': 0.025, 'bright': 0.9, 'early': 0.0, 'width': 1.0},
        'pieces': {
            'kick': {'layers': {'soft': 'hard', 'mid': 'hard'}, 'pitch': 50, 'decay': 0.12, 'gate': (0.13, 0.03),
                     'eq': [HP(35), PK(80, 3), PK(300, -5, 1.4), PK(4000, 6, 1.0)], 'transient': (6, -6), 'comp': (-12, 8, 6, 80, 5, 1)},
            'snare': {'layers': {'soft': 'mid'}, 'pitch': 215, 'decay': 0.22, 'eq': [HP(100), PK(220, 3), PK(1000, 2), PK(5000, 3)],
                      'transient': (4, -1), 'comp': (-12, 4, 8, 100, 4, 1), 'send': db(-10), 'send2': db(-18)},
            'tom1': {'pitch': 150, 'decay': 0.45, 'eq': [PK(150, 4), PK(400, -6), PK(5000, 4)], 'gate': (0.35, 0.08), 'comp': (-10, 4, 8, 120, 3, 1), 'send': db(-12)},
            'tom2': {'pitch': 85, 'decay': 0.65, 'eq': [PK(85, 4), PK(350, -6), PK(5000, 3)], 'gate': (0.45, 0.1), 'comp': (-10, 4, 8, 120, 3, 1), 'send': db(-12)},
            'hatClosed': {'decay': 0.045, 'eq': [HP(500), PK(8000, 2)]},
            'hatOpen': {'decay': 0.35, 'eq': [HP(500), PK(8000, 2)]},
            'ride': {'eq': [HP(400)]},
            'crash': {'decay': 1.8, 'eq': [HP(400), PK(12000, 2)], 'send': db(-18)},
            'china': {'decay': 1.3, 'eq': [HP(500), PK(3000, 3)], 'send': db(-18)},
        },
        'bus': {'comp': (-12, 4, 10, 150, 3, 1), 'width': 1.0},
    },
    # ------------------------------------------------------------------ punk
    {
        # 1970s punk: small dry booth, close mics, drummer's-eye stereo, washy open hats and crashes.
        'id': 'punk-77', 'source': 'drskit', 'room_mic_db': -14,
        'verb': {'seconds': 0.3, 'predelay': 0.001, 'bright': 0.3, 'early': 1.0, 'width': 0.8},
        'pieces': {
            'kick': {'pitch': 60, 'decay': 0.22, 'eq': [PK(70, 3), PK(400, -4), PK(2500, 2)], 'comp': (-10, 4, 10, 80, 2, 1), 'send': db(-18)},
            'snare': {'pitch': 230, 'decay': 0.22, 'eq': [PK(200, 2), PK(3500, 3)], 'comp': (-10, 4, 8, 80, 2, 1), 'send': db(-15)},
            'tom1': {'pitch': 130, 'decay': 0.38, 'eq': [PK(130, 3), PK(450, -3)], 'send': db(-15)},
            'tom2': {'pitch': 85, 'decay': 0.48, 'eq': [PK(85, 3), PK(400, -3)], 'send': db(-15)},
            'hatClosed': {'decay': 0.07, 'eq': [HP(300), PK(8000, 2)], 'send': db(-18)},
            'hatOpen': {'decay': 0.7, 'eq': [HP(300), PK(8000, 2)], 'send': db(-18)},
            'ride': {'eq': [HP(300)], 'send': db(-18)},
            'crash': {'decay': 1.8, 'eq': [HP(300), LP(12000)], 'send': db(-15), 'gain_db': 1.5},
            'china': {'source': 'smdrums', 'decay': 1.2, 'eq': [HP(500), LP(9000)], 'gain_db': -3},
        },
        'bus': {'comp': (-10, 4, 10, 100, 2, 1), 'sat': (4, 0.08, 1), 'eq': [LP(14000)], 'width': 1.0},
    },
    {
        # 1990s pop punk: fast, bright, tight snare crack, explosive tom fills, open-hat wash.
        'id': 'punk-pop-90', 'source': 'smdrums',
        'verb': {'seconds': 0.8, 'predelay': 0.008, 'bright': 0.8, 'early': 0.8, 'width': 1.0},
        'verb2': {'seconds': 1.2, 'predelay': 0.025, 'bright': 0.9, 'early': 0.0, 'width': 1.0},
        'pieces': {
            'kick': {'pitch': 60, 'decay': 0.22, 'eq': [PK(60, 3), PK(350, -5), PK(4000, 4)], 'comp': (-10, 4, 5, 80, 3, 1), 'send': db(-15)},
            'snare': {'use': 'snareAlt', 'pitch': 260, 'decay': 0.2, 'eq': [HP(100), PK(250, 2), PK(4000, 4), PK(10000, 2)], 'comp': (-10, 4, 5, 80, 3, 1),
                      'send': db(-10), 'send2': db(-15)},
            'tom1': {'pitch': 140, 'decay': 0.45, 'eq': [PK(140, 3), PK(450, -4), PK(5000, 3)], 'comp': (-10, 4, 8, 120, 2, 1), 'send': db(-10)},
            'tom2': {'pitch': 85, 'decay': 0.55, 'eq': [PK(85, 3), PK(400, -4), PK(5000, 3)], 'comp': (-10, 4, 8, 120, 2, 1), 'send': db(-10)},
            'hatClosed': {'decay': 0.06, 'eq': [HP(400), PK(10000, 3)], 'send': db(-15)},
            'hatOpen': {'decay': 0.55, 'eq': [HP(400), PK(10000, 3)], 'send': db(-15)},
            'ride': {'eq': [HP(300)], 'send': db(-15)},
            'crash': {'decay': 1.8, 'eq': [HP(300), PK(12000, 2)], 'send': db(-12)},
            'china': {'decay': 1.2, 'eq': [HP(500)], 'send': db(-12)},
        },
        'bus': {'comp': (-12, 4, 10, 150, 3, 1), 'eq': [HS(10000, 2)], 'width': 1.0},
    },
]
