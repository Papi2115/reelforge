/**
 * The sky of an outdoor Game B2 level (a port of the showcase's desert sky, generalised): a
 * dithered gradient by elevation per preset, a skyline silhouette by bearing (hills, mountains,
 * a tree line, dunes, a city with lit windows, the sea, a mesa, towers), drifting clouds, stars,
 * the sun or a crescent moon, an underwater surface shimmer. Everything is a pure function of the
 * camera and t; tables are built once per sky (`planSky`).
 */
import { bayer, hash3, rng, vnoise } from '../core/rand.js';
import { C } from '../palette.js';
import { SKY_DEFAULTS, type Sky, type SkyPreset } from '../level/sky.js';

const TAU = Math.PI * 2;
/** Skyline / cloud samples around the horizon. */
export const SKY_AZ = 1024;
const CLOUD_ROWS = 48;
const CLOUD_TOP = 0.7;

/** Gradient stops from the zenith down: [elevation (tan), colour]. */
const GRADIENT: Readonly<Record<SkyPreset, readonly (readonly [number, number])[]>> = {
  day: [
    [0.5, C.HAZE],
    [0.24, C.MOON],
    [0.08, C.PUTTY],
    [0, C.PAPER],
  ],
  dawn: [
    [0.45, C.DUSK],
    [0.22, C.HAZE],
    [0.08, C.SAND_L],
    [0, C.PAPER],
  ],
  dusk: [
    [0.5, C.NIGHT],
    [0.26, C.DUSK],
    [0.12, C.PLUM],
    [0.04, C.CLAY],
    [0, C.TUNGSTEN],
  ],
  night: [
    [0.42, C.NIGHT_D],
    [0.18, C.NIGHT],
    [0, C.DUSK],
  ],
  overcast: [
    [0.45, C.SLATE],
    [0.2, C.GREY],
    [0, C.PUTTY],
  ],
  space: [[0, C.VOID]],
  underwater: [
    [0.6, C.HAZE],
    [0.3, C.DUSK],
    [0.1, C.NIGHT],
    [0, C.NIGHT_D],
  ],
};

/** [silhouette, highlight] of the skyline per preset (hills / mountains / towers). */
const LAND: Readonly<Record<SkyPreset, readonly [number, number]>> = {
  day: [C.HAZE, C.MOON],
  dawn: [C.DUSK, C.HAZE],
  dusk: [C.PLUM, C.CLAY],
  night: [C.NIGHT, C.DUSK],
  overcast: [C.SLATE, C.GREY],
  space: [C.CHAR, C.SLATE],
  underwater: [C.NIGHT_D, C.NIGHT],
};
/** [light, shade] of clouds per preset. */
const CLOUD: Readonly<Record<SkyPreset, readonly [number, number]>> = {
  day: [C.PAPER, C.PUTTY],
  dawn: [C.PAPER, C.SAND_L],
  dusk: [C.CLAY, C.PLUM],
  night: [C.DUSK, C.NIGHT],
  overcast: [C.GREY, C.SLATE],
  space: [C.CHAR, C.VOID],
  underwater: [C.MOON, C.HAZE],
};

export interface SkyPlan {
  readonly preset: SkyPreset;
  readonly gradient: readonly (readonly [number, number])[];
  /** Skyline elevation per bearing sample. */
  readonly skyline: Float32Array;
  readonly skylineKind: Sky['skyline'];
  readonly land: readonly [number, number];
  /** Cloud field (bearing sample x row): 0 clear, 1 thin, 2 thick. */
  readonly clouds: Uint8Array;
  readonly cloudColours: readonly [number, number];
  readonly drift: number;
  readonly stars: readonly (readonly [number, number, number])[];
  readonly sun: Exclude<Sky['sun'], undefined>;
  readonly belowToo: boolean;
}

