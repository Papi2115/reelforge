/**
 * `game-b2-door`: the walk through a door. The outgoing frame is the door: it rises like a Doom
 * door (a dark bottom rail with a lit lip moving up), uncovering the next place framed by the
 * door jamb (seen from a step back, smaller); then we walk through: the next place grows to fill
 * the frame and the jamb slides out past the edges. Palette-pure: A or B pixels and world tones.
 */
import type { Compositor } from '../pixels.js';
import { endFrames, phase } from '../wow.js';
import { b2Tones } from './tones.js';

function inOut(q: number): number {
  return q < 0.5 ? 4 * q * q * q : 1 - (-2 * q + 2) ** 3 / 2;
}

const FAR = 0.82;

export const doorWalk: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, out, p, tones } = c;
  const ink = b2Tones(tones);
  const s = W / 640;
  // The door rises over the first 55 %, accelerating then braking at the top.
  const lift = inOut(phase(p, 0, 0.55));
  const edge = Math.round(H * (1 - lift));
  const rail = Math.max(2, Math.round(5 * s));
  const scale = FAR + (1 - FAR) * inOut(phase(p, 0.45, 1));
  const cx = W / 2;
  const cy = H / 2;
  const jamb = Math.max(2, Math.round(9 * s));
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      if (y < edge) {
        // The door: the outgoing frame, slid up by what has risen.
        const sy = y + (H - edge);
        out[i] = sy < H ? (a[sy * W + x] ?? 0) : ink.VOID;
        if (edge - y <= rail) out[i] = edge - y === rail ? ink.SLATE : ink.CHAR;
        continue;
      }
      const bx = (x - cx) / scale + cx;
      const by = (y - cy) / scale + cy;
      if (bx < 0 || by < 0 || bx >= W || by >= H) {
        const outside = Math.max(-bx, bx - W + 1, -by, by - H + 1);
        out[i] = outside < jamb / scale ? ink.CHAR : ink.VOID;
        continue;
      }
      out[i] = b[Math.floor(by) * W + Math.floor(bx)] ?? 0;
    }
};
