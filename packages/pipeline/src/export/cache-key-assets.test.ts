import type { ManifestAsset, RenderManifest } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { assetInputs, segmentCacheKey, type RenderIdentity } from './cache-key.js';
import { planShots } from './shot-plan.js';

const identity: RenderIdentity = {
  engineVersion: 'e1',
  kitVersion: 'k1',
  style: { id: 'voxel-pixel-crisp640', width: 640, height: 360, preset: { a: 1 } },
};

function asset(ref: string, sha: string, at?: number): ManifestAsset {
  return {
    ref,
    id: ref.split('@')[0] ?? ref,
    file: `.reelforge/assets/${ref}.jpg`,
    mime: 'image/jpeg',
    sha256: sha.repeat(64),
    ...(at === undefined ? {} : { at }),
    width: 1,
    height: 1,
    rgb: 'AAAA',
  };
}

function manifest(assets?: ManifestAsset[]): RenderManifest {
  return {
    version: 1,
    fps: 30,
    seed: 1,
    ...(assets ? { assets } : {}),
    shots: [
      {
        id: 'a',
        t0: 0,
        t1: 2,
        scene: { file: 'a.js', source: "ctx.assets.image('nasa-apollo', { crop: 'cover' });" },
      },
      { id: 'b', t0: 2, t1: 4, scene: { file: 'b.js', source: 'return 1;' } },
    ],
  };
}

function keyOf(m: RenderManifest, shot = 0): string {
  const planned = planShots(m).shots[shot];
  if (!planned) throw new Error('no shot');
  return segmentCacheKey({ manifest: m, planned, identity, outputKey: 'out' });
}

describe('segment keys and asset pictures (PLAN.md#12.11)', () => {
  it('keeps the keys of videos without assets', () => {
    expect(assetInputs('x', manifest())).toBeUndefined();
    expect(keyOf(manifest([]))).toBe(keyOf(manifest()));
  });

  it('depends on the pictures a shot names, not on the others', () => {
    const apollo = asset('nasa-apollo', 'a');
    const other = asset('wm-1', 'b');
    const key = keyOf(manifest([apollo, other]));
    const otherShot = keyOf(manifest([apollo, other]), 1);
    expect(key).not.toBe(keyOf(manifest()));
    expect(keyOf(manifest([{ ...apollo, sha256: 'c'.repeat(64) }, other]))).not.toBe(key);
    expect(keyOf(manifest([apollo, { ...other, sha256: 'c'.repeat(64) }]))).toBe(key);
    expect(keyOf(manifest([{ ...apollo, width: 2, height: 1, rgb: 'AAAAAAAA' }, other]))).not.toBe(
      key,
    );
    expect(keyOf(manifest([apollo, other]), 1)).toBe(otherShot);
  });

  it('keys video stills by their ref and time, and follows props that name pictures', () => {
    const still = asset('clip@2.5', 'a', 2.5);
    const inputs = assetInputs("ctx.assets.image('clip@2.5')", {
      assets: [still, asset('clip', 'a')],
    });
    expect(inputs).toEqual([
      { ref: 'clip@2.5', sha256: 'a'.repeat(64), at: 2.5, size: [1, 1], decoder: 1 },
    ]);
    const prop = { name: 'frame', file: 'kit-ext/props/frame.js', source: "assets.image('clip')" };
    expect(
      assetInputs('kit.props.frame();', { assets: [asset('clip', 'a')], kitExtensions: [prop] }),
    ).toHaveLength(1);
  });
});
