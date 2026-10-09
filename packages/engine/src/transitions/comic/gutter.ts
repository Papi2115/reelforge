/**
 * `comic-gutter-wipe` (docs/worlds/comic-panels-v2 transitions.js `split`): the outgoing page is
 * cut along a leaning gutter through the focus point, a small recoil, then the two halves are
 * pulled apart (up-left and down-right) over the incoming page; the cut edges are inked and the
 * halves cast a dithered ink shadow.
 */
import type { Compositor } from '../pixels.js';
import { endFrames, focusPixels } from '../wow.js';
import { bayer4, comicInks, inOutCubic, inkScale } from './inks.js';

/** The pull: a recoil to -1.2 % by 0.18, then out with an ease. */
function pull(p: number): number {
  if (p < 0.18) {
    const q = p / 0.18;
    return -0.012 * (1 - (1 - q) * (1 - q));
  }
  return -0.012 + 1.012 * inOutCubic((p - 0.18) / 0.82);
}

export const gutterWipe: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, out, p } = c;
  const { INK } = comicInks(c.tones).ink;
  const s = inkScale(W, H);
  const [fx] = focusPixels(c);
  const x0 = fx + 52 * s;
  const x1 = fx - 30 * s;
  const e = pull(p);
  const left = [-e * W * 0.72, -e * 46 * s] as const;
  const right = [e * W * 0.72, e * 38 * s] as const;
  const nx = H;
  const ny = -(x1 - x0);
  const nl = Math.hypot(nx, ny);
  const edge = 2 * s;
  /** A's pixel carried by one half to (x, y), or -1. */
  const piece = (
    x: number,
    y: number,
    move: readonly [number, number],
    isLeft: boolean,
  ): number => {
    const sx = Math.round(x - move[0]);
    const sy = Math.round(y - move[1]);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return -1;
    const d = ((sx - x0) * nx + sy * ny) / nl;
    if (isLeft ? d > 0 : d < 0) return -1;
    return Math.abs(d) < edge ? INK : (a[sy * W + sx] ?? 0);
  };
  const lag = 3 * s;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      let pixel = piece(x, y, left, true);
      if (pixel < 0) pixel = piece(x, y, right, false);
      if (pixel < 0) {
        const shaded =
          piece(x - lag, y - lag, left, true) >= 0 || piece(x - lag, y - lag, right, false) >= 0;
        pixel = shaded && bayer4(x, y) < 0.6 ? INK : (b[y * W + x] ?? 0);
      }
      out[y * W + x] = pixel;
    }
  }
};
