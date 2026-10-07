/**
 * `game-b1-screen-flip` (PLAN.md#13.15 B1 rework): the hero walks off the edge of the screen and
 * the next screen of the level slides in, the way a flip-screen game moves from room to room. The
 * outgoing picture is pushed out sideways and the incoming one follows it in, both in whole
 * 16-px playfield blocks (a 2600 cannot scroll by a pixel), in held steps that start slow and
 * land hard. `focus.x` < 0.5 = the hero leaves on the left (the screens move right). Palette-pure:
 * every pixel is a pixel of A or B.
 */
import type { Compositor } from '../pixels.js';
import { endFrames } from '../wow.js';
import { scaleOf } from './tones.js';

const STEPS = 12;

export const screenFlip: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, out, p, focus } = c;
  const block = Math.max(1, Math.round(16 * scaleOf(W)));
  const held = Math.floor(p * STEPS) / STEPS;
  const eased = held * held * (3 - 2 * held);
  const shift = Math.min(W, Math.round((eased * W) / block) * block);
  const toLeft = focus.x >= 0.5;
  for (let y = 0; y < H; y += 1) {
    const row = y * W;
    for (let x = 0; x < W; x += 1) {
      const sx = toLeft ? x + shift : x - shift;
      out[row + x] =
        sx >= 0 && sx < W ? (a[row + sx] ?? 0) : (b[row + (toLeft ? sx - W : sx + W)] ?? 0);
    }
  }
};
