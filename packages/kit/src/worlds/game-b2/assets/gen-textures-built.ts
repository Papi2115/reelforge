/**
 * Man-made surfaces of the texture generator (64x64, seamless): tiles, planks, bricks, castle
 * stone, cobbles, metal plates, a space-station hull, canvas, log walls, thatch, adobe, building
 * facades with windows and glass curtain walls. `window: true` cuts a see-through hole (the sky
 * or the level beyond shows), `lit` sets the share of lit (glowing) windows. Uneven on purpose:
 * chipped bricks, a darker board, a crooked seam.
 */
import { Bmp, handStroke } from '../core/bitmap.js';
import { hash3 } from '../core/rand.js';
import { C, T } from '../palette.js';
import { TEX } from '../ray/texture.js';
import { rampAt } from './ramps.js';
import type { TexInput } from './gen-textures-nature.js';
import { fbm, noiseFill } from './tile-noise.js';

export interface BuiltInput extends TexInput {
  readonly lit: number;
  readonly window: boolean;
}

const at = (ramp: readonly number[], k: number): number =>
  ramp[Math.max(0, Math.min(ramp.length - 1, k))] ?? C.SLATE;

export function tiles({ ramp, seed, wear }: BuiltInput): Bmp {
  const b = new Bmp(TEX, TEX);
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1) {
      const check = ((x >> 4) + (y >> 4)) & 1;
      const grout = (x & 15) === 0 || (y & 15) === 0;
      const speck = hash3(x, y, seed) < 0.05 + wear * 0.1;
      b.px(x, y, grout ? at(ramp, 1) : speck ? at(ramp, 2) : check ? at(ramp, 3) : at(ramp, 4));
    }
  return b;
}

export function planks({ ramp, seed, wear }: BuiltInput): Bmp {
  const b = new Bmp(TEX, TEX);
  for (let y = 0; y < TEX; y += 1) {
    const board = y >> 3;
    const dark = hash3(board, 1, seed) < 0.3;
    for (let x = 0; x < TEX; x += 1) {
      const grain = Math.sin(x * 0.4 + fbm(x, y, 8, seed + board) * 7);
      let c = at(ramp, dark ? 2 : 3);
      if (grain > 0.82) c = at(ramp, dark ? 1 : 2);
      const joint = (x + board * 23) % 64 === 0;
      if ((y & 7) === 7 || joint) c = at(ramp, 0);
      b.px(x, y, c);
    }
    b.px((board * 23 + 3) % 64, (board << 3) + 3, at(ramp, 0));
  }
  for (let i = 0; i < 20 * wear; i += 1)
    b.px(hash3(i, 2, seed) * TEX, hash3(i, 3, seed) * TEX, at(ramp, 1));
  return b;
}

/** Bricks (rust ramp) or castle blocks (stone ramp, big = true) in mortar. */
export function masonry({ ramp, seed, wear, window }: BuiltInput, big: boolean): Bmp {
  const b = new Bmp(TEX, TEX);
  const bw = big ? 32 : 16;
  const bh = big ? 16 : 8;
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1) {
      const row = Math.floor(y / bh);
      const shift = row % 2 ? bw / 2 : 0;
      const col = Math.floor((x + shift) / bw);
      const mortar = y % bh === 0 || (x + shift) % bw === 0;
      if (mortar) {
        b.px(x, y, big ? at(ramp, 1) : C.GREY);
        continue;
      }
      const tone = hash3(col, row, seed);
      const v = 0.35 + tone * 0.35 + (fbm(x, y, 8, seed) - 0.5) * 0.3 - ((y % bh) / bh) * 0.15;
      const chipped =
        hash3(col, row, seed + 5) < 0.12 * (1 + wear) && (x + shift) % bw < 3 && y % bh < 3;
      b.px(x, y, chipped ? at(ramp, 0) : rampAt(ramp, v, x, y, 1, big ? 4 : 3));
    }
  if (big && wear > 0.3)
    for (let i = 0; i < 90 * wear; i += 1)
      b.px(hash3(i, 6, seed) * TEX, 50 + hash3(i, 7, seed) * 14, C.MOSS);
  if (window) arch(b);
  return b;
}

