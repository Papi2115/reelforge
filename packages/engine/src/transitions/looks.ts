/**
 * Look-change transitions of the kit (ADR-011): CRT zoom (retro UI), tile flip (diorama), draw
 * over (blueprint) and pixel-sort melt (C-rolls). Same contract as basic.ts: pure functions of
 * (A, B, p, seed), p = 0 gives A, p = 1 gives B, every pixel a copy or a palette tone.
 */
import { clamp01, bayerThreshold, hashOf, smooth, unit, type Compositor } from './pixels.js';

/** Power-off (zoom + collapse) until here, then power-on. */
const CRT_SPLIT = 0.4;
const CRT_MAX_ZOOM = 4;
const CRT_EDGE = 2;
/** Share of the power-on phase the picture takes to open fully. */
const CRT_OPENING = 0.6;

/** Zoom into the screen centre, collapse to a line (power off), then B powers on from a line. */
export const crtZoom: Compositor = ({ width, height, a, b, out, p, tones }) => {
  const cx = width / 2;
  const cy = height / 2;
  const off = p < CRT_SPLIT;
  const q = off ? p / CRT_SPLIT : (p - CRT_SPLIT) / (1 - CRT_SPLIT);
  const zoom = off ? 1 + (CRT_MAX_ZOOM - 1) * q * q : 1;
  // Share of the picture height still lit: shrinks at the end of phase 1, grows in phase 2.
  const open = off ? 1 - smooth(clamp01((q - 0.6) / 0.4)) : smooth(clamp01(q / CRT_OPENING));
  const halfOpen = open * cy;
  const scale = Math.max(open, 1 / height);
  const animating = open < 1;
  const scanlines = off ? q > 0.3 : q < 0.8;
  const source = off ? a : b;
  for (let y = 0; y < height; y += 1) {
    const dy = y + 0.5 - cy;
    const index0 = y * width;
    if (Math.abs(dy) > halfOpen) {
      out.fill(tones.darkest, index0, index0 + width);
      continue;
    }
    const sy = Math.min(height - 1, Math.max(0, Math.floor(cy + dy / zoom / scale)));
    const edge = animating && Math.abs(dy) > halfOpen - CRT_EDGE;
    const dim = scanlines && (y & 1) === 1;
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(width - 1, Math.max(0, Math.floor(cx + (x + 0.5 - cx) / zoom)));
      const pixel = source[sy * width + sx] ?? 0;
      out[index0 + x] = edge ? tones.shift(pixel, 3) : dim ? tones.shift(pixel, -1) : pixel;
    }
  }
};

const TILE = 24;
const FLIP = 0.35;

/** A diagonal wave of tiles flips over (checker: alternate tiles flip on the other axis). */
export const tileFlip: Compositor = ({ width, height, a, b, out, p, seed, tones }) => {
  const tilesX = Math.ceil(width / TILE);
  const tilesY = Math.ceil(height / TILE);
  const span = Math.max(1, tilesX + tilesY - 2);
  for (let ty = 0; ty < tilesY; ty += 1) {
    for (let tx = 0; tx < tilesX; tx += 1) {
      const order = ((tx + ty) / span) * 0.85 + unit(hashOf(seed, tx, ty)) * 0.15;
      const f = clamp01((p - order * (1 - FLIP)) / FLIP);
      const scale = Math.abs(1 - 2 * f);
      const source = f < 0.5 ? a : b;
      const horizontal = ((tx + ty) & 1) === 0;
      const cx = tx * TILE + TILE / 2;
      const cy = ty * TILE + TILE / 2;
      const half = (scale * TILE) / 2;
      for (let y = ty * TILE; y < Math.min(height, (ty + 1) * TILE); y += 1) {
        for (let x = tx * TILE; x < Math.min(width, (tx + 1) * TILE); x += 1) {
          const local = horizontal ? x + 0.5 - cx : y + 0.5 - cy;
          const index = y * width + x;
          if (Math.abs(local) > half || half < 0.5) {
            out[index] = tones.darkest;
            continue;
          }
          const sx = horizontal ? Math.floor(cx + local / scale) : x;
          const sy = horizontal ? y : Math.floor(cy + local / scale);
          const pixel =
            source[Math.min(height - 1, Math.max(0, sy)) * width + Math.min(width - 1, sx)] ?? 0;
          out[index] = scale < 0.5 ? tones.shift(pixel, -1) : pixel;
        }
      }
    }
  }
};

const DRAW_SLOPE = 0.25;
const DRAW_TRAIL = 24;
const DRAW_LEAD = 40;
const DRAW_PEN = 2;
const DRAW_GRID = 16;

/** A slanted pen line sweeps right; construction lines ahead of it, B hatched in behind it. */
export const drawOver: Compositor = ({ width, height, a, b, out, p, tones }) => {
  const start = -DRAW_LEAD - 1;
  const end = width + DRAW_SLOPE * height + DRAW_TRAIL;
  const front = start + p * (end - start);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const behind = front - (x + DRAW_SLOPE * y);
      if (behind >= DRAW_TRAIL) out[index] = b[index] ?? 0;
      else if (behind >= 0) {
        const hatched = behind / DRAW_TRAIL > bayerThreshold(x >> 1, y >> 1);
        out[index] = (hatched ? b[index] : a[index]) ?? 0;
      } else if (behind >= -DRAW_PEN) out[index] = tones.brightest;
      else if (behind >= -DRAW_LEAD && (x % DRAW_GRID === 0 || y % DRAW_GRID === 0)) {
        out[index] = tones.shift(a[index] ?? 0, 2);
      } else out[index] = a[index] ?? 0;
    }
  }
};

const MELT_STRIP = 2;
const MELT_MAX_DELAY = 0.35;
const MELT_SORT = 40;

/** Columns of A fall away (random-walk delays), their leading rows luma-sorted; B behind. */
export const pixelSortMelt: Compositor = ({ width, height, a, b, out, p, seed, tones }) => {
  const strips = Math.ceil(width / MELT_STRIP);
  let delay = unit(hashOf(seed, 0)) * MELT_MAX_DELAY;
  const band: number[] = [];
  for (let strip = 0; strip < strips; strip += 1) {
    const walk = (unit(hashOf(seed, strip, 1)) - 0.5) * 0.06;
    delay = Math.min(MELT_MAX_DELAY, Math.max(0, delay + walk));
    const fall = clamp01((p - delay) / (1 - MELT_MAX_DELAY));
    const offset = Math.min(height, Math.floor(height * fall * fall));
    const sorted = Math.floor(Math.min(offset, MELT_SORT) * 0.6);
    for (let x = strip * MELT_STRIP; x < Math.min(width, (strip + 1) * MELT_STRIP); x += 1) {
      for (let y = 0; y < height; y += 1) {
        const index = y * width + x;
        out[index] = (y < offset ? b[index] : a[(y - offset) * width + x]) ?? 0;
      }
      if (sorted < 2) continue;
      band.length = 0;
      for (let row = 0; row < sorted && offset + row < height; row += 1) {
        band.push(out[(offset + row) * width + x] ?? 0);
      }
      band.sort((first, second) => tones.rank(second) - tones.rank(first) || first - second);
      band.forEach((pixel, row) => {
        out[(offset + row) * width + x] = pixel;
      });
    }
  }
};
