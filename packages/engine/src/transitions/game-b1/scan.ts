/**
 * Interlaced redraws of the Game B1 world:
 * - `game-b1-scanline-wipe`: the next picture is painted line by line like a 2600 kernel drawing
 *   a new screen, even lines top-down first, then the odd ones; a dithered cream beam rides the
 *   front (the room's wall calendar becoming the boss page, shot 2 -> 3: end the outgoing shot
 *   pushed in on the calendar and stand the page in the same place in the next one);
 * - `game-b1-calendar-zoom` (a zoom-through link): the outgoing frame pushes into the anchor (the
 *   calendar), which drifts to the centre and grows, then the next picture is redrawn over it the
 *   same interlaced way; the next shot opens on the object, centred.
 * Lines are the world's TV lines (one line = width / 640 px). Palette-pure: A, B, cream.
 */
import { bayerThreshold, type Compositor, type Composition } from '../pixels.js';
import { easeIn, endFrames, focusPixels, lerp, phase, zoomSample } from '../wow.js';
import { b1Tones, scaleOf } from './tones.js';

/** Writes the interlaced redraw at k (0..1) from `under` (a sampler) to B into `out`. */
function interlace(c: Composition, k: number, under: (x: number, y: number) => number): void {
  const { width: W, height: H, b, out, tones } = c;
  const line = Math.max(1, Math.round(scaleOf(W)));
  const lines = Math.ceil(H / line);
  const cream = b1Tones(tones).CREAM;
  const pass = k < 0.5 ? 0 : 1;
  const front = Math.floor(((k < 0.5 ? k : k - 0.5) / 0.5) * lines);
  for (let y = 0; y < H; y += 1) {
    const l = Math.floor(y / line);
    const even = l % 2 === 0;
    const drawn = (even && (pass === 1 || l < front)) || (!even && pass === 1 && l < front);
    const beam = l === front || l === front + 1;
    const row = y * W;
    for (let x = 0; x < W; x += 1) {
      if (beam && bayerThreshold(Math.floor(x / line), l) < 0.6) out[row + x] = cream;
      else out[row + x] = drawn ? (b[row + x] ?? 0) : under(x, y);
    }
  }
}

export const scanlineWipe: Compositor = (c) => {
  if (endFrames(c)) return;
  const { a, width: W } = c;
  interlace(c, c.p, (x, y) => a[y * W + x] ?? 0);
};

const PUSH = 0.5;
const ZOOM = 2.4;

export const calendarZoom: Compositor = (c) => {
  if (endFrames(c)) return;
  const { a, width: W, height: H, p } = c;
  const [fx, fy] = focusPixels(c);
  const q = easeIn(phase(p, 0, PUSH));
  const view = {
    fx,
    fy,
    cx: lerp(fx, W / 2, q),
    cy: lerp(fy, H / 2, q),
    zoom: 1 + (ZOOM - 1) * q,
  };
  const sample = (x: number, y: number): number => zoomSample(a, W, H, x, y, view);
  if (p < PUSH) {
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) c.out[y * W + x] = sample(x, y);
    return;
  }
  interlace(c, phase(p, PUSH, 1), sample);
};
