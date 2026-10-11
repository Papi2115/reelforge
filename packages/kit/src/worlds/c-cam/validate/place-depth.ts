/**
 * The depth check of a Grim Ink place (PLAN.md#14.17, quality lab; rubric "Depth: >= 3 layers: the
 * place, mid props, the people, a foreground piece"): the lab's places were a wall plus a crowd
 * strip and the previews never said so. `validatePlace` draws the place once (t = 0, no light pool)
 * into a paint that only keeps the box and opacity of every fill, then counts the MID-GROUND
 * THINGS inside the wide framing (x 0-1920, y 0-1080): opaque shapes that are neither the set
 * (walls, floors, skies: wider than half the frame or taller than three quarters of it) nor detail
 * (under ~50 x 50 px), merged where they touch, standing in the lower 60 % of the frame (on the
 * floor, not high on the back wall) and at least 60 px each way. Fewer than
 * `PLACE_MIN_MIDGROUND` -> a `place-no-midground` warning with the count. A heuristic on purpose:
 * a warning for the preview and the fix turn, never an error.
 *
 * Public API: `PLACE_MIN_MIDGROUND`, `midgroundThings`, `validatePlace`.
 */
import type { FillRule, LineCap, Paint2D } from '../draw/paint.js';
import type { Finding, ValidationReport } from './types.js';

/** Mid-ground things a place shows in its wide framing at least. */
export const PLACE_MIN_MIDGROUND = 2;

const FRAME = { x0: 0, y0: 0, x1: 1920, y1: 1080 } as const;
const FRAME_W = FRAME.x1 - FRAME.x0;
const FRAME_H = FRAME.y1 - FRAME.y0;
/** Set pieces: wider than this share of the frame, or taller than this one. */
const SET_W = 0.5;
const SET_H = 0.75;
/** Detail below this area (px²). */
const DETAIL_AREA = 2500;
/** A thing stands on the floor: its bottom below this share of the frame height. */
const FLOOR_FROM = 0.4;
/** A thing is at least this big each way (px). */
const MIN_SIZE = 60;
/** Fills at least this opaque count (stains, light and hatching are translucent). */
const OPAQUE = 0.85;
/** Boxes closer than this merge into one thing (px). */
const TOUCH = 6;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type Matrix = readonly [number, number, number, number, number, number];

const alphaOf = (style: string): number => {
  const rgba = /rgba?\(([^)]*)\)/i.exec(style);
  if (rgba === null) return 1;
  const parts = (rgba[1] ?? '').split(',');
  return parts.length === 4 ? Number(parts[3]) : 1;
};

/** A Paint2D that only records the device box and opacity of every fill. */
class FillBoxPaint implements Paint2D {
  fillStyle = '#000000';
  strokeStyle = '#000000';
  lineWidth = 1;
  lineCap: LineCap = 'butt';
  globalAlpha = 1;
  readonly fills: { readonly box: Box; readonly alpha: number }[] = [];
  private m: Matrix = [1, 0, 0, 1, 0, 0];
  private readonly stack: Matrix[] = [];
  private box: Box | undefined;

  private add(x: number, y: number): void {
    const [a, b, c, d, e, f] = this.m;
    const px = a * x + c * y + e;
    const py = b * x + d * y + f;
    const box = this.box;
    if (box === undefined) this.box = { x0: px, y0: py, x1: px, y1: py };
    else {
      box.x0 = Math.min(box.x0, px);
      box.y0 = Math.min(box.y0, py);
      box.x1 = Math.max(box.x1, px);
      box.y1 = Math.max(box.y1, py);
    }
  }
  private multiply(n: Matrix): void {
    const m = this.m;
    this.m = [
      m[0] * n[0] + m[2] * n[1],
      m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3],
      m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4],
      m[1] * n[4] + m[3] * n[5] + m[5],
    ];
  }
  save(): void {
    this.stack.push(this.m);
  }
  restore(): void {
    this.m = this.stack.pop() ?? this.m;
  }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.m = [a, b, c, d, e, f];
  }
  translate(x: number, y: number): void {
    this.multiply([1, 0, 0, 1, x, y]);
  }
  rotate(angle: number): void {
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    this.multiply([cos, sin, -sin, cos, 0, 0]);
  }
  scale(x: number, y: number): void {
    this.multiply([x, 0, 0, y, 0, 0]);
  }
  beginPath(): void {
    this.box = undefined;
  }
  closePath(): void {}
  moveTo(x: number, y: number): void {
    this.add(x, y);
  }
  lineTo(x: number, y: number): void {
    this.add(x, y);
  }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.add((cpx + x) / 2, (cpy + y) / 2);
    this.add(x, y);
  }
  rect(x: number, y: number, width: number, height: number): void {
    this.add(x, y);
    this.add(x + width, y + height);
  }
  ellipse(x: number, y: number, rx: number, ry: number): void {
    this.add(x - rx, y - ry);
    this.add(x + rx, y + ry);
  }
  fill(_rule?: FillRule): void {
    if (this.box !== undefined) {
      const alpha = alphaOf(this.fillStyle) * this.globalAlpha;
      this.fills.push({ box: { ...this.box }, alpha });
    }
  }
  stroke(): void {}
  clip(): void {}
  fillRect(x: number, y: number, width: number, height: number): void {
    this.beginPath();
    this.rect(x, y, width, height);
    this.fill();
    this.box = undefined;
  }
}

