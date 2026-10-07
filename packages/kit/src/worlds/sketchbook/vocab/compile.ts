/**
 * Doodle spec -> pen operations (PLAN.md#13.15a). The parts are placed (anchor, scale, mirror,
 * rotation) and roughened in page pixels, so a 40 px icon and a 400 px tree wobble like one hand
 * drew them: loops overlap their start, lines bow, corners are missed by a pixel, fills land a
 * little out of the lines. Spot art becomes a doodle of short dabs, one per run of a row.
 */
import { at, rnd } from '../draw/math.js';
import type { ToolName } from '../draw/marks.js';
import type { Pts, Xform } from '../draw/paths.js';
import { inkOfSwatch } from '../inks.js';
import { arcPts, blobPts, jitter, roughPoly, scribblePts } from './rough.js';
import { NIB_TOOLS, type DoodlePart, type DoodleSpec, type SpotArt } from './spec.js';

export interface StrokeOp {
  readonly kind: 'stroke';
  readonly pts: Pts;
  readonly corners: readonly boolean[] | null;
  readonly tool: ToolName;
  readonly color: number | undefined;
  readonly width: number | undefined;
  readonly smooth: boolean;
  /** Pace multiplier: scribble shading is fast; dots are dabs (`dab`). */
  readonly pace?: number;
  readonly dab?: boolean;
}
export interface FillOp {
  readonly kind: 'fill';
  readonly poly: Pts;
  readonly color: number;
  readonly spacing: number;
  readonly dir: 1 | -1;
  readonly dense: boolean;
}
export type Op = StrokeOp | FillOp;

export interface Placement {
  readonly x: number;
  readonly y: number;
  /** Target units per local unit (across; `scaleY` down, default the same). */
  readonly scale: number;
  readonly scaleY?: number | undefined;
  readonly anchor: 'bottom' | 'center' | 'top-left';
  readonly flip: boolean;
  readonly rot: number;
  /** Page px per target unit (1 on the page; a head frame's radius when attached to a head). */
  readonly unit: number;
  /** A local point placed at (x, y) instead of the anchor (a tool's grip). */
  readonly pivot?: readonly [number, number] | undefined;
}

