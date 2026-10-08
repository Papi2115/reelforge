/**
 * The OUTDOOR mode of the Game B2 level format: `sky: { preset, clouds, sun, stars, skyline,
 * ground, drift }`. An outdoor level has no ceiling (a cell keeps a roof only when its legend
 * entry names a `ceiling`), its border may stay open (the ground runs on to the horizon) and its
 * walls may stand up to 4 tall (towers, cliffs, tree lines). The preset sets the light: tint, fog
 * colour (the horizon haze), fog density and ambient light of the level's own room.
 */
import { z } from 'zod';
import type { Rgb } from '../palette.js';

export const SKY_PRESETS = [
  'day',
  'dawn',
  'dusk',
  'night',
  'overcast',
  'space',
  'underwater',
] as const;
export const SKYLINES = [
  'none',
  'hills',
  'mountains',
  'trees',
  'dunes',
  'city',
  'sea',
  'mesa',
  'towers',
] as const;
export type SkyPreset = (typeof SKY_PRESETS)[number];

const sunSchema = z.union([
  z.literal('none'),
  z.strictObject({
    az: z.number().min(-360).max(360).describe('Bearing in degrees (0 = +x / east, 90 = +y)'),
    el: z.number().min(0).max(70).describe('Elevation in degrees above the horizon'),
    moon: z.boolean().default(false).describe('A crescent moon instead of the sun'),
  }),
]);

export const skySchema = z.strictObject({
  preset: z.enum(SKY_PRESETS).default('day'),
  clouds: z.number().min(0).max(1).optional().describe('Cloud cover 0..1 (default per preset)'),
  sun: sunSchema.optional().describe("{ az, el, moon } or 'none' (default per preset)"),
  stars: z.boolean().optional().describe('Stars (default: night and space)'),
  skyline: z.enum(SKYLINES).default('hills').describe('Silhouette on the horizon'),
  skylineHeight: z
    .number()
    .min(0)
    .max(0.5)
    .default(0.08)
    .describe('Height of the skyline (0.08 = low hills)'),
  ground: z
    .string()
    .optional()
    .describe(
      "Texture of the ground beyond the grid (default the level's floor; 'none' = sky below too)",
    ),
  drift: z.number().min(0).max(0.2).default(0.01).describe('Cloud drift, radians per second'),
});
export type SkyInput = z.input<typeof skySchema>;
export type Sky = z.output<typeof skySchema>;

export interface SkyLight {
  readonly tint: Rgb;
  /** Fog colour: the haze at the horizon. */
  readonly fog: Rgb;
  readonly density: number;
  readonly ambient: number;
}

/** Light of the level's own room under each sky. */
export const SKY_LIGHT: Readonly<Record<SkyPreset, SkyLight>> = {
  day: { tint: [1.04, 1.02, 0.97], fog: [190, 196, 196], density: 0.03, ambient: 0.92 },
  dawn: { tint: [1.08, 0.96, 0.86], fog: [216, 185, 143], density: 0.04, ambient: 0.7 },
  dusk: { tint: [1.12, 0.86, 0.76], fog: [110, 72, 80], density: 0.045, ambient: 0.5 },
  night: { tint: [0.72, 0.82, 1.08], fog: [13, 20, 40], density: 0.07, ambient: 0.2 },
  overcast: { tint: [0.95, 0.98, 1.0], fog: [135, 129, 123], density: 0.06, ambient: 0.68 },
  space: { tint: [1.0, 1.0, 1.04], fog: [8, 7, 10], density: 0.01, ambient: 0.55 },
  underwater: { tint: [0.84, 0.98, 1.04], fog: [40, 62, 104], density: 0.07, ambient: 0.8 },
};

/** Defaults per preset: [clouds, stars, sun]. */
export const SKY_DEFAULTS: Readonly<
  Record<SkyPreset, readonly [number, boolean, z.output<typeof sunSchema>]>
> = {
  day: [0.35, false, { az: 40, el: 28, moon: false }],
  dawn: [0.3, false, { az: 0, el: 4, moon: false }],
  dusk: [0.4, false, { az: 180, el: 3, moon: false }],
  night: [0.15, true, { az: 30, el: 22, moon: true }],
  overcast: [0.9, false, 'none'],
  space: [0, true, 'none'],
  underwater: [0, false, 'none'],
};
