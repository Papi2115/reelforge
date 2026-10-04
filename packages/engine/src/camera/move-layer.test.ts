import { ambientVariation, type VariationBudget } from '@reelforge/kit';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createExactAnchorResolver } from '../anchors.js';
import type { SceneContext, SceneModule } from '../contract.js';
import { EngineError } from '../errors.js';
import { buildShot, type BuiltShot, type ShotInput } from '../shot.js';
import { resolveStyle } from '../style.js';
import { CAMERA_API_MEMBERS, createCameraApi } from './camera-api.js';
import { createCameraMoveLayer } from './move-layer.js';
import { cameraForward } from './moves.js';

const palette = resolveStyle({}).palette;
const shot = { id: 's07', t0: 20, duration: 12, width: 640, height: 360, fps: 30 };
const BASE = { position: [0.6, 1.6, 6] as const, target: [0.6, 1.1, -0.5] as const, fov: 50 };

interface MovesState {
  readonly hero: THREE.Object3D;
  readonly crate: THREE.Object3D;
  readonly beat: { t: number; tEnd: number };
}

function input(module: SceneModule, overrides: Partial<ShotInput> = {}): ShotInput {
  return {
    shot,
    module,
    projectSeed: 9,
    palette,
    resolveAnchor: createExactAnchorResolver([{ text: 'now', t: 26, tEnd: 27 }]),
    ...overrides,
  };
}

function box(three: SceneContext['three'], position: THREE.Vector3Tuple): THREE.Mesh {
  const mesh = new three.Mesh(new three.BoxGeometry(1, 2, 1), new three.MeshBasicMaterial());
  mesh.position.set(...position);
  return mesh;
}

/** Camera set once in build; update only calls the moves (the restore keeps it pure). */
const allMoves: SceneModule = {
  meta: { id: 's07' },
  build(ctx) {
    ctx.camera.set({ position: [...BASE.position], target: [...BASE.target], fov: BASE.fov });
    const hero = box(ctx.three, [0.6, 1, -0.5]);
    const crate = box(ctx.three, [-1, 1, 3]);
    ctx.scene.add(hero, crate);
    return { hero, crate, beat: ctx.anchor('now') } satisfies MovesState;
  },
  update(t, raw, ctx) {
    const state = raw as MovesState;
    ctx.camera.rackFocus({ from: state.crate, to: state.hero, t0: 0.5, t1: 2 });
    if (t >= 3) ctx.camera.dollyZoom({ from: 3, to: 9, t0: 3, t1: 5, subject: state.hero });
    if (t >= 4) ctx.camera.orbit({ degrees: 60, t0: 4, t1: 8 });
    if (t >= 5) {
      ctx.camera.parallax({
        amount: 2,
        t0: state.beat,
        t1: state.beat,
        layers: [{ objects: [state.crate], ratio: 2 }],
      });
    }
  },
};

interface Snapshot {
  readonly camera: number[];
  readonly crate: number[];
  readonly focus: number[] | undefined;
}

function snapshot(built: BuiltShot, state: () => MovesState, t: number): Snapshot {
  built.update(t);
  const { camera } = built;
  return {
    camera: [...camera.position.toArray(), ...camera.quaternion.toArray(), camera.fov],
    crate: state().crate.position.toArray(),
    focus: built.focus && [built.focus.distance, built.focus.aperture],
  };
}

function capture(module: SceneModule, overrides: Partial<ShotInput> = {}) {
  let state: MovesState | undefined;
  const built = buildShot(
    input(
      {
        ...module,
        build: (ctx) => {
          state = module.build(ctx) as MovesState;
          return state;
        },
      },
      overrides,
    ),
  );
  const current = (): MovesState => {
    if (!state) throw new Error('not built');
    return state;
  };
  return { built, at: (t: number) => snapshot(built, current, t), state: current };
}

const TIMES = [0, 0.7, 1.4, 2.5, 3.2, 4.4, 5.5, 6.25, 6.6, 7.9, 11];

