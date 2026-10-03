/** Helpers shared by the stroke annotations: vector maths, value labels, arrow heads. */
import { fontByName } from '../text/cards.js';
import type { AnnotationEnv } from './env.js';
import { measureLabel, type LabelColors, type LabelGeometry } from './label.js';
import type { ParsedArrow } from './options.js';
import type { Point } from './raster.js';

export const add = (a: Point, b: Point, k = 1): Point => ({ x: a.x + b.x * k, y: a.y + b.y * k });
export const unit = (from: Point, to: Point): Point => {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
};

export type LabelOptions = Pick<ParsedArrow, 'scale' | 'font' | 'textColor' | 'plate'>;

export function labelFor(env: AnnotationEnv, text: string, options: LabelOptions): LabelGeometry {
  const scale = options.scale ?? env.labelScale;
  return measureLabel(text, fontByName(options.font), scale, env.safeArea.w * 0.5);
}

export function labelColors(env: AnnotationEnv, options: LabelOptions): LabelColors {
  return {
    text: env.resolveColor(options.textColor, 'textColor'),
    plate: options.plate === false ? undefined : env.resolveColor(options.plate, 'plate'),
    rim: env.outline,
  };
}

/** Filled arrow head with its tip 1 px past `tip`, pointing along unit `dir`. */
export function head(tip: Point, dir: Point, size: number): readonly [Point, Point, Point] {
  const normal = { x: -dir.y, y: dir.x };
  const base = add(tip, dir, -size);
  const half = size * 0.6;
  return [add(tip, dir, 1), add(base, normal, half), add(base, normal, -half)];
}
