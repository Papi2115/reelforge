/**
 * Engine runtime for one loaded video: validates the manifest, imports and builds every shot,
 * and renders any global time synchronously. Runs inside the sandboxed engine frame.
 */
import { loadProjectCast } from '@reelforge/kit';
import {
  renderManifestSchema,
  type RenderManifest,
  type SceneSource,
  type ShotDirection,
} from '@reelforge/shared';
import { shotAmbient } from './ambient.js';
import { createExactAnchorResolver, NO_ANCHORS } from './anchors.js';
import { createAssetLibrary } from './assets/library.js';
import type { ResolvedAnchor, SfxCue } from './contract.js';
import {
  blendFrameDirections,
  createFrameDirector,
  directedClock,
  directionWindows,
  frameDirection,
  type FrameDirector,
} from './direction.js';
import { describeError, EngineError } from './errors.js';
import {
  configureColorManagement,
  createFrameRenderer,
  type FrameRenderer,
  type FrameRendererOptions,
  type GpuInfo,
} from './gl/frame-renderer.js';
import { loadProjectModules, type KitExtensionImporter } from './kit-extensions.js';
import {
  applyPaletteShift,
  paletteShiftMap,
  shotClock,
  shotPaletteShift,
  type ShotClock,
} from './moments.js';
import { createMoodGrader } from './mood.js';
import { pickInShot, type PickResult } from './pick.js';
import { shotSeed } from './rng.js';
import { toSceneModule } from './scene-module.js';
import { buildShot, type BuiltShot } from './shot.js';
import { resolveStyle, type ResolvedStyle } from './style.js';
import { checkCards, collectCardTimeline, type CardDiagnostic } from './text/check-cards.js';
import { createTimeline, sampleTimeline, type TimelineSample } from './timeline.js';
import { videoWorldAssets } from './world-assets/build.js';
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
  /**
   * Replaces one shot's live co-direction (PLAN.md#12.14) without rebuilding anything; undefined
   * clears it. Seek again to see the change.
   */
  setShotDirection(shotId: string, direction: ShotDirection | undefined): LoadInfo;
  dispose(): void;
}