describe('camera moves in a shot', () => {
  it('renders the same camera, objects and focus for a t in any seek order', () => {
    const forward = capture(allMoves);
    const expected = TIMES.map((t) => forward.at(t));
    const shuffled = capture(allMoves);
    const order = [6, 2, 9, 0, 10, 4, 1, 8, 3, 7, 5, 6, 0];
    for (const index of order) expect(shuffled.at(TIMES[index] ?? 0)).toEqual(expected[index]);
  });

  it('restores the scene pose and objects when a frame has no moves', () => {
    const { at, state } = capture(allMoves);
    const rest = at(0);
    at(6.4);
    expect(at(0)).toEqual(rest);
    expect(state().crate.position.toArray()).toEqual([-1, 1, 3]);
  });

  it('racks the focus from the first subject to the second', () => {
    const { built, at } = capture(allMoves);
    at(0);
    const near = built.focus;
    expect(near?.distance).toBeCloseTo(cameraDepth(built, [-1, 1, 3]), 9);
    expect(near?.aperture).toBe(3);
    at(2.5);
    expect(built.focus?.distance).toBeCloseTo(cameraDepth(built, [0.6, 1, -0.5]), 9);
  });

  it('composes with the ambient camera drift and stays a pure function of t', () => {
    const budget: VariationBudget = {
      tones: {},
      toneShare: 0,
      steps: 5,
      cell: [1, 1],
      horizon: [0, 0],
      fade: [1, 1],
      lightAzimuth: [0, 0],
      lightElevation: [0, 0],
      debris: [1, 1],
      cameraDrift: [1.2, 0.5],
    };
    const ambient = ambientVariation({
      seed: 3,
      shotId: 's07',
      index: 1,
      actIndex: 0,
      budgetKey: 'voxel',
      budget,
    });
    const drifting = capture(allMoves, { ambient });
    const plain = capture(allMoves);
    const expected = TIMES.map((t) => drifting.at(t));
    for (const [index, t] of [...TIMES.entries()].reverse()) {
      expect(drifting.at(t)).toEqual(expected[index]);
    }
    // The drift turns the moved camera: same position, different orientation.
    const withDrift = drifting.at(6.6);
    const without = plain.at(6.6);
    expect(withDrift.camera.slice(0, 3)).toEqual(without.camera.slice(0, 3));
    expect(withDrift.camera.slice(3, 7)).not.toEqual(without.camera.slice(3, 7));
  });

  it('keeps the dolly-zoom subject on its depth and the orbit radius', () => {
    const { built, at } = capture(allMoves);
    at(5.5);
    expect(cameraDepth(built, [0.6, 1, -0.5])).toBeCloseTo(9, 6);
  });

  it('holds the latest started rack focus', () => {
    const module: SceneModule = {
      meta: { id: 's07' },
      build: () => ({}),
      update(_t, _state, ctx) {
        ctx.camera.rackFocus({ from: 2, to: 6, t0: 1, t1: 2 });
        ctx.camera.rackFocus({ from: 6, to: 3, t0: 4, t1: 5, bokeh: 5 });
      },
    };
    const built = buildShot(input(module));
    const focusAt = (t: number): number[] => {
      built.update(t);
      return [built.focus?.distance ?? Number.NaN, built.focus?.aperture ?? Number.NaN];
    };
    expect(focusAt(0)).toEqual([2, 3]);
    expect(focusAt(3)).toEqual([6, 3]);
    expect(focusAt(6)).toEqual([3, 5]);
  });

  it('has no focus and no change without moves', () => {
    const module: SceneModule = { meta: { id: 's07' }, build: () => ({}), update: () => undefined };
    const built = buildShot(input(module));
    const before = built.camera.matrixWorld.clone();
    built.update(1);
    expect(built.focus).toBeUndefined();
    expect(built.camera.matrixWorld.equals(before)).toBe(true);
  });
});

function cameraDepth(built: BuiltShot, point: THREE.Vector3Tuple): number {
  return new THREE.Vector3(...point).sub(built.camera.position).dot(cameraForward(built.camera));
}

