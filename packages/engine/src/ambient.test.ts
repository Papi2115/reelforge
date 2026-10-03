/**
 * Ambient variation in the engine (PLAN.md#12.8): manifest switch -> per-shot parameters with the
 * real style budgets, `ctx.ambient`, and the camera drift being a pure function of t.
 */
import { variationDistance, type AmbientVariation } from '@reelforge/kit';
import type { RenderManifest } from '@reelforge/shared';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAmbientApi, lookBudgetKey, shotAmbient } from './ambient.js';
import { NO_ANCHORS } from './anchors.js';
import { createCameraDrift, driftProgress } from './camera/drift.js';
import type { SceneContext, SceneModule } from './contract.js';
import { STYLE_PRESET_IDS } from './presets/index.js';
import { buildShot } from './shot.js';
import { resolveStyle } from './style.js';

const ROLLS = ['A', 'A', 'B', 'A', 'C'] as const;

/** A synthetic 8-minute film: 80 shots of 6 s, a new act (glitch) every 16 shots. */
function film(enabled = true, count = 80): RenderManifest {
  return {
    version: 1,
    fps: 30,
    seed: 2115,
    ...(enabled ? { ambientVariation: { enabled: true, seed: 2115 } } : {}),
    shots: Array.from({ length: count }, (_, index) => ({
      id: `s${String(index + 1).padStart(2, '0')}`,
      t0: index * 6,
      t1: (index + 1) * 6,
      ...(index > 0 && index % 16 === 0
        ? { transitionIn: { type: 'glitch' as const, duration: 0.3 } }
        : {}),
      scene: { file: 'scenes/x.js', source: 'x' },
      ambient: { index, act: Math.floor(index / 16), roll: ROLLS[index % 5] ?? 'A' },
    })),
  };
}

function filmParams(manifest: RenderManifest, style = resolveStyle({})): AmbientVariation[] {
  return manifest.shots.map((_, index) => {
    const params = shotAmbient(manifest, style, index);
    if (!params) throw new Error(`shot ${String(index)} does not vary`);
    return params;
  });
}

describe('shotAmbient', () => {
  const style = resolveStyle({});

  it('is off without the switch, when disabled and for looks without a budget', () => {
    expect(shotAmbient(film(false), style, 0)).toBeUndefined();
    const disabled = { ...film(), ambientVariation: { enabled: false, seed: 1 } };
    expect(shotAmbient(disabled, style, 0)).toBeUndefined();
    const manifest = film();
    const retro = {
      ...manifest,
      shots: manifest.shots.map((shot) => ({
        ...shot,
        ambient: { index: 0, act: 0, look: 'retro-ui' },
      })),
    };
    expect(lookBudgetKey('retro-ui')).toBe('retro-ui');
    expect(shotAmbient(retro, style, 0)).toBeUndefined();
    expect(lookBudgetKey('nope')).toBeUndefined();
    expect(shotAmbient(film(), style, 999)).toBeUndefined();
  });

  it('gives every style a voxel budget and keeps neighbours of an 8-minute film apart', () => {
    for (const id of STYLE_PRESET_IDS) {
      const resolved = resolveStyle({ style: id });
      const swatches = new Set(Object.keys(resolved.swatches));
      const shots = filmParams(film(), resolved);
      shots.forEach((params, index) => {
        expect(params.budgetKey).toBe('voxel');
        for (const [family, member] of Object.entries(params.tones)) {
          expect(swatches.has(family) && swatches.has(member), `${id} ${family}`).toBe(true);
        }
        const previous = shots[index - 1];
        if (previous) expect(variationDistance(previous, params), id).toBeGreaterThanOrEqual(2);
      });
    }
  });

  it('uses the storyboard position from the manifest, so a shot rendered alone matches', () => {
    const manifest = film();
    const shot = manifest.shots[40];
    if (!shot) throw new Error('no shot 40');
    const alone: RenderManifest = {
      ...manifest,
      shots: [
        { id: 'pad-s41', t0: 0, t1: shot.t0, scene: { file: 'pad.js', source: 'x' } },
        { ...shot, transitionIn: undefined },
      ],
    };
    expect(shotAmbient(alone, style, 1)).toEqual(shotAmbient(manifest, style, 40));
  });

  it('derives index and act from the manifest when shots carry no ambient info', () => {
    const manifest = film();
    const bare = {
      ...manifest,
      shots: manifest.shots.map((shot) => ({ ...shot, ambient: undefined })),
    };
    const derived = shotAmbient(bare, style, 20);
    const explicit = shotAmbient(
      {
        ...manifest,
        shots: manifest.shots.map((shot) => ({
          ...shot,
          ambient: { index: shot.ambient?.index ?? 0, act: shot.ambient?.act ?? 0 },
        })),
      },
      style,
      20,
    );
    expect(derived).toEqual(explicit);
  });

  it('multiplies the film-wide and per-shot scale', () => {
    const manifest = film();
    const scaled: RenderManifest = {
      ...manifest,
      ambientVariation: { enabled: true, seed: 2115, scale: 0.5 },
      shots: manifest.shots.map((shot) => ({
        ...shot,
        ambient: { index: shot.ambient?.index ?? 0, act: 0, scale: 0 },
      })),
    };
    expect(shotAmbient(scaled, style, 3)?.scale).toBe(0);
    expect(
      shotAmbient({ ...manifest, ambientVariation: scaled.ambientVariation }, style, 3)?.scale,
    ).toBe(0.5);
  });
});

