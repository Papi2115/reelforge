/**
 * Shape geometry of the flat-2d look: exact outlines (polygon rings around the shape's centre,
 * y down) for every shape kind, and a radial profile (distance from the centre at evenly spaced
 * angles) used to morph between kinds: two profiles blend angle by angle, so a circle can turn
 * into a star or a square and back without the outline crossing itself.
 */
import type { Point } from './raster.js';

export const SHAPE_KINDS = [
  'circle',
  'rect',
  'pill',
  'triangle',
  'diamond',
  'hexagon',
  'star',
  'plus',
  'ring',
] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

export interface ShapeSize {
  readonly w: number;
  readonly h: number;
  /** Corner radius of rects (pixels). */
  readonly round: number;
  /** Band of rings (pixels). */
  readonly thickness: number;
}

/** Samples of a radial profile (and of the morph outline). */
export const PROFILE_SAMPLES = 128;

function ellipseRing(rx: number, ry: number, samples = 96): Point[] {
  return Array.from({ length: samples }, (_, index) => {
    const angle = (index / samples) * Math.PI * 2;
    return [Math.cos(angle) * rx, Math.sin(angle) * ry] as const;
  });
}

function roundedRect(w: number, h: number, round: number): Point[] {
  const r = Math.max(0, Math.min(round, w / 2, h / 2));
  const x = w / 2;
  const y = h / 2;
  if (r < 0.5) {
    return [
      [-x, -y],
      [x, -y],
      [x, y],
      [-x, y],
    ];
  }
  const steps = Math.max(3, Math.round(r / 2));
  const corners: readonly (readonly [number, number, number])[] = [
    [x - r, -y + r, -Math.PI / 2],
    [x - r, y - r, 0],
    [-x + r, y - r, Math.PI / 2],
    [-x + r, -y + r, Math.PI],
  ];
  return corners.flatMap(([cx, cy, from]) =>
    Array.from({ length: steps + 1 }, (_, index) => {
      const angle = from + (index / steps) * (Math.PI / 2);
      return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r] as const;
    }),
  );
}

function regular(count: number, w: number, h: number, start: number, inner?: number): Point[] {
  const points = inner === undefined ? count : count * 2;
  return Array.from({ length: points }, (_, index) => {
    const angle = start + (index / points) * Math.PI * 2;
    const k = inner !== undefined && index % 2 === 1 ? inner : 1;
    return [(Math.cos(angle) * w * k) / 2, (Math.sin(angle) * h * k) / 2] as const;
  });
}

function plusRing(w: number, h: number): Point[] {
  const ax = w * 0.17;
  const ay = h * 0.17;
  const x = w / 2;
  const y = h / 2;
  return [
    [-ax, -y],
    [ax, -y],
    [ax, -ay],
    [x, -ay],
    [x, ay],
    [ax, ay],
    [ax, y],
    [-ax, y],
    [-ax, ay],
    [-x, ay],
    [-x, -ay],
    [-ax, -ay],
  ];
}

/** Exact outline rings of a shape around its centre (rings have a hole as a second ring). */
export function shapeRings(kind: ShapeKind, size: ShapeSize): Point[][] {
  const { w, h } = size;
  switch (kind) {
    case 'circle':
      return [ellipseRing(w / 2, h / 2)];
    case 'rect':
      return [roundedRect(w, h, size.round)];
    case 'pill':
      return [roundedRect(w, h, Math.min(w, h) / 2)];
    case 'triangle':
      return [
        [
          [0, -h / 2],
          [w / 2, h / 2],
          [-w / 2, h / 2],
        ],
      ];
    case 'diamond':
      return [regular(4, w, h, -Math.PI / 2)];
    case 'hexagon':
      return [regular(6, w, h, 0)];
    case 'star':
      return [regular(5, w, h, -Math.PI / 2, 0.45)];
    case 'plus':
      return [plusRing(w, h)];
    case 'ring': {
      const band = Math.max(1, Math.min(size.thickness, w / 2 - 1, h / 2 - 1));
      return [ellipseRing(w / 2, h / 2), ellipseRing(w / 2 - band, h / 2 - band)];
    }
  }
}

/** Distance from the origin to the outline along each of PROFILE_SAMPLES angles. */
export function radialProfile(kind: ShapeKind, size: ShapeSize): Float64Array {
  const outline = shapeRings(kind, size)[0] ?? [];
  const result = new Float64Array(PROFILE_SAMPLES);
  for (let index = 0; index < PROFILE_SAMPLES; index += 1) {
    const angle = (index / PROFILE_SAMPLES) * Math.PI * 2 - Math.PI / 2;
    result[index] = rayDistance(outline, Math.cos(angle), Math.sin(angle));
  }
  return result;
}

/** Farthest hit of the ray from the origin along (dx, dy) with a closed polygon. */
function rayDistance(ring: readonly Point[], dx: number, dy: number): number {
  let best = 0;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [ax, ay] = ring[previous] ?? [0, 0];
    const [bx, by] = ring[index] ?? [0, 0];
    const ex = bx - ax;
    const ey = by - ay;
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < 1e-12) continue;
    const distance = (ax * ey - ay * ex) / denominator;
    const along = (ax * dy - ay * dx) / denominator;
    if (distance >= 0 && along >= -1e-9 && along <= 1 + 1e-9) best = Math.max(best, distance);
  }
  return best;
}

/** Outline of two profiles blended at `k` (0 = a, 1 = b). */
export function morphRing(a: Float64Array, b: Float64Array, k: number): Point[] {
  return Array.from({ length: PROFILE_SAMPLES }, (_, index) => {
    const angle = (index / PROFILE_SAMPLES) * Math.PI * 2 - Math.PI / 2;
    const r = (a[index] ?? 0) * (1 - k) + (b[index] ?? 0) * k;
    return [Math.cos(angle) * r, Math.sin(angle) * r] as const;
  });
}

/** Rings scaled, rotated (degrees, clockwise on screen) and moved to (cx, cy). */
export function placeRings(
  rings: readonly (readonly Point[])[],
  cx: number,
  cy: number,
  scale: number,
  rotation: number,
): Point[][] {
  const angle = (rotation * Math.PI) / 180;
  const cos = Math.cos(angle) * scale;
  const sin = Math.sin(angle) * scale;
  return rings.map((ring) =>
    ring.map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos] as const),
  );
}
