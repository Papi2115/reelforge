/**
 * `comic-ink-bleed` (docs/worlds/comic-panels-v2 transitions.js `bleed`): wet ink creeps out of
 * one point (the focus) along the paper fibres; behind its dark front the incoming page is
 * printed, ahead of it a dithered sepia stain soaks in. The out of a flashback: the colour bleeds
 * back out of the old print. The distance field is pure per frame size and focus, so cached.
 */
import type { Compositor } from '../pixels.js';
import { endFrames, focusPixels } from '../wow.js';
import { bayer4, comicInks, noise } from './inks.js';

const fields = new Map<string, Float32Array>();

function field(W: number, H: number, ox: number, oy: number): Float32Array {
  const key = `${String(W)}x${String(H)}:${String(Math.round(ox))},${String(Math.round(oy))}`;
  const cached = fields.get(key);
  if (cached !== undefined) return cached;
  const s = W / 640;
  const far = Math.max(
    Math.hypot(ox, oy),
    Math.hypot(W - ox, oy),
    Math.hypot(ox, H - oy),
    Math.hypot(W - ox, H - oy),
  );
  const f = new Float32Array(W * H);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const fibre = (noise(11, x, y, 18 * s) - 0.5) * 0.26 + (noise(12, x, y, 4 * s) - 0.5) * 0.07;
      f[y * W + x] = Math.hypot(x - ox, (y - oy) * 1.25) / far + fibre;
    }
  }
  if (fields.size >= 8) fields.clear();
  fields.set(key, f);
  return f;
}

export const inkBleed: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, out, p } = c;
  const { INK, SEP_MID } = comicInks(c.tones).ink;
  const [ox, oy] = focusPixels(c);
  const f = field(W, H, ox, oy);
  const r = p * p * 1.3;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      const d = f[i] ?? 0;
      if (d < r - 0.045) out[i] = b[i] ?? 0;
      else if (d < r - 0.03) out[i] = bayer4(x, y) < (r - 0.03 - d) / 0.015 ? (b[i] ?? 0) : INK;
      else if (d < r) out[i] = INK;
      else if (d < r + 0.03 && bayer4(x, y) < 0.3) out[i] = SEP_MID;
      else out[i] = a[i] ?? 0;
    }
  }
};