describe('ctx.ambient', () => {
  const params = filmParams(film())[0];

  it('is neutral when off and tones names when on', () => {
    const off = createAmbientApi(undefined);
    expect(off.enabled).toBe(false);
    expect(off.params).toBeUndefined();
    expect(off.tone('navy')).toBe('navy');
    const on = createAmbientApi(params);
    expect(on.enabled).toBe(true);
    expect(Object.isFrozen(on)).toBe(true);
    const family = Object.keys(params?.tones ?? {})[0] ?? 'navy';
    expect(on.tone(family)).toBe(params?.tones[family] ?? family);
  });

  it('reaches the scene in build and update', () => {
    const seen: boolean[] = [];
    const module: SceneModule = {
      meta: { id: 's01' },
      build: (ctx: SceneContext) => seen.push(ctx.ambient.enabled),
      update: (_t, _state, ctx) => seen.push(ctx.ambient.params === params),
    };
    const shot = { id: 's01', t0: 0, duration: 4, width: 640, height: 360, fps: 30 };
    const base = { shot, module, projectSeed: 1, resolveAnchor: NO_ANCHORS };
    buildShot({ ...base, palette: resolveStyle({}).palette, ambient: params }).update(1);
    buildShot({ ...base, palette: resolveStyle({}).palette }).update(1);
    expect(seen).toEqual([true, true, false, false]);
  });
});

describe('camera drift', () => {
  it('runs from -1 at the start to +1 at the end of the shot', () => {
    expect(driftProgress(0, 4)).toBe(-1);
    expect(driftProgress(2, 4)).toBe(0);
    expect(driftProgress(9, 4)).toBe(1);
    expect(driftProgress(1, 0)).toBe(0);
  });

  it('is a pure function of t even when the scene never sets the camera in update', () => {
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
    camera.position.set(0, 2, 8);
    camera.lookAt(0, 0, 0);
    const own = camera.quaternion.clone();
    const drift = createCameraDrift(camera, [1.2, 0.5], 4);
    const at = (t: number): number[] => {
      drift.begin();
      drift.apply(t);
      return camera.quaternion.toArray();
    };
    const first = at(3);
    at(0.5);
    at(4);
    expect(at(3)).toEqual(first);
    drift.begin();
    expect(camera.quaternion.toArray()).toEqual(own.toArray());
    const degrees = (own.angleTo(new THREE.Quaternion().fromArray(at(4))) * 180) / Math.PI;
    expect(degrees).toBeCloseTo(Math.hypot(1.2, 0.5), 3);
  });
});
