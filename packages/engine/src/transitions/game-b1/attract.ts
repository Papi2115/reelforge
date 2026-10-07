/**
 * `game-b1-attract-cycle` (the showcase's 3 -> 4 seam): the game is over, so the console drops
 * into attract mode: the outgoing picture keeps its shapes while its hues step round the colour
 * wheel in three uneven holds (the 2600's real idle colour cycling), then the incoming screen is
 * redrawn top-down in nine uneven bursts over it, a two-row playfield band marking the beam.
 * Palette-pure: A through the world's cycle LUTs, B, and two world inks for the beam.
 */
import { hashOf, unit, type Compositor } from '../pixels.js';
import { endFrames, phase } from '../wow.js';
import { apply, b1Tones, lutMap, scaleOf, type LutName } from './tones.js';

const STEPS: readonly (readonly [number, LutName])[] = [
  [0.06, 'cycle0'],
  [0.2, 'cycle1'],
  [0.31, 'cycle2'],
];
const DRAW_FROM = 0.42;

/** The redraw's front (rows above it are new) for k 0..1: nine bursts of uneven weight. */
export function burstFront(k: number, height: number, seed: number): number {
  const n = 9;
  const weights = Array.from({ length: n }, (_, i) => 0.55 + unit(hashOf(seed, i, 7)) * 0.9);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < n; i += 1) {
    const w = weights[i] ?? 1;
    const a = acc / total;
    const b = (acc + w) / total;
    if (k < b) {
      const e = 1 - (1 - (k - a) / (b - a)) ** 3;
      return Math.round(((i + e) * height) / n);
    }
    acc += w;
  }
  return height;
}

export const attractCycle: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, out, p, tones, seed } = c;
  const step = STEPS.filter(([at]) => p >= at).at(-1);
  const map = step === undefined ? undefined : lutMap(tones, step[1]);
  const front = p < DRAW_FROM ? 0 : burstFront(phase(p, DRAW_FROM, 1), H, seed);
  const ink = b1Tones(tones);
  const s = scaleOf(W);
  const beam = Math.max(2, Math.round(2 * s));
  const block = Math.max(1, Math.round(16 * s));
  for (let y = 0; y < H; y += 1) {
    const row = y * W;
    if (y < front) {
      out.set(b.subarray(row, row + W), row);
      continue;
    }
    if (y < front + beam && p >= DRAW_FROM) {
      for (let x = 0; x < W; x += 1)
        out[row + x] =
          (Math.floor(x / block) + Math.floor(front / (40 * s))) % 3 !== 0 ? ink.TEAL : ink.AQUA;
      continue;
    }
    for (let x = 0; x < W; x += 1) {
      const pixel = a[row + x] ?? 0;
      out[row + x] = map === undefined ? pixel : apply(map, pixel);
    }
  }
};
