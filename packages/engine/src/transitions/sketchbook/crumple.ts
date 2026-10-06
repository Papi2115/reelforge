/**
 * `sketchbook-crumple-toss` (docs/worlds/sketchbook-v2 js/transitions.js "crumple"): the outgoing
 * page is torn out at the spiral (a jagged edge, lifted and turned a little), balled up into a
 * lumpy crumpled ball (the page rectangle morphs into it, the picture swirls inward, creases and
 * soft folds appear), and tossed down to the right out of the frame; the incoming page lies under
 * it all along, its spiral keeping the stubs.
 */
import type { Compositor } from '../pixels.js';
import { easeIn, easeOut, endFrames, lerp, phase } from '../wow.js';
import { inOut, sketchInks, tearX } from './inks.js';

const TEAR_SEED = 13;
const BALL_SAMPLES = 720;

export const crumpleToss: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, b, out, p } = c;
  const inks = sketchInks(c.tones);
  const s = W / 960;
  out.set(b);
  const lift = easeOut(phase(p, 0, 0.3));
  const q = phase(p, 0.3, 1);
  const rot = (-4 * lift * Math.PI) / 180;
  const [lx, ly] = [16 * lift * s, 22 * lift * s];
  const [cr, sr] = [Math.cos(rot), Math.sin(rot)];
  const [pivotX, pivotY] = [500 * s, 290 * s];
  /** Lifted page px -> source px of A (undo the tear-off lift), or -1 when torn off / outside. */
  const source = (x: number, y: number): number => {
    const ux = x - lx - pivotX;
    const uy = y - ly - pivotY;
    const sx = Math.round(ux * cr + uy * sr + pivotX);
    const sy = Math.round(-ux * sr + uy * cr + pivotY);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return -1;
    const tear = tearX(sy, TEAR_SEED, s);
    if (sx < tear) return -1;
    return sx < tear + 2 * s ? inks.ink.SHADE : (a[sy * W + sx] ?? 0);
  };
  if (q <= 0) {
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const pixel = source(x, y);
        if (pixel >= 0) out[y * W + x] = pixel;
      }
    }
    return;
  }
  const morph = inOut(q);
  const shrink = 1 - 0.18 * q;
  const toBall = inOut(phase(q, 0, 0.7));
  const toss = easeIn(phase(q, 0.7, 1));
  const [halfW, halfH] = [457 * s, 272 * s];
  const [pageX, pageY] = [503 * s, 270 * s];
  const cx = lerp(pageX + lx, 720 * s, toBall) + 190 * s * toss;
  const cy = lerp(pageY + ly, 380 * s, toBall) + 330 * s * toss - 70 * s * Math.sin(Math.PI * toss);
  const extent = (theta: number): number => {
    const ac = Math.max(1e-6, Math.abs(Math.cos(theta)));
    const as = Math.max(1e-6, Math.abs(Math.sin(theta)));
    return Math.min(halfW / ac, halfH / as);
  };
  const radii = new Float32Array(BALL_SAMPLES);
  let reach = 0;
  for (let i = 0; i < BALL_SAMPLES; i += 1) {
    const theta = (i / BALL_SAMPLES) * Math.PI * 2 - Math.PI;
    const blob = 62 * s * (1 + 0.2 * Math.sin(theta * 5 + 1) + 0.1 * Math.sin(theta * 9 + 4));
    const radius = lerp(extent(theta) * shrink, blob, morph);
    radii[i] = radius;
    reach = Math.max(reach, radius);
  }
  const [y0, y1] = [Math.max(0, Math.floor(cy - reach)), Math.min(H, Math.ceil(cy + reach))];
  const [x0, x1] = [Math.max(0, Math.floor(cx - reach)), Math.min(W, Math.ceil(cx + reach))];
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const [dx, dy] = [x - cx, y - cy];
      const theta = Math.atan2(dy, dx);
      const sample = Math.floor(((theta + Math.PI) / (Math.PI * 2)) * BALL_SAMPLES) % BALL_SAMPLES;
      const rho = Math.sqrt(dx * dx + dy * dy) / (radii[sample] ?? 1);
      if (rho > 1) continue;
      // The picture swirls into the ball; map back to the flat (lifted) page.
      const swirl = theta + morph * 0.7 * Math.sin(rho * 7 + theta * 2);
      const flat = extent(swirl) * rho;
      let pixel = source(pageX + Math.cos(swirl) * flat, pageY + Math.sin(swirl) * flat);
      if (pixel < 0) continue;
      if (rho > 0.985) pixel = inks.ink.SHADE;
      else if (morph > 0.12) {
        const crease = Math.abs(Math.sin(theta * 4 + rho * 9 + Math.sin(theta * 7) * 2));
        if (crease < 0.07 * morph) pixel = inks.ink.GRAPH_L;
        else if (
          inks.paperlike(pixel) &&
          Math.sin(theta * 6 + rho * 11) * 0.5 + 0.5 < morph * 0.5
        ) {
          pixel = inks.soft(pixel);
        }
      }
      out[y * W + x] = pixel;
    }
  }
};
