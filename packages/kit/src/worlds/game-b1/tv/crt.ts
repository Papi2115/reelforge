/**
 * The CRT pass on a screen rect (px), all as palette LUTs: NTSC colour bleed (bright chroma
 * smears right onto dark pixels), scanlines (every other row one step down its ramp), a slow hum
 * bar rolling down (period 7.3 s, scaled with the rect) and the tube: rounded corners with a
 * falloff at the edges. Applied to the TV picture only, never to the room or the HUD.
 */
import { dith, type IndexCanvas } from '../core/canvas.js';
import { BLEED, C, DARK, SCAN } from '../palette.js';

export interface CrtOptions {
  /** Corner radius in px (22 full frame, ~5 room units in the room). */
  readonly radius: number;
  readonly hum: boolean;
}

interface Box {
  /** Clipped area painted. */
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  /** The whole tube (may run off the frame while the camera pushes in). */
  readonly gx0: number;
  readonly gy0: number;
  readonly gx1: number;
  readonly gy1: number;
}

function bleedAndScan(cv: IndexCanvas, box: Box): void {
  const { x0, y0, x1, y1 } = box;
  const d = cv.d;
  const W = cv.w;
  // Module tables in locals: the hot loop never goes through an import binding.
  const [bleed, dark, scan] = [BLEED, DARK, SCAN];
  const row = new Uint8Array(x1 - x0);
  for (let y = y0; y < y1; y += 1) {
    const base = y * W + x0;
    row.set(d.subarray(base, base + row.length));
    for (let x = 1; x < row.length; x += 1) {
      const c = row[x] ?? 0;
      if (dark[c] !== 1) continue;
      const b1 = bleed[row[x - 1] ?? 0] ?? -1;
      const b = b1 >= 0 ? b1 : x > 1 ? (bleed[row[x - 2] ?? 0] ?? -1) : -1;
      if (b >= 0 && b !== c) d[base + x] = b;
    }
    if (((y - box.gy0) & 1) === 1)
      for (let i = base; i < base + row.length; i += 1) d[i] = scan[d[i] ?? 0] ?? 0;
  }
}

function humBar(cv: IndexCanvas, box: Box, t: number): void {
  const { x0, y0, x1, y1 } = box;
  const h = box.gy1 - box.gy0;
  const k = h / 360;
  const period = 7.3;
  const yb = box.gy0 - 40 * k + ((((t % period) + period) % period) / period) * (h + 80 * k);
  const band = 26 * k;
  const d = cv.d;
  const [scan, on] = [SCAN, dith];
  for (let y = Math.max(y0, Math.floor(yb)); y < Math.min(y1, Math.floor(yb + band)); y += 1) {
    const level = (1 - Math.abs((y - yb) / (band / 2) - 1)) * 0.35;
    for (let x = x0; x < x1; x += 1)
      if (on(x, y, level)) d[y * cv.w + x] = scan[d[y * cv.w + x] ?? 0] ?? 0;
  }
}

const VOID = C.VOID;

/** One tube pixel; `scan` and `on` are the module's SCAN and dith passed as locals. */
function tubePixel(
  cv: IndexCanvas,
  box: Box,
  rad: number,
  at: readonly [x: number, y: number, dy: number, edgeY: number],
  scan: Uint8Array,
  on: typeof dith,
) {
  const [x, y, dy, edgeY] = at;
  const dx = Math.max(0, box.gx0 + rad - x - 0.5, x - (box.gx1 - rad) + 0.5);
  const dist = Math.sqrt(dx * dx + dy * dy) - rad;
  const edge = Math.min(x - box.gx0, box.gx1 - 1 - x, edgeY);
  const d = cv.d;
  const i = y * cv.w + x;
  if (dist > 0) d[i] = VOID;
  else if (dist > -3 || edge < 3) d[i] = scan[d[i] ?? 0] ?? 0;
  else if ((dist > -9 || edge < 9) && on(x, y, 0.5)) d[i] = scan[d[i] ?? 0] ?? 0;
}

/**
 * Rounded corners and the falloff at the tube's edges. Only the rows near the top and bottom
 * and the columns near the sides can change (a wide tube's middle is untouched), so only those
 * are visited; a small radius (< 9 px) touches the whole glass.
 */
function tube(cv: IndexCanvas, box: Box, rad: number): void {
  const margin = Math.ceil(Math.max(rad, 9)) + 1;
  const whole = rad < 9;
  const [scan, on] = [SCAN, dith];
  const pixel = (x: number, y: number, dy: number, edgeY: number): void => {
    tubePixel(cv, box, rad, [x, y, dy, edgeY], scan, on);
  };
  for (let y = box.y0; y < box.y1; y += 1) {
    const dy = Math.max(0, box.gy0 + rad - y - 0.5, y - (box.gy1 - rad) + 0.5);
    const edgeY = Math.min((y - box.gy0) * 1.4, (box.gy1 - 1 - y) * 1.4);
    if (whole || dy > 0 || edgeY < 9) {
      for (let x = box.x0; x < box.x1; x += 1) pixel(x, y, dy, edgeY);
      continue;
    }
    const left = Math.min(box.x1, box.gx0 + margin);
    const right = Math.max(left, box.gx1 - margin, box.x0);
    for (let x = box.x0; x < left; x += 1) pixel(x, y, dy, edgeY);
    for (let x = right; x < box.x1; x += 1) pixel(x, y, dy, edgeY);
  }
}

export function crt(
  cv: IndexCanvas,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
  options: CrtOptions,
): void {
  const gx0 = Math.round(x);
  const gy0 = Math.round(y);
  const gx1 = Math.round(x + w);
  const gy1 = Math.round(y + h);
  const box: Box = {
    x0: Math.max(0, gx0),
    y0: Math.max(0, gy0),
    x1: Math.min(cv.w, gx1),
    y1: Math.min(cv.h, gy1),
    gx0,
    gy0,
    gx1,
    gy1,
  };
  if (box.x1 <= box.x0 || box.y1 <= box.y0) return;
  bleedAndScan(cv, box);
  if (options.hum) humBar(cv, box, t);
  tube(cv, box, options.radius);
}
