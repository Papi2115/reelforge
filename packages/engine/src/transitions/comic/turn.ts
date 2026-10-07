/**
 * Page turns of the Comic world (docs/worlds/comic-panels-v2 transitions.js `turn`): the outgoing
 * printed page holds still while it turns; a leaning fold sweeps across the frame, the incoming
 * page is revealed beyond it under a dithered ink shadow, and the lifted flap shows the back of
 * the page (newsprint, the dark ink of the other side showing through as shade). `comic-page-turn`
 * turns forward (the fold sweeps right to left); `comic-page-back` turns a page BACK (mirrored,
 * the fold leaning the other way): into a flashback.
 */
import type { Composition, Compositor } from '../pixels.js';
import { endFrames } from '../wow.js';
import { bayer4, comicInks, inOutSine } from './inks.js';

function turn(c: Composition, back: boolean, slope: number): void {
  const { width: W, height: H, a, b, out, p } = c;
  const inks = comicInks(c.tones);
  const { INK, SHADE, AGED, PAPER } = inks.ink;
  const s = W / 640;
  const e = inOutSine(p);
  const f0 = W + 70 * s + (-90 * s - (W + 70 * s)) * e;
  const lift = Math.sin(Math.min(1, p * 1.2) * Math.PI * 0.5 + 0.0001);
  for (let y = 0; y < H; y += 1) {
    const fold = f0 + (H - y) * slope - 36 * s * Math.sin(p * Math.PI) * (y / H);
    const flap = Math.max(0, Math.min(84 * s, (W - fold) * 0.42)) * lift;
    for (let x = 0; x < W; x += 1) {
      const xx = back ? W - 1 - x : x;
      const i = y * W + xx;
      const d = x - fold;
      if (d >= 0) {
        const shadow = Math.max(0, 1 - d / (16 * s)) * 0.75;
        out[i] = shadow > 0 && bayer4(xx, y) < shadow ? INK : (b[i] ?? 0);
      } else if (-d <= flap) {
        if (-d > flap - 1.5 * s) {
          out[i] = INK;
          continue;
        }
        const u = -d / Math.max(1, flap);
        const mx = Math.round(fold + (fold - x) * 1.6);
        const source = mx >= 0 && mx < W ? (a[y * W + (back ? W - 1 - mx : mx)] ?? PAPER) : PAPER;
        const curl = u < 0.25 ? 0.55 - u * 2 : (u - 0.25) * 0.5;
        out[i] = inks.inky(source) ? SHADE : bayer4(xx, y) < curl ? AGED : PAPER;
      } else out[i] = a[i] ?? 0;
    }
  }
}

export const pageTurn: Compositor = (c) => {
  if (endFrames(c)) return;
  turn(c, false, 0.22);
};

export const pageBack: Compositor = (c) => {
  if (endFrames(c)) return;
  turn(c, true, -0.18);
};
