/** What every annotation drawer receives and returns. */
import type { Paint, Rgb8, TextSurface } from '../text/surface.js';
import type { PixelRect } from '../text/types.js';
import type { StrokeStyle } from './raster.js';
import type { TargetSpec } from './target-spec.js';
import type { ResolvedTarget } from './targets.js';
import type { AnnotationPhase } from './timing.js';

export interface AnnotationEnv {
  readonly surface: TextSurface;
  readonly width: number;
  readonly height: number;
  readonly safeArea: PixelRect;
  /** Seed of this annotation (scribbles, stamp texture). */
  readonly seed: number;
  /** Default stroke thickness (2 px at 360 px high). */
  readonly stroke: number;
  /** Default label text scale (2 at 360 px high). */
  readonly labelScale: number;
  /** Default stamp text scale (3 at 360 px high). */
  readonly bigScale: number;
  readonly phase: AnnotationPhase;
  /** Main colour, rim colour and the dissolve paint of this frame. */
  readonly color: Rgb8;
  readonly outline: Rgb8 | undefined;
  readonly paint: Paint;
  /** Resolves a palette token / swatch; throws naming the option when unknown. */
  resolveColor(name: string, option: string): Rgb8;
  /**
   * Resolves a target (projected for this frame) and records it for QA under `role`;
   * `occlusion` raycasts whether geometry hides it (always done in QA probes).
   */
  target(spec: TargetSpec, role: string, occlusion?: boolean): ResolvedTarget;
  /** What is already on screen in this frame: text card boxes, earlier annotations' extents. */
  readonly occupied: readonly PixelRect[];
}

export interface AnnotationDraw {
  /** Label part (callout box, pin label, badge, stamp, value plate); empty for pure strokes. */
  readonly box: PixelRect;
  /** Everything it may draw at rest. */
  readonly extent: PixelRect;
  readonly textScale?: number | undefined;
  /** Hidden this frame although inside at..until (an occluded pin). */
  readonly hidden?: boolean | undefined;
}

export const EMPTY_RECT: PixelRect = { x: 0, y: 0, w: 0, h: 0 };

export function strokeStyle(env: AnnotationEnv, thickness: number | undefined): StrokeStyle {
  return {
    color: env.color,
    thickness: thickness ?? env.stroke,
    outline: env.outline,
    paint: env.paint,
  };
}

/** A share of the frame height in pixels. */
export function px(env: AnnotationEnv, share: number): number {
  return share * env.height;
}