export interface RuntimeDependencies {
  readonly canvas: HTMLCanvasElement;
  /** Imports a scene module source and returns its namespace. */
  importScene(scene: SceneSource, shotId: string): Promise<unknown>;
  /** Imports a project module (`kitExtensions`) and returns its namespace. */
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
  modules: Awaited<ReturnType<typeof loadProjectModules>>,
): ShotBuilder {
  // Project roles (PLAN.md#12.20): invalid files are left out, a scene naming one gets the error.
  const cast = loadProjectCast(manifest.castRoles);
  const resolveAnchor = manifest.words
    ? createExactAnchorResolver(manifest.words.words)
    : NO_ANCHORS;
  // One library per video: decoded pictures and stylised pixels are shared by all shots.
  const assets = createAssetLibrary(manifest.assets ?? [], {
    colors: Object.values(style.swatches),
    lut: style.post.lut,
    ditherSize: style.post.dither.size,
  });
  // The film's world assets (PLAN.md#13.15): parsed once, the same frozen value in every shot.
  const worldAssets = videoWorldAssets(style.id, manifest.worldAssets)?.value;
  const captions = manifest.captions === true ? (manifest.words?.words ?? []) : undefined;
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
      ...modules,
      cast,
      ambient: shotAmbient(manifest, style, index),
      assets,
      styleId: style.id,
      worldAssets,
      captions,
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
  const modules = await loadProjectModules(manifest, style.id, dependencies.importKitExtension);
  const build = createShotBuilder(manifest, style, modules);
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
  // Reveal moments (PLAN.md#12.27): slow-motion clocks and palette shifts of accepted moments.
  // Shots without them keep the plain local time and the frame as rendered.
  // Live co-direction (PLAN.md#12.14): per-shot overrides, replaceable without a rebuild.
  const directions: (ShotDirection | undefined)[] = manifest.shots.map((shot) => shot.direction);
  const clockOf = (index: number): ShotClock | undefined => {
    const shot = manifest.shots[index];
    const built = shots[index];
    if (shot === undefined) return undefined;
    if (directions[index]?.rate === undefined || built === undefined) return shotClock(shot);
    return directedClock(shot, directionWindows(shot, directions[index], built));
  };
  const clocks: (ShotClock | undefined)[] = manifest.shots.map((_, index) => clockOf(index));
  const sceneTime = (index: number, localTime: number): number =>
    clocks[index]?.(localTime) ?? localTime;
  let frameDirector: FrameDirector | undefined;
  /** Applies the shots' frame directions (tone, zoom, marks) to the frame just rendered. */
  const direct = (sample: TimelineSample, t: number): void => {
    const current = frameDirection(directions[sample.current.index]);
    const outgoing = sample.transition
      ? frameDirection(directions[sample.transition.outgoing.index])
      : undefined;
    const direction = sample.transition
      ? blendFrameDirections(outgoing, current, sample.transition.progress)
      : current;
    if (direction === undefined) return;
    frameDirector ??= createFrameDirector(style, manifest.seed);
    let source = composited;
    if (source === undefined) {
      source = new Uint8Array(width * height * 4);
      frameRenderer.readFrame(source);
    }
    composited = frameDirector.apply(source, direction, t);
  };
  const shifts = manifest.shots.some((shot) => (shot.paletteShift?.length ?? 0) > 0)
    ? {
        map: paletteShiftMap(style.swatches, style.variation),
        source: new Uint8Array(width * height * 4),
        out: new Uint8Array(width * height * 4),
      }
    : undefined;
  /** Applies the current shot's palette shift to the frame just rendered (moments only). */
  const shiftPalette = (index: number, localTime: number): void => {
    const shot = manifest.shots[index];
    if (shifts === undefined || shot === undefined) return;
    const amount = shotPaletteShift(shot, localTime);
    if (amount <= 0) return;
    const source = composited ?? shifts.source;
    if (composited === undefined) frameRenderer.readFrame(source);
    applyPaletteShift(source.slice(), width, shifts.map, amount, shifts.out);
    composited = shifts.out;
  };
  // Tension map mood grade (PLAN.md#12.22): undefined when no shot is graded (idle path).
  const moodGrader = createMoodGrader(manifest, style);
  /** Post passes of the frame just rendered: moment flash, mood grade, live co-direction. */
  const finish = (sample: TimelineSample, t: number): void => {
    shiftPalette(sample.current.index, sample.current.localTime);
    const mood = moodGrader?.amount(sample) ?? 0;
    if (moodGrader !== undefined && mood !== 0) {
      let source = composited;
      if (source === undefined) {
        source = new Uint8Array(width * height * 4);
        frameRenderer.readFrame(source);
      }
      composited = moodGrader.apply(source, mood);
    }
    direct(sample, t);
  };
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
      const options = { captionTime: t }; // captions follow the audio clock, not a scene clock
      if (!sample.transition) {
        current.update(sceneTime(sample.current.index, sample.current.localTime), options);
        frameRenderer.render({ a: current, mode: 'single', progress: 0, seed: 0 });
        finish(sample, t);
        return;
      }
      const outgoing = shotAt(sample.transition.outgoing.index);
      const { outgoing: before } = sample.transition;
      outgoing.update(sceneTime(before.index, before.localTime), options);
      current.update(sceneTime(sample.current.index, sample.current.localTime), options);
      const seed = transitionSeeds[sample.current.index] ?? 0;
      const pixelTransition = findTransition(sample.transition.style);
      if (pixelTransition) {
        composited = pixelTransitions.render({
          a: outgoing,
          b: current,
          transition: pixelTransition,
          progress: sample.transition.progress,
          seed,
          focus: sample.transition.focus,
        });
        finish(sample, t);
        return;
      }
      frameRenderer.render({
        a: outgoing,
        b: current,
        mode: sample.transition.type,
        progress: sample.transition.progress,
        seed,
      });
      finish(sample, t);
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
      const localTime = sceneTime(current.index, current.localTime);
      shot.update(localTime);
      return pickInShot({ shot, width, height, x, y, t, localTime });
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
      // New hits may move the rate windows of a directed shot.
      clocks[index] = clockOf(index);
      info = describe();
      return info;
    },
    setShotDirection(shotId, direction) {
      const index = manifest.shots.findIndex((shot) => shot.id === shotId);
      if (index < 0) throw new EngineError('not-loaded', `no shot "${shotId}" in the loaded video`);
      directions[index] = direction;
      clocks[index] = clockOf(index);
      return info;
    },
    dispose() {
      frameRenderer.dispose();
    },
  };
}
