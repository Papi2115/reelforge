/**
 * Limbs of the character pack (ADR-024), as on the concept page: sleeve + hand on the arms, legs
 * with a shin colour and a shoe that sticks out at the toe, plus the rectangle-frame helper used
 * for glasses and the magnifier.
 */
import type { BodySpec } from './rig.js';
import { shapeSet, type Shape, type ShapeSet } from './shape.js';

export interface LimbSpec {
  readonly sleeve: string;
  readonly hand: string;
  readonly pants: string;
  /** Colour of the lower leg (default: pants; skin for shorts). */
  readonly shin?: string | undefined;
  readonly shoe: string;
  readonly armW?: number | undefined;
  readonly handW?: number | undefined;
  readonly handH?: number | undefined;
  readonly legW?: number | undefined;
  readonly toe?: number | undefined;
  readonly shoeH?: number | undefined;
}

/** Hand height used when a limb spec has none (also where held props attach). */
export const DEFAULT_HAND_H = 1.4;

export function humanoid(spec: BodySpec, limbs: LimbSpec): ShapeSet {
  const shapes = shapeSet(spec.unit);
  const aw = limbs.armW ?? 2;
  const fore = spec.fore ?? spec.upper;
  const hh = limbs.handH ?? DEFAULT_HAND_H;
  const hw = limbs.handW ?? aw;
  const lw = limbs.legW ?? 2.6;
  const shin = spec.leg - spec.thigh;
  const sh = limbs.shoeH ?? 1;
  for (const side of ['L', 'R'] as const) {
    shapes(`sh${side}`).cb(limbs.sleeve, [0, -spec.upper, 0], [aw, spec.upper + 0.6, aw]);
    shapes(`el${side}`)
      .cb(limbs.sleeve, [0, -fore + hh, 0], [aw * 0.94, fore - hh, aw * 0.94])
      .cb(limbs.hand, [0, -fore, 0], [hw, hh, hw]);
    shapes(`hip${side}`).cb(limbs.pants, [0, -spec.thigh, 0], [lw, spec.thigh + 0.3, lw]);
    shapes(`kn${side}`)
      .cb(limbs.shin ?? limbs.pants, [0, -shin + sh, 0], [lw * 0.95, shin - sh, lw * 0.95])
      .box(
        limbs.shoe,
        [-lw / 2 - 0.1, -shin, -lw / 2 - 0.1],
        [lw / 2 + 0.1, -shin + sh, lw / 2 + (limbs.toe ?? 0.8)],
      );
  }
  return shapes;
}

/** Rectangle frame in the x/y plane (glasses, magnifier): w x h, bar thickness t. */
export function frame(
  shape: Shape,
  color: string,
  cx: number,
  cy: number,
  z: number,
  w: number,
  h: number,
  t: number,
): Shape {
  return shape
    .cb(color, [cx, cy - h / 2, z], [w, t, t])
    .cb(color, [cx, cy + h / 2 - t, z], [w, t, t])
    .cb(color, [cx - w / 2 + t / 2, cy - h / 2, z], [t, h, t])
    .cb(color, [cx + w / 2 - t / 2, cy - h / 2, z], [t, h, t]);
}
