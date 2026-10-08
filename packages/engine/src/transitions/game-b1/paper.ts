/**
 * The manual's paper moves of the Game B1 world (the showcase's 7 -> 8 and 8 -> 9 seams):
 * - `game-b1-page-slide`: the incoming shot (a manual page) slides up over the outgoing one: a
 *   peek from the bottom edge (anticipation), a held beat, the slide, a small overshoot, the
 *   settle; tilted on the way, with a cast shadow on what it covers;
 * - `game-b1-page-turn`: the outgoing shot (a manual page) is turned from its bottom-right corner
 *   onto the incoming one; the lifted flap shows the paper's back with the print showing through
 *   (mirrored, faint), the fold casts a soft shadow on what is under it.
 * Pure functions of (A, B, p); pixels of A or B, A or B through the world's shadow LUT, paper inks.
 */
import { bayerThreshold, type Compositor } from '../pixels.js';
import { endFrames, lerp } from '../wow.js';
import { apply, b1Tones, lutMap, scaleOf } from './tones.js';

const SLIDE_S = 0.8;

const out3 = (u: number) => 1 - (1 - u) ** 3;
const inOut3 = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

/** Peek -> hold -> slide -> overshoot -> settle; u in seconds, offsets in 640x360 px. */
export function slidePose(u: number): { oy: number; angle: number } {
  if (u < 0.14) return { oy: lerp(390, 332, out3(u / 0.14)), angle: 0.07 };
  if (u < 0.22) return { oy: 332, angle: 0.07 };
  if (u < 0.56) {
    const e = inOut3((u - 0.22) / 0.34);
    return { oy: lerp(332, -10, e), angle: lerp(0.07, -0.012, e) };
  }
  if (u < 0.68) {
    const e = out3((u - 0.56) / 0.12);
    return { oy: lerp(-10, 0, e), angle: lerp(-0.012, 0, e) };
  }
  return { oy: 0, angle: 0 };
}

export const pageSlide: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, out, p, tones } = c;
  const s = scaleOf(W);
  const { oy, angle } = slidePose(p * SLIDE_S);
  const shift = Math.round(oy * s);
  const co = Math.cos(-angle);
  const si = Math.sin(-angle);
  const scan = lutMap(tones, 'scan');
  const [sx0, sy0] = [7 * s, 9 * s];
  const inside = (x: number, y: number, dx: number, dy: number) => {
    const rx = x + 0.5 - W / 2 - dx;
    const ry = y + 0.5 - (H / 2 + shift) - dy;
    const u = Math.floor(rx * co - ry * si + W / 2);
    const v = Math.floor(rx * si + ry * co + H / 2);
    return u >= 0 && v >= 0 && u < W && v < H ? v * W + u : -1;
  };
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      const page = inside(x, y, 0, 0);
      if (page >= 0) out[i] = b[page] ?? 0;
      else if (inside(x, y, sx0, sy0) >= 0) out[i] = apply(scan, a[i] ?? 0);
      else out[i] = a[i] ?? 0;
    }
};

const TURN_LEAD = 90;

/** The fold's x in row y at progress p (paper left of it). */
export function foldX(p: number, y: number, width: number, height: number): number {
  const e = inOut3(p);
  return Math.round(
    width * (1 - e) - (y / height) * TURN_LEAD * (width / 640) * Math.sin(Math.PI * p),
  );
}

export const pageTurn: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, out, p, tones } = c;
  const ink = b1Tones(tones);
  const scan = lutMap(tones, 'scan');
  const s = scaleOf(W);
  const edge = Math.max(1, Math.round(s));
  for (let y = 0; y < H; y += 1) {
    const fold = foldX(p, y, W, H);
    const flap = Math.round((W - fold) * 0.55);
    const row = y * W;
    for (let x = 0; x < W; x += 1) {
      const i = row + x;
      if (x >= fold) {
        const shadow = x < fold + 4 * s || (x < fold + 10 * s && bayerThreshold(x, y) < 0.5);
        out[i] = shadow ? apply(scan, b[i] ?? 0) : (b[i] ?? 0);
        continue;
      }
      if (x < fold - flap) {
        out[i] = a[i] ?? 0;
        continue;
      }
      const mirror = 2 * fold - x;
      const behind = mirror < W ? (a[row + mirror] ?? 0) : ink.CREAM;
      const print = tones.rank(behind) <= tones.rank(ink.TEAK) && bayerThreshold(x, y) < 0.5;
      const rim = x - (fold - flap) < edge || fold - 1 - x < edge;
      out[i] = rim ? ink.WALNUT_D : print || x > fold - 7 * s ? ink.TAN : ink.CREAM;
    }
  }
};
