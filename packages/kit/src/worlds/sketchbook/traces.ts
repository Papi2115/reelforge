/**
 * Physical human traces of the Sketchbook world (docs/worlds/QUALITY.md §2): torn clear tape, a
 * gem paper clip, a coffee ring with a gap where the mug was lifted, a sticky note with a curled
 * band, a dragged ink or graphite smudge. Static once they appear, seeded, painted through the
 * page -> screen map in flat palette remaps (no alpha).
 */
import { roundBrush, type InkCanvas } from './draw/canvas.js';
import { at, clamp01, hash, rnd } from './draw/math.js';
import { dropShadow, printLine } from './draw/paper.js';
import {
  ellipsePts,
  pixelPath,
  placement,
  quad,
  smoothPath,
  xformPts,
  type Pts,
  type Xform,
} from './draw/paths.js';
import { HARD, INK, SOFT, TAPE } from './inks.js';

/** Page -> screen map of a placement (local box at x, y rotated deg). */
function placed(toScreen: Xform, x: number, y: number, deg: number, scale = 1): Xform {
  const place = placement(x, y, deg, scale);
  return (u, v) => {
    const [px, py] = place.toPage(u, v);
    return toScreen(px, py);
  };
}

/** Clear tape strip w x h centred at (x, y), torn ends, long edges catching the light. */
export function paintTape(
  canvas: InkCanvas,
  toScreen: Xform,
  x: number,
  y: number,
  w: number,
  h: number,
  deg: number,
  seed: number,
): void {
  const xf = placed(toScreen, x, y, deg);
  const steps = 6;
  const loop: Pts = [];
  for (let i = 0; i <= steps; i += 1)
    loop.push(...xf(-w / 2 + rnd(-2.2, 2.2, seed, i, 1), -h / 2 + (i / steps) * h));
  for (let i = steps; i >= 0; i -= 1)
    loop.push(...xf(w / 2 + rnd(-2.2, 2.2, seed, i, 2), -h / 2 + (i / steps) * h));
  canvas.remapped(TAPE, () => {
    canvas.fillPoly(loop, 0);
  });
  printLine(canvas, xf, [-w / 2 + 2, -h / 2], [w / 2 - 2, -h / 2], INK.SHADE, 0.35);
  printLine(canvas, xf, [-w / 2 + 2, h / 2], [w / 2 - 2, h / 2], INK.SHADE, 0.35);
}

/** Gem paper clip (local 16 x 60), top at (x, y). */
const CLIP = [
  4, 16, 4, 44, 5.2, 46.8, 8, 48, 10.8, 46.8, 12, 44, 12, 4, 10.2, -0.2, 6, -2, 1.8, -0.2, 0, 4, 0,
  52, 2.3, 57.7, 8, 60, 13.7, 57.7, 16, 52, 16, 22,
];

export function paintClip(
  canvas: InkCanvas,
  toScreen: Xform,
  x: number,
  y: number,
  deg: number,
  scale: number,
): void {
  const path = smoothPath(xformPts(CLIP, placed(toScreen, x, y, deg, scale)), null, 1.5);
  const shadow = pixelPath(
    path.map((value, i) => value + (i % 2 === 1 ? 3 : 2)),
    false,
  );
  canvas.remapped(HARD, () => {
    for (let i = 0; i < shadow.length; i += 2)
      canvas.stamp(at(shadow, i), at(shadow, i + 1), roundBrush(2), 0);
  });
  const wire = pixelPath(path, false);
  for (let i = 0; i < wire.length; i += 2)
    canvas.stamp(at(wire, i), at(wire, i + 1), roundBrush(3), INK.GRAPHITE);
  const glint = pixelPath(
    path.map((value, i) => value - (i % 2 === 1 ? 0 : 1)),
    true,
  );
  for (let i = 0; i < glint.length; i += 2) {
    canvas.put(at(glint, i), at(glint, i + 1), hash(i, 3) < 0.15 ? INK.PAPER : INK.GRAPH_L);
  }
}

/** Coffee ring: uneven dried edge, faint stain inside, a gap where the mug was lifted. */
export function paintCoffeeRing(
  canvas: InkCanvas,
  toScreen: Xform,
  cx: number,
  cy: number,
  r: number,
  seed: number,
): void {
  const n = 720;
  const gapAngle = hash(seed, 1) * Math.PI * 2;
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const wobble =
      Math.sin(a * 3 + hash(seed, 2) * 6) * 1.6 + Math.sin(a * 7 + hash(seed, 3) * 6) * 0.8;
    const d = Math.abs(((a - gapAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const strength = clamp01((Math.PI - d) / 0.9);
    const thick = 1 + Math.round(1.6 * (0.5 + 0.5 * Math.sin(a * 2 + seed)) * strength);
    const rr = r + wobble;
    for (let k = 0; k < thick; k += 1) {
      const [sx, sy] = toScreen(cx + Math.cos(a) * (rr - k), cy + Math.sin(a) * (rr - k));
      const x = Math.round(sx);
      const y = Math.round(sy);
      if (strength > 0.15 && hash(x, y, seed) < 0.25 + strength)
        canvas.put(x, y, k === 0 ? INK.COFFEE : INK.COFFEE_L);
    }
    // Stain bleeding inward.
    if (hash(seed, i, 7) < 0.5 * strength) {
      const k = 3 + Math.floor(hash(seed, i, 8) * 4);
      const [sx, sy] = toScreen(cx + Math.cos(a) * (rr - k), cy + Math.sin(a) * (rr - k));
      canvas.put(Math.round(sx), Math.round(sy), INK.COFFEE_L);
    }
  }
}

/** Sticky note w x h at (x, y) rotated deg; `lift` 0..1 raises its shadow (slapped on). */
export function paintSticky(
  canvas: InkCanvas,
  toScreen: Xform,
  x: number,
  y: number,
  w: number,
  h: number,
  deg: number,
  lift = 0,
): void {
  const xf = placed(toScreen, x, y, deg);
  dropShadow(canvas, xf, w, h, 3 + lift * 10, 5 + lift * 12, SOFT);
  canvas.fillPoly(quad(xf, w, h), INK.STICKY);
  canvas.fillPoly([...xf(0, h * 0.86), ...xf(w, h * 0.83), ...xf(w, h), ...xf(0, h)], INK.STICKY_D);
  printLine(canvas, xf, [0, 0], [w, 0], INK.STICKY_D, 0.5);
}

/** Dragged smudge (wet ink or graphite under the side of a hand), w x h centred at (x, y). */
export function paintSmudge(
  canvas: InkCanvas,
  toScreen: Xform,
  x: number,
  y: number,
  w: number,
  h: number,
  deg: number,
  seed: number,
  color: number,
  density = 0.5,
): void {
  const place = placement(x, y, deg, 1);
  const xf = placed(toScreen, x, y, deg);
  const [ox, oy] = toScreen(0, 0);
  const [ux] = toScreen(1, 0);
  const scale = ux - ox;
  canvas.fillPoly(xformPts(ellipsePts(0, 0, w / 2, h / 2, 16), xf), (px, py) => {
    const [u, v] = place.toLocal((px + 0.5 - ox) / scale, (py + 0.5 - oy) / scale);
    const r = Math.hypot(u / (w / 2), v / (h / 2));
    const streak = hash(Math.round(v * 0.9), seed, 2) * 0.5 + 0.5;
    return hash(px, py, seed) < density * (1 - r * r) * streak ? color : -1;
  });
}
