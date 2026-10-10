/**
 * `kit.fx.inkStage` (world c-cam, PLAN.md#14.2): the full-frame ink canvas every C-CAM shot draws
 * on. Backed by the spike's CPU canvas (`fx/ink-stage.ts`, ADR-004 addendum): one canvas per
 * stage, repainted from scratch for each t (reset -> opaque INK -> save -> painter -> restore),
 * shown on a nearest-filtered full-frame quad through the normal (full-colour) post pass.
 *
 * Scene API: `const stage = ctx.kit.fx.inkStage()` in build() (add it to ctx.scene), then
 * `stage.paint(t, (g, env) => ...)` in update(t). `g` is a `Paint2D` (no canvas, text, images or
 * pixel reads); `env` (`InkStageEnv`) carries the frame size, t, zoom 1 (`zoom`, `lw`: env is a
 * brush env itself), the palette `C`, the pure time and hash helpers of core.ts, the brushes bound
 * to `g` at zoom 1 and `ink`, the kit's C-CAM draw functions (stage-ink.ts: camera, scenery,
 * grime, faces, rig, contacts, lettering on this surface). Units: canvas px, seconds.
 */
import { z } from 'zod';
import { KitError } from '../../errors.js';
import { createInkStage, type StageCanvasFactory } from '../../fx/ink-stage.js';
import { createKitObject, type KitObject } from '../../object.js';
import { defineFx, type KitTools } from '../../registry.js';
import { C, H, W, clamp01, ease, hash, key, lerp, noise1, rnd, seg, step, twos } from './core.js';
import {
  DEFAULT_ENV,
  brushStroke,
  curve,
  inkLine,
  type InkLineOptions,
  type Pts,
} from './draw/brushes.js';
import type { Paint2D } from './draw/paint.js';
import { blob, type BlobOptions } from './draw/shapes.js';
import { stageInk, type StageInk } from './stage-ink.js';
import { stageSurface } from './stage-surface.js';

/** Pure helpers of core.ts a painter may use (all functions of their arguments). */
const TIME = Object.freeze({ twos, key, step, seg, ease, lerp, clamp01, hash, rnd, noise1 });

/** Brushes bound to this frame's surface at zoom 1 (screen space; `env.ink` has the rest). */
export interface StageBrushes {
  /** The uneven ink ribbon through points `[x, y, x, y, ...]` (options: closed, seed, w, taper, color). */
  inkLine(pts: Pts, options?: InkLineOptions): void;
  /** A soft brush stroke through control points (wrinkles, cracks, folds). */
  brushStroke(pts: Pts, options?: InkLineOptions): void;
  /** A filled shape with shade/light crescents, mottle, hatch and an ink outline; returns the outline. */
  blob(pts: Pts, fill: string, options?: BlobOptions): number[];
  /** Catmull-Rom points through control points (pure). */
  curve(pts: Pts, closed?: boolean, step?: number): number[];
}

/** What a painter gets next to `g`; frozen, rebuilt for every frame. */
export interface InkStageEnv {
  /** Canvas size in px (default the frame: 1920x1080, or 1080x1920 for a portrait short). */
  readonly width: number;
  readonly height: number;
  /** The time passed to `paint`, seconds. */
  readonly t: number;
  /** Zoom 1 and its ink width: `env` is the brush env of screen space (`cam.env` after a camera). */
  readonly zoom: number;
  readonly lw: number;
  /** The C-CAM palette (`C.INK`, `C.LINEN`, `C.RUST`, ...). */
  readonly C: typeof C;
  /** Pure helpers: twos (pose time on twos), key, step, seg, ease, lerp, clamp01, hash, rnd, noise1. */
  readonly time: typeof TIME;
  readonly brush: StageBrushes;
  /** The kit's C-CAM draw functions with their own signatures; `drawText` draws on `g`. */
  readonly ink: StageInk;
}

export type InkPainter = (g: Paint2D, env: InkStageEnv) => void;

export type InkStageObject = KitObject & {
  /** Canvas size in px. */
  readonly size: readonly [number, number];
  /** Repaints the stage for time t (seconds) with a pure painter; call it in update(t). */
  paint(t: number, painter: InkPainter): void;
};

export const inkStageParams = z.object({
  size: z
    .tuple([z.int().min(16).max(4096), z.int().min(16).max(4096)])
    .optional()
    .describe('Canvas size in px [width, height] (default: the frame, 1920x1080)'),
});