function skylineAt(kind: Sky['skyline'], u: number, height: number, seed: number): number {
  const n = (scale: number, salt: number): number => vnoise(u * scale, 0, 1, seed + salt);
  switch (kind) {
    case 'none':
    case 'sea':
      return 0;
    case 'hills':
      return height * (0.35 + 0.65 * n(7, 1)) + height * 0.15 * n(40, 2);
    case 'mountains': {
      const ridge = 1 - Math.abs(n(9, 3) * 2 - 1);
      return height * (0.4 + 1.6 * ridge * ridge) + height * 0.2 * n(60, 4);
    }
    case 'trees': {
      const crowns = Math.abs(Math.sin(u * TAU * 90 + n(30, 5) * 6));
      return height * (0.55 + 0.25 * n(12, 6) + 0.25 * Math.sqrt(crowns));
    }
    case 'dunes':
      return height * (0.25 + 0.5 * n(4, 7));
    case 'city': {
      const block = Math.floor(u * 140);
      const tall = hash3(block, 1, seed);
      return tall < 0.15 ? height * 0.2 : height * (0.4 + tall * 1.8);
    }
    case 'mesa': {
      const v = n(9, 8);
      return v > 0.55 ? height * (0.9 + (v - 0.55) * 0.8) : height * (0.25 + v * 0.4);
    }
    case 'towers': {
      const tower = hash3(Math.floor(u * 40), 2, seed) < 0.18;
      const merlon = Math.floor(u * 900) % 3 === 0 ? height * 0.12 : 0;
      return (tower ? height * 1.5 : height * 0.7) + merlon;
    }
  }
}

/** Precomputes the skyline, cloud field and stars of a sky (once per level). */
export function planSky(sky: Sky, seed: number): SkyPlan {
  const [cover, stars, sun] = SKY_DEFAULTS[sky.preset];
  const skyline = new Float32Array(SKY_AZ);
  for (let i = 0; i < SKY_AZ; i += 1)
    skyline[i] = skylineAt(sky.skyline, i / SKY_AZ, sky.skylineHeight, seed);
  const clouds = new Uint8Array(SKY_AZ * CLOUD_ROWS);
  const amount = sky.clouds ?? cover;
  for (let row = 0; row < CLOUD_ROWS; row += 1)
    for (let i = 0; i < SKY_AZ; i += 1) {
      const el = ((row + 0.5) / CLOUD_ROWS) * CLOUD_TOP;
      const band = Math.exp(-(((el - 0.2) / 0.16) ** 2));
      const v =
        vnoise(i, row * 3.2, 48, seed + 31) * 0.7 + vnoise(i, row * 3.2, 12, seed + 32) * 0.3;
      const threshold = 1 - amount * (0.55 + 0.45 * band);
      clouds[row * SKY_AZ + i] = v > threshold ? (v > threshold + 0.08 ? 2 : 1) : 0;
    }
  const random = rng(seed + 77);
  const starList: [number, number, number][] = [];
  const showStars = sky.stars ?? stars;
  const below = sky.ground === 'none';
  if (showStars)
    for (let i = 0; i < 220; i += 1)
      starList.push([
        random() * TAU,
        (below ? random() * 2 - 1 : 0.04 + random() ** 1.4) * 1.1,
        random(),
      ]);
  const trees = sky.skyline === 'trees';
  const sand = sky.skyline === 'dunes' || sky.skyline === 'mesa';
  const land: readonly [number, number] = trees
    ? sky.preset === 'day' || sky.preset === 'dawn' || sky.preset === 'overcast'
      ? [C.GREEN, C.SAGE]
      : [C.MOSS_D, C.MOSS]
    : sand && (sky.preset === 'day' || sky.preset === 'dawn')
      ? [C.SAND, C.SAND_L]
      : sand && sky.preset === 'dusk'
        ? [C.DIRT, C.CLAY]
        : LAND[sky.preset];
  return {
    preset: sky.preset,
    gradient: GRADIENT[sky.preset],
    skyline,
    skylineKind: sky.skyline,
    land,
    clouds,
    cloudColours: CLOUD[sky.preset],
    drift: sky.drift,
    stars: starList,
    sun: sky.sun ?? sun,
    belowToo: below,
  };
}

/** Index of bearing `az` (radians) in the skyline table. */
export function azIndex(az: number): number {
  const u = (((az / TAU) % 1) + 1) % 1;
  return Math.min(SKY_AZ - 1, Math.floor(u * SKY_AZ));
}

function gradientAt(plan: SkyPlan, el: number, x: number, y: number): number {
  const stops = plan.gradient;
  const first = stops[0];
  if (first === undefined) return C.VOID;
  if (el >= first[0]) return first[1];
  for (let k = 1; k < stops.length; k += 1) {
    const upper = stops[k - 1];
    const lower = stops[k];
    if (upper === undefined || lower === undefined) break;
    if (el >= lower[0]) {
      const share = (el - lower[0]) / (upper[0] - lower[0]);
      return bayer(x, y) < share ? upper[1] : lower[1];
    }
  }
  return stops[stops.length - 1]?.[1] ?? C.VOID;
}

