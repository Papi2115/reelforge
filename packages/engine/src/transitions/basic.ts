/**
 * Plain transitions of the kit (any look pair, ADR-011): pixel wipe, dither dissolve, glitch cut,
 * iris, scanline sweep, mosaic reveal. Pure functions of (A, B, p, seed): p = 0 gives A, p = 1
 * gives B, and every pixel is a copy from A or B or a palette tone.
 */
import { bayerThreshold, clamp01, hashOf, smooth, unit, type Compositor } from './pixels.js';

const WIPE_BLOCK = 8;
const WIPE_JITTER = 0.08;
const WIPE_BAND = 0.12;
export const WIPE_DIRECTIONS = ['right', 'left', 'down', 'up', 'diagonal'] as const;

/** Blocky, stair-stepped wipe with a dithered fringe; direction from the seed. */
export const pixelWipe: Compositor = ({ width, height, a, b, out, p, seed }) => {
  const direction = wipeDirection(seed);
  const blocksX = Math.ceil(width / WIPE_BLOCK);
  const blocksY = Math.ceil(height / WIPE_BLOCK);
  const front = p * (1 + WIPE_BAND);
  for (let y = 0; y < height; y += 1) {
    const by = Math.floor(y / WIPE_BLOCK);
    const v = (by + 0.5) / blocksY;
    for (let x = 0; x < width; x += 1) {
      const bx = Math.floor(x / WIPE_BLOCK);
      const u = (bx + 0.5) / blocksX;
      let along: number;
      let across: number;
      if (direction === 'right') [along, across] = [u, by];
      else if (direction === 'left') [along, across] = [1 - u, by];
      else if (direction === 'down') [along, across] = [v, bx];
      else if (direction === 'up') [along, across] = [1 - v, bx];
      else [along, across] = [(u + v) / 2, bx - by + blocksY];
      const s = (along + unit(hashOf(seed, across)) * WIPE_JITTER) / (1 + WIPE_JITTER);
      const reveal = (front - s) / WIPE_BAND;
      const index = y * width + x;
      const fromB = reveal >= 1 || (reveal > 0 && reveal > bayerThreshold(x >> 1, y >> 1));
      out[index] = (fromB ? b[index] : a[index]) ?? 0;
    }
  }
};

/** Ordered dissolve in 2x2 cells (the Bayer matrix offset by the seed). */
export const ditherDissolve: Compositor = ({ width, height, a, b, out, p, seed }) => {
  const offsetX = seed & 7;
  const offsetY = (seed >>> 3) & 7;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const fromB = p > bayerThreshold((x >> 1) + offsetX, (y >> 1) + offsetY);
      out[index] = (fromB ? b[index] : a[index]) ?? 0;
    }
  }
};

const GLITCH_STEPS = 10;
const GLITCH_BAND = 10;
const GLITCH_MAX_SHIFT = 0.12;
const GLITCH_BLOCK_W = 32;
const GLITCH_BLOCK_H = 8;

/** Displaced rows and blocks with palette tone swaps around a hard cut. */
export const glitchCut: Compositor = ({ width, height, a, b, out, p, seed, tones }) => {
  const step = Math.min(GLITCH_STEPS - 1, Math.floor(p * GLITCH_STEPS));
  const intensity = 1 - Math.abs(2 * p - 1);
  const switchShare = clamp01((p - 0.3) / 0.4);
  for (let y = 0; y < height; y += 1) {
    const band = Math.floor(y / GLITCH_BAND);
    const h = hashOf(seed, band, step);
    const displaced = unit(hashOf(h, 1)) < 0.15 + 0.45 * intensity;
    const raw = (unit(h) - 0.5) * 2 * intensity * width * GLITCH_MAX_SHIFT;
    const shift = displaced ? Math.round(raw / 4) * 4 : 0;
    const bandFromB = unit(hashOf(h, 2)) < switchShare;
    const swap = unit(hashOf(h, 3)) < 0.2 * intensity ? ((h & 1) === 0 ? 2 : -2) : 0;
    for (let x = 0; x < width; x += 1) {
      const cell = Math.floor(x / GLITCH_BLOCK_W) * 97 + Math.floor(y / GLITCH_BLOCK_H);
      const block = hashOf(seed ^ 0x5bd1e995, cell, step);
      const blockHit = unit(block) < 0.06 * intensity;
      const fromB = blockHit ? !bandFromB : bandFromB;
      const dx = blockHit ? ((block & 2) === 0 ? 16 : -16) : 0;
      const sx = (((x + shift + dx) % width) + width) % width;
      const source = fromB ? b : a;
      const pixel = source[y * width + sx] ?? 0;
      out[y * width + x] = swap === 0 ? pixel : tones.shift(pixel, swap);
    }
  }
};
const IRIS_BLOCK = 4;
const IRIS_RIM = 4;