/** Local box units -> target units. */
export function placeXform(
  box: readonly [number, number],
  place: Placement,
  origin: readonly [number, number] = [0, 0],
): Xform {
  const [w, h] = box;
  const [ox, oy] = origin;
  const [ax, ay] =
    place.pivot ??
    (place.anchor === 'bottom'
      ? [ox + w / 2, oy + h]
      : place.anchor === 'center'
        ? [ox + w / 2, oy + h / 2]
        : [ox, oy]);
  const a = (place.rot * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  const sx = place.flip ? -place.scale : place.scale;
  const sy = place.scaleY ?? place.scale;
  return (u, v) => {
    const x = (u - ax) * sx;
    const y = (v - ay) * sy;
    return [place.x + x * c - y * s, place.y + x * s + y * c];
  };
}

function mapPts(pts: readonly number[], xf: Xform): Pts {
  const out: Pts = [];
  for (let i = 0; i + 1 < pts.length; i += 2) out.push(...xf(at(pts, i), at(pts, i + 1)));
  return out;
}

const flatOf = (points: readonly (number | readonly [number, number])[]): number[] =>
  points.flatMap((point) => (typeof point === 'number' ? [point] : [point[0], point[1]]));

interface Ctx {
  readonly xf: Xform;
  /** Roughness amplitude in target units. */
  readonly amp: number;
  /** Target units per local unit. */
  readonly k: number;
  readonly unit: number;
  readonly seed: number;
  readonly out: Op[];
}

function stroke(
  c: Ctx,
  part: DoodlePart,
  pts: Pts,
  corners: boolean[] | null,
  smooth = true,
  pace = 1,
): void {
  if (!part.outline || pts.length < 4) return;
  const nib = NIB_TOOLS[part.nib];
  c.out.push({
    kind: 'stroke',
    pts,
    corners,
    tool: nib.tool,
    color: part.color === undefined ? undefined : inkOfSwatch(part.color),
    width: part.width ?? nib.width,
    smooth,
    pace,
  });
}

/** The coloured fill of a closed part, a little out of its lines. */
function fill(c: Ctx, part: DoodlePart, poly: Pts, salt: number): void {
  const name = part.fill ?? ('hatch' in part ? (part.color ?? 'orange') : undefined);
  if (name === undefined || poly.length < 6) return;
  const color = inkOfSwatch(name) ?? 0;
  const [dx, dy] = [rnd(-2.6, 2.6, c.seed, salt, 1) / c.unit, rnd(-2, 2, c.seed, salt, 2) / c.unit];
  const moved = poly.map((value, index) => value + (index % 2 === 0 ? dx : dy));
  if (part.shade === 'scribble') {
    const zig = scribblePts(moved, 4.5 / c.unit, part.dir === 1 ? -35 : 35, c.seed + salt);
    if (zig.length >= 4) {
      c.out.push({
        kind: 'stroke',
        pts: zig,
        corners: null,
        tool: 'cpencil',
        color,
        width: 2,
        smooth: false,
        pace: 2.6,
      });
    }
    return;
  }
  const spacing = part.shade === 'dense' ? 2 : part.shade === 'light' ? 5 : 3;
  c.out.push({
    kind: 'fill',
    poly: moved,
    color,
    spacing,
    dir: part.dir,
    dense: part.shade === 'dense',
  });
}

function closed(c: Ctx, part: DoodlePart, vertices: Pts, salt: number): void {
  const local = mapPts(vertices, c.xf);
  const { pts, corners } = roughPoly(local, true, c.seed + salt, c.amp);
  stroke(c, part, pts, corners);
  fill(c, part, local, salt);
}

function compilePart(c: Ctx, part: DoodlePart, index: number): void {
  const salt = index * 7 + 1;
  if ('blob' in part || 'circle' in part) {
    const [cx, cy, rx, ry] =
      'blob' in part
        ? part.blob
        : ([part.circle[0], part.circle[1], part.circle[2], part.circle[2]] as const);
    const lumps = 'blob' in part ? part.lumps : 0.05;
    const rot = 'blob' in part ? part.rot : 0;
    const loop = mapPts(blobPts(cx, cy, rx, ry, c.seed + salt, lumps, rot), c.xf);
    stroke(c, part, jitter(loop, c.amp * 0.35, c.seed + salt), null);
    fill(c, part, loop.slice(0, Math.max(6, Math.floor(loop.length / 1.1) & ~1)), salt);
  } else if ('rect' in part) {
    const [x, y, w, h] = part.rect;
    closed(c, part, [x, y, x + w, y, x + w, y + h, x, y + h], salt);
  } else if ('poly' in part) {
    closed(c, part, flatOf(part.poly), salt);
  } else if ('hatch' in part) {
    fill(c, part, mapPts(flatOf(part.hatch), c.xf), salt);
  } else if ('line' in part) {
    const pts = mapPts(flatOf(part.line), c.xf);
    if (part.sharp) {
      const rough = roughPoly(pts, false, c.seed + salt, c.amp);
      stroke(c, part, rough.pts, rough.corners);
    } else {
      stroke(c, part, jitter(pts, c.amp * 0.5, c.seed + salt), null);
    }
    if (part.arrow && pts.length >= 4) arrowHead(c, part, pts);
  } else if ('arc' in part) {
    const [cx, cy, r, from, to] = part.arc;
    stroke(
      c,
      part,
      jitter(mapPts(arcPts(cx, cy, r, r, from, to, c.seed + salt), c.xf), c.amp * 0.4, c.seed),
      null,
    );
  } else if ('dots' in part) {
    const pts = mapPts(flatOf(part.dots), c.xf);
    const nib = NIB_TOOLS[part.nib];
    for (let i = 0; i + 1 < pts.length; i += 2) {
      const [x, y] = [at(pts, i), at(pts, i + 1)];
      c.out.push({
        kind: 'stroke',
        pts: [x, y, x + 0.7 / c.unit, y + 0.4 / c.unit],
        corners: null,
        tool: nib.tool,
        color: part.color === undefined ? undefined : inkOfSwatch(part.color),
        width: Math.max(1, Math.min(8, Math.round(part.size))),
        smooth: false,
        dab: true,
      });
    }
  } else if ('rays' in part) {
    const [cx, cy, r0, r1] = part.rays;
    for (let i = 0; i < part.count; i += 1) {
      const k =
        part.count === 1 ? 0.5 : i / (part.to - part.from >= 360 ? part.count : part.count - 1);
      const a =
        ((part.from + (part.to - part.from) * k) * Math.PI) / 180 +
        rnd(-0.12, 0.12, c.seed, salt, i);
      const [a0, a1] = [r0 * rnd(0.9, 1.1, c.seed, i, 3), r1 * rnd(0.82, 1.12, c.seed, i, 4)];
      const ray = mapPts(
        [
          cx + Math.cos(a) * a0,
          cy + Math.sin(a) * a0,
          cx + Math.cos(a) * a1,
          cy + Math.sin(a) * a1,
        ],
        c.xf,
      );
      stroke(c, part, ray, null, false);
    }
  } else if ('scribble' in part) {
    const poly = mapPts(flatOf(part.scribble), c.xf);
    const zig = scribblePts(poly, part.spacing * c.k, part.angle, c.seed + salt);
    stroke(c, part, jitter(zig, c.amp * 0.4, c.seed + salt), null, false, 2.6);
  } else if ('zigzag' in part) {
    const [x0, y0, x1, y1] = part.zigzag;
    const length = Math.hypot(x1 - x0, y1 - y0) || 1;
    const [nx, ny] = [-(y1 - y0) / length, (x1 - x0) / length];
    const pts: Pts = [];
    for (let i = 0; i <= part.teeth; i += 1) {
      const side = (i % 2 === 0 ? -0.5 : 0.5) * part.amp * rnd(0.7, 1.25, c.seed, salt, i);
      const k = i / part.teeth;
      pts.push(x0 + (x1 - x0) * k + nx * side, y0 + (y1 - y0) * k + ny * side);
    }
    const mapped = mapPts(pts, c.xf);
    const count = mapped.length / 2;
    const corners = Array.from({ length: count }, (_, i) => i > 0 && i < count - 1);
    stroke(c, part, jitter(mapped, c.amp * 0.3, c.seed + salt), corners);
  } else {
    const [x0, y, x1] = part.wave;
    const pts: Pts = [];
    const steps = part.count * 8;
    for (let i = 0; i <= steps; i += 1) {
      const k = i / steps;
      const hump =
        Math.abs(Math.sin(Math.PI * part.count * k)) *
        part.amp *
        rnd(0.8, 1.15, c.seed, salt, Math.floor(k * part.count));
      pts.push(x0 + (x1 - x0) * k, y - hump);
    }
    stroke(c, part, jitter(mapPts(pts, c.xf), c.amp * 0.3, c.seed + salt), null);
  }
}

function arrowHead(c: Ctx, part: DoodlePart, pts: Pts): void {
  const m = pts.length;
  const [x, y] = [at(pts, m - 2), at(pts, m - 1)];
  const a = Math.atan2(y - at(pts, m - 3), x - at(pts, m - 4));
  const head = 11 / c.unit;
  const tip = [
    x + Math.cos(a + Math.PI - 0.5) * head,
    y + Math.sin(a + Math.PI - 0.5) * head,
    x,
    y,
    x + Math.cos(a + Math.PI + 0.42) * head * 0.9,
    y + Math.sin(a + Math.PI + 0.42) * head * 0.9,
  ];
  stroke(c, part, tip, [false, true, false]);
}

/** Roughness in page px for a drawing of this page size (bigger drawings wobble a bit more). */
export function roughness(spec: DoodleSpec, place: Placement): number {
  const size = Math.max(spec.box[0], spec.box[1]) * place.scale * place.unit;
  return spec.wobble * Math.min(2.2, Math.max(0.8, 0.8 + size / 260));
}

export function compileDoodle(spec: DoodleSpec, place: Placement, seed: number): Op[] {
  const out: Op[] = [];
  const amp = roughness(spec, place) / place.unit;
  const xf = placeXform(spec.box, place, spec.origin);
  spec.parts.forEach((part, index) => {
    const own = part.wobble === undefined ? amp : (amp * part.wobble) / spec.wobble;
    compilePart(
      { xf, amp: own, k: place.scale, unit: place.unit, seed: seed + index * 101, out },
      part,
      index,
    );
  });
  return out;
}

/** Spot art as a doodle of dabs: each run of one ink in a row is one short stroke. */
export function spotDoodle(art: SpotArt, pagePerUnit: number): DoodleSpec {
  const parts: DoodlePart[] = [];
  const cell = art.px * pagePerUnit;
  const lines = Math.max(1, Math.ceil(cell / 7.5));
  const width = Math.max(1, Math.min(8, Math.round(cell / lines + 0.4)));
  art.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const char = row[x] ?? ' ';
      let end = x + 1;
      while (end < row.length && row[end] === char) end += 1;
      const entry = art.legend[char];
      if (entry !== undefined) {
        const [color, nib] =
          typeof entry === 'string' ? [entry, 'felt' as const] : [entry.color, entry.nib];
        for (let l = 0; l < lines; l += 1) {
          const v = (y + (l + 0.5) / lines) * art.px;
          const inset = art.px * 0.28;
          parts.push({
            line: [x * art.px + inset, v, end * art.px - inset, v],
            nib,
            color,
            width,
            sharp: true,
            arrow: false,
            shade: 'hatch',
            dir: 1,
            outline: true,
            wobble: 0.5,
          });
        }
      }
      x = end;
    }
  });
  const cols = Math.max(1, ...art.rows.map((row) => row.length));
  return { box: [cols * art.px, art.rows.length * art.px], parts, wobble: 1 };
}

