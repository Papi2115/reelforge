/**
 * `kit.env.blockCity`: a seeded voxel city - street grid, blocks of four lots, towers with lit
 * and dark window columns, rooftop antennas, small parks on empty lots. One greedy mesh.
 */
import { z } from 'zod';
import { createKitObject } from '../object.js';
import { defineEnv } from '../registry.js';
import { toneOf } from '../variation/ambient.js';
import type { VoxelColor } from '../voxel/model.js';
import { asEnv, hashCell, pickColor, voxels } from './shared.js';

const CITY_VOXEL = 0.25;
const STREET = 2;
const LOT = 5;
/** Building footprint inside a lot; the rest is an alley. */
const FOOTPRINT = 4;
const BLOCK = STREET + 2 * LOT;
const ANTENNA = 3;

export const blockCityParams = z.object({
  seed: z.number().int().default(0).describe('Layout variant (same seed = same city)'),
  density: z
    .number()
    .min(0)
    .max(1)
    .default(0.8)
    .describe('Share of lots with a building (the rest are small parks)'),
  blocks: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .describe('City blocks per side (3 units each)'),
  maxHeight: z.number().min(1).max(20).default(6).describe('Tallest tower in units'),
  minHeight: z.number().min(0.5).max(20).default(1).describe('Lowest building in units'),
  windows: z.number().min(0).max(1).default(0.45).describe('Share of lit windows'),
});

type CityParams = z.output<typeof blockCityParams>;

/** Palette slots (1-based model indices). */
const SLOT = {
  street: 1,
  lot: 2,
  grass: 3,
  trunk: 4,
  bodyFirst: 5,
  window: 9,
  windowAlt: 10,
  windowDark: 11,
  antenna: 12,
  antennaTip: 13,
} as const;
const BODY_COUNT = 4;

interface Lot {
  readonly height: number;
  readonly body: number;
}

function cityLots(params: CityParams, random: () => number, lotsPerSide: number): (Lot | null)[] {
  const maxH = voxels(params.maxHeight, CITY_VOXEL);
  const minH = Math.min(maxH, voxels(params.minHeight, CITY_VOXEL));
  const centre = (lotsPerSide - 1) / 2;
  const lots: (Lot | null)[] = [];
  for (let lz = 0; lz < lotsPerSide; lz += 1) {
    for (let lx = 0; lx < lotsPerSide; lx += 1) {
      const built = random() < params.density;
      const roll = random();
      const body = SLOT.bodyFirst + Math.floor(random() * BODY_COUNT);
      if (!built) {
        lots.push(null);
        continue;
      }
      // Downtown: taller towers near the centre.
      const distance = Math.hypot(lx - centre, lz - centre) / Math.max(1, centre * Math.SQRT2);
      const share = roll * roll * (1 - 0.6 * distance);
      lots.push({ height: minH + Math.round((maxH - minH) * share), body });
    }
  }
  return lots;
}

/** Position along one axis -> lot index, offset inside the lot (-1 on streets). */
function lotAxis(value: number): { lot: number; inside: number } {
  const inBlock = value % BLOCK;
  if (inBlock < STREET) return { lot: -1, inside: -1 };
  const offset = inBlock - STREET;
  return { lot: Math.floor(value / BLOCK) * 2 + Math.floor(offset / LOT), inside: offset % LOT };
}

export const blockCity = defineEnv({
  name: 'blockCity',
  description:
    'Seeded voxel city: street grid, towers with lit window columns and antennas, parks on empty lots; taller downtown. Use as a miniature for top-down or orbit shots (a 2-unit hero is about 2 floors tall). Static.',
  params: blockCityParams,
  anchors: {
    top: 'street level at the street crossing nearest the centre',
    street: 'same as top',
  },
  build(params, tools) {
    const { palette } = tools;
    const lotsPerSide = params.blocks * 2;
    const size = params.blocks * BLOCK + STREET;
    const maxH = voxels(params.maxHeight, CITY_VOXEL);
    const sizeY = 1 + maxH + ANTENNA;
    const seed = tools.rng.fork(`seed:${String(params.seed)}`);
    const lots = cityLots(params, seed, lotsPerSide);
    // Ambient variation (PLAN.md#12.8) re-rolls the lit windows and tones the tower bodies; the
    // street layout stays the scene's.
    const windowSeed = (seed.int(0, 0x7fffffff) ^ (tools.variation?.layout ?? 0)) >>> 0;
    const body = (chain: readonly string[]): string =>
      toneOf(tools.variation, pickColor(palette, chain));
    const colors: VoxelColor[] = [
      pickColor(palette, ['shadow']),
      'ground',
      'accent3',
      body(['darkSlate', 'charcoal', 'umber', 'shadow']),
      body(['darkSlate', 'slate', 'plum', 'groundAlt']),
      body(['slateGrey', 'steel', 'mauve', 'textDim']),
      body(['slateBlue', 'charcoal', 'dusk', 'groundAlt']),
      'groundAlt',
      { color: 'keyLight', glow: true },
      { color: 'accent1', glow: true },
      'shadow',
      'textDim',
      { color: 'accent2', glow: true },
    ];
    const tallest = maxH * 0.7;
    const fill = (x: number, y: number, z: number): number => {
      const ax = lotAxis(x);
      const az = lotAxis(z);
      const onStreet = ax.lot < 0 || az.lot < 0 || x >= size - STREET || z >= size - STREET;
      if (y === 0) return onStreet ? SLOT.street : SLOT.lot;
      if (onStreet || ax.inside >= FOOTPRINT || az.inside >= FOOTPRINT) return 0;
      const lot = lots[az.lot * lotsPerSide + ax.lot];
      const middleX = ax.inside === 1 || ax.inside === 2;
      const middleZ = az.inside === 1 || az.inside === 2;
      if (!lot) {
        if (y === 1) return SLOT.grass;
        if (middleX && middleZ && y <= 3) return y === 3 ? SLOT.grass : SLOT.trunk;
        return 0;
      }
      if (y > lot.height) {
        const antenna = lot.height >= tallest && ax.inside === 1 && az.inside === 1;
        if (!antenna || y > lot.height + ANTENNA) return 0;
        return y === lot.height + ANTENNA ? SLOT.antennaTip : SLOT.antenna;
      }
      const facade = ax.inside === 0 || ax.inside === 3 || az.inside === 0 || az.inside === 3;
      const windowCell = facade && (middleX || middleZ) && y % 2 === 0 && y < lot.height;
      if (!windowCell) return lot.body;
      const roll = hashCell(x, y, z, windowSeed);
      if (roll >= params.windows) return SLOT.windowDark;
      return roll < params.windows * 0.2 ? SLOT.windowAlt : SLOT.window;
    };
    const model = tools.voxel.generate([size, sizeY, size], fill, colors);
    const mesh = tools.voxel.mesh(model, { voxelSize: CITY_VOXEL });
    const crossing = Math.round(size / 2 / BLOCK) * BLOCK + 1;
    const street = (crossing - size / 2) * CITY_VOXEL;
    const object = createKitObject(tools.three, {
      kitType: 'blockCity',
      anchors: { top: [street, CITY_VOXEL, street], street: [street, CITY_VOXEL, street] },
    });
    object.add(mesh);
    return asEnv(object);
  },
});
