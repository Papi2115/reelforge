/**
 * `art.backdrop` (PLAN.md#13.15a): the establishing shot composed from the terrain and place
 * generators by preset (forest, meadow, mountains, ocean, underwater, desert, city, village, room,
 * station, space, night). A backdrop is also the placeholder of a panel whose subject has not
 * arrived yet (never an empty panel).
 */
import { z } from 'zod';
import type { ComicPen } from '../page/pen.js';
import { parseArt, seedSchema } from './common.js';
import { buildingSchema, drawBuilding } from './gen-buildings.js';
import { drawSeaweed, seaweedSchema } from './gen-undergrowth.js';
import { interiorSchema, drawInterior, spaceSchema, drawSpace } from './gen-places.js';
import {
  drawDunes,
  drawForest,
  drawSkyline,
  dunesSchema,
  forestSchema,
  skylineSchema,
} from './gen-terrain-rows.js';
import {
  boxSchema,
  drawHills,
  drawLand,
  drawSea,
  drawSky,
  hillsSchema,
  landSchema,
  seaSchema,
  skySchema,
  type Box,
} from './gen-terrain.js';

export const BACKDROPS = [
  'forest',
  'meadow',
  'mountains',
  'ocean',
  'underwater',
  'desert',
  'city',
  'village',
  'room',
  'station',
  'space',
  'night',
] as const;

export const backdropSchema = z.strictObject({
  preset: z.enum(BACKDROPS).default('meadow'),
  box: boxSchema,
  time: z
    .enum(['day', 'dawn', 'dusk', 'night'])
    .optional()
    .describe('Light of an outdoor backdrop'),
  horizon: z.number().min(0.2).max(0.9).optional(),
  seed: seedSchema,
  t: z.number().optional(),
});

type Layer = readonly [name: string, options: Record<string, unknown>];

/** The layers of a preset, back to front. */
export function backdropLayers(o: z.output<typeof backdropSchema>): Layer[] {
  const time = o.time ?? (o.preset === 'night' ? 'night' : o.preset === 'city' ? 'dusk' : 'day');
  const lit = time === 'night' || time === 'dusk';
  const common = { box: o.box, seed: o.seed };
  const sky = (extra: Record<string, unknown> = {}): Layer => [
    'sky',
    { ...common, kind: time, t: o.t, sun: time === 'day', moon: time === 'night', ...extra },
  ];
  const h = (fallback: number) => o.horizon ?? fallback;
  switch (o.preset) {
    case 'forest':
      return [
        sky({ horizon: h(0.7) }),
        ['hills', { ...common, horizon: h(0.7), layers: 1 }],
        ['forest', { ...common, horizon: h(0.7) + 0.06, rows: 2, kind: 'mixed', t: o.t }],
        ['land', { ...common, horizon: h(0.7) + 0.06, kind: 'meadow' }],
      ];
    case 'meadow':
      return [
        sky({ horizon: h(0.6) }),
        ['hills', { ...common, horizon: h(0.6) }],
        ['land', { ...common, horizon: h(0.6), kind: 'meadow' }],
      ];
    case 'mountains':
      return [
        sky({ horizon: h(0.66) }),
        [
          'hills',
          { ...common, horizon: h(0.66), peaks: true, snow: true, fill: 'greyLight', height: 0.45 },
        ],
        ['land', { ...common, horizon: h(0.66), kind: 'rock' }],
      ];
    case 'ocean':
      return [sky({ horizon: h(0.55) }), ['sea', { ...common, horizon: h(0.55), t: o.t }]];
    case 'underwater':
      return [
        ['sky', { ...common, kind: 'underwater', horizon: h(0.8), t: o.t }],
        ['land', { ...common, kind: 'seabed', horizon: h(0.8) }],
        [
          'seaweed',
          {
            x: o.box[0] + o.box[2] * 0.12,
            y: o.box[1] + o.box[3],
            size: o.box[3] * 0.45,
            kind: 'kelp',
            seed: o.seed,
            t: o.t,
          },
        ],
        [
          'seaweed',
          {
            x: o.box[0] + o.box[2] * 0.86,
            y: o.box[1] + o.box[3],
            size: o.box[3] * 0.3,
            kind: 'coral',
            seed: o.seed,
          },
        ],
      ];
    case 'desert':
      return [sky({ horizon: h(0.6), clouds: 0 }), ['dunes', { ...common, horizon: h(0.6) }]];
    case 'city':
      return [
        sky({ horizon: h(0.7), clouds: 1 }),
        ['skyline', { ...common, horizon: h(0.7), lit }],
        ['land', { ...common, horizon: h(0.7), kind: 'road' }],
      ];
    case 'village':
      return [
        sky({ horizon: h(0.64) }),
        ['hills', { ...common, horizon: h(0.64), layers: 1 }],
        ['land', { ...common, horizon: h(0.64), kind: 'dirt' }],
        ...villageHouses(o.box, h(0.64), o.seed),
      ];
    case 'room':
      return [
        [
          'interior',
          { ...common, kind: 'room', window: lit ? 'night' : 'day', door: true, t: o.t },
        ],
      ];
    case 'station':
      return [['interior', { ...common, kind: 'module', window: 'earth', t: o.t }]];
    case 'space':
      return [['space', { ...common, planet: 'earth', t: o.t }]];
    case 'night':
      return [
        sky({ horizon: h(0.7), stars: 60 }),
        ['hills', { ...common, horizon: h(0.7), fill: 'night', layers: 2 }],
        ['land', { ...common, horizon: h(0.7), kind: 'meadow', fill: 'cyanDeep' }],
      ];
  }
}

function villageHouses(box: Box, horizon: number, seed: number | string): Layer[] {
  const [bx, by, bw, bh] = box;
  const y = by + bh * horizon + 4;
  return [0.1, 0.24, 0.88].map((u, i): Layer => [
    'building',
    {
      x: bx + bw * u,
      y,
      size: bh * (0.12 + (i % 2) * 0.03),
      kind: 'cottage',
      seed: `${String(seed)}${String(i)}`,
    },
  ]);
}

const LAYER_GENERATORS: Readonly<
  Record<string, { schema: z.ZodType; draw: (g: ComicPen, o: never) => unknown }>
> = {
  sky: { schema: skySchema, draw: drawSky },
  hills: { schema: hillsSchema, draw: drawHills },
  forest: { schema: forestSchema, draw: drawForest },
  land: { schema: landSchema, draw: drawLand },
  sea: { schema: seaSchema, draw: drawSea },
  dunes: { schema: dunesSchema, draw: drawDunes },
  skyline: { schema: skylineSchema, draw: drawSkyline },
  interior: { schema: interiorSchema, draw: drawInterior },
  space: { schema: spaceSchema, draw: drawSpace },
  building: { schema: buildingSchema, draw: drawBuilding },
  seaweed: { schema: seaweedSchema, draw: drawSeaweed },
};

export function drawBackdrop(g: ComicPen, o: z.output<typeof backdropSchema>): void {
  for (const [name, options] of backdropLayers(o)) {
    const layer = LAYER_GENERATORS[name];
    if (layer === undefined) continue;
    layer.draw(g, parseArt(layer.schema, options, `art.backdrop('${o.preset}') ${name}`) as never);
  }
}
