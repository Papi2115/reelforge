/**
 * PLAN.md#14.19: a scene that reads `ctx.film` depends on its place in the film, and a Grim Ink
 * library may change any shot (its people and places call it); scenes that use neither keep
 * their keys.
 */
import type { RenderManifest } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import {
  filmInputs,
  kitExtensionInputs,
  segmentCacheKey,
  type RenderIdentity,
} from './cache-key.js';
import { planShots } from './shot-plan.js';

const identity: RenderIdentity = {
  engineVersion: 'e1',
  kitVersion: 'k1',
  style: { id: 'c-cam', width: 1920, height: 1080, preset: { a: 1 } },
};

const LIB = {
  name: 'crowd',
  file: 'kit-ext/lib/crowd.js',
  source: 'export const lib = { v() { return 1; } };',
  kind: 'lib' as const,
};

function manifestOf(
  scene: string,
  last: number,
  extra: Partial<RenderManifest> = {},
): RenderManifest {
  return {
    version: 1,
    style: 'c-cam',
    fps: 24,
    seed: 1,
    shots: [
      { id: 'a', t0: 0, t1: 2, scene: { file: 'a.js', source: scene } },
      { id: 'b', t0: 2, t1: last, scene: { file: 'b.js', source: 'export const meta = {};' } },
    ],
    ...extra,
  };
}

function firstShot(manifest: RenderManifest): RenderManifest['shots'][number] {
  const shot = manifest.shots[0];
  if (!shot) throw new Error('no shot');
  return shot;
}

function keyOf(manifest: RenderManifest): string {
  const planned = planShots(manifest).shots[0];
  if (!planned) throw new Error('no shot');
  return segmentCacheKey({ planned, identity, manifest, outputKey: 'out' });
}

describe('export cache key, ctx.film and libraries (PLAN.md#14.19)', () => {
  it('follows the film length only for a scene that reads ctx.film', () => {
    const gag = 'const size = ctx.film.progress;';
    expect(keyOf(manifestOf(gag, 6))).not.toBe(keyOf(manifestOf(gag, 9)));
    const plain = 'const size = ctx.shot.duration; // the film is short';
    expect(keyOf(manifestOf(plain, 6))).toBe(keyOf(manifestOf(plain, 9)));
    expect(filmInputs(firstShot(manifestOf(plain, 6)), manifestOf(plain, 6))).toBeUndefined();
    const destructured = 'export function update(t, s, { film }) {}';
    expect(filmInputs(firstShot(manifestOf(destructured, 6)), manifestOf(destructured, 6))).toEqual(
      { duration: 6, index: 0, count: 2 },
    );
  });

  it('reads the film place of an isolated manifest', () => {
    const manifest = manifestOf('ctx.film.t', 6, { film: { duration: 60, shotCount: 12 } });
    const shot = { ...firstShot(manifest), filmIndex: 5 };
    expect(filmInputs(shot, manifest)).toEqual({ duration: 60, index: 5, count: 12 });
  });

  it('includes every library in every shot of the film', () => {
    expect(kitExtensionInputs('ctx.kit.people.baker.draw()', [LIB])).toEqual([
      { name: 'crowd', source: expect.any(String) as string, kind: 'lib' },
    ]);
    const scene = 'ctx.kit.people.baker.draw(g, env, {});';
    const base = keyOf(manifestOf(scene, 6, { kitExtensions: [LIB] }));
    const changed = { ...LIB, source: 'export const lib = { v() { return 2; } };' };
    expect(keyOf(manifestOf(scene, 6, { kitExtensions: [changed] }))).not.toBe(base);
  });
});
