/**
 * The neutral mannequin of the character pack (ADR-024), 1:1 from the concept page: one cream
 * colour, smooth carved body with ball joints, no face or clothes, a finer voxel (1/24 unit) like
 * the anatomy models. Calm energy; think/eureka fold the long arm to the chin.
 */
import type { KitTools } from '../registry.js';
import type { CharacterBuild } from './build.js';
import { clamp01, lerp, smooth } from './math.js';
import { buildRig, type BodySpec } from './rig.js';
import { shapeSet, type Inside } from './shape.js';

export const MANNEQUIN_INFO =
  'Mannequin: one-colour, faceless wooden-style figure with ball joints and realistic proportions; for anatomy, diagrams and "the average person".';

const ellipsoid =
  (cx: number, cy: number, cz: number, rx: number, ry: number, rz: number): Inside =>
  (x, y, z) =>
    ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1;

const capsule =
  (y0: number, y1: number, r0: number, r1: number): Inside =>
  (x, y, z) => {
    const k = clamp01((y - y0) / (y1 - y0));
    const yy = Math.min(Math.max(y, Math.min(y0, y1)), Math.max(y0, y1));
    const r = lerp(r0, r1, k);
    return x * x + (y - yy) ** 2 + z * z <= r * r;
  };

const ball =
  (r: number): Inside =>
  (x, y, z) =>
    x * x + y * y + z * z <= r * r;

const either =
  (...parts: readonly Inside[]): Inside =>
  (x, y, z) =>
    parts.some((inside) => inside(x, y, z));

function torso(x: number, y: number, z: number): boolean {
  if (y > 15) return x * x + z * z <= 2.5 * 2.5;
  const chest = y > 12 ? Math.sqrt(Math.max(0, 1 - ((y - 12) / 3.6) ** 2)) * 0.6 + 0.4 : 1;
  const rx = y < 6 ? lerp(4.8, 4.5, y / 6) : lerp(4.5, 6.9, smooth(6, 12, y)) * chest;
  const rz = y < 8 ? 3.4 : 3.9;
  return (x / rx) ** 2 + (z / rz) ** 2 <= 1;
}

export function buildMannequin(tools: KitTools): CharacterBuild {
  const u = 1 / 24;
  const color = 'cream';
  const spec: BodySpec = {
    unit: u,
    leg: 22,
    thigh: 11,
    hipX: 3,
    shoulderX: 8,
    shoulderY: 13,
    upper: 9,
    neckY: 16,
  };
  const S = shapeSet(u);
  const lo = [-7, -14, -7] as const;
  const hi = [7, 4, 7] as const;
  S('hips').vox(color, [-7, -5, -5], [7, 3, 5], ellipsoid(0, -0.6, 0, 5.8, 3.7, 3.9));
  S('torso').vox(color, [-8, 0, -5], [8, 19, 5], torso);
  S('neck').vox(
    color,
    [-5, 0, -5],
    [5, 11, 6],
    either(ellipsoid(0, 5.5, 0.3, 3.6, 4.6, 4.1), ellipsoid(0, 3, 1.2, 2.6, 2.5, 3)),
  );
  for (const side of ['L', 'R'] as const) {
    S(`sh${side}`).vox(color, lo, hi, either(ball(2.5), capsule(-8.3, -1.5, 1.8, 2.3)));
    S(`el${side}`).vox(
      color,
      lo,
      hi,
      either(ball(1.9), capsule(-6.8, -1, 1.4, 1.9), ellipsoid(0, -8.3, 0.2, 1.4, 2, 1.7)),
    );
    S(`hip${side}`).vox(color, lo, hi, either(ball(2.8), capsule(-10, -1, 2.2, 3)));
    S(`kn${side}`).vox(
      color,
      lo,
      hi,
      either(ball(2.2), capsule(-9.4, -1, 1.6, 2.2), ellipsoid(0, -10.3, 1.1, 1.7, 1, 3)),
    );
  }
  return {
    id: 'mannequin',
    rig: buildRig(tools, spec, S),
    energy: 0.25,
    longArms: true,
    headTop: [0, 10.5, 0],
    faceAt: [0, 5.5, 4.4],
    hand: [0, -8.3, 0.2],
  };
}
