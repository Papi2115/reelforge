import { describe, expect, it } from 'vitest';
import { renderManifestSchema } from './render-manifest.js';
import {
  isWorldAssetWorld,
  manifestWorldAssetsSchema,
  worldAssetsDir,
  worldCastFileSchema,
} from './world-assets.js';

const shot = { id: 's01', t0: 0, t1: 2, scene: { file: 'scenes/s01.js', source: 'x' } };

describe('world assets', () => {
  it('names the worlds and their folders', () => {
    expect(isWorldAssetWorld('game-b2')).toBe(true);
    expect(isWorldAssetWorld('voxel-pixel-crisp640')).toBe(false);
    expect(isWorldAssetWorld(undefined)).toBe(false);
    expect(worldAssetsDir('comic')).toBe('assets/comic');
  });

  it('is an optional manifest field without duplicate files', () => {
    const base = { version: 1, fps: 30, seed: 1, shots: [shot] };
    expect(renderManifestSchema.parse(base)).not.toHaveProperty('worldAssets');
    const files = [{ file: 'assets/comic/a.json', source: '{}' }];
    expect(
      renderManifestSchema.parse({ ...base, worldAssets: { world: 'comic', files } }).worldAssets,
    ).toEqual({ world: 'comic', files });
    const twice = manifestWorldAssetsSchema.safeParse({
      world: 'comic',
      files: [...files, ...files],
    });
    expect(twice.success).toBe(false);
    expect(manifestWorldAssetsSchema.safeParse({ world: 'voxel', files }).success).toBe(false);
  });

  it('validates cast.json entries', () => {
    const entry = {
      id: 'ranger',
      kind: 'character',
      name: 'the ranger',
      file: 'assets/comic/a.json',
    };
    expect(
      worldCastFileSchema.parse({ version: 1, world: 'comic', entries: [entry] }).entries[0]?.shots,
    ).toEqual([]);
    expect(
      worldCastFileSchema.safeParse({
        version: 1,
        world: 'comic',
        entries: [{ ...entry, kind: 'hero' }],
      }).success,
    ).toBe(false);
  });
});
