/**
 * Picture planes for asset props (ADR-014): an asset's stylised pixels on a nearest-filtered
 * plane facing +z, centred on its origin - unlit (screens, backlit billboards) or lit by the
 * scene lights (prints, frames). Screen effects are pure functions of t that step pixels to a
 * darker colour of the picture's own colour list (scanlines, flicker, scan-in, develop), so a
 * frame never leaves the style palette.
 */
import type * as THREE from 'three';
import { hashCell } from '../env/shared.js';
import type { KitTools } from '../registry.js';
import type { AssetPixels } from './handle.js';

export interface PicturePlaneSpec {
  readonly name: string;
  readonly pixels: AssetPixels;
  /** World size of one picture pixel. */
  readonly pixelSize: number;
  /** true: shaded by the scene lights (prints); false: unlit (screens, backlit signs). */
  readonly lit: boolean;
}

export interface PicturePlane {
  readonly mesh: THREE.Mesh;
  /** Plane size in units. */
  readonly width: number;
  readonly height: number;
  /** Shows a colour index per pixel (same size and colour list); uploads only on change. */
  show(indices: Uint8Array): void;
}

function hexBytes(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function createPicturePlane(tools: KitTools, spec: PicturePlaneSpec): PicturePlane {
  const { three } = tools;
  const { width, height, colors } = spec.pixels;
  const bytes = colors.map(hexBytes);
  const rgba = new Uint8Array(width * height * 4);
  const texture = tools.track(new three.DataTexture(rgba, width, height, three.RGBAFormat));
  texture.magFilter = three.NearestFilter;
  texture.minFilter = three.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  const material = spec.lit
    ? tools.track(new three.MeshLambertMaterial({ map: texture, flatShading: true }))
    : tools.track(new three.MeshBasicMaterial({ map: texture }));
  const planeWidth = width * spec.pixelSize;
  const planeHeight = height * spec.pixelSize;
  const geometry = tools.track(new three.PlaneGeometry(planeWidth, planeHeight));
  const mesh = new three.Mesh(geometry, material);
  mesh.name = spec.name;
  const shown = new Int16Array(width * height).fill(-1);
  const show = (indices: Uint8Array): void => {
    let changed = false;
    for (let y = 0; y < height; y += 1) {
      // Texture rows are bottom-up (flipY = false), pixel rows top-down.
      const row = (height - 1 - y) * width;
      for (let x = 0; x < width; x += 1) {
        const index = indices[y * width + x] ?? 0;
        if (shown[row + x] === index) continue;
        shown[row + x] = index;
        const [r, g, b] = bytes[index] ?? [0, 0, 0];
        rgba.set([r, g, b, 255], (row + x) * 4);
        changed = true;
      }
    }
    if (changed) texture.needsUpdate = true;
  };
  show(spec.pixels.indices);
  return { mesh, width: planeWidth, height: planeHeight, show };
}

/** For every colour of the list, the index of the list colour closest to it at 55 % brightness. */
export function dimMap(colors: readonly string[]): Uint8Array {
  const bytes = colors.map(hexBytes);
  return Uint8Array.from(bytes, ([r, g, b]) => {
    const target = [(r * 55) / 100, (g * 55) / 100, (b * 55) / 100] as const;
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    bytes.forEach(([cr, cg, cb], index) => {
      const distance = (cr - target[0]) ** 2 + (cg - target[1]) ** 2 + (cb - target[2]) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  });
}

/** Index of the brightest / darkest colour of the list (scan line, letterbox). */
export function extremeIndex(colors: readonly string[], brightest: boolean): number {
  let best = 0;
  let bestLuma = brightest ? -1 : Number.POSITIVE_INFINITY;
  colors.map(hexBytes).forEach(([r, g, b], index) => {
    const luma = 77 * r + 150 * g + 29 * b;
    if (brightest ? luma > bestLuma : luma < bestLuma) {
      bestLuma = luma;
      best = index;
    }
  });
  return best;
}

export interface ScreenEffects {
  /** Every other row one step darker. */
  readonly scanlines: boolean;
  /** 0..1: seeded dim frames and a rolling hum bar. */
  readonly flicker: number;
  /** Local time the picture scans in top-down (undefined = already there). */
  readonly revealAt?: number | undefined;
  /** Seconds the scan-in takes. */
  readonly revealTime: number;
  /** Screen on (false = darkest colour everywhere). */
  readonly on: boolean;
  readonly seed: number;
}

const FLICKER_RATE = 24;
const HUM_PERIOD = 4;

/** The screen picture at t (pure): base indices with the effects applied. */
export function screenFrame(
  pixels: AssetPixels,
  dim: Uint8Array,
  effects: ScreenEffects,
  t: number,
): Uint8Array {
  const { width, height, indices } = pixels;
  const dark = extremeIndex(pixels.colors, false);
  const out = new Uint8Array(indices.length);
  if (!effects.on) return out.fill(dark);
  const reveal =
    effects.revealAt === undefined
      ? 1
      : (t - effects.revealAt) / Math.max(1e-6, effects.revealTime);
  const scanRow = Math.floor(Math.min(1, Math.max(0, reveal)) * height);
  const light = extremeIndex(pixels.colors, true);
  const slot = Math.floor(t * FLICKER_RATE);
  const dimFrame =
    effects.flicker > 0 && hashCell(slot, 1, 3, effects.seed) < effects.flicker * 0.18;
  const hum = ((((t / HUM_PERIOD) % 1) + 1) % 1) * 1.4 - 0.2;
  for (let y = 0; y < height; y += 1) {
    const inHum = effects.flicker > 0 && Math.abs((y + 0.5) / height - hum) < 0.05;
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (reveal < 1 && y > scanRow) {
        out[pixel] = dark;
        continue;
      }
      if (reveal < 1 && y === scanRow) {
        out[pixel] = light;
        continue;
      }
      let value = indices[pixel] ?? dark;
      if (effects.scanlines && (y & 1) === 1) value = dim[value] ?? dark;
      if (dimFrame) value = dim[value] ?? dark;
      if (inHum && ((x + y) & 1) === 0) value = dim[value] ?? dark;
      out[pixel] = value;
    }
  }
  return out;
}
