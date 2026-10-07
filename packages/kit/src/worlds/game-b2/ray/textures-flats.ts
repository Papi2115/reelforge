/**
 * Floor and ceiling textures of the Game B2 level format (the showcase's concrete, carpet,
 * warehouse slab with its painted line, shop tiles, sand; dark slabs, office tiles, light panels
 * and fluorescent tubes that glow). Seeded, palette indices only.
 */
import { handStroke, Bmp } from '../core/bitmap.js';
import { hash3, vnoise } from '../core/rand.js';
import { C, T } from '../palette.js';
import { blank, noisy, TEX, texture, type Texture } from './texture.js';

export function concreteFloor(seed: number, sandy: boolean): Texture {
  const b = blank();
  noisy(b, [C.CHAR, C.SLATE, C.SLATE, C.GREY], 10, seed + 41);
  handStroke(b, [3, 40, 18, 44, 30, 39], C.CHAR, seed + 42, 2);
  if (sandy)
    for (let y = 0; y < TEX; y += 1)
      for (let x = 0; x < TEX; x += 1) {
        const d = Math.hypot(x - 22, y - 30) + vnoise(x, y, 6, seed + 5) * 14;
        if (d < 22 || (d < 34 && hash3(x, y, 44) < 0.25)) b.px(x, y, d < 14 ? C.SAND_L : C.SAND);
      }
  return texture(b);
}

export function carpet(seed: number): Texture {
  const b = blank();
  noisy(b, [C.MOSS_D, C.MOSS, C.MOSS, C.GREEN], 3, seed + 51);
  return texture(b);
}

function slab(seed: number): Bmp {
  const b = blank();
  noisy(b, [C.SLATE, C.GREY, C.GREY, C.SLATE], 12, seed + 52);
  b.rect(0, 0, TEX, 1, C.CHAR);
  b.rect(0, 0, 1, TEX, C.CHAR);
  return b;
}

export function warehouseFloor(seed: number, line: boolean): Texture {
  const b = slab(seed);
  if (line)
    for (let x = 0; x < TEX; x += 1)
      for (let y = 29; y < 34; y += 1)
        if (hash3(x, y, seed + 53) > 0.12 + (x > 40 ? 0.25 : 0)) b.px(x, y, C.TUNGSTEN);
  return texture(b);
}

export function tile(seed: number, big: boolean): Texture {
  const b = blank();
  const shift = big ? 5 : 4;
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1) {
      const check = ((x >> shift) + (y >> shift)) & 1;
      const speck = hash3(x, y, seed + 54) < (big ? 0.06 : 0.1);
      const [light, dark] = big ? [C.PUTTY, C.GREY] : [C.SAND_L, C.PUTTY];
      b.px(x, y, speck ? (big ? C.SAND : C.GREY) : check ? dark : light);
    }
  return texture(b);
}

export function sand(seed: number): Texture {
  const b = blank();
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1) {
      const ripple = Math.sin(x * 0.21 + y * 0.09 + vnoise(x, y, 16, seed) * 5);
      b.px(x, y, ripple > 0.86 ? C.SAND_L : hash3(x, y, seed) < 0.03 ? C.DIRT : C.SAND);
    }
  return texture(b);
}

export function darkCeiling(seed: number): Texture {
  const b = blank();
  noisy(b, [C.SHADOW, C.CHAR, C.CHAR], 9, seed + 71);
  b.rect(0, 40, TEX, 3, C.SLATE);
  return texture(b);
}

function speckled(base: number, speck: number, share: number, seed: number): Bmp {
  const b = blank(base);
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1) if (y === 0 || hash3(x, y, seed) < share) b.px(x, y, speck);
  return b;
}

export function officeCeiling(seed: number, light: boolean): Texture {
  const b = speckled(C.GREY, C.SLATE, 0.05, seed + 72);
  if (!light) return texture(b);
  b.rect(10, 18, 44, 28, C.TUNGSTEN);
  b.rect(12, 20, 40, 24, C.BULB);
  return texture(b, [C.BULB, C.TUNGSTEN]);
}

function warehouseCeilingBmp(seed: number): Bmp {
  const b = blank(C.SHADOW);
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1)
      if (y < 3 || hash3(x, y, seed + 73) < 0.04) b.px(x, y, y === 0 ? C.SLATE : C.CHAR);
  return b;
}

function addTube(base: Bmp, rows: number): Bmp {
  const b = new Bmp(TEX, TEX, T);
  b.blit(base, 0, 0);
  b.rect(4, 26, 56, 10, C.SLATE);
  b.rect(6, 28, 52, 6, C.CHAR);
  for (let i = 0; i < rows; i += 1) b.rect(7, 29 + i * 3, 50, 2, C.TUBE);
  return b;
}

export function warehouseCeiling(seed: number, tube: boolean, flicker: boolean): Texture {
  const base = warehouseCeilingBmp(seed);
  return tube ? texture(addTube(base, 1), [C.TUBE], 1.25, flicker) : texture(base);
}

export function greyCeiling(seed: number, tube: boolean, flicker: boolean): Texture {
  const base = speckled(C.GREY, C.SLATE, 0.06, seed + 75);
  return tube ? texture(addTube(base, 2), [C.TUBE], 1.2, flicker) : texture(base);
}
