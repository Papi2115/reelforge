/**
 * `kit.env.void`: the "empty stage" backdrop - a near-black dithered gradient sky with a seeded
 * cloud of floating cubes and crystal shards around a clear centre for the subject.
 */
import { z } from 'zod';
import { createKitObject } from '../object.js';
import { defineEnv } from '../registry.js';
import { debrisCount, layoutLabel, toneOf } from '../variation/ambient.js';
import { buildFloatingCubes, buildShards, floatingCubesParams } from './floating.js';
import { asEnv, pickColor } from './shared.js';
import { buildSky, skyParams } from './sky.js';

const tuple3 = z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]);

export const voidParams = z.object({
  seed: z.number().int().default(0).describe('Layout variant (same seed = same layout)'),
  cubes: z.number().int().min(0).max(400).default(36).describe('Number of floating cubes'),
  shards: z.number().int().min(0).max(400).default(18).describe('Number of crystal shards'),
  area: tuple3
    .default([20, 10, 20])
    .describe('[diameter x, height, diameter z] of the debris cloud, centred on the origin'),
  clear: z
    .number()
    .min(0)
    .default(3)
    .describe('Keep-out radius around the y axis, so debris stays off the subject'),
  stars: z.number().int().min(0).max(2000).default(60).describe('Faint stars in the backdrop'),
  drift: z.number().default(0.05).describe('Orbit speed of the debris in rad/s'),
});

export const voidScene = defineEnv({
  name: 'void',
  description:
    'Empty dark stage: near-black dithered gradient sky, seeded floating cubes and crystal shards drifting around a clear centre (the subject goes at the origin). For abstract or "nothing but the idea" shots. Call env.update(t) every frame.',
  params: voidParams,
  anchors: { top: 'the origin (centre of the clear stage)' },
  build(params, tools) {
    const { palette, variation } = tools;
    const tone = (chain: readonly string[]): string => toneOf(variation, pickColor(palette, chain));
    const sky = buildSky(
      skyParams.parse({ style: 'void', stars: params.stars, starColor: 'textDim' }),
      tools,
    );
    const [, height] = params.area;
    const cubes = buildFloatingCubes(
      floatingCubesParams.parse({
        count: Math.max(1, params.cubes),
        seed: params.seed,
        area: params.area,
        clear: params.clear,
        size: [0.15, 0.6],
        colors: [
          tone(['indigo', 'slate', 'plum', 'groundAlt']),
          tone(['violet', 'steel', 'mauve', 'ground']),
          'accent1',
          'accent4',
        ],
        glow: 0.2,
        drift: params.drift,
      }),
      tools,
    );
    cubes.position.y = -height / 2;
    cubes.visible = params.cubes > 0;
    const shardRng = tools.rng.fork(layoutLabel(variation, `shards:${String(params.seed)}`));
    const shards = buildShards(tools, shardRng, {
      count: debrisCount(variation, Math.max(1, params.shards), 1),
      colors: [
        tone(['slateGrey', 'ash', 'ice', 'textDim']),
        tone(['teal', 'tealDark', 'cornflower', 'accent3']),
        'heroTrim',
      ],
      area: { area: params.area, clear: params.clear, size: [0.12, 0.3], spin: 0.6 },
      motion: { drift: -params.drift * 0.7, bob: 0.35 },
    });
    shards.mesh.position.y = -height / 2;
    shards.mesh.visible = params.shards > 0;
    const object = createKitObject(tools.three, {
      kitType: 'void',
      anchors: { top: [0, 0, 0] },
    });
    object.add(sky, cubes, shards.mesh);
    return asEnv(object, (t) => {
      sky.update(t);
      cubes.update(t);
      shards.pose(t);
    });
  },
});
