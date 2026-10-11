import type { RenderManifest } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { kitExtensionInputs, segmentCacheKey, type RenderIdentity } from './cache-key.js';
import { planShots } from './shot-plan.js';

const identity: RenderIdentity = {
  engineVersion: 'e1',
  kitVersion: 'k1',
  style: { id: 'c-cam', width: 1920, height: 1080, preset: { a: 1 } },
};

const BAKER = {
  name: 'nightBaker',
  file: 'kit-ext/people/nightBaker.js',
  source: 'export const person = { v: 1 };',
  kind: 'people' as const,
};
const ROOM = {
  name: 'bakeryBackRoom',
  file: 'kit-ext/places/bakeryBackRoom.js',
  source: 'export const place = { v: 1 };',
  kind: 'places' as const,
};
const FRIDGE = { name: 'fridge', file: 'kit-ext/props/fridge.js', source: 'export const prop' };

function keyOf(scene: string, kitExtensions: RenderManifest['kitExtensions']): string {
  const manifest: RenderManifest = {
    version: 1,
    style: 'c-cam',
    fps: 24,
    seed: 1,
    ...(kitExtensions === undefined ? {} : { kitExtensions }),
    shots: [{ id: 'a', t0: 0, t1: 2, scene: { file: 'a.js', source: scene } }],
  };
  const planned = planShots(manifest).shots[0];
  if (!planned) throw new Error('no shot');
  return segmentCacheKey({ planned, identity, manifest, outputKey: 'out' });
}

describe('export cache key and Grim Ink modules (PLAN.md#14.8)', () => {
  it('changes with the content of a person or place the shot draws, not with the others', () => {
    const scene = 'ctx.kit.people.nightBaker.draw(g, env, {}); ctx.kit.places.bakeryBackRoom;';
    const base = keyOf(scene, [BAKER, ROOM]);
    expect(keyOf(scene, [{ ...BAKER, source: 'export const person = { v: 2 };' }, ROOM])).not.toBe(
      base,
    );
    expect(keyOf(scene, [BAKER, { ...ROOM, source: 'export const place = { v: 2 };' }])).not.toBe(
      base,
    );
    const other = 'ctx.kit.places.bakeryBackRoom;';
    expect(keyOf(other, [BAKER, ROOM])).toBe(
      keyOf(other, [{ ...BAKER, source: 'export const person = { v: 2 };' }, ROOM]),
    );
  });

  it('lists kinds (props unchanged), kebab spellings and dynamic indexing per kind', () => {
    expect(kitExtensionInputs("people['night-baker']", [BAKER, ROOM, FRIDGE])).toEqual([
      { name: 'nightBaker', source: expect.any(String) as string, kind: 'people' },
    ]);
    expect(kitExtensionInputs('const p = kit.people[id];', [BAKER, ROOM, FRIDGE])).toHaveLength(1);
    expect(kitExtensionInputs('kit.props.fridge()', [BAKER, FRIDGE])).toEqual([
      { name: 'fridge', source: expect.any(String) as string },
    ]);
  });
});
