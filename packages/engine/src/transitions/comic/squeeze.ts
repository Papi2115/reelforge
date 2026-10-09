/**
 * Squeezing panel transitions of the Comic world (docs/worlds/comic-panels-v2 transitions.js
 * `push` and `collapse`). `comic-panel-push`: the incoming page shoves in from the right as a new
 * panel (ink border, a paper gutter) and squeezes the outgoing page into a narrowing strip.
 * `comic-gutter-collapse`: the gutters above and below the focus slam shut and crush the outgoing
 * page into an inked slit; the incoming page lies around it. Every pixel is a pixel of A or B or a
 * comic ink.
 */
import type { Compositor } from '../pixels.js';
import { endFrames, focusPixels, lerp } from '../wow.js';
import { comicInks, inkScale } from './inks.js';

const outCubic = (q: number): number => 1 - (1 - q) ** 3;
const inCubic = (q: number): number => q * q * q;

export const panelPush: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, out, p } = c;
  const { INK, PAPER } = comicInks(c.tones).ink;
  const s = inkScale(W, H);
  const gutter = Math.max(2, Math.round(10 * s));
  const edge = Math.max(2, Math.round(2 * s));
  const split = Math.round((1 - outCubic(p)) * W);
  const aWidth = split - Math.floor(gutter / 2);
  const bLeft = split + Math.ceil(gutter / 2);
  const bWidth = W - bLeft;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      if (x < aWidth) {
        out[i] =
          x >= aWidth - edge
            ? INK
            : (a[y * W + Math.min(W - 1, Math.floor((x * W) / aWidth))] ?? 0);
      } else if (x < bLeft) {
        out[i] = PAPER;
      } else {
        const sx = Math.min(W - 1, Math.floor(((x - bLeft) * W) / Math.max(1, bWidth)));
        out[i] = x < bLeft + edge ? INK : (b[y * W + sx] ?? 0);
      }
    }
  }
};

export const gutterCollapse: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, out, p } = c;
  const { INK } = comicInks(c.tones).ink;
  const s = inkScale(W, H);
  const edge = Math.max(2, Math.round(2 * s));
  const [, middle] = focusPixels(c);
  const e = inCubic(p);
  const top = lerp(0, middle, e);
  const bottom = lerp(H, middle, e);
  const open = bottom - top >= 2;
  for (let y = 0; y < H; y += 1) {
    const inside = open && y >= top && y < bottom;
    const sy = inside ? Math.min(H - 1, Math.floor(((y - top) / (bottom - top)) * H)) : 0;
    const rim = inside && (y < top + edge || y >= bottom - edge);
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      out[i] = !inside ? (b[i] ?? 0) : rim ? INK : (a[sy * W + x] ?? 0);
    }
  }
};
