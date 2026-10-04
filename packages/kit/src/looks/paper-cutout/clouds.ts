/**
 * `kit.props.paperClouds`: scalloped paper clouds (a flat base and three or four bumps, torn
 * rims) drifting sideways on the stop-motion clock and wrapping around the strip, bobbing a pixel
 * now and then like a hand-moved cut-out.
 */
import { z } from 'zod';
import { hashCell } from '../../env/shared.js';
import { defineProp } from '../../registry.js';
import type { PaperColors } from './colors.js';
import { seedParam, toneParam } from './landscape.js';
import { finishPaper, PAPER_GRAIN } from './paper.js';
import { createPiece, type PieceModel, type PosedPart } from './piece.js';
import { createSprite, fillEllipse, fillRect, type Point, type Sprite } from './sprite.js';

function cutCloud(colors: PaperColors, tone: number, width: number, seed: number): Sprite {
  const height = Math.ceil(width * 0.45);
  const sprite = createSprite(width + 2, height + 2);
  const bottom = height - 1;
  fillRect(sprite, width * 0.12, bottom - width * 0.12, width * 0.76, width * 0.12, tone);
  const bumps = 3 + Math.floor(hashCell(1, 2, 3, seed) * 2);
  for (let index = 0; index < bumps; index += 1) {
    const k = (index + 0.5) / bumps;
    const r =
      width * (0.13 + 0.09 * Math.sin(k * Math.PI)) * (0.85 + 0.3 * hashCell(index, 1, 9, seed));
    fillEllipse(sprite, 1 + width * (0.12 + 0.76 * k), bottom - r * 0.9, r * 1.1, r, tone);
  }
  finishPaper(sprite, colors, { rim: 'torn', grain: PAPER_GRAIN, seed });
  return sprite;
}

export const paperClouds = defineProp({
  name: 'paperClouds',
  description:
    'Scalloped paper clouds drifting sideways on the stop-motion clock (they wrap around). Usually layer 1, in front of the sky.',
  params: z.object({
    count: z.int().min(1).max(8).default(3),
    band: z
      .tuple([z.number(), z.number()])
      .default([30, 120])
      .describe('y range of the clouds (640x360 px)'),
    size: z.number().min(16).max(240).default(70).describe('Cloud width (640x360 px), +-25 %'),
    drift: z.number().min(-60).max(60).default(6).describe('Drift in px per second (+ = right)'),
    tone: toneParam('paper'),
    seed: seedParam,
  }),
  anchors: { 'cloud<i>': 'Centre of cloud i' },
  build: (params, tools) =>
    createPiece(
      tools,
      cloudsModel({
        ...params,
        tone: params.tone ?? 'paper',
        seed: params.seed ?? tools.rng.int(0, 99_999),
      }),
    ),
});

export interface CloudsOptions {
  readonly count: number;
  readonly band: readonly [number, number];
  readonly size: number;
  readonly drift: number;
  readonly tone: string;
  readonly seed: number;
}

/** The drifting clouds model (paperClouds and the stage's day sky). */
export function cloudsModel(options: CloudsOptions): PieceModel {
  return {
    kitType: 'paperClouds',
    placement: { layer: 1, x: 0, y: 0 },
    bind: (context) => {
      const { s, colors, clock } = context;
      const tone = colors.index(options.tone);
      const span = context.width + context.margin * 2;
      const clouds = Array.from({ length: options.count }, (_, index) => {
        const width = Math.round(
          options.size * s * (0.75 + 0.5 * hashCell(index, 3, 1, options.seed)),
        );
        const sprite = cutCloud(colors, tone, width, options.seed + index * 13);
        const [top, low] = options.band;
        return {
          sprite,
          start: ((index + hashCell(index, 5, 1, options.seed) * 0.6) / options.count) * span,
          y: (top + (low - top) * hashCell(index, 7, 1, options.seed)) * s,
        };
      });
      return (t) => {
        const frame = clock.frame(t);
        const travel = options.drift * s * clock.time(t);
        const parts: PosedPart[] = [];
        const anchors: Record<string, { x: number; y: number }> = {};
        clouds.forEach((cloud, index) => {
          const wrapped = (((cloud.start + travel) % span) + span) % span;
          const x = Math.round(wrapped - context.margin) - context.originX;
          const y = Math.round(cloud.y + clock.jitter(frame, index, 1));
          const pivot: Point = [cloud.sprite.width / 2, cloud.sprite.height / 2];
          parts.push({ sprite: cloud.sprite, x, y, pivot });
          anchors[`cloud${String(index)}`] = { x, y };
        });
        return { parts, anchors };
      };
    },
  };
}