/** A see-through arched window / porthole in the middle of the tile (with a sill). */
function arch(b: Bmp): void {
  for (let y = 14; y < 46; y += 1)
    for (let x = 22; x < 42; x += 1) {
      const top = y < 24 ? Math.hypot(x - 31.5, y - 24) <= 10 : true;
      if (top) b.px(x, y, T);
    }
  b.rect(20, 46, 24, 3, C.PUTTY);
  b.rect(20, 49, 24, 1, C.CHAR);
}

export function cobble({ ramp, seed }: BuiltInput): Bmp {
  const b = new Bmp(TEX, TEX, at(ramp, 0));
  for (let cy = 0; cy < 8; cy += 1)
    for (let cx = 0; cx < 8; cx += 1) {
      const ox = cx * 8 + (cy % 2 ? 4 : 0) + Math.floor(hash3(cx, cy, seed) * 2);
      const oy = cy * 8 + Math.floor(hash3(cx, cy, seed + 1) * 2);
      for (let y = 0; y < 7; y += 1)
        for (let x = 0; x < 7; x += 1) {
          const nx = (x - 3) / 3.4;
          const ny = (y - 3) / 3.2;
          if (nx * nx + ny * ny > 1) continue;
          const lit = 0.55 - nx * 0.3 - ny * 0.35 + hash3(cx, cy, seed + 2) * 0.25;
          b.px((ox + x) % TEX, (oy + y) % TEX, rampAt(ramp, lit, x, y, 1, 4));
        }
    }
  return b;
}

/** Metal plates with seams and rivets; `hull` adds a hazard stripe and two small glowing lights. */
export function metal({ ramp, seed, wear, window }: BuiltInput, hull: boolean): Bmp {
  const b = new Bmp(TEX, TEX);
  noiseFill(b, ramp, 32, seed, 2, 3);
  for (let i = 0; i < TEX; i += 1) {
    b.px(i, 0, at(ramp, 1));
    b.px(i, 31, at(ramp, 1));
    b.px(0, i, at(ramp, 1));
    b.px(i, 1, at(ramp, 4));
    b.px(1, i, at(ramp, 4));
  }
  for (const [x, y] of [
    [4, 4],
    [59, 4],
    [4, 27],
    [59, 27],
    [4, 35],
    [59, 59],
  ] as const)
    b.px(x, y, at(ramp, 4));
  for (let i = 0; i < 30 * wear; i += 1)
    b.px(hash3(i, 8, seed) * TEX, hash3(i, 9, seed) * TEX, C.CLAY);
  if (hull) {
    for (let x = 0; x < TEX; x += 1)
      for (let y = 52; y < 58; y += 1) b.px(x, y, ((x + y) >> 2) % 2 ? C.TUNGSTEN : C.CHAR);
    b.rect(48, 8, 3, 2, C.FLUO);
    b.rect(10, 40, 2, 2, C.ACCENT_D);
  }
  if (window) {
    for (let y = 4; y < 40; y += 1)
      for (let x = 10; x < 54; x += 1) {
        const d = Math.hypot((x - 31.5) / 20, (y - 21.5) / 16);
        if (d <= 1) b.px(x, y, d > 0.9 ? at(ramp, 1) : T);
      }
    handStroke(b, [11, 22, 16, 10, 31, 5, 47, 10, 52, 22], at(ramp, 4), seed, 0);
  }
  return b;
}

