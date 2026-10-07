/**
 * `game-b2-melt`: Doom's screen melt (the showcase's tally entrance). The outgoing frame slides
 * down in uneven columns (each starts after a clamped random-walk delay, at most a step apart from
 * its neighbour, and accelerates), uncovering the incoming frame. Palette-pure: only A or B pixels.
 */
import { hashOf, unit, type Compositor } from '../pixels.js';
import { endFrames } from '../wow.js';

const MAX_DELAY = 0.26;

export const screenMelt: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, out, p, seed } = c;
  const column = Math.max(1, Math.round((4 * W) / 640));
  let delay = unit(hashOf(seed, 1, 2)) * MAX_DELAY;
  for (let x0 = 0, k = 0; x0 < W; x0 += column, k += 1) {
    const step = Math.floor(unit(hashOf(seed, k, 81)) * 3) - 1;
    delay = Math.min(MAX_DELAY, Math.max(0, delay + step * 0.0165));
    const q = Math.min(1, Math.max(0, (p - delay) / (1 - MAX_DELAY)));
    const off = Math.round(H * q ** 1.5);
    for (let y = 0; y < H; y += 1) {
      const row = y * W;
      const from = (y - off) * W;
      for (let x = x0; x < Math.min(W, x0 + column); x += 1)
        out[row + x] = y < off ? (b[row + x] ?? 0) : (a[from + x] ?? 0);
    }
  }
};
