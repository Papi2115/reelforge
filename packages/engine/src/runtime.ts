/**
 * Engine runtime for one loaded video: validates the manifest, imports and builds every shot,
 * and renders any global time synchronously. Runs inside the sandboxed engine frame.
 */
import type { KitDefinition } from '@reelforge/kit';
import { renderManifestSchema, type RenderManifest, type SceneSource } from '@reelforge/shared';
import { shotAmbient } from './ambient.js';
import { createExactAnchorResolver, NO_ANCHORS } from './anchors.js';
import { createAssetLibrary } from './assets/library.js';
import type { ResolvedAnchor, SfxCue } from './contract.js';
import { describeError, EngineError } from './errors.js';
import {
  configureColorManagement,
  createFrameRenderer,
  type FrameRenderer,
  type FrameRendererOptions,
  type GpuInfo,
} from './gl/frame-renderer.js';
import { loadKitExtensions, type KitExtensionImporter } from './kit-extensions.js';
import { pickInShot, type PickResult } from './pick.js';
import { shotSeed } from './rng.js';
import { toSceneModule } from './scene-module.js';
import { buildShot, type BuiltShot } from './shot.js';
import { resolveStyle, type ResolvedStyle } from './style.js';
import { checkCards, collectCardTimeline, type CardDiagnostic } from './text/check-cards.js';
import { createTimeline, sampleTimeline } from './timeline.js';
import { findTransition, paletteNumbers } from './transitions/index.js';
import { createPixelTransitionRenderer } from './transitions/render.js';

export interface LoadInfo {
  readonly duration: number;
  /** Id of the style preset in use. */
  readonly style: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  /** All sfx cues scheduled by the scenes, in global time, sorted by time (stable). */
  readonly cues: readonly SfxCue[];
  /** Anchors the scenes resolved in build(), in global time, sorted by time (stable). */
  readonly anchors: readonly ResolvedAnchor[];
  readonly gpu: GpuInfo;
}

export interface EngineRuntime {
  /** Info of the loaded video; cues and anchors change when a shot is reloaded. */
  readonly info: LoadInfo;
  /** Renders global time t (seconds) into the output target. Synchronous and deterministic. */
  seek(t: number): void;
  /** Copy of the last rendered frame (RGBA8, top-down, width*height*4 bytes). */
  readFrame(): Uint8Array<ArrayBuffer>;
  /**
   * Text-card QA of one shot (overlaps, safe area; annotation targets and anchors), sampled every
   * frame (PLAN.md §4.4).
   */
  checkCards(shotId: string): CardDiagnostic[];
  /**
   * What is at normalized frame point (x, y) (0..1, top-left origin) at global time t: a text
   * card, a kit object or another scene object of the shot on screen; undefined = background.
   * Evaluates the shot like seek() but renders nothing (PLAN.md#6.6).
   */
  pick(t: number, x: number, y: number): PickResult | undefined;
  /**
   * Re-imports and rebuilds one shot from new scene source (hot reload, PLAN.md#6.4); the other
   * shots, the timeline and the renderer are kept. On failure the previous shot stays in place.
   */
  reloadShot(shotId: string, scene: SceneSource): Promise<LoadInfo>;
  dispose(): void;
}

export interface RuntimeDependencies {
  readonly canvas: HTMLCanvasElement;
  /** Imports a scene module source and returns its namespace. */
  importScene(scene: SceneSource, shotId: string): Promise<unknown>;
  /** Imports a project prop module (`kitExtensions`) and returns its namespace. */
  readonly importKitExtension: KitExtensionImporter;
}

export function parseManifest(input: unknown): RenderManifest {
  const result = renderManifestSchema.safeParse(input);
  if (result.success) return result.data;
  const details = result.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  throw new EngineError('invalid-manifest', `invalid render manifest: ${details}`);
}

/** Builds one manifest shot from its imported scene module namespace. */
type ShotBuilder = (
  shot: RenderManifest['shots'][number],
  namespace: unknown,
  index: number,
) => BuiltShot;

function createShotBuilder(
  manifest: RenderManifest,
  style: ResolvedStyle,
  kitExtensions: readonly KitDefinition[],
): ShotBuilder {
  const resolveAnchor = manifest.words
    ? createExactAnchorResolver(manifest.words.words)
    : NO_ANCHORS;
  // One library per video: decoded pictures and stylised pixels are shared by all shots.
  const assets = createAssetLibrary(manifest.assets ?? [], {
    colors: Object.values(style.swatches),
    lut: style.post.lut,
    ditherSize: style.post.dither.size,
  });
  return (shot, namespace, index) =>
    buildShot({
      shot: {
        id: shot.id,
        t0: shot.t0,
        duration: shot.t1 - shot.t0,
        width: style.width,
        height: style.height,
        fps: manifest.fps,
      },
      module: toSceneModule(namespace, shot.scene.file, shot.id),
      projectSeed: manifest.seed,
      palette: style.palette,
      safeArea: style.safeArea,
      resolveAnchor,
      kitExtensions,
      ambient: shotAmbient(manifest, style, index),
      assets,
    });
}

