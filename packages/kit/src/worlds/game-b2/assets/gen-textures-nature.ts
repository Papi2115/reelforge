/**
 * Natural surfaces of the texture generator (64x64, seamless): grass, sand, mud, snow, rock, ice,
 * foliage walls, and the animated water and lava (3 frames). Ramp names come from the spec, so
 * the same generator paints a green pond, a brown river or a blue sea.
 */
import { Bmp, handStroke } from '../core/bitmap.js';
import { hash3 } from '../core/rand.js';
import { C } from '../palette.js';
import { TEX } from '../ray/texture.js';
import { blob } from './draw.js';
import { rampAt, type Ramp } from './ramps.js';
import { fbm, noiseFill, tnoise, wpx } from './tile-noise.js';

export interface TexInput {
  readonly ramp: Ramp;
  readonly seed: number;
  readonly wear: number;
  readonly frame: number;
}

export function grass({ ramp, seed, wear }: TexInput): Bmp {
  const b = new Bmp(TEX, TEX);
  noiseFill(b, ramp, 16, seed, 1, 3);
  for (let i = 0; i < 150; i += 1) {
    const x = hash3(i, 1, seed) * TEX;
    const y = hash3(i, 2, seed) * TEX;
    const c = hash3(i, 3, seed) < 0.6 ? (ramp[3] ?? C.SAGE) : (ramp[0] ?? C.MOSS_D);
    wpx(b, x, y, c);
    wpx(b, x, y - 1, c);
    if (hash3(i, 4, seed) < 0.4) wpx(b, x + 1, y - 2, c);
  }
  for (let i = 0; i < 40 * wear; i += 1)
    wpx(b, hash3(i, 5, seed) * TEX, hash3(i, 6, seed) * TEX, C.DIRT);
  return b;
}

export function sand({ ramp, seed, wear }: TexInput): Bmp {
  const b = new Bmp(TEX, TEX);
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1) {
      const ripple = Math.sin(((y + tnoise(x, y, 16, seed) * 12) / TEX) * Math.PI * 2 * 4);
      const v = 0.45 + ripple * 0.18 + (fbm(x, y, 8, seed + 3) - 0.5) * 0.4;
      b.px(x, y, rampAt(ramp, v, x, y, 1, 3));
    }
  for (let i = 0; i < 30 + 60 * wear; i += 1)
    wpx(b, hash3(i, 7, seed) * TEX, hash3(i, 8, seed) * TEX, ramp[1] ?? C.DIRT);
  return b;
}

export function mud({ ramp, seed }: TexInput): Bmp {
  const b = new Bmp(TEX, TEX);
  noiseFill(b, ramp, 16, seed, 0, 2);
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1) {
      const pool = fbm(x, y, 16, seed + 9);
      if (pool > 0.66) b.px(x, y, pool > 0.72 && hash3(x, y, seed) < 0.08 ? C.GREY : C.UMBER);
    }
  handStroke(b, [4, 20, 20, 24, 36, 18], ramp[0] ?? C.DIRT_D, seed + 1, 3);
  return b;
}

export function snow({ ramp, seed }: TexInput): Bmp {
  const b = new Bmp(TEX, TEX);
  const n = ramp.length;
  const [shade, mid, light] = [
    ramp[n - 3] ?? C.MOON,
    ramp[n - 2] ?? C.PUTTY,
    ramp[n - 1] ?? C.PAPER,
  ];
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1) {
      const v = fbm(x, y, 16, seed);
      b.px(x, y, v < 0.32 || (v < 0.4 && hash3(x, y, 2) < 0.5) ? shade : v < 0.75 ? mid : light);
    }
  for (let i = 0; i < 24; i += 1)
    wpx(b, hash3(i, 9, seed) * TEX, hash3(i, 10, seed) * TEX, C.PAPER);
  return b;
}

