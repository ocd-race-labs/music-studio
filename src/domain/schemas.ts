// JSON Schemas for everything that enters the app from outside: song files moved
// between devices and idea files written by Claude. Validated before anything is kept.

import Ajv from 'ajv';

const catalogRef = {
  type: 'object',
  required: ['key', 'version'],
  properties: {
    key: { type: 'string', pattern: '^[a-z][a-z0-9-]*(\\.[a-z0-9-]+)+$' },
    version: { type: 'string', pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$' },
  },
} as const;

export const notesPayload = {
  type: 'object',
  required: ['notes'],
  properties: {
    notes: {
      type: 'array',
      maxItems: 2000,
      items: {
        type: 'object',
        required: ['tick', 'dur', 'midi'],
        properties: {
          id: { type: 'string' },
          tick: { type: 'integer', minimum: 0 },
          dur: { type: 'integer', minimum: 1 },
          midi: { type: 'integer', minimum: 0, maximum: 127 },
          spell: { type: 'string' },
          vel: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
} as const;

export const patternPayload = {
  type: 'object',
  required: ['rows'],
  properties: {
    steps: { type: 'integer', minimum: 1, maximum: 256 },
    rows: {
      type: 'array',
      maxItems: 16,
      items: {
        type: 'object',
        required: ['sound', 'hits'],
        properties: {
          sound: catalogRef,
          hits: {
            type: 'array',
            items: {
              type: 'object',
              required: ['step'],
              properties: { step: { type: 'integer', minimum: 0 }, vel: { type: 'number', minimum: 0, maximum: 1 } },
            },
          },
        },
      },
    },
  },
} as const;

export const chordsPayload = {
  type: 'object',
  required: ['chords'],
  properties: {
    chords: {
      type: 'array',
      maxItems: 64,
      items: {
        type: 'object',
        required: ['tick', 'dur', 'degree'],
        properties: {
          tick: { type: 'integer', minimum: 0 },
          dur: { type: 'integer', minimum: 1 },
          degree: { type: 'integer', minimum: 0, maximum: 6 },
        },
      },
    },
  },
} as const;

export const ideasFileSchema = {
  type: 'object',
  required: ['format', 'version', 'ideas'],
  properties: {
    format: { const: 'music-studio.ideas' },
    version: { const: 1 },
    song_title: { type: 'string' },
    ideas: {
      type: 'array',
      minItems: 1,
      maxItems: 20,
      items: {
        type: 'object',
        required: ['kind', 'title', 'payload'],
        properties: {
          kind: { enum: ['melody', 'clip', 'pattern', 'chords'] },
          title: { type: 'string', minLength: 1, maxLength: 120 },
          prompt: { type: 'string', maxLength: 500 },
          target_instrument: catalogRef,
          payload: { type: 'object' },
        },
        allOf: [
          { if: { properties: { kind: { enum: ['melody', 'clip'] } } }, then: { properties: { payload: notesPayload } } },
          { if: { properties: { kind: { const: 'pattern' } } }, then: { properties: { payload: patternPayload } } },
          { if: { properties: { kind: { const: 'chords' } } }, then: { properties: { payload: chordsPayload } } },
        ],
      },
    },
  },
} as const;

export const songFileSchema = {
  type: 'object',
  required: ['format', 'version', 'song'],
  properties: {
    format: { const: 'music-studio.song' },
    version: { const: 1 },
    song: {
      type: 'object',
      required: ['id', 'title', 'ppq', 'tempo_bpm', 'key_tonic', 'key_mode', 'sections', 'tracks', 'schema_version'],
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        ppq: { const: 960 },
        tempo_bpm: { type: 'number', minimum: 20, maximum: 400 },
        key_tonic: { type: 'string', pattern: '^[A-G](bb|b|##|#)?$' },
        key_mode: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
        schema_version: { const: 1 },
        sections: { type: 'array' },
        tracks: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'kind', 'clips'],
            properties: {
              kind: { enum: ['instrument', 'drums', 'audio'] },
              instrument: { anyOf: [catalogRef, { type: 'null' }] },
              clips: { type: 'array' },
            },
          },
        },
      },
    },
  },
} as const;

const ajv = new Ajv({ allErrors: true, strict: false });
export const validateIdeasFile = ajv.compile(ideasFileSchema);
export const validateSongFile = ajv.compile(songFileSchema);

export function errorsOf(validate: { errors?: { instancePath: string; message?: string }[] | null }): string[] {
  return (validate.errors ?? []).map((e) => `${e.instancePath || '(file)'} ${e.message ?? 'is invalid'}`);
}