describe('camera move errors', () => {
  const failing = (update: SceneModule['update'], build: SceneModule['build'] = () => ({})) =>
    buildShot(input({ meta: { id: 's07' }, build, update }));

  it('rejects moves in build()', () => {
    const attempt = (): BuiltShot =>
      failing(
        () => undefined,
        (ctx) => ctx.camera.dollyZoom({ from: 2, to: 4, t0: 0, t1: 1 }),
      );
    expect(attempt).toThrow(EngineError);
    expect(attempt).toThrow(/dollyZoom.*outside update/);
  });

  it.each([
    [{ from: 0, to: 2, t0: 0, t1: 1 }, /dollyZoom: from must be greater than 0/],
    [{ from: 2, to: 4, t0: 'soon', t1: 1 }, /t0 must be local seconds or an anchor/],
    [{ from: 2, to: 4, t0: 0, t1: 1, ease: 'bouncy' }, /unknown ease "bouncy"/],
    [{ from: 2, to: 4, t0: 0, t1: 1, subject: [1, 2] }, /subject must be a world point/],
  ])('rejects invalid dollyZoom options %#', (options, message) => {
    const built = failing((_t, _state, ctx) => {
      ctx.camera.dollyZoom(options as never);
    });
    expect(() => {
      built.update(0.5);
    }).toThrow(message);
  });

  it('rejects invalid layers and a subject behind the camera', () => {
    const layers = failing((_t, _state, ctx) => {
      ctx.camera.parallax({ amount: 1, t0: 0, t1: 1, layers: [{ near: 5, far: 2, ratio: 1 }] });
    });
    expect(() => {
      layers.update(0);
    }).toThrow(/layers\[0\] needs 0 <= near < far/);
    const behind = failing((_t, _state, ctx) => {
      ctx.camera.dollyZoom({ from: 2, to: 4, t0: 0, t1: 1, subject: [0, 2, 20] });
    });
    expect(() => {
      behind.update(0);
    }).toThrow(/subject must be in front of the camera/);
  });
});

describe('ctx.camera', () => {
  it('lists exactly its members (lint rule camera-api) and keeps the orbit rig', () => {
    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
    const moves = createCameraMoveLayer({
      shotId: 's',
      camera,
      scene: new THREE.Scene(),
      lookTarget: () => [0, 0, 0],
    });
    const api = createCameraApi(camera, { duration: 4, seed: 1, moves });
    expect(Object.keys(api).sort()).toEqual([...CAMERA_API_MEMBERS].sort());
    const pose = api.orbit({ radius: 5, degrees: [0, 90], ease: 'linear' })(4);
    expect(pose.position[0]).toBeCloseTo(5, 9);
  });

  it('moves a kit-tagged layer with the camera at ratio 0 (pinned to the frame)', () => {
    const module: SceneModule = {
      meta: { id: 's07' },
      build(ctx) {
        ctx.camera.set({ position: [0, 1.5, 6], target: [0, 1, 0] });
        const globe = ctx.kit.props.globe();
        globe.position.set(-1, 0, -2);
        ctx.scene.add(globe);
        return globe;
      },
      update(_t, _state, ctx) {
        ctx.camera.parallax({ amount: 3, t0: 0, t1: 1, layers: [{ kit: 'globe', ratio: 0 }] });
      },
    };
    let globe: THREE.Object3D | undefined;
    const built = buildShot(
      input({
        ...module,
        build: (ctx) => {
          globe = module.build(ctx) as THREE.Object3D;
          return globe;
        },
      }),
    );
    const screen = (t: number): number[] => {
      built.update(t);
      built.camera.updateMatrixWorld();
      return globe?.getWorldPosition(new THREE.Vector3()).project(built.camera).toArray() ?? [];
    };
    const start = screen(0);
    screen(1).forEach((value, index) => {
      expect(value).toBeCloseTo(start[index] ?? Number.NaN, 9);
    });
    expect(built.camera.position.x).toBeCloseTo(3, 9);
  });
});
