/**
 * Per-shot runtime: builds a scene module once (collecting sfx cues) and evaluates it at a local
 * time. GL-free, so it runs (and is tested) in Node as well as in the engine page.
 */
import { createKit, type KitDefinition } from '@reelforge/kit';
import { DEFAULT_SAFE_AREA, type SafeAreaMargins } from '@reelforge/shared';
import * as THREE from 'three';
import type { AnchorResolver } from './anchors.js';
import { createCameraApi } from './camera/camera-api.js';
import { EASINGS } from './camera/easing.js';
import type {
  AnchorHit,
  CameraPose,
  ResolvedAnchor,
  SceneContext,
  SceneModule,
  SfxApi,
  SfxCue,
  ShotInfo,
} from './contract.js';
import { describeError, EngineError } from './errors.js';
import { createRng, hashString, shotSeed } from './rng.js';
import type { ScenePalette } from './style.js';
import { createTextLayer, type TextOverlay } from './text/text-layer.js';
import type { PixelRect, TextCard } from './text/types.js';

/** Default camera: 50° vertical FOV, looking at the origin from slightly above. */
export const DEFAULT_CAMERA_POSE: CameraPose = { position: [0, 2, 8], target: [0, 0, 0], fov: 50 };

export interface ShotInput {
  readonly shot: ShotInfo & { readonly t0: number };
  readonly module: SceneModule;
  readonly projectSeed: number;
  readonly palette: ScenePalette;
  /** Text safe-area margins of the style; defaults to 5 %. */
  readonly safeArea?: SafeAreaMargins | undefined;
  readonly resolveAnchor: AnchorResolver;
  /** Project props (manifest `kitExtensions`), registered as ctx.kit.props.<name>. */
  readonly kitExtensions?: readonly KitDefinition[] | undefined;
}

export interface BuiltShot {
  readonly info: ShotInfo;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  /** Cues scheduled by `build`, in global time, in call order. */
  readonly cues: readonly SfxCue[];
  /** Anchors resolved by `build`, in global time, in call order. */
  readonly anchors: readonly ResolvedAnchor[];
  /** Text drawn by the last `update` (composited over the shot by the renderer). */
  readonly overlay: TextOverlay;
  /** Text safe area in low-res pixels. */
  readonly safeArea: PixelRect;
  /** Evaluates the scene at local time t (seconds). */
  update(localTime: number): void;
  /** Text cards registered by the last `update`. */
  cards(): readonly TextCard[];
}

function createAnchor(input: ShotInput): (phrase: string, nth?: number) => AnchorHit {
  const { shot, resolveAnchor } = input;
  return (phrase, nth = 1) => {
    const span = resolveAnchor(phrase, nth);
    if (!span) {
      throw new EngineError(
        'anchor-not-found',
        `anchor("${phrase}", ${String(nth)}) is not spoken in words.json; use a phrase copied from the script`,
        { shotId: shot.id },
      );
    }
    return { t: span.t - shot.t0, tEnd: span.tEnd - shot.t0 };
  };
}

/** `anchor()` of the build context: also records every resolved anchor (global time). */
function recordingAnchor(
  input: ShotInput,
  anchors: ResolvedAnchor[],
): (phrase: string, nth?: number) => AnchorHit {
  const anchor = createAnchor(input);
  return (phrase, nth = 1) => {
    const hit = anchor(phrase, nth);
    const { id, t0 } = input.shot;
    anchors.push({ shotId: id, phrase, nth, t: hit.t + t0, tEnd: hit.tEnd + t0 });
    return hit;
  };
}

function collectingSfx(shot: ShotInput['shot'], cues: SfxCue[]): SfxApi {
  return {
    at(t, name) {
      if (!Number.isFinite(t) || name.length === 0) {
        throw new EngineError(
          'scene-build',
          `sfx.at(${String(t)}, "${name}"): needs a finite time and a name`,
          {
            shotId: shot.id,
          },
        );
      }
      cues.push({ t: shot.t0 + t, name, shotId: shot.id });
    },
  };
}

function forbiddenSfx(shotId: string): SfxApi {
  return {
    at(_t, name) {
      throw new EngineError(
        'sfx-outside-build',
        `sfx.at(…, "${name}") was called in update(); schedule cues once in build()`,
        { shotId },
      );
    },
  };
}

export function buildShot(input: ShotInput): BuiltShot {
  const { shot, module, palette } = input;
  const { id, width, height, duration, fps } = shot;
  const info: ShotInfo = { id, width, height, duration, fps };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(DEFAULT_CAMERA_POSE.fov, width / height, 0.1, 1000);
  const seed = shotSeed(input.projectSeed, id);
  const cameraApi = createCameraApi(camera, { duration, seed });
  cameraApi.set(DEFAULT_CAMERA_POSE);
  const cues: SfxCue[] = [];
  const anchors: ResolvedAnchor[] = [];
  const text = createTextLayer({
    shotId: id,
    width,
    height,
    safeArea: input.safeArea ?? DEFAULT_SAFE_AREA,
    palette,
    seed: hashString('text', seed),
  });
  // One kit per shot, with its own seeded stream; sealed after build() (no new objects in update).
  const kit = createKit({
    three: THREE,
    palette,
    rng: createRng(hashString('kit', seed)),
    extraProps: input.kitExtensions,
  });
  const base = {
    three: THREE,
    scene,
    camera: cameraApi,
    kit: kit.api,
    palette,
    ease: EASINGS,
    anchor: createAnchor(input),
    shot: info,
  };
  const buildContext: SceneContext = {
    ...base,
    anchor: recordingAnchor(input, anchors),
    text: text.buildApi,
    sfx: collectingSfx(shot, cues),
    rng: createRng(seed),
  };
  let state: unknown;
  try {
    state = module.build(buildContext);
  } catch (error) {
    if (error instanceof EngineError) throw error;
    throw new EngineError('scene-build', `build() threw ${describeError(error)}`, {
      shotId: id,
      cause: error,
    });
  }
  if (state instanceof Promise) {
    throw new EngineError('scene-build', 'build() must be synchronous (it returned a Promise)', {
      shotId: id,
    });
  }
  kit.seal();
  const updateSfx = forbiddenSfx(id);
  return {
    info,
    scene,
    camera,
    cues,
    anchors,
    overlay: text.overlay,
    safeArea: text.safeArea,
    cards: () => text.cards(),
    update(localTime) {
      text.beginFrame(localTime);
      const updateContext: SceneContext = {
        ...base,
        text: text.frameApi,
        sfx: updateSfx,
        rng: createRng(seed).fork('update'),
      };
      try {
        module.update(localTime, state, updateContext);
      } catch (error) {
        if (error instanceof EngineError) throw error;
        throw new EngineError(
          'scene-update',
          `update(${String(localTime)}) threw ${describeError(error)}`,
          {
            shotId: id,
            cause: error,
          },
        );
      }
    },
  };
}
