/**
 * `sketchbook-tape-peel` (docs/worlds/sketchbook-v2 js/transitions.js "sticky", its peel): the
 * outgoing page is pulled off the incoming one from its bottom-left corner, like a sheet whose
 * tape gives: the corner lifts a little and holds (the tape resists), then the sheet peels away up
 * and to the right. The fold line moves across the frame; past it the sheet's back shows (blank
 * paper, the ink ghosting through, a shaded band and a crease along the fold), before it the
 * incoming page with a soft shadow next to the fold.
 */
import type { Compositor } from '../pixels.js';
import { easeOut, endFrames, lerp, phase } from '../wow.js';
import { inOut, sketchInks } from './inks.js';

/** The corner lifts this far (share of the peel) and holds before the sheet comes away. */
const RESIST = 0.05;
const RESIST_UNTIL = 0.18;

export const tapePeel: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, out, p } = c;
  const inks = sketchInks(c.tones);
  const { PAPER, FIBRE, SHADE, GRAPH_L } = inks.ink;
  const s = W / 960;
  const k =
    p < RESIST_UNTIL
      ? RESIST * easeOut(phase(p, 0, RESIST_UNTIL * 0.6))
      : lerp(RESIST, 1, inOut(phase(p, RESIST_UNTIL, 1)));
  const [cx, cy] = [0, H];
  const norm = Math.hypot(1, 0.55);
  const [dx, dy] = [1 / norm, -0.55 / norm];
  const reach = Math.max((W - cx) * dx - cy * dy, (W - cx) * dx + (H - cy) * dy, -cy * dy);
  const fold = k * reach * 1.02;
  const margin = 60 * s;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      const proj = (x - cx) * dx + (y - cy) * dy;
      if (proj < fold) {
        const under = b[i] ?? PAPER;
        out[i] =
          fold - proj < (14 + 10 * k) * s && inks.paperlike(under) ? inks.soft(under) : under;
        continue;
      }
      const depth = proj - fold;
      const px = x - 2 * depth * dx;
      const py = y - 2 * depth * dy;
      if (px < -margin || px >= W + margin || py < -margin || py >= H + margin) {
        out[i] = a[i] ?? PAPER;
        continue;
      }
      const sx = Math.round(px);
      const sy = Math.round(py);
      const inside = sx >= 0 && sy >= 0 && sx < W && sy < H;
      const ghost = inside && !inks.paperlike(a[sy * W + sx] ?? PAPER);
      const edge = Math.min(px + margin, W + margin - px, py + margin, H + margin - py) < 1.5;
      out[i] = edge ? GRAPH_L : depth < 2.5 * s ? SHADE : depth < 16 * s || ghost ? FIBRE : PAPER;
    }
  }
};
