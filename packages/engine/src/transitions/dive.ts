/**
 * Scale-dive transitions (ADR-028, family `dive`): `dive-in` zooms into the focus point up to 8x
 * while the pixels grow, flips block by block into the incoming shot at the same zoom and lets it
 * settle to 1x; `dive-out` pulls the camera back 8x: the outgoing picture shrinks into the focus
 * point of the incoming one, which sharpens around it ("from the flat to the street to the city").
 * Pure functions of (A, B, p, seed, focus); every pixel is a copy of A or B or a palette colour.
 */
import { bayerThreshold, hashOf, unit, type Compositor } from './pixels.js';
import {
  diamondAngle,
  endFrames,
  focusPixels,
  lerp,
  mosaic,
  phase,
  scaleLerp,
  shade,
  smoothstep,
  zoomSample,
  type ZoomView,
} from './wow.js';

const MAX_ZOOM = 8;
const BLOCKS = [1, 2, 4, 8, 16] as const;
const FLIP_TILE = 16;
const FLIP_FROM = 0.44;
const FLIP_TO = 0.56;

/** Mosaic block (screen px) for a share 0..1 of the maximum pixelation. */
function blockFor(share: number): number {
  return BLOCKS[Math.min(BLOCKS.length - 1, Math.floor(share * BLOCKS.length))] ?? 1;
}

/**
 * Dive in: A zooms 1x -> 8x into the focus (which drifts to the centre) with growing mosaic
 * blocks; around the middle 16-px tiles flip to B at 8x in seeded order; B settles 8x -> 1x back
 * onto the focus point.
 */
export const diveIn: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width, height, a, b, out, p, seed, tones } = c;
  const [fx, fy] = focusPixels(c);
  const inward = phase(p, 0, FLIP_TO);
  const outward = phase(p, FLIP_FROM, 1);
  const centreA = smoothstep(inward);
  const centreB = 1 - smoothstep(outward);
  const viewA: ZoomView = {
    fx,
    fy,
    cx: lerp(fx, width / 2, centreA),
    cy: lerp(fy, height / 2, centreA),
    zoom: scaleLerp(1, MAX_ZOOM, inward * inward),
  };
  const viewB: ZoomView = {
    fx,
    fy,
    cx: lerp(fx, width / 2, centreB),
    cy: lerp(fy, height / 2, centreB),
    zoom: scaleLerp(MAX_ZOOM, 1, smoothstep(outward)),
  };
  const blockA = blockFor(inward * inward);
  const blockB = blockFor(1 - outward * 1.15);
  const tilesX = Math.ceil(width / FLIP_TILE);
  const flip = phase(p, FLIP_FROM, FLIP_TO);
  const streaks = Math.min(phase(p, 0.15, FLIP_FROM), 1 - phase(p, FLIP_TO, 0.8));
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    const tileRow = Math.floor(y / FLIP_TILE) * tilesX;
    for (let x = 0; x < width; x += 1) {
      const tile = tileRow + Math.floor(x / FLIP_TILE);
      const fromB = flip >= 1 || (flip > 0 && unit(hashOf(seed, tile)) < flip);
      const block = fromB ? blockB : blockA;
      const sx = Math.min(width - 1, mosaic(x, block));
      const sy = Math.min(height - 1, mosaic(y, block));
      const pixel = fromB
        ? zoomSample(b, width, height, sx, sy, viewB)
        : zoomSample(a, width, height, sx, sy, viewA);
      out[row + x] =
        streaks > 0 ? speedLine(pixel, x, y, width, height, seed, streaks, tones.brightest) : pixel;
    }
  }
};

const STREAK_SECTORS = 72;

/**
 * Radial speed lines (1-2 px, brightest tone, dithered) from the frame edges toward the centre:
 * the rush of the dive. `amount` 0..1 sets how far in they reach and how dense they are.
 */
function speedLine(
  pixel: number,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number,
  amount: number,
  bright: number,
): number {
  const dx = x + 0.5 - width / 2;
  const dy = y + 0.5 - height / 2;
  const distance = Math.sqrt((dx / width) ** 2 + (dy / height) ** 2) * 2;
  const angle = (diamondAngle(dx, dy) / 4) * STREAK_SECTORS;
  const sector = Math.floor(angle);
  const h = hashOf(seed ^ 0x2c1b3c6d, sector);
  if (unit(h) > 0.45) return pixel;
  const centre = sector + 0.2 + 0.6 * unit(hashOf(h, 2));
  const across = Math.abs(angle - centre) * (Math.sqrt(dx * dx + dy * dy) / STREAK_SECTORS) * 6.3;
  const reach = 1.05 - amount * (0.35 + 0.4 * unit(hashOf(h, 1)));
  return across < 0.9 && distance > reach && bayerThreshold(x >> 1, y >> 1) < 0.6 ? bright : pixel;
}

/** Edge of the shrinking picture where it dithers into the incoming shot (px). */
const INSET_EDGE = 6;

/**
 * Dive out: the camera pulls back 8x. B is shown zoomed 8x -> 1x around the focus point; A sits
 * inside B at the focus as a picture 1/8 of the frame (full screen at the start), shrinking with
 * the zoom, its edge dithered into B; it dissolves once it is small.
 */
export const diveOut: Compositor = (c) => {
  if (endFrames(c)) return;
  const { width, height, a, b, out, p, tones } = c;
  const [fx, fy] = focusPixels(c);
  const pull = smoothstep(p);
  const zoom = scaleLerp(MAX_ZOOM, 1, pull);
  const cx = lerp(width / 2, fx, pull);
  const cy = lerp(height / 2, fy, pull);
  const viewB: ZoomView = { fx, fy, cx, cy, zoom };
  const scale = zoom / MAX_ZOOM;
  const halfW = (width / 2) * scale;
  const halfH = (height / 2) * scale;
  const viewA: ZoomView = { fx: width / 2, fy: height / 2, cx, cy, zoom: scale };
  const fade = phase(p, 0.72, 0.96);
  const edge = Math.max(2, INSET_EDGE * scale);
  const darkRim = phase(p, 0.05, 0.3) * (1 - fade);
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    const ay = Math.abs(y + 0.5 - cy);
    for (let x = 0; x < width; x += 1) {
      const ax = Math.abs(x + 0.5 - cx);
      const outsideBy = Math.max(ax - halfW, ay - halfH);
      if (outsideBy >= 0) {
        const pixel = zoomSample(b, width, height, x, y, viewB);
        out[row + x] =
          outsideBy < 2 && darkRim > 0 ? shade(pixel, tones.darkest, darkRim, x, y) : pixel;
        continue;
      }
      const inner = -outsideBy / edge;
      const keepA = inner >= 1 ? 1 - fade : inner * (1 - fade);
      const fromA = keepA > 0 && bayerThreshold(x >> 1, y >> 1) < keepA;
      out[row + x] = fromA
        ? zoomSample(a, width, height, x, y, viewA)
        : zoomSample(b, width, height, x, y, viewB);
    }
  }
};
