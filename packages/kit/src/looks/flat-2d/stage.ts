/**
 * The flat-2d stage: the background field every template paints first (unless `stage: 'none'`),
 * in two palette tones of the shot's tone family. Gradients are ordered-dither ramps between
 * the two tones (16 Bayer levels), patterns are integer-exact, and everything drifts slowly with
 * t so a held shot stays alive.
 */
import { z } from 'zod';
import { bayerOn, type Raster } from './raster.js';
import type { Theme } from './theme.js';

export const STAGE_PATTERNS = [
  'solid',
  'gradient',
  'spot',
  'stripes',
  'dots',
  'grid',
  'checker',
  'rays',
  'none',
] as const;
export type StagePattern = (typeof STAGE_PATTERNS)[number];

export const stagePatternParam = (fallback: StagePattern) =>
  z
    .enum(STAGE_PATTERNS)
    .default(fallback)
    .describe(
      'Background: solid, gradient (dithered, top to bottom), spot (dithered glow in the centre), stripes, dots, grid, checker, rays (sunburst), none (transparent overlay)',
    );

export const driftParam = z
  .number()
  .min(0)
  .max(60)
  .default(8)
  .describe('Pattern drift in pixels per second (rays: degrees per second); 0 = still');

export interface StageSpec {
  readonly pattern: StagePattern;
  readonly drift: number;
  /** Raster pixels per 640x360-frame pixel. */
  readonly s: number;
}

/** Paints the stage for time t (no-op for `none`). */
export function createStagePainter(
  width: number,
  height: number,
  spec: StageSpec,
): (raster: Raster, theme: Theme, t: number) => void {
  const unit = (value: number): number => Math.max(1, Math.round(value * spec.s));
  const angles = spec.pattern === 'rays' ? rayAngles(width, height) : undefined;
  return (raster, theme, t) => {
    if (spec.pattern === 'none') return;
    raster.rect(0, 0, width, height, theme.field);
    const offset = Math.floor(t * spec.drift * spec.s);
    switch (spec.pattern) {
      case 'solid':
        return;
      case 'gradient': {
        const shift = Math.sin(t * 0.6) * 0.05;
        raster.mask(theme.alt, (x, y) => bayerOn(x, y, (y / height - 0.25 + shift) / 0.7));
        return;
      }
      case 'spot': {
        const cx = width / 2 + Math.sin(t * 0.4) * width * 0.04;
        const cy = height * 0.45 + Math.cos(t * 0.3) * height * 0.03;
        const radius = Math.max(width, height) * 0.55;
        raster.mask(theme.alt, (x, y) => {
          const dx = (x - cx) / radius;
          const dy = ((y - cy) / radius) * 1.4;
          return bayerOn(x, y, 1.15 - Math.sqrt(dx * dx + dy * dy) * 1.3);
        });
        return;
      }
      case 'stripes': {
        const period = unit(28);
        const band = unit(10);
        raster.mask(theme.alt, (x, y) => {
          const k = (((x + y - offset) % period) + period) % period;
          return k < band;
        });
        return;
      }
      case 'dots': {
        const pitch = unit(24);
        const dot = unit(3);
        for (let row = 0, y = -pitch; y < height + pitch; row += 1, y += pitch) {
          const shiftX = (row % 2) * (pitch >> 1) + (offset % pitch);
          const dy = y + (offset % pitch);
          for (let x = -pitch + shiftX; x < width + pitch; x += pitch) {
            raster.rect(x, dy, dot, dot, theme.alt);
          }
        }
        return;
      }
      case 'grid': {
        const pitch = unit(32);
        const line = unit(1);
        const start = offset % pitch;
        for (let x = start - pitch; x < width; x += pitch)
          raster.rect(x, 0, line, height, theme.alt);
        for (let y = start - pitch; y < height; y += pitch)
          raster.rect(0, y, width, line, theme.alt);
        return;
      }
      case 'checker': {
        const cell = unit(40);
        raster.mask(theme.alt, (x, y) => {
          const cx = Math.floor((x + offset) / cell);
          const cy = Math.floor((y + offset) / cell);
          return ((cx + cy) & 1) === 0;
        });
        return;
      }
      case 'rays': {
        const wedges = 16;
        const turn = ((t * spec.drift) / 360) * wedges;
        raster.mask(theme.alt, (x, y) => {
          const angle = angles?.[y * width + x] ?? 0;
          return (Math.floor(angle * wedges + turn) & 1) === 0;
        });
        return;
      }
    }
  };
}

/** Angle of every pixel around the frame centre in turns (0..1), computed once per board. */
function rayAngles(width: number, height: number): Float32Array {
  const result = new Float32Array(width * height);
  const cx = width / 2;
  const cy = height * 0.55;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      result[y * width + x] = (Math.atan2(y + 0.5 - cy, x + 0.5 - cx) / (Math.PI * 2) + 1) % 1;
    }
  }
  return result;
}