/**
 * The sky pixel at screen (x, y): `el` = elevation (tan) of the row, `az` = bearing of the
 * column (radians), `ai` = its skyline index.
 */
export function skyPixel(
  plan: SkyPlan,
  x: number,
  y: number,
  el: number,
  az: number,
  ai: number,
  t: number,
): number {
  if (el < 0 && !plan.belowToo) return plan.gradient[plan.gradient.length - 1]?.[1] ?? C.VOID;
  const ridge = plan.skyline[ai] ?? 0;
  if (el >= 0 && el < ridge) {
    if (plan.skylineKind === 'city' && plan.preset !== 'day' && plan.preset !== 'overcast') {
      const lit = hash3(Math.floor(az * 600), Math.floor(el * 400), 9) < 0.12 && el < ridge - 0.01;
      return lit ? C.TUNGSTEN : C.NIGHT_D;
    }
    return el > ridge - 0.006 && bayer(x, y) < 0.6 ? plan.land[1] : plan.land[0];
  }
  if (plan.preset === 'underwater' && el > 0.18) {
    const u = az * 9 + Math.sin(el * 26 + t * 0.9) * 0.7;
    const line = Math.abs(Math.sin(u * 3 + Math.sin(az * 5 - t * 0.6) * 1.4));
    if (line < 0.05 + (el - 0.18) * 0.12) return bayer(x, y) < 0.6 ? C.MOON : C.HAZE;
  }
  if (el > 0.03 && el < CLOUD_TOP && plan.clouds.length > 0) {
    const row = Math.floor((el / CLOUD_TOP) * CLOUD_ROWS);
    const shift = Math.floor(((t * plan.drift) / TAU) * SKY_AZ);
    const col = (((ai + shift) % SKY_AZ) + SKY_AZ) % SKY_AZ;
    const cloud = plan.clouds[row * SKY_AZ + col] ?? 0;
    if (cloud === 2) return plan.cloudColours[0];
    if (cloud === 1 && bayer(x, y) < 0.7) return plan.cloudColours[1];
  }
  return gradientAt(plan, el, x, y);
}

/** Stars, the sun or the moon: drawn only where the sky shows (`depth` still FAR). */
export function skyDetails(
  plan: SkyPlan,
  put: (x: number, y: number, c: number) => void,
  toScreen: (az: number, el: number) => readonly [number, number] | null,
  t: number,
): void {
  plan.stars.forEach(([az, el, bright], i) => {
    const at = toScreen(az, el);
    if (at === null) return;
    if (el >= 0 && el < (plan.skyline[azIndex(az)] ?? 0) + 0.01) return;
    const twinkle = hash3(Math.floor(t * 3 + i * 0.37), i, 4) < 0.12;
    put(at[0], at[1], twinkle ? C.HAZE : bright > 0.85 ? C.PAPER : bright > 0.4 ? C.MOON : C.HAZE);
  });
  const sun = plan.sun;
  if (sun === 'none') return;
  const at = toScreen((sun.az * Math.PI) / 180, Math.tan((sun.el * Math.PI) / 180));
  if (at === null) return;
  const [sx, sy] = at;
  if (sun.moon) {
    for (let yy = -5; yy <= 5; yy += 1)
      for (let xx = -5; xx <= 5; xx += 1) {
        const inA = xx * xx + yy * yy <= 20;
        const inB = (xx - 2.2) ** 2 + (yy + 1) ** 2 <= 17;
        if (inA && !inB) put(sx + xx, sy + yy, xx < -3 ? C.MOON : C.PAPER);
      }
    return;
  }
  const disc = plan.preset === 'dusk' || plan.preset === 'dawn' ? C.BULB : C.PAPER;
  for (let yy = -9; yy <= 9; yy += 1)
    for (let xx = -9; xx <= 9; xx += 1) {
      const d = xx * xx + yy * yy;
      if (d <= 26) put(sx + xx, sy + yy, disc);
      else if (d <= 72 && bayer(sx + xx, sy + yy) < (72 - d) / 60) put(sx + xx, sy + yy, C.BULB);
    }
}
