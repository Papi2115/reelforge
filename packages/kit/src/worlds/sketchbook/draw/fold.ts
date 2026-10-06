/**
 * Page-corner fold of the Sketchbook (the flipbook riffle, docs/worlds/sketchbook-v2 shot 6): the
 * top page folds away from a corner along a direction, its back (blank paper, the ink ghosting
 * through) lies over the fold line, the page under it shows with a soft shadow next to the
 * crease. Plus the thumb that works the corner. Index buffers in, index buffer out (flat remaps,
 * no alpha), so the result is palette-exact and a pure function of its inputs.
 */
import { INK, PAPERLIKE, SOFT } from '../inks.js';
import type { InkCanvas } from './canvas.js';
import { PAGE_X } from './paper.js';
import type { Pts } from './paths.js';

export interface FoldOptions {
  /** Screen px of the corner that lifts (default the bottom-right). */
  readonly corner?: readonly [number, number];
  /** Direction the fold travels (default up-left). */
  readonly dir?: readonly [number, number];
}

/**
 * Folds `top` away from the corner by k (0 = flat, 1 = gone), revealing `under`, into `canvas`;
 * returns the screen px of the folded tip.
 */
export function cornerFold(
  canvas: InkCanvas,
  top: Uint8Array,
  under: Uint8Array,
  k: number,
  options: FoldOptions = {},
): readonly [number, number] {
  const { width: W, height: H, data } = canvas;
  const s = W / 960;
  const [cx, cy] = options.corner ?? [W, H];
  const [rx, ry] = options.dir ?? [-1, -0.62];
  const n = Math.hypot(rx, ry);
  const dx = rx / n;
  const dy = ry / n;
  const reach = Math.max(
    -cx * dx - cy * dy,
    (W - cx) * dx - cy * dy,
    -cx * dx + (H - cy) * dy,
    (W - cx) * dx + (H - cy) * dy,
  );
  const f = k * reach * 1.02;
  const [bx0, by0, bx1, by1] = [PAGE_X * s, -200 * s, W, H];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      const proj = (x - cx) * dx + (y - cy) * dy;
      if (proj < f) {
        const u = under[i] ?? INK.PAPER;
        data[i] = f - proj < (14 + 10 * k) * s && PAPERLIKE[u] === 1 ? (SOFT[u] ?? u) : u;
        continue;
      }
      const d2 = 2 * (proj - f);
      const px = x - d2 * dx;
      const py = y - d2 * dy;
      const t = top[i] ?? INK.PAPER;
      if (px >= bx0 && px < bx1 && py >= by0 && py < by1) {
        const edge = px - bx0 < 1.5 || bx1 - px < 1.5 || py - by0 < 1.5 || by1 - py < 1.5;
        const sx = Math.round(px);
        const sy = Math.round(py);
        const ghost =
          sx >= 0 && sy >= 0 && sx < W && sy < H && PAPERLIKE[top[sy * W + sx] ?? 0] !== 1;
        const depth = proj - f;
        data[i] = edge
          ? INK.GRAPH_L
          : depth < 2.5 * s
            ? INK.SHADE
            : depth < 16 * s || ghost
              ? INK.FIBRE
              : INK.PAPER;
      } else {
        const near = px >= bx0 - 5 && px < bx1 + 5 && py >= by0 - 5 && py < by1 + 7;
        data[i] = near && PAPERLIKE[t] === 1 ? (SOFT[t] ?? t) : t;
      }
    }
  }
  return [cx + 2 * f * dx, cy + 2 * f * dy];
}

/** A capsule from (u0, v0) to (u1, v1) with radius r. */
function capsule(u0: number, v0: number, u1: number, v1: number, r: number): Pts {
  const out: Pts = [];
  const length = Math.hypot(u1 - u0, v1 - v0);
  const au = (u1 - u0) / length;
  const av = (v1 - v0) / length;
  const cap = (u: number, v: number, from: number): void => {
    for (let i = 0; i <= 10; i += 1) {
      const a = from + (i / 10) * Math.PI;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      out.push(u + (au * c - av * sn) * r, v + (av * c + au * sn) * r);
    }
  };
  cap(u0, v0, Math.PI / 2);
  cap(u1, v1, -Math.PI / 2);
  return out;
}

/** The thumb on the page corner (`bob` px: it presses as a page goes), tip at (x, y) page px. */
export function drawThumb(canvas: InkCanvas, x: number, y: number, bob: number): void {
  const s = canvas.width / 960;
  const at = (pts: Pts, ox = 0, oy = 0): Pts =>
    pts.map((value, i) => (i % 2 === 0 ? value + x - 930 + ox : value + y - 508 + bob + oy) * s);
  const thumb = capsule(932, 512, 1010, 566, 25);
  canvas.remapped(SOFT, () => {
    canvas.fillPoly(at(thumb, 7, 9), 0);
  });
  canvas.fillPoly(at(thumb), INK.COFFEE_L);
  canvas.outline(at(thumb), INK.COFFEE);
  const nail = capsule(926, 507, 942, 518, 10);
  canvas.fillPoly(at(nail), INK.FIBRE);
  canvas.outline(at(nail), INK.COFFEE_L);
}
