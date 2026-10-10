/** Grim Ink's machine fonts in the export cache key (PLAN.md#14.18); other keys unchanged. */
import type { RenderManifest } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { segmentCacheKey, type RenderIdentity } from './cache-key.js';
import { planShots } from './shot-plan.js';

const BASE: RenderIdentity = {
  engineVersion: 'e1',
  kitVersion: 'k1',
  style: { id: 'c-cam', width: 1920, height: 1080, preset: { a: 1 } },
};

const MANIFEST: RenderManifest = {
  version: 1,
  style: 'c-cam',
  fps: 24,
  seed: 1,
  shots: [{ id: 'a', t0: 0, t1: 2, scene: { file: 'a.js', source: 'export const x = 1;' } }],
};

function keyOf(identity: RenderIdentity): string {
  const planned = planShots(MANIFEST).shots[0];
  if (!planned) throw new Error('no shot');
  return segmentCacheKey({ planned, identity, manifest: MANIFEST, outputKey: 'out' });
}

describe('export cache key and the text fonts', () => {
  it('changes when the fonts change, and leaves a key without fonts as it was', () => {
    const plain = keyOf(BASE);
    expect(keyOf({ ...BASE, fonts: undefined })).toBe(plain);
    const system = keyOf({ ...BASE, fonts: 'system' });
    const fallback = keyOf({ ...BASE, fonts: 'fallback:Arial Black,Impact' });
    expect(new Set([plain, system, fallback]).size).toBe(3);
  });
});