export function rock({ ramp, seed, wear }: TexInput): Bmp {
  const b = new Bmp(TEX, TEX);
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1) {
      const facet = tnoise(x, y, 16, seed);
      const v = facet * 0.7 + tnoise(x, y, 4, seed + 1) * 0.3;
      b.px(x, y, rampAt(ramp, v, x, y, 1, 3));
    }
  for (let k = 0; k < 4 + wear * 4; k += 1) {
    const x = hash3(k, 11, seed) * TEX;
    const y = hash3(k, 12, seed) * TEX;
    handStroke(
      b,
      [x, y, x + 9 * (hash3(k, 13, seed) - 0.3), y + 12, x + 4, y + 20],
      ramp[0] ?? C.CHAR,
      seed + k,
      3,
    );
  }
  return b;
}

export function ice({ ramp, seed }: TexInput): Bmp {
  const b = new Bmp(TEX, TEX);
  noiseFill(b, ramp, 32, seed, 2, 4);
  for (let k = 0; k < 5; k += 1) {
    const x = hash3(k, 14, seed) * TEX;
    const y = hash3(k, 15, seed) * TEX;
    handStroke(b, [x, y, x + 14, y + 5, x + 22, y - 3], C.PAPER, seed + k, 2);
  }
  return b;
}

/** A wall of leaves (forest edge, hedge): many small rough blobs, dark gaps between. */
export function foliage({ ramp, seed }: TexInput): Bmp {
  const b = new Bmp(TEX, TEX, ramp[0] ?? C.MOSS_D);
  for (let i = 0; i < 70; i += 1) {
    const x = hash3(i, 16, seed) * TEX;
    const y = hash3(i, 17, seed) * TEX;
    const r = 3 + hash3(i, 18, seed) * 5;
    for (const [ox, oy] of [
      [0, 0],
      [TEX, 0],
      [-TEX, 0],
      [0, TEX],
      [0, -TEX],
    ] as const)
      if (x + ox > -r && x + ox < TEX + r && y + oy > -r && y + oy < TEX + r)
        blob(b, x + ox, y + oy, r, r * 0.8, ramp, seed + i, 0.3, 0, i % 3 === 0 ? 4 : 3);
  }
  return b;
}

/** Water: a dark-to-light ramp field with ripple highlights that move between the 3 frames. */
export function water({ ramp, seed, frame }: TexInput): Bmp {
  const b = new Bmp(TEX, TEX);
  const shift = frame * 5;
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1) {
      const v =
        fbm(x + shift, y, 16, seed) * 0.55 + tnoise(x - shift, y + shift, 8, seed + 4) * 0.45;
      b.px(x, y, rampAt(ramp, v * 0.85, x, y, 1, 3));
    }
  for (let i = 0; i < 26; i += 1) {
    const x = hash3(i, 19, seed) * TEX + frame * (2 + (i % 3));
    const y = hash3(i, 20, seed) * TEX;
    const len = 2 + Math.floor(hash3(i, 21, seed) * 5);
    const c = i % 4 === 0 ? (ramp[ramp.length - 1] ?? C.MOON) : (ramp[3] ?? C.HAZE);
    for (let k = 0; k < len; k += 1) wpx(b, x + k, y + (frame === 1 && k > len / 2 ? 1 : 0), c);
  }
  return b;
}

/** Lava: dark crust plates and glowing cracks (the cracks glow: emissive tungsten / bulb). */
export function lava({ seed, frame }: TexInput): Bmp {
  const b = new Bmp(TEX, TEX);
  for (let y = 0; y < TEX; y += 1)
    for (let x = 0; x < TEX; x += 1) {
      const v = fbm(x, y + frame * 3, 16, seed);
      const crack = Math.abs(v - 0.5) < 0.04;
      const hot = Math.abs(v - 0.5) < 0.015;
      b.px(
        x,
        y,
        hot
          ? C.BULB
          : crack
            ? C.TUNGSTEN
            : v < 0.5
              ? C.UMBER
              : rampAt([C.SHADOW, C.UMBER, C.BROWN], fbm(x, y, 8, seed), x, y),
      );
    }
  return b;
}