export function fabric({ ramp, seed }: BuiltInput): Bmp {
  const b = new Bmp(TEX, TEX);
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1) {
      const weave = (x + (y >> 1)) % 3 === 0 || hash3(x, y, seed) < 0.08;
      const fold = Math.sin((x / TEX) * Math.PI * 4) * 0.25;
      b.px(x, y, rampAt(ramp, 0.55 + fold - (weave ? 0.2 : 0), x, y, 1, 3));
    }
  for (let y = 0; y < TEX; y += 3) b.px(31, y, at(ramp, 0));
  return b;
}

export function logs({ ramp, seed }: BuiltInput): Bmp {
  const b = new Bmp(TEX, TEX);
  for (let y = 0; y < TEX; y += 1) {
    const v = (y % 16) / 16;
    const round = Math.sin(v * Math.PI);
    for (let x = 0; x < TEX; x += 1) {
      const grain = fbm(x, y, 8, seed) * 0.2;
      b.px(x, y, rampAt(ramp, round * 0.75 + grain - (v > 0.8 ? 0.3 : 0), x, y, 0, 3));
    }
  }
  for (let r = 0; r < 4; r += 1) b.px(10 + r * 13, r * 16 + 7, at(ramp, 0));
  return b;
}

export function thatch({ ramp, seed }: BuiltInput): Bmp {
  const b = new Bmp(TEX, TEX, at(ramp, 1));
  for (let i = 0; i < 260; i += 1) {
    const x = hash3(i, 10, seed) * TEX;
    const y = hash3(i, 11, seed) * TEX;
    const c = at(ramp, 1 + Math.floor(hash3(i, 12, seed) * 3));
    for (let k = 0; k < 7; k += 1) b.px((x + k * 0.4) % TEX, (y + k) % TEX, c);
  }
  for (let y = 15; y < TEX; y += 16) for (let x = 0; x < TEX; x += 1) b.px(x, y, at(ramp, 0));
  return b;
}

export function adobe({ ramp, seed, window }: BuiltInput): Bmp {
  const b = new Bmp(TEX, TEX);
  noiseFill(b, ramp, 32, seed, 2, 3);
  b.rect(0, 54, TEX, 10, at(ramp, 1));
  handStroke(b, [40, 10, 44, 20, 41, 28], at(ramp, 1), seed, 2);
  if (window) {
    b.rect(24, 16, 16, 18, T);
    b.rect(22, 34, 20, 2, at(ramp, 1));
  }
  return b;
}

/** A building facade: storeys of windows in a wall colour; `lit` share of windows glow at night. */
export function facade({ ramp, seed, lit }: BuiltInput): Bmp {
  const b = new Bmp(TEX, TEX);
  noiseFill(b, ramp, 32, seed, 2, 3);
  for (let row = 0; row < 2; row += 1)
    for (let col = 0; col < 2; col += 1) {
      const x = 8 + col * 32;
      const y = 6 + row * 32;
      const on = hash3(col, row, seed + 3) < lit;
      b.rect(x - 1, y - 1, 18, 22, at(ramp, 1));
      b.rect(x, y, 16, 20, on ? C.BULB : C.NIGHT);
      if (on) b.rect(x, y + 12, 16, 8, C.TUNGSTEN);
      else b.rect(x + 2, y + 2, 3, 8, C.DUSK);
      b.rect(x + 7, y, 2, 20, at(ramp, 1));
      b.rect(x - 2, y + 20, 20, 2, at(ramp, 4));
    }
  return b;
}

export function glass({ ramp, seed, lit }: BuiltInput): Bmp {
  const b = new Bmp(TEX, TEX);
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1) {
      const pane = (x & 15) === 0 || (y & 15) === 0;
      const on = hash3(x >> 4, y >> 4, seed) < lit;
      const sheen = ((x + y * 2) & 31) < 3;
      b.px(
        x,
        y,
        pane
          ? C.CHAR
          : on
            ? C.TUNGSTEN
            : sheen
              ? at(ramp, 3)
              : rampAt(ramp, 0.3 + (y / TEX) * 0.4, x, y, 1, 2),
      );
    }
  return b;
}
