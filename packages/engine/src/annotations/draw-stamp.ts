/**
 * Rubber stamp: display-font text in a (double) frame, rendered into a small ink mask, worn by a
 * seeded texture (stable while it moves), then rotated with nearest-neighbour sampling so it stays
 * pixel art. Enters by slamming down from 1.9x.
 */
import { hashString } from '../rng.js';
import { DISPLAY_FONT } from '../text/font-display.js';
import { inkBox, layoutText, capLine, lineOffset } from '../text/layout.js';
import type { PixelRect } from '../text/types.js';
import type { AnnotationDraw, AnnotationEnv } from './env.js';
import type { ParsedStamp } from './options.js';
import { clampInto } from './placement.js';
import { grow, type Point } from './raster.js';

interface Mask {
  readonly w: number;
  readonly h: number;
  readonly bits: Uint8Array;
}

function stampMask(text: string, scale: number, border: ParsedStamp['border']): Mask {
  const layout = layoutText(DISPLAY_FONT.normalize(text), DISPLAY_FONT);
  const ink = inkBox(layout, 'center', scale, 0, 0);
  const line = Math.max(1, scale - 1);
  const frame = border === 'none' ? 0 : border === 'double' ? line + scale + 1 : line;
  const pad = scale * 2 + frame;
  const w = ink.w + 2 * pad;
  const h = ink.h + 2 * pad;
  const bits = new Uint8Array(w * h);
  const set = (x: number, y: number): void => {
    if (x >= 0 && x < w && y >= 0 && y < h) bits[y * w + x] = 1;
  };
  const ring = (inset: number, thickness: number): void => {
    for (let y = inset; y < h - inset; y += 1) {
      for (let x = inset; x < w - inset; x += 1) {
        const edge = Math.min(x - inset, y - inset, w - 1 - inset - x, h - 1 - inset - y);
        if (edge < thickness) set(x, y);
      }
    }
  };
  if (border !== 'none') ring(0, line);
  if (border === 'double') ring(line + scale, 1);
  const left = pad - ink.x;
  const top = pad - ink.y;
  for (const word of layout.words) {
    const lineX = left + lineOffset(layout, word.line, 'center', scale) + word.x * scale;
    const cap = top + capLine(layout, word.line, scale);
    for (const { glyph, x } of word.glyphs) {
      for (let row = 0; row < glyph.height; row += 1) {
        for (let column = 0; column < glyph.width; column += 1) {
          if (glyph.bits[row * glyph.width + column] !== 1) continue;
          for (let dy = 0; dy < scale; dy += 1) {
            for (let dx = 0; dx < scale; dx += 1) {
              set(lineX + (x + column) * scale + dx, cap + (glyph.top + row) * scale + dy);
            }
          }
        }
      }
    }
  }
  return { w, h, bits };
}

/** Worn ink: blotches (2x2 cells) and single specks removed, seeded per mask pixel. */
function worn(mask: Mask, texture: number, seed: number): Mask {
  if (texture <= 0) return mask;
  const bits = mask.bits.slice();
  for (let y = 0; y < mask.h; y += 1) {
    for (let x = 0; x < mask.w; x += 1) {
      const index = y * mask.w + x;
      if (bits[index] !== 1) continue;
      const blotch = hashString(`${String(x >> 1)}:${String(y >> 1)}`, seed) / 0xffffffff;
      const speck = hashString(`${String(x)},${String(y)}`, seed ^ 0x5bd1e995) / 0xffffffff;
      if (blotch < texture * 0.4 || speck < texture * 0.4) bits[index] = 0;
    }
  }
  return { ...mask, bits };
}

function rotatedBox(mask: Mask, centre: Point, cos: number, sin: number, size: number): PixelRect {
  const hw = (mask.w * size) / 2;
  const hh = (mask.h * size) / 2;
  const ex = Math.abs(hw * cos) + Math.abs(hh * sin);
  const ey = Math.abs(hw * sin) + Math.abs(hh * cos);
  const x = Math.floor(centre.x - ex);
  const y = Math.floor(centre.y - ey);
  return { x, y, w: Math.ceil(centre.x + ex) - x, h: Math.ceil(centre.y + ey) - y };
}

function stampCentre(env: AnnotationEnv, options: ParsedStamp): Point {
  if (options.pos) return { x: options.pos[0] * env.width, y: options.pos[1] * env.height };
  if (options.target) return env.target(options.target, 'target');
  return { x: env.width / 2, y: env.height / 2 };
}

export function drawStamp(env: AnnotationEnv, options: ParsedStamp): AnnotationDraw {
  const scale = options.scale ?? env.bigScale;
  const full = stampMask(options.text, scale, options.border);
  const mask = worn(full, options.texture, env.seed);
  const angle = (options.rotate * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const wanted = stampCentre(env, options);
  const rest = rotatedBox(mask, wanted, cos, sin, 1);
  const clamped = clampInto(grow(rest, 1), env.safeArea);
  const centre = { x: wanted.x + clamped.x - (rest.x - 1), y: wanted.y + clamped.y - (rest.y - 1) };
  const box = grow(rotatedBox(mask, centre, cos, sin, 1), 1);
  const result = { box, extent: box, textScale: scale };
  if (!env.phase.visible) return result;
  const size = 1 + Math.max(0, 1 - env.phase.pop) * 0.9;
  const area = rotatedBox(mask, centre, cos, sin, size);
  const inked = (source: Mask, x: number, y: number): boolean => {
    const dx = (x + 0.5 - centre.x) / size;
    const dy = (y + 0.5 - centre.y) / size;
    const sx = Math.floor(dx * cos + dy * sin + source.w / 2);
    const sy = Math.floor(-dx * sin + dy * cos + source.h / 2);
    return (
      sx >= 0 && sx < source.w && sy >= 0 && sy < source.h && source.bits[sy * source.w + sx] === 1
    );
  };
  const rim = (x: number, y: number): boolean =>
    !inked(full, x, y) &&
    (inked(full, x - 1, y) ||
      inked(full, x + 1, y) ||
      inked(full, x, y - 1) ||
      inked(full, x, y + 1));
  const opacity = env.paint.opacity;
  for (let y = area.y - 1; y <= area.y + area.h; y += 1) {
    for (let x = area.x - 1; x <= area.x + area.w; x += 1) {
      if (inked(mask, x, y)) {
        env.surface.plot(x, y, env.color, opacity, false);
      } else if (env.outline && rim(x, y)) {
        env.surface.plot(x, y, env.outline, opacity, false);
      }
    }
  }
  return result;
}