/** Stair-stepped circle opening from the centre, with a bright rim of B. */
export const iris: Compositor = ({ width, height, a, b, out, p, tones }) => {
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.sqrt(cx * cx + cy * cy) + IRIS_BLOCK;
  const radius = smooth(p) * (maxRadius + IRIS_RIM) - IRIS_RIM;
  const inner = radius > 0 ? radius * radius : -1;
  const outer = radius + IRIS_RIM > 0 ? (radius + IRIS_RIM) ** 2 : -1;
  for (let y = 0; y < height; y += 1) {
    const dy = Math.floor(y / IRIS_BLOCK) * IRIS_BLOCK + IRIS_BLOCK / 2 - cy;
    for (let x = 0; x < width; x += 1) {
      const dx = Math.floor(x / IRIS_BLOCK) * IRIS_BLOCK + IRIS_BLOCK / 2 - cx;
      const distance = dx * dx + dy * dy;
      const index = y * width + x;
      if (distance < inner) out[index] = b[index] ?? 0;
      else if (distance < outer) out[index] = tones.shift(b[index] ?? 0, 3);
      else out[index] = a[index] ?? 0;
    }
  }
};

const SCAN_LINE = 2;

/** Interlaced reveal: even rows top to bottom, then odd rows, behind a bright scan line. */
export const scanlineSweep: Compositor = ({ width, height, a, b, out, p, tones }) => {
  const passes = [clamp01(2 * p), clamp01(2 * p - 1)];
  for (let y = 0; y < height; y += 1) {
    const pass = passes[y & 1] ?? 0;
    const front = Math.floor(pass * height);
    const revealed = y < front;
    const onLine = pass > 0 && pass < 1 && y >= front && y < front + SCAN_LINE;
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (onLine) out[index] = tones.shift(b[index] ?? 0, 3);
      else out[index] = (revealed ? b[index] : a[index]) ?? 0;
    }
  }
};

const MOSAIC_TILE = 16;
const MOSAIC_SIZES = [1, 2, 4, 8, 16] as const;

/** Pixel blocks grow, tiles flip from A to B in seeded order, then the blocks shrink again. */
export const mosaicReveal: Compositor = ({ width, height, a, b, out, p, seed }) => {
  const peak = 1 - Math.abs(2 * p - 1);
  const size = MOSAIC_SIZES[Math.min(MOSAIC_SIZES.length - 1, Math.floor(peak * 5))] ?? 1;
  const tilesX = Math.ceil(width / MOSAIC_TILE);
  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(height - 1, y - (y % size) + (size >> 1));
    const ty = Math.floor(y / MOSAIC_TILE);
    for (let x = 0; x < width; x += 1) {
      const tile = ty * tilesX + Math.floor(x / MOSAIC_TILE);
      const fromB = p >= 0.3 + 0.4 * unit(hashOf(seed, tile));
      const sx = Math.min(width - 1, x - (x % size) + (size >> 1));
      out[y * width + x] = (fromB ? b : a)[sy * width + sx] ?? 0;
    }
  }
};

/** Direction of a pixel wipe with this seed. */
export function wipeDirection(seed: number): (typeof WIPE_DIRECTIONS)[number] {
  return WIPE_DIRECTIONS[seed % WIPE_DIRECTIONS.length] ?? 'right';
}
