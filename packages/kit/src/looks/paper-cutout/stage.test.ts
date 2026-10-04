import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../kit.js';
import type { KitObject } from '../../object.js';
import { fakeAsset } from '../../testing/asset.js';
import { CRISP_PALETTE, TOKENS_ONLY_PALETTE } from '../../testing/palettes.js';
import { testRng } from '../../testing/rng.js';
import { extraLookDefinitions, LOOKS, lookMetaSchema, voxelLook } from '../index.js';
import { paperCutoutLook } from './index.js';
import { stageInternals, type PaperStage, type StagePose } from './stage.js';

type Factory = (params?: unknown) => KitObject;

function kit(palette = CRISP_PALETTE) {
  const { api } = createKit({
    three: THREE,
    palette,
    rng: testRng(11),
    looks: [voxelLook, paperCutoutLook],
  });
  return {
    env: api.env as unknown as Readonly<Record<string, (params?: unknown) => PaperStage>>,
    props: api.props as unknown as Readonly<Record<string, Factory>>,
  };
}

const camera = new THREE.PerspectiveCamera(30, 640 / 360, 0.1, 1000);

function aim(pose: StagePose): THREE.PerspectiveCamera {
  camera.position.set(...pose.position);
  camera.lookAt(...pose.target);
  camera.updateMatrixWorld();
  return camera;
}

/** Hash of the composite at t (update, camera preset, compose). */
function frameAt(stage: PaperStage, t: number, pan = 0): string {
  const internals = stageInternals(stage);
  if (internals === undefined) throw new Error('not a paper stage');
  stage.update(t);
  internals.compose(aim(stage.camera({ t, pan })));
  return createHash('sha256').update(internals.frame).digest('hex');
}

function sceneStage(palette = CRISP_PALETTE) {
  const { env, props } = kit(palette);
  const stage = env['paperStage']?.({ backdrop: 'dusk', drift: 0, seed: 4 });
  if (stage === undefined) throw new Error('paperStage missing');
  const puppet = stage.place(props['paperPuppet']?.({ pose: 'wave', seed: 2 }) as KitObject, {
    layer: 4,
    y: 300,
  });
  stage.place(props['paperCard']?.({ title: 'HELLO', at: 1 }) as KitObject, { layer: 5 });
  return { stage, puppet, props };
}

describe('look paper-cutout', () => {
  it('is an available A/B/C look with its own palette and budget', () => {
    expect(LOOKS).toContain(paperCutoutLook);
    expect(lookMetaSchema.safeParse(paperCutoutLook).success).toBe(true);
    expect(paperCutoutLook.rolls).toEqual(['A', 'B', 'C']);
    expect(paperCutoutLook.treatments).toEqual(
      expect.arrayContaining([
        'metaphor-object',
        'character-scene',
        '3d-reconstruction',
        'title-card',
        'montage/transition',
      ]),
    );
    expect(paperCutoutLook.soundPalette).toBe('paper-cutout');
    expect(paperCutoutLook.variationBudget).toBe('paper-cutout');
    const names = [...extraLookDefinitions().env, ...extraLookDefinitions().prop]
      .filter((entry) => entry.look === 'paper-cutout')
      .map((entry) => entry.definition.name);
    expect(names).toEqual(
      expect.arrayContaining(['paperStage', 'paperPuppet', 'paperRoom', 'paperStack', 'paperCard']),
    );
    for (const name of names) expect(name.startsWith('paper')).toBe(true);
  });

  it('builds every piece with defaults in Crisp 640 and in a tokens-only style', () => {
    for (const palette of [CRISP_PALETTE, TOKENS_ONLY_PALETTE]) {
      const { env, props } = kit(palette);
      for (const backdrop of ['day', 'dusk', 'night', 'kraft', 'paper']) {
        for (const scenery of ['hills', 'city', 'none']) {
          const stage = env['paperStage']?.({ backdrop, scenery, seed: 1 });
          expect(stage).toBeDefined();
        }
      }
      const stage = env['paperStage']?.({ scenery: 'none' });
      if (stage === undefined) throw new Error('paperStage missing');
      const minimal: Readonly<Record<string, unknown>> = {
        paperSign: { text: 'TOWN' },
        paperLabel: { text: 'TAG' },
        paperCard: { title: 'TITLE' },
        paperStack: { asset: fakeAsset() },
      };
      for (const name of paperCutoutLook.kit.props?.map((definition) => definition.name) ?? []) {
        const piece = props[name]?.(minimal[name] ?? {});
        expect(piece, name).toBeDefined();
        if (piece !== undefined) stage.place(piece);
      }
      expect(frameAt(stage, 2)).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('composites the same frame for a t whatever the seek order', () => {
    const { stage } = sceneStage();
    const times = [0, 0.9, 1.3, 2.6, 4];
    const forward = times.map((t) => frameAt(stage, t, 20 - 10 * t));
    const backward = [...times].reverse().map((t) => frameAt(stage, t, 20 - 10 * t));
    expect(backward.reverse()).toEqual(forward);
    expect(new Set(forward).size).toBe(times.length);
  });

  it('moves on the stop-motion clock: one image per 1/8 s, a new one on the next frame', () => {
    const { stage } = sceneStage();
    expect(frameAt(stage, 2.0)).toBe(frameAt(stage, 2.1));
    expect(frameAt(stage, 2.0)).not.toBe(frameAt(stage, 2.125));
  });

  it('parallaxes by whole pixels with the camera and keeps anchors in world space', () => {
    const { stage, puppet } = sceneStage();
    const still = frameAt(stage, 2);
    expect(frameAt(stage, 2, 30)).not.toBe(still);
    const hand = puppet.anchor('hand');
    stage.update(2.5);
    expect(puppet.anchor('hand').equals(hand)).toBe(false);
    const head = puppet.anchor('head').project(aim(stage.camera({ t: 2.5 })));
    expect(head.y).toBeGreaterThan(-1);
    expect(head.y).toBeLessThan(1);
    expect(stage.point(3, 320, 180)).toEqual([0, 0, 0]);
  });

  it('rejects what is not a piece, a layer out of range and a second placement', () => {
    const { env, props } = kit();
    const stage = env['paperStage']?.({});
    const puppet = props['paperPuppet']?.({});
    if (stage === undefined || puppet === undefined) throw new Error('missing');
    expect(() => stage.place(new THREE.Group() as unknown as KitObject)).toThrow(/paper piece/);
    expect(() => stage.place(puppet, { layer: 9 })).toThrow(/layer must be an integer 0..5/);
    stage.place(puppet, { layer: 4 });
    expect(() => stage.place(puppet, { layer: 3 })).toThrow(/already on the stage/);
    expect(() => {
      stage.update(Number.NaN);
    }).toThrow(/finite time/);
  });

  it('shows the asset picture on top of the stack', () => {
    const { env, props } = kit();
    const stage = env['paperStage']?.({ backdrop: 'kraft', scenery: 'none', sky: false });
    const stack = props['paperStack']?.({ asset: fakeAsset(), count: 2 });
    if (stage === undefined || stack === undefined) throw new Error('missing');
    stage.place(stack, { layer: 3 });
    const withAsset = frameAt(stage, 3);
    const plainStage = env['paperStage']?.({ backdrop: 'kraft', scenery: 'none', sky: false });
    const plain = props['paperStack']?.({ count: 2 });
    if (plainStage === undefined || plain === undefined) throw new Error('missing');
    plainStage.place(plain, { layer: 3 });
    expect(frameAt(plainStage, 3)).not.toBe(withAsset);
    expect(stack.anchorNames()).toContain('photo');
  });
});
