/**
 * `sketchbook-torn-strip` (docs/worlds/sketchbook-v2 js/transitions.js "drop"): the outgoing page
 * is torn out along the spiral (a jagged strip stays in the binding) and falls away: a small
 * jerk as it comes free, then it drops out of the bottom of the frame turning a few degrees about
 * its top-right corner, a soft shadow on the incoming page under it.
 */
import type { Compositor } from '../pixels.js';
import { easeIn, easeOut, endFrames, phase } from '../wow.js';
import { sketchInks, tearX } from './inks.js';

const TEAR_SEED = 29;

export const tornStrip: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, out, p } = c;
  const inks = sketchInks(c.tones);
  const s = W / 960;
  const fall = easeIn(p);
  const jerk = easeOut(phase(p, 0, 0.25));
  const rot = ((5 * fall + 1.5 * jerk) * Math.PI) / 180;
  const [tx, ty] = [(30 * fall + 6 * jerk) * s, (640 * fall + 10 * jerk) * s];
  const [cr, sr] = [Math.cos(rot), Math.sin(rot)];
  const [shadowX, shadowY] = [6 * s, 10 * s];
  /** The falling page's pixel over screen (x, y), or -1 where it does not cover it. */
  const page = (x: number, y: number): number => {
    const ux = x - tx - W;
    const uy = y - ty;
    const sx = Math.round(ux * cr + uy * sr + W);
    const sy = Math.round(-ux * sr + uy * cr);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return -1;
    const tear = tearX(sy, TEAR_SEED, s);
    if (sx < tear) return -1;
    return sx < tear + 2 * s ? inks.ink.SHADE : (a[sy * W + sx] ?? 0);
  };
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      const pixel = page(x, y);
      if (pixel >= 0) {
        out[i] = pixel;
        continue;
      }
      const under = b[i] ?? 0;
      const shaded = inks.paperlike(under) && page(x - shadowX, y - shadowY) >= 0;
      out[i] = shaded ? inks.soft(under) : under;
    }
  }
};