const STAGE_METHODS = {
  'paint(t, (g, env) => ...)':
    'Repaints the whole stage for time t (seconds) from an opaque INK background: call it every frame in update(t). The painter must be a pure function of env.t (no state between frames)',
  g: 'Paint2D: fillStyle, strokeStyle, lineWidth, lineCap, globalAlpha, save/restore, setTransform/translate/rotate/scale, beginPath/closePath/moveTo/lineTo/quadraticCurveTo/rect/ellipse, fill(rule)/stroke/clip, fillRect. No text, images, gradients or pixel reads',
  env: 'width, height, t, zoom/lw (1: screen space), C (palette: INK, LINEN, OLIVE, CLAY, MUSTARD, RUST, ...), time.{twos, key, step, seg, ease, lerp, clamp01, hash, rnd, noise1}, brush.{inkLine(pts, o), brushStroke(pts, o), blob(pts, fill, o), curve(pts, closed, step)}, ink.* (the C-CAM draw functions: applyCamera, resolveCut, blob(g, e, ...), pool, stain, exprAt, palmWorld, reachPalm, drawFigure, drawText(text, o), ...: reelforge kit-docs grim-ink); points are flat [x, y, x, y, ...] in canvas px',
} as const;

function brushesFor(g: Paint2D): StageBrushes {
  return Object.freeze({
    inkLine: (pts: Pts, options?: InkLineOptions) => {
      inkLine(g, DEFAULT_ENV, pts, options);
    },
    brushStroke: (pts: Pts, options?: InkLineOptions) => {
      brushStroke(g, DEFAULT_ENV, pts, options);
    },
    blob: (pts: Pts, fill: string, options?: BlobOptions) =>
      blob(g, DEFAULT_ENV, pts, fill, options),
    curve: (pts: Pts, closed?: boolean, stepLength?: number) => curve(pts, closed, stepLength),
  });
}

function checkPaint(t: number, painter: unknown): void {
  if (!Number.isFinite(t)) {
    throw new KitError(
      'invalid-params',
      `inkStage.paint(t, painter): t must be a finite time in seconds (got ${String(t)})`,
    );
  }
  if (typeof painter !== 'function') {
    throw new KitError(
      'invalid-params',
      'inkStage.paint(t, painter): painter must be a function (g, env) => { ... }',
    );
  }
}

type StageTools = Pick<KitTools, 'three' | 'track' | 'frame'>;

/** Builds the stage object; `createCanvas` is injectable for unit tests (default: the frame's document). */
export function buildInkStage(
  params: z.output<typeof inkStageParams>,
  tools: StageTools,
  createCanvas?: StageCanvasFactory,
): InkStageObject {
  const [width, height] = params.size ?? [tools.frame?.width ?? W, tools.frame?.height ?? H];
  const stage = createInkStage(
    tools,
    { width, height, background: C.INK, upload: 'canvas' },
    createCanvas,
  );
  let disposed = false;
  const release = {
    dispose: (): void => {
      disposed = true;
      stage.dispose();
    },
  };
  tools.track(release);
  const object = createKitObject(tools.three, {
    kitType: 'inkStage',
    // A clip-space quad: no extent in the scene.
    bounds: () => new tools.three.Box3(),
    resources: [release],
  });
  object.add(stage.mesh);
  const size = Object.freeze([width, height] as const);
  const paint = (t: number, painter: InkPainter): void => {
    checkPaint(t, painter);
    if (disposed) throw new KitError('invalid-params', 'inkStage.paint(): the stage was disposed');
    stage.render(t, (context) => {
      const g = stageSurface(context);
      const env: InkStageEnv = {
        width,
        height,
        t,
        zoom: DEFAULT_ENV.zoom,
        lw: DEFAULT_ENV.lw,
        C,
        time: TIME,
        brush: brushesFor(g),
        ink: stageInk(g),
      };
      painter(g, Object.freeze(env));
    });
  };
  return Object.assign(object, { size, paint });
}

export const inkStage = defineFx({
  name: 'inkStage',
  description:
    'The full-frame ink canvas of a Grim Ink (c-cam) shot: build it once, add it to ctx.scene, and repaint it every frame with stage.paint(t, (g, env) => ...) using the ink brushes (uneven ink line, blobs with crescents, mottle and hatching) over an opaque ink background.',
  params: inkStageParams,
  methods: STAGE_METHODS,
  build: (params, tools) => buildInkStage(params, tools),
});
