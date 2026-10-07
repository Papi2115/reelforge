/**
 * Texture generator of the Game B2 open layer: `{ gen: 'texture', kind, seed, ramp, wear, lit,
 * window }` -> a seamless 64x64 raycaster texture (walls, floors, ceilings, the ground of an
 * outdoor level). Water and lava are animated (3 frames); lit windows, hull lights and lava
 * cracks glow (not lit by the room, barely fogged).
 */
import { z } from 'zod';
import type { Bmp } from '../core/bitmap.js';
import { C } from '../palette.js';
import { texture, type Texture } from '../ray/texture.js';
import * as B from './gen-textures-built.js';
import * as N from './gen-textures-nature.js';
import { rampParam, seedParam } from './made.js';
import { rampOf, RAMPS, type Ramp } from './ramps.js';

export const TEXTURE_KINDS = [
  'grass',
  'sand',
  'mud',
  'snow',
  'rock',
  'ice',
  'foliage',
  'water',
  'lava',
  'tile',
  'planks',
  'brick',
  'stone',
  'cobble',
  'metal',
  'hull',
  'fabric',
  'logs',
  'thatch',
  'adobe',
  'facade',
  'glass',
] as const;
export type TextureKind = (typeof TEXTURE_KINDS)[number];

export const textureGenSchema = z.strictObject({
  gen: z.literal('texture'),
  kind: z.enum(TEXTURE_KINDS),
  seed: seedParam,
  ramp: rampParam
    .optional()
    .describe('Main ramp (default per kind: grass leaf, water sky, brick rust...)'),
  wear: z.number().min(0).max(1).default(0.3).describe('Dirt, cracks, moss, chips'),
  lit: z.number().min(0).max(1).default(0.35).describe('facade / glass: share of lit windows'),
  window: z
    .boolean()
    .default(false)
    .describe('stone / brick / metal / hull / adobe: a see-through window'),
});
export type TextureGenSpec = z.output<typeof textureGenSchema>;

export interface MadeTexture {
  readonly frames: readonly Texture[];
  readonly fps: number;
}

const SNOW: Ramp = [C.HAZE, C.MOON, C.PUTTY, C.PAPER];
const METAL: Ramp = [C.VOID, C.CHAR, C.SLATE, C.GREY, C.MOON];
const HULL: Ramp = [C.CHAR, C.SLATE, C.GREY, C.PUTTY, C.PAPER];

const DEFAULT_RAMP: Readonly<Record<TextureKind, Ramp>> = {
  grass: RAMPS.leaf,
  sand: RAMPS.earth,
  mud: RAMPS.earth,
  snow: SNOW,
  rock: RAMPS.stone,
  ice: RAMPS.sky,
  foliage: RAMPS.leaf,
  water: RAMPS.sky,
  lava: RAMPS.rust,
  tile: RAMPS.stone,
  planks: RAMPS.warm,
  brick: RAMPS.rust,
  stone: RAMPS.stone,
  cobble: RAMPS.stone,
  metal: METAL,
  hull: HULL,
  fabric: RAMPS.earth,
  logs: RAMPS.warm,
  thatch: RAMPS.earth,
  adobe: RAMPS.earth,
  facade: RAMPS.stone,
  glass: RAMPS.sky,
};

const GLOW: Readonly<Partial<Record<TextureKind, readonly number[]>>> = {
  lava: [C.BULB, C.TUNGSTEN],
  hull: [C.FLUO],
  facade: [C.BULB, C.TUNGSTEN],
  glass: [C.TUNGSTEN],
};

const ANIMATED: Readonly<Partial<Record<TextureKind, readonly [number, number]>>> = {
  water: [3, 3],
  lava: [3, 2],
};

function draw(kind: TextureKind, input: B.BuiltInput): Bmp {
  switch (kind) {
    case 'grass':
      return N.grass(input);
    case 'sand':
      return N.sand(input);
    case 'mud':
      return N.mud(input);
    case 'snow':
      return N.snow(input);
    case 'rock':
      return N.rock(input);
    case 'ice':
      return N.ice(input);
    case 'foliage':
      return N.foliage(input);
    case 'water':
      return N.water(input);
    case 'lava':
      return N.lava(input);
    case 'tile':
      return B.tiles(input);
    case 'planks':
      return B.planks(input);
    case 'brick':
      return B.masonry(input, false);
    case 'stone':
      return B.masonry(input, true);
    case 'cobble':
      return B.cobble(input);
    case 'metal':
      return B.metal(input, false);
    case 'hull':
      return B.metal(input, true);
    case 'fabric':
      return B.fabric(input);
    case 'logs':
      return B.logs(input);
    case 'thatch':
      return B.thatch(input);
    case 'adobe':
      return B.adobe(input);
    case 'facade':
      return B.facade(input);
    case 'glass':
      return B.glass(input);
  }
}

/** Paints a generated texture (every frame). */
export function makeTexture(spec: TextureGenSpec): MadeTexture {
  const [count, fps] = ANIMATED[spec.kind] ?? [1, 0];
  const ramp = spec.ramp === undefined ? DEFAULT_RAMP[spec.kind] : rampOf(spec.ramp);
  const glow = GLOW[spec.kind] ?? [];
  const frames = Array.from({ length: count }, (_, frame) =>
    texture(
      draw(spec.kind, {
        ramp,
        seed: spec.seed * 13 + 5,
        wear: spec.wear,
        frame,
        lit: spec.lit,
        window: spec.window,
      }),
      glow,
    ),
  );
  return { frames, fps };
}