async function buildShots(
  manifest: RenderManifest,
  build: ShotBuilder,
  dependencies: RuntimeDependencies,
): Promise<BuiltShot[]> {
  const namespaces = await Promise.all(
    manifest.shots.map((shot) => dependencies.importScene(shot.scene, shot.id)),
  );
  return manifest.shots.map((shot, index) => build(shot, namespaces[index], index));
}

function createRendererOrThrow(options: FrameRendererOptions): FrameRenderer {
  try {
    return createFrameRenderer(options);
  } catch (error) {
    throw new EngineError('webgl', `cannot create the WebGL renderer: ${describeError(error)}`, {
      cause: error,
    });
  }
}

export async function createRuntime(
  manifestInput: unknown,
  dependencies: RuntimeDependencies,
): Promise<EngineRuntime> {
  const manifest = parseManifest(manifestInput);
  const style = resolveStyle(manifest);
  // Before any scene code runs: module top-level code may already create Colors.
  configureColorManagement();
  const kitExtensions = await loadKitExtensions(
    manifest.kitExtensions ?? [],
    dependencies.importKitExtension,
  );
  const build = createShotBuilder(manifest, style, kitExtensions);
  const shots = await buildShots(manifest, build, dependencies);
  const timeline = createTimeline(
    manifest.shots.map((shot) => ({
      id: shot.id,
      t0: shot.t0,
      t1: shot.t1,
      transitionIn: shot.transitionIn ?? { type: 'cut' },
    })),
  );
  const transitionSeeds = manifest.shots.map((shot) =>
    shotSeed(manifest.seed, `transition:${shot.id}`),
  );
  const { width, height } = style;
  const frameRenderer = createRendererOrThrow({
    canvas: dependencies.canvas,
    width,
    height,
    post: style.post,
  });
  const gpu = frameRenderer.gpuInfo();
  const pixelTransitions = createPixelTransitionRenderer(frameRenderer, {
    palette: paletteNumbers(style.swatches),
  });
  /** The last frame when it was composited on the CPU (transition kit), else read from the GPU. */
  let composited: Uint8Array<ArrayBuffer> | undefined;
  const describe = (): LoadInfo => ({
    duration: timeline.duration,
    style: style.id,
    width,
    height,
    fps: manifest.fps,
    cues: shots.flatMap((shot) => shot.cues).sort((first, second) => first.t - second.t),
    anchors: shots.flatMap((shot) => shot.anchors).sort((first, second) => first.t - second.t),
    gpu,
  });
  let info = describe();
  const shotAt = (index: number): BuiltShot => {
    const shot = shots[index];
    if (!shot) throw new EngineError('not-loaded', `no shot at index ${String(index)}`);
    return shot;
  };

  return {
    get info() {
      return info;
    },
    seek(t) {
      const sample = sampleTimeline(timeline, t);
      const current = shotAt(sample.current.index);
      composited = undefined;
      if (!sample.transition) {
        current.update(sample.current.localTime);
        frameRenderer.render({ a: current, mode: 'single', progress: 0, seed: 0 });
        return;
      }
      const outgoing = shotAt(sample.transition.outgoing.index);
      outgoing.update(sample.transition.outgoing.localTime);
      current.update(sample.current.localTime);
      const seed = transitionSeeds[sample.current.index] ?? 0;
      const pixelTransition = findTransition(sample.transition.style);
      if (pixelTransition) {
        composited = pixelTransitions.render({
          a: outgoing,
          b: current,
          transition: pixelTransition,
          progress: sample.transition.progress,
          seed,
        });
        return;
      }
      frameRenderer.render({
        a: outgoing,
        b: current,
        mode: sample.transition.type,
        progress: sample.transition.progress,
        seed,
      });
    },
    readFrame() {
      if (composited) return composited.slice();
      const frame = new Uint8Array(width * height * 4);
      frameRenderer.readFrame(frame);
      return frame;
    },
    pick(t, x, y) {
      const { current } = sampleTimeline(timeline, t);
      const shot = shotAt(current.index);
      shot.update(current.localTime);
      return pickInShot({ shot, width, height, x, y, t, localTime: current.localTime });
    },
    checkCards(shotId) {
      const shot = shots.find((candidate) => candidate.info.id === shotId);
      if (!shot) throw new EngineError('not-loaded', `no shot "${shotId}" in the loaded video`);
      // QA probe: annotation targets are also raycast for occlusion.
      const probing = {
        info: shot.info,
        safeArea: shot.safeArea,
        cards: () => shot.cards(),
        update: (localTime: number) => {
          shot.update(localTime, { probe: true });
        },
      };
      return checkCards(collectCardTimeline(probing));
    },
    async reloadShot(shotId, scene) {
      const index = manifest.shots.findIndex((shot) => shot.id === shotId);
      const shot = manifest.shots[index];
      if (!shot) throw new EngineError('not-loaded', `no shot "${shotId}" in the loaded video`);
      const namespace = await dependencies.importScene(scene, shotId);
      // Built before it replaces the old shot: a broken scene leaves the video as it was.
      shots[index] = build({ ...shot, scene }, namespace, index);
      info = describe();
      return info;
    },
    dispose() {
      frameRenderer.dispose();
    },
  };
}
