/**
 * Panel transitions of the Comic world. `comic-panel-zoom` (docs/worlds/comic-panels-v2
 * transitions.js `inset`): the camera pushes into the outgoing page at the focus point while the
 * incoming page pops up there as a small inset panel (ink rim, paper border, offset ink shadow),
 * holds, then grows into the whole page - a match cut through one panel. `comic-panel-slam`: the
 * incoming page slams onto the outgoing one as a panel (lands a little small with an overshoot,
 * thick ink border, offset shadow), the page under it shakes, then it settles to the full frame.
 */
import type { Composition, Compositor } from '../pixels.js';
import { endFrames, focusPixels, lerp, phase } from '../wow.js';
import { bayer4, comicInks, inOutCubic, inOutSine, inkScale } from './inks.js';

/** Keyframes [p, value] with an ease into each key. */
function keys(
  p: number,
  track: readonly (readonly [number, number, (q: number) => number])[],
): number {
  const first = track[0];
  if (first === undefined || p <= first[0]) return first?.[1] ?? 0;
  for (let i = 1; i < track.length; i += 1) {
    const [at, value, ease] = track[i] ?? first;
    const [from, start] = track[i - 1] ?? first;
    if (p <= at) return lerp(start, value, ease((p - from) / (at - from || 1)));
  }
  return track[track.length - 1]?.[1] ?? 0;
}

const outQuad = (q: number) => 1 - (1 - q) * (1 - q);

interface Box {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** B squeezed into a box over A with an ink rim, a paper border and an offset ink shadow. */
function panelOver(
  c: Composition,
  box: Box,
  rim: number,
  under: (x: number, y: number) => number,
): void {
  const { width: W, height: H, b, out } = c;
  const { INK, PAPER } = comicInks(c.tones).ink;
  const { x0, y0, x1, y1 } = box;
  const drop = Math.max(2, Math.round(rim * 0.8));
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x;
      if (x >= x0 && x < x1 && y >= y0 && y < y1 && x1 - x0 > 1) {
        const sx = Math.min(W - 1, Math.floor(((x - x0) / (x1 - x0)) * W));
        const sy = Math.min(H - 1, Math.floor(((y - y0) / (y1 - y0)) * H));
        out[i] = b[sy * W + sx] ?? 0;
      } else if (rim > 0 && x >= x0 - rim && x < x1 + rim && y >= y0 - rim && y < y1 + rim) {
        const edge = x < x0 - rim + 2 || x >= x1 + rim - 2 || y < y0 - rim + 2 || y >= y1 + rim - 2;
        out[i] = edge ? INK : PAPER;
      } else if (
        rim > 0 &&
        x >= x0 - rim + drop &&
        x < x1 + rim + drop &&
        y >= y0 - rim + drop &&
        y < y1 + rim + drop
      ) {
        out[i] = bayer4(x, y) < 0.75 ? INK : under(x, y);
      } else out[i] = under(x, y);
    }
  }
}

export const panelZoom: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, p } = c;
  const s = inkScale(W, H);
  const [fx, fy] = focusPixels(c);
  const pop = keys(p, [
    [0, 0, outQuad],
    [0.16, 1.12, outQuad],
    [0.24, 1, inOutSine],
  ]);
  const grow = inOutCubic(phase(p, 0.4, 1));
  // The camera pushes into A at the focus while the inset is up.
  const push = 1 + 0.14 * inOutSine(phase(p, 0, 0.7));
  const under = (x: number, y: number): number => {
    const sx = Math.min(W - 1, Math.max(0, Math.round(fx + (x - fx) / push)));
    const sy = Math.min(H - 1, Math.max(0, Math.round(fy + (y - fy) / push)));
    return a[sy * W + sx] ?? 0;
  };
  const hw = (W * 0.2 * pop) / 2;
  const hh = (H * 0.2 * pop) / 2;
  const box = {
    x0: lerp(fx - hw, -2, grow),
    y0: lerp(fy - hh, -2, grow),
    x1: lerp(fx + hw, W + 2, grow),
    y1: lerp(fy + hh, H + 2, grow),
  };
  panelOver(c, box, pop > 0.05 ? Math.round(4 * s * (1 - grow)) : 0, under);
};

export const panelSlam: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width: W, height: H, a, p, seed } = c;
  const s = inkScale(W, H);
  // B lands a little small (a panel on the page), holds, then settles to the full frame.
  const k = keys(p, [
    [0.12, 1.1, outQuad],
    [0.3, 0.84, outQuad],
    [0.42, 0.88, inOutSine],
    [0.72, 0.88, inOutSine],
    [1, 1, inOutCubic],
  ]);
  const impact = 0.3;
  const hit = p < impact ? 0 : 6 * s * Math.exp(-(p - impact) / 0.08);
  const frame = Math.floor(p * 40);
  const jitter = (n: number) =>
    ((((seed + frame * 7 + n * 13) * 2654435761) >>> 0) / 4_294_967_296) * 2 - 1;
  const [dx, dy] = [Math.round(jitter(1) * hit), Math.round(jitter(2) * hit)];
  const under = (x: number, y: number): number => {
    const sx = Math.min(W - 1, Math.max(0, x - dx));
    const sy = Math.min(H - 1, Math.max(0, y - dy));
    return a[sy * W + sx] ?? 0;
  };
  if (p < 0.12) {
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) c.out[y * W + x] = under(x, y);
    return;
  }
  const [cx, cy] = [W / 2 + 12 * s, H / 2 - 6 * s];
  const box = {
    x0: cx - (W / 2) * k,
    y0: cy - (H / 2) * k,
    x1: cx + (W / 2) * k,
    y1: cy + (H / 2) * k,
  };
  const settle = phase(p, 0.72, 1);
  const rim = Math.round(4 * s * (1 - settle));
  const full = {
    x0: lerp(box.x0, 0, settle),
    y0: lerp(box.y0, 0, settle),
    x1: lerp(box.x1, W, settle),
    y1: lerp(box.y1, H, settle),
  };
  panelOver(c, full, rim, under);
};
