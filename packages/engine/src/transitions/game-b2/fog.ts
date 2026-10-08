/**
 * Fog and darkness, the Game B2 ways to let time pass between two places.
 * `game-b2-fog`: a bank of dense desert fog drifts in over the outgoing frame (flat light sand,
 * its fringe a darker sand in slow noise), fills the frame, then thins away over the incoming one
 * (the showcase's fog interlude between 1983 and 2014: a flat sand-coloured screen). `game-b2-darkness`: the lights go out (the outgoing frame's light falls in
 * steps, each pixel the world colour of its hue at that light, to black), a dark beat, then the new place clicks on with two
 * uneven stutters like a switched bulb. Palette-pure: A or B pixels, world colours.
 */
import { bayerThreshold, type Compositor } from '../pixels.js';
import { endFrames, phase } from '../wow.js';
import { b2Tones, dim, valueNoise } from './tones.js';

function inOut(q: number): number {
  return q < 0.5 ? 4 * q * q * q : 1 - (-2 * q + 2) ** 3 / 2;
}

export const fogBank: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, out, p, seed, tones } = c;
  const ink = b2Tones(tones);
  const s = W / 640;
  const cover = p < 0.5 ? inOut(phase(p, 0, 0.5)) : 1 - inOut(phase(p, 0.5, 1));
  const drift = p * 90 * s;
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      const bank = valueNoise(x + drift, y * 1.6, 70 * s, seed);
      const threshold = 0.62 * bank + 0.38 * bayerThreshold(x, y);
      if (threshold < cover - 0.07) out[i] = ink.SAND_L;
      else if (threshold < cover) out[i] = ink.SAND;
      else out[i] = p < 0.5 ? (a[i] ?? 0) : (b[i] ?? 0);
    }
};

/** Light level of the incoming frame through the switch-on (two uneven stutters, then on). */
const STUTTER: readonly (readonly [number, number])[] = [
  [0, 1],
  [0.12, 0],
  [0.24, 0.6],
  [0.32, 0],
  [0.44, 1],
];

export const darkness: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, out, p, tones } = c;
  const STEPS = 9;
  let source = a;
  let level = 1 - inOut(phase(p, 0, 0.42));
  if (p >= 0.42 && p < 0.55) level = 0;
  if (p >= 0.55) {
    source = b;
    const q = phase(p, 0.55, 1);
    level = 0;
    for (const [at, value] of STUTTER) if (q >= at) level = value;
    if (q > 0.44) level = 0.6 + 0.4 * phase(q, 0.44, 0.6);
  }
  const depth = (1 - level) * STEPS;
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      const steps = Math.floor(depth) + (depth % 1 > bayerThreshold(x, y) ? 1 : 0);
      out[i] = steps >= STEPS ? tones.darkest : dim(tones, source[i] ?? 0, 1 - steps / STEPS);
    }
};