const touching = (a: Box, b: Box): boolean =>
  a.x0 <= b.x1 + TOUCH && b.x0 <= a.x1 + TOUCH && a.y0 <= b.y1 + TOUCH && b.y0 <= a.y1 + TOUCH;

/** Boxes merged where they touch (transitively). */
function merged(boxes: readonly Box[]): Box[] {
  const groups: Box[] = [];
  for (const box of boxes) {
    let joined = { ...box };
    for (let i = groups.length - 1; i >= 0; i -= 1) {
      const other = groups[i];
      if (other === undefined || !touching(joined, other)) continue;
      joined = {
        x0: Math.min(joined.x0, other.x0),
        y0: Math.min(joined.y0, other.y0),
        x1: Math.max(joined.x1, other.x1),
        y1: Math.max(joined.y1, other.y1),
      };
      groups.splice(i, 1);
    }
    groups.push(joined);
  }
  return groups.length === boxes.length ? groups : merged(groups);
}

/** The place's mid-ground things in its wide framing (boxes in frame px). */
export function midgroundThings(draw: (g: Paint2D) => void): Box[] {
  const g = new FillBoxPaint();
  draw(g);
  const candidates = g.fills
    .filter((fill) => fill.alpha >= OPAQUE)
    .map((fill) => ({
      x0: Math.max(FRAME.x0, fill.box.x0),
      y0: Math.max(FRAME.y0, fill.box.y0),
      x1: Math.min(FRAME.x1, fill.box.x1),
      y1: Math.min(FRAME.y1, fill.box.y1),
    }))
    .filter((box) => box.x1 > box.x0 && box.y1 > box.y0)
    .filter((box) => box.x1 - box.x0 < SET_W * FRAME_W && box.y1 - box.y0 < SET_H * FRAME_H)
    .filter((box) => (box.x1 - box.x0) * (box.y1 - box.y0) >= DETAIL_AREA);
  return merged(candidates).filter(
    (box) =>
      box.y1 >= FRAME.y0 + FLOOR_FROM * FRAME_H &&
      box.x1 - box.x0 >= MIN_SIZE &&
      box.y1 - box.y0 >= MIN_SIZE &&
      box.x1 - box.x0 < SET_W * FRAME_W,
  );
}

/** The depth report of a place: `place-no-midground` when its wide framing has too few things. */
export function validatePlace(draw: (g: Paint2D) => void): ValidationReport {
  const count = midgroundThings(draw).length;
  const findings: Finding[] =
    count >= PLACE_MIN_MIDGROUND
      ? []
      : [
          {
            code: 'place-no-midground',
            severity: 'warn',
            view: null,
            pose: null,
            message: `the wide framing shows ${String(count)} mid-ground thing(s) between the back wall and the people (want ${String(PLACE_MIN_MIDGROUND)}+): the shots will be a wall and the people (depth: place, mid props, people, foreground)`,
            fix: 'draw 3-6 things that tell the place standing on its floor at different depths and sizes (furniture, goods, gear, posts, instruments: ink.props.*, ink.instruments.* or by hand)',
            measured: count,
            limit: PLACE_MIN_MIDGROUND,
          },
        ];
  return {
    ok: true,
    findings,
    checks: { 'place-no-midground': 1 },
    metrics: { 'mid-ground things': count },
  };
}
