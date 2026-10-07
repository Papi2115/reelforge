/**
 * A generator family of the open vocabulary (PLAN.md#13.15a): one `page.draw(kind, ...)` kind
 * (tree, bird, building, icon, ...) with its types, each a maker that draws on a Draft. The
 * shared knobs: `type`, `color` (the main crayon colour), `action` (pose of a creature or a
 * vehicle), `count` (how many of the repeated bits), `plain` (outline only) and `bold` (a fatter
 * outline: the hero, readable at thumbnail size).
 */
import type { SwatchName } from '../../inks.js';
import type { DoodleInput } from '../spec.js';
import type { Draft } from './draft.js';

export const GROUPS = [
  'animal',
  'plant',
  'backdrop',
  'structure',
  'vehicle',
  'object',
  'tool',
  'instrument',
  'icon',
  'effect',
] as const;
export type Group = (typeof GROUPS)[number];

/** What a maker reads besides its type. */
export interface Knobs {
  readonly type: string;
  readonly color: SwatchName | undefined;
  readonly action: string | undefined;
  readonly count: number | undefined;
  /** Page size asked for (backdrops draw their box in page px). */
  readonly w: number | undefined;
  readonly h: number | undefined;
}

export type Maker = (d: Draft, k: Knobs) => DoodleInput;

export interface Family {
  readonly kind: string;
  readonly group: Group;
  readonly summary: string;
  readonly types: Readonly<Record<string, Maker>>;
  /** Actions a maker understands (first = default). */
  readonly actions?: readonly string[];
  /** Default page height (px) when the call gives neither h nor w. */
  readonly height: number;
  /** Per-type default heights (an elephant is taller than a rabbit). */
  readonly heights?: Readonly<Record<string, number>>;
}

/** The default page height of a family's type. */
export function heightOf(entry: Family, type: string): number {
  return entry.heights?.[type] ?? entry.height;
}

export function family(spec: Family): Family {
  return spec;
}

/** A pointed leaf / petal outline around (cx, cy) along `deg` (0 = right, 90 = down). */
export function leafPts(
  cx: number,
  cy: number,
  length: number,
  width: number,
  deg: number,
): number[] {
  const a = (deg * Math.PI) / 180;
  const [ux, uy, vx, vy] = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a)];
  const out: number[] = [];
  const steps = 5;
  for (let i = 0; i <= steps * 2; i += 1) {
    const side = i <= steps ? 1 : -1;
    const k = i <= steps ? i / steps : 2 - i / steps;
    const along = (k - 0.5) * length;
    const across = Math.sin(Math.PI * k) * (width / 2) * side;
    out.push(cx + ux * along + vx * across, cy + uy * along + vy * across);
  }
  return out;
}

/** n points on an ellipse arc (degrees, 0 = right, 90 = down). */
export function arcFlat(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  from: number,
  to: number,
  n: number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i += 1) {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    out.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
  return out;
}

/** A star / burst outline: `points` tips between radii r0 (inner) and r1 (outer). */
export function starFlat(
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  points: number,
  turn = -90,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const a = ((turn + (i * 180) / points) * Math.PI) / 180;
    const r = i % 2 === 0 ? r1 : r0;
    out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return out;
}

/** A wavy vertical-ish line from (x, y0) to (x, y1) swinging `amp` with `turns` waves. */
export function wavyFlat(
  x: number,
  y0: number,
  y1: number,
  amp: number,
  turns: number,
  phase = 0,
): number[] {
  const out: number[] = [];
  const steps = Math.max(4, Math.round(turns * 6));
  for (let i = 0; i <= steps; i += 1) {
    const k = i / steps;
    out.push(x + Math.sin(phase + k * turns * Math.PI * 2) * amp, y0 + (y1 - y0) * k);
  }
  return out;
}
