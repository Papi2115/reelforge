import { describe, expect, it } from 'vitest';
import {
  emptyTasteLog,
  shotVariantFile,
  shotVariantSetSchema,
  shotVariantsFile,
  tasteLogSchema,
  type ShotVariantSet,
  type TasteEntry,
} from './index.js';

const STAMP = '2026-10-03T10:00:00.000Z';

const set: ShotVariantSet = {
  version: 1,
  shotId: 's03',
  round: 0,
  note: 'calmer',
  base: { scene: 'scenes/s03.js', sceneHash: 'abc', shotHash: 'def' },
  variants: [
    {
      index: 1,
      direction: { id: 'hero-push', label: 'Hero object, slow push-in' },
      status: 'ready',
      file: '.reelforge/variants/s03/v1.js',
      updatedAt: STAMP,
    },
    {
      index: 2,
      direction: { id: 'orbit-depth', label: 'Orbit, layered depth' },
      status: 'dropped',
      reason: 'failed QA',
      updatedAt: STAMP,
    },
  ],
  createdAt: STAMP,
  updatedAt: STAMP,
};

describe('shot variants (.reelforge/variants/<shot>/variants.json)', () => {
  it('accepts a set and names its files', () => {
    expect(shotVariantSetSchema.parse(set)).toEqual(set);
    expect(shotVariantsFile('s03')).toBe('.reelforge/variants/s03/variants.json');
    expect(shotVariantFile('s03', 2)).toBe('.reelforge/variants/s03/v2.js');
  });

  it('rejects other versions, more than 3 variants and bad indexes', () => {
    expect(shotVariantSetSchema.safeParse({ ...set, version: 2 }).success).toBe(false);
    const first = set.variants[0];
    if (first === undefined) throw new Error('fixture');
    const four = [1, 2, 3, 4].map((index) => ({ ...first, index }));
    expect(shotVariantSetSchema.safeParse({ ...set, variants: four }).success).toBe(false);
    const zero = [{ ...first, index: 0 }];
    expect(shotVariantSetSchema.safeParse({ ...set, variants: zero }).success).toBe(false);
  });
});

describe('taste log (.reelforge/taste.json)', () => {
  it('accepts pick / keep-current / discard entries', () => {
    const entry: TasteEntry = {
      shotId: 's03',
      treatment: 'metaphor-object',
      decision: 'pick',
      offered: ['hero-push', 'orbit-depth'],
      chosen: 'hero-push',
      scores: [
        { direction: 'hero-push', status: 'ok', findings: 0 },
        { direction: 'orbit-depth', status: 'dropped', findings: 0 },
      ],
      at: STAMP,
    };
    const log = {
      ...emptyTasteLog(),
      entries: [entry, { ...entry, decision: 'discard', chosen: 'none' }],
    };
    expect(tasteLogSchema.parse(log)).toEqual(log);
    expect(tasteLogSchema.safeParse({ ...log, version: 2 }).success).toBe(false);
    expect(
      tasteLogSchema.safeParse({ ...log, entries: [{ ...entry, decision: 'maybe' }] }).success,
    ).toBe(false);
  });
});