/** The spec with its box fitted to what its parts draw (so `h` is the drawing's own height). */
export function fitDoodle(spec: DoodleSpec): DoodleSpec {
  const unitPlace: Placement = {
    x: 0,
    y: 0,
    scale: 1,
    anchor: 'top-left',
    flip: false,
    rot: 0,
    unit: 1,
  };
  const [x, y, w, h] = opsBox(
    compileDoodle({ ...spec, origin: undefined, wobble: 0.3 }, unitPlace, 1),
  );
  if (!(w > 0 && h > 0)) return spec;
  return { ...spec, origin: [x, y], box: [w, h] };
}

/** Bounding box [x, y, w, h] of ops (target units). */
export function opsBox(ops: readonly Op[]): readonly [number, number, number, number] {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const op of ops) {
    const pts = op.kind === 'stroke' ? op.pts : op.poly;
    for (let i = 0; i + 1 < pts.length; i += 2) {
      x0 = Math.min(x0, at(pts, i));
      y0 = Math.min(y0, at(pts, i + 1));
      x1 = Math.max(x1, at(pts, i));
      y1 = Math.max(y1, at(pts, i + 1));
    }
  }
  return x0 === Infinity ? [0, 0, 0, 0] : [x0, y0, x1 - x0, y1 - y0];
}
