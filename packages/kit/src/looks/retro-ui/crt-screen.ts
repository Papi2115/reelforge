/**
 * CRT screen processing (pure): a content canvas (UI pixels) -> the tube image at 2x density with
 * barrel curvature and rounded corners, phosphor tint, glow halos next to bright pixels (one tone
 * darker; none on inverse-video ink), 1-px scanlines (every other row one tone darker), seeded flicker and a rolling hum bar,
 * and the power-on (line -> image) / power-off (image -> line -> dot) animations. Every effect is
 * a palette-tone step, so the frame stays in the style palette.
 */
import { noise1 } from '../../fx/shared.js';
import { CLEAR, ditherPick, type PixelCanvas, type Point } from './canvas.js';
import { C, dimIndex } from './colors.js';

const WARM_TIME = 0.5;
const COLLAPSE_TIME = 0.45;
const FLICKER_RATE = 24;
const HUM_PERIOD = 4;

export type PowerMode = 'off' | 'warming' | 'on' | 'collapsing';

export interface PowerState {
  readonly mode: PowerMode;
  /** Progress of warming/collapsing (0..1). */
  readonly k: number;
}

/** Power state at t: on unless `powerOn` is later or `powerOff` has passed. */
export function powerState(t: number, powerOn?: number, powerOff?: number): PowerState {
  if (powerOff !== undefined && t >= powerOff) {
    const k = (t - powerOff) / COLLAPSE_TIME;
    return k >= 1 ? { mode: 'off', k: 1 } : { mode: 'collapsing', k };
  }
  if (powerOn !== undefined) {
    if (t < powerOn) return { mode: 'off', k: 0 };
    const k = (t - powerOn) / WARM_TIME;
    if (k < 1) return { mode: 'warming', k };
  }
  return { mode: 'on', k: 1 };
}

export interface CrtOptions {
  /** Index -> index phosphor remap. */
  readonly tint: Uint8Array;
  /** Luminance per index (glow detection). */
  readonly luminance: Float32Array;
  readonly curvature: number;
  readonly scanlines: boolean;
  readonly flicker: number;
  readonly seed: number;
}

function barrel(curvature: number): number {
  return 0.2 * curvature;
}

/** Content point (content pixels) -> tube point (output pixels), inverting the barrel map. */
export function tubePoint(
  point: Point,
  content: { readonly width: number; readonly height: number },
  output: { readonly width: number; readonly height: number },
  curvature: number,
): Point {
  const k = barrel(curvature);
  const su = (point[0] / content.width) * 2 - 1;
  const sv = (point[1] / content.height) * 2 - 1;
  let u = su;
  let v = sv;
  for (let step = 0; step < 6; step += 1) {
    const f = 1 + k * (u * u + v * v);
    u = su / f;
    v = sv / f;
  }
  return [((u + 1) / 2) * output.width, ((v + 1) / 2) * output.height];
}

const GLASS = [C.black, C.navy, C.slateBlue, C.midGrey];

function glass(x: number, y: number, u: number, v: number): number {
  const glare = Math.max(0, 1 - Math.hypot((u + 0.45) / 0.5, (v + 0.5) / 0.35));
  return ditherPick(x, y, 0.22 + glare * 0.7, GLASS);
}

/** Paints the tube image of `content` at t into `out` (output pixels, typically 2x content). */
export function paintTube(
  out: PixelCanvas,
  content: PixelCanvas,
  options: CrtOptions,
  power: PowerState,
  t: number,
): void {
  const { width: W, height: H } = out;
  const k = barrel(options.curvature);
  const corner = 10 - 4 * options.curvature;
  const slot = Math.floor(t * FLICKER_RATE);
  const dimFrame = options.flicker > 0 && noise1(slot, 1, options.seed) < options.flicker * 0.18;
  const hum = (((t / HUM_PERIOD) % 1) + 1) % 1;
  const humCentre = hum * 1.4 - 0.2;
  let open = 1;
  let lineReach = -1;
  if (power.mode === 'warming') {
    lineReach = Math.min(1, power.k / 0.25);
    open = Math.max(0, (power.k - 0.25) / 0.75);
  } else if (power.mode === 'collapsing') {
    open = Math.max(0, 1 - power.k / 0.6);
    lineReach = power.k < 0.6 ? 1 : Math.max(0, 1 - (power.k - 0.6) / 0.4);
  }
  const base = new Uint8Array(W * H);
  /** Tube pixels showing inverse-video ink: no glow halo, so marked glyphs stay readable. */
  const ink = new Uint8Array(W * H);
  for (let y = 0; y < H; y += 1) {
    const v = ((y + 0.5) / H) * 2 - 1;
    for (let x = 0; x < W; x += 1) {
      const u = ((x + 0.5) / W) * 2 - 1;
      const offset = y * W + x;
      if (Math.abs(u) ** corner + Math.abs(v) ** corner > 1) {
        base[offset] = C.black;
        continue;
      }
      if (power.mode === 'off') {
        base[offset] = glass(x, y, u, v);
        continue;
      }
      const f = 1 + k * (u * u + v * v);
      const su = u * f;
      const sv = v * f;
      const lineRow = Math.abs(v) < 1.5 / H;
      if (open <= 0 || Math.abs(sv) > open) {
        const lit = lineReach > 0 && lineRow && Math.abs(u) <= lineReach;
        base[offset] = lit ? C.cream : C.black;
        continue;
      }
      const sampleV = open > 0 ? sv / open : 0;
      if (Math.abs(su) > 1 || Math.abs(sampleV) > 1) {
        base[offset] = C.black;
        continue;
      }
      const cx = Math.min(content.width - 1, Math.floor(((su + 1) / 2) * content.width));
      const cy = Math.min(content.height - 1, Math.floor(((sampleV + 1) / 2) * content.height));
      const value = content.data[cy * content.width + cx] ?? CLEAR;
      base[offset] = value === CLEAR ? C.black : (options.tint[value] ?? C.black);
      if (value === C.inverseInk) ink[offset] = 1;
    }
  }
  const lum = (index: number): number => options.luminance[index] ?? 0;
  for (let y = 0; y < H; y += 1) {
    const vy = (y + 0.5) / H;
    const inHum = options.flicker > 0 && Math.abs(vy - humCentre) < 0.05;
    for (let x = 0; x < W; x += 1) {
      const offset = y * W + x;
      let value = base[offset] ?? C.black;
      if (power.mode !== 'off' && lum(value) < 0.15 && ink[offset] === 0) {
        const left = x > 0 ? (base[offset - 1] ?? 0) : 0;
        const right = x < W - 1 ? (base[offset + 1] ?? 0) : 0;
        const bright = lum(left) >= lum(right) ? left : right;
        if (lum(bright) > 0.5) value = dimIndex(bright);
      }
      if (power.mode !== 'off') {
        if (options.scanlines && (y & 1) === 1) value = dimIndex(value);
        if (dimFrame) value = dimIndex(value);
        if (inHum && ((x + y) & 1) === 0) value = dimIndex(value);
      }
      out.data[offset] = value;
    }
  }
}
