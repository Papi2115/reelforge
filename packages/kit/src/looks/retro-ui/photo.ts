/**
 * Placeholder pictures and body copy for the retro-UI templates: procedural "photos" (a value
 * field per kind, Bayer-dithered onto a ramp of colour roles: halftone newsprint, web JPEGs,
 * mugshots) and greeked text lines. Pure in (area, kind, seed); asset photos arrive in 2.1.
 */
import { hashCell } from '../../env/shared.js';
import { smoothNoise } from '../../fx/shared.js';
import { ditherPick, fillRect, type PixelCanvas, type Rect } from './canvas.js';

export const PHOTO_KINDS = ['landscape', 'portrait', 'city', 'crowd'] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function landscape(u: number, v: number, seed: number): number {
  const ridge = 0.45 + 0.18 * smoothNoise(u * 5, 1, seed) + 0.06 * smoothNoise(u * 17, 2, seed);
  const near = 0.72 + 0.08 * smoothNoise(u * 3 + 7, 3, seed);
  const sun = Math.hypot((u - 0.68) * 1.4, v - 0.3);
  if (v > near) return 0.18 + 0.15 * (1 - v);
  if (v > ridge) return 0.32 + 0.1 * smoothNoise(u * 9, 4, seed);
  if (sun < 0.12) return 0.98;
  return clamp01(0.95 - v * 0.9 + (sun < 0.2 ? 0.15 : 0));
}

function portrait(u: number, v: number): number {
  const head = Math.hypot((u - 0.5) / 0.19, (v - 0.4) / 0.25);
  const shoulders = Math.hypot((u - 0.5) / 0.45, (v - 1.05) / 0.38);
  const stripe = Math.floor(v * 10) % 2 === 0 ? 0.04 : 0;
  if (head < 1) return clamp01(0.62 + 0.25 * (u - 0.5) - 0.2 * Math.max(0, head - 0.75));
  if (shoulders < 1) return 0.16 + 0.1 * (1 - shoulders);
  return 0.82 + stripe - 0.12 * v;
}

function city(u: number, v: number, seed: number): number {
  const column = Math.floor(u * 9);
  const top = 0.25 + 0.45 * hashCell(column, 1, 0, seed);
  if (v > top) {
    const lit = hashCell(Math.floor(u * 40), Math.floor(v * 24), 2, seed) > 0.62;
    const mullion = Math.floor(u * 40) % 2 === 0 || Math.floor(v * 24) % 2 === 0;
    return lit && !mullion ? 0.85 : 0.12 + 0.08 * hashCell(column, 3, 0, seed);
  }
  return clamp01(0.35 + v * 0.9);
}

/** Rows of head-and-shoulder silhouettes, nearer rows larger and darker (front row wins). */
function crowd(u: number, v: number, seed: number): number {
  for (let row = 3; row >= 0; row -= 1) {
    const size = 0.16 + row * 0.07;
    const horizon = 0.3 + row * 0.17;
    const spacing = size * 1.15;
    const offset = row * 0.31 + hashCell(row, 0, 6, seed) * spacing;
    const slot = Math.floor((u + offset) / spacing);
    const local = (u + offset) / spacing - slot - 0.5;
    const jitter = (hashCell(slot, row, 4, seed) - 0.5) * 0.25;
    const headY = horizon + jitter * size;
    const dx = local * spacing;
    const head = Math.hypot(dx / (size * 0.3), (v - headY) / (size * 0.42)) < 1;
    const shoulders = v > headY + size * 0.3 && Math.abs(dx) < size * (0.45 + (v - headY) * 0.8);
    if (head || shoulders) {
      const tone = 0.08 + (3 - row) * 0.12 + (head ? 0.1 : 0);
      return clamp01(tone + 0.06 * hashCell(slot, row, 5, seed));
    }
  }
  return clamp01(0.92 - v * 0.35);
}

/** Brightness 0..1 of a photo at (u, v) in 0..1 (pure). */
export function photoValue(kind: PhotoKind, u: number, v: number, seed: number): number {
  if (kind === 'landscape') return landscape(u, v, seed);
  if (kind === 'portrait') return portrait(u, v);
  if (kind === 'city') return city(u, v, seed);
  return crowd(u, v, seed);
}

/**
 * Dithered photo in `area` on `ramp` (dark -> light role indices). `block` > 1 paints it in
 * coarse blocks (progressive / interlaced loading).
 */
export function drawPhoto(
  canvas: PixelCanvas,
  area: Rect,
  kind: PhotoKind,
  seed: number,
  ramp: readonly number[],
  block = 1,
): void {
  for (let y = area.y; y < area.y + area.h; y += block) {
    for (let x = area.x; x < area.x + area.w; x += block) {
      const u = (x - area.x + block / 2) / area.w;
      const v = (y - area.y + block / 2) / area.h;
      const color = ditherPick(x, y, photoValue(kind, u, v, seed), ramp);
      const w = Math.min(block, area.x + area.w - x);
      const h = Math.min(block, area.y + area.h - y);
      fillRect(canvas, { x, y, w, h }, color);
    }
  }
}

/**
 * Greeked body copy: 2-px-high word bars on a `pitch` grid, ragged right, paragraph breaks.
 * Returns the y below the last line.
 */
export function drawGreek(
  canvas: PixelCanvas,
  area: Rect,
  color: number,
  seed: number,
  pitch = 4,
): number {
  let y = area.y;
  let line = 0;
  while (y + 2 <= area.y + area.h) {
    const paragraphEnd = hashCell(line, 7, 1, seed) < 0.14;
    const limit = area.w - (paragraphEnd ? Math.floor(area.w * 0.4) : 0);
    let x = area.x;
    let word = 0;
    while (x < area.x + limit) {
      const length = 2 + Math.floor(hashCell(line, word, 2, seed) * 7);
      const end = Math.min(x + length, area.x + limit);
      fillRect(canvas, { x, y, w: end - x, h: 2 }, color);
      x = end + 2;
      word += 1;
    }
    y += pitch + (paragraphEnd ? pitch : 0);
    line += 1;
  }
  return y;
}
