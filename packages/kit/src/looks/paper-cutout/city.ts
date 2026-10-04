/**
 * `kit.props.paperBuildings`: a city skyline strip of cut-paper buildings (flat, gabled, domed
 * roofs, antennas, water tanks) with punched windows. Each building is cut on its own and pasted
 * over its left neighbour with a 1-px inner shadow; a few windows switch on and off every two
 * seconds of the stop-motion clock.
 */
import { z } from 'zod';
import { hashCell } from '../../env/shared.js';
import { defineProp } from '../../registry.js';
import type { PaperColors } from './colors.js';
import { seedParam, toneParam } from './landscape.js';
import { finishPaper, PAPER_GRAIN } from './paper.js';
import { createPiece, memo, type PieceModel } from './piece.js';
import { createSprite, fillEllipse, fillPolygon, fillRect, stamp, type Sprite } from './sprite.js';

const ROOFS = ['flat', 'gable', 'dome', 'antenna', 'tank'] as const;

export interface BuildingsOptions {
  readonly count: number;
  /** Height range in 640x360 px. */
  readonly height: readonly [number, number];
  readonly tone: string;
  readonly roof: string;
  readonly window: string;
  /** Share of lit windows. */
  readonly lit: number;
  readonly seed: number;
}

interface Building {
  readonly x: number;
  readonly width: number;
  readonly height: number;
  readonly roof: (typeof ROOFS)[number];
  readonly tone: number;
}

function cutBuilding(
  colors: PaperColors,
  building: Building,
  options: BuildingsOptions,
  depth: number,
  s: number,
  frame: number,
  index: number,
): { sprite: Sprite; top: number } {
  const { width, height, roof, tone } = building;
  const extra = Math.ceil(26 * s);
  const sprite = createSprite(width, height + extra + depth);
  const top = extra;
  const roofTone = colors.index(options.roof);
  const mid = width / 2;
  if (roof === 'gable') {
    fillPolygon(
      sprite,
      [
        [-0.5, top + 1],
        [mid, top - width * 0.35],
        [width + 0.5, top + 1],
      ],
      roofTone,
    );
  } else if (roof === 'dome') {
    fillEllipse(sprite, mid, top + 1, width * 0.32, width * 0.3, roofTone);
  } else if (roof === 'antenna') {
    fillRect(sprite, mid - s, top - extra + 2, Math.max(1, Math.round(s)), extra, tone);
    fillRect(sprite, mid - 2 * s, top - extra + 2, Math.max(2, Math.round(3 * s)), 2, roofTone);
  } else if (roof === 'tank') {
    const tankWidth = Math.round(10 * s);
    fillRect(sprite, width * 0.25, top - 12 * s, tankWidth, 8 * s, roofTone);
    fillRect(sprite, width * 0.25 + 1, top - 4 * s, 1, 4 * s, tone);
    fillRect(sprite, width * 0.25 + tankWidth - 2, top - 4 * s, 1, 4 * s, tone);
  } else {
    fillRect(sprite, -1, top - 2 * s, width + 2, 2 * s, colors.shade[tone] ?? tone);
  }
  // The body goes over the roof's lower half (domes, tanks sit on top).
  fillRect(sprite, 0, top, width, height + depth, tone);
  finishPaper(sprite, colors, { rim: 'cut', grain: PAPER_GRAIN, seed: options.seed + index });
  const pane = Math.max(2, Math.round(3 * s));
  const step = pane * 3;
  const lit = colors.index(options.window);
  const dark = colors.shade[tone] ?? tone;
  const columns = Math.max(1, Math.floor((width - pane * 2) / step));
  const offset = Math.round((width - (columns * step - (step - pane))) / 2);
  const period = Math.floor(frame / 16);
  for (let row = 0; top + pane * 2 + row * (pane * 4) < top + height - pane; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const toggles = hashCell(column, row, index, options.seed + 7) < 0.08;
      const flip = toggles && hashCell(column, row, period, options.seed) < 0.5;
      const on = hashCell(column, row, index, options.seed) < options.lit !== flip;
      fillRect(
        sprite,
        offset + column * step,
        top + pane * 2 + row * pane * 4,
        pane,
        pane * 2,
        on ? lit : dark,
      );
    }
  }
  return { sprite, top };
}

/** Skyline strip `stripWidth` wide; buildings stand on `base` px from the sprite top. */
function cutSkyline(
  colors: PaperColors,
  options: BuildingsOptions,
  stripWidth: number,
  depth: number,
  s: number,
  frame: number,
): { sprite: Sprite; base: number; tallest: readonly [number, number] } {
  const [low, high] = options.height;
  const main = colors.index(options.tone);
  const tones = [main, colors.shade[main] ?? main, colors.light[main] ?? main];
  const buildings: Building[] = [];
  let x = -Math.round(10 * s);
  let index = 0;
  while (x < stripWidth) {
    const width = Math.round(
      (stripWidth / options.count) * (0.55 + 0.6 * hashCell(index, 1, 2, options.seed)),
    );
    const height = Math.round((low + (high - low) * hashCell(index, 3, 4, options.seed)) * s);
    const roof = ROOFS[Math.floor(hashCell(index, 5, 6, options.seed) * ROOFS.length)] ?? 'flat';
    const variant = hashCell(index, 7, 8, options.seed) < 0.85 ? 1 : 2;
    const tone = tones[index % 2 === 0 ? 0 : variant] ?? main;
    buildings.push({ x, width: Math.max(Math.round(18 * s), width), height, roof, tone });
    x += Math.max(Math.round(18 * s), width) - Math.round(4 * s);
    index += 1;
  }
  const tallestHeight = Math.max(...buildings.map((building) => building.height));
  const base = tallestHeight + Math.ceil(26 * s);
  const sprite = createSprite(stripWidth, base + depth);
  let tallest: readonly [number, number] = [0, 0];
  const centre = stripWidth / 2;
  buildings.forEach((building, position) => {
    const cut = cutBuilding(colors, building, options, depth, s, frame, position);
    stamp(sprite, cut.sprite, building.x, base - building.height - cut.top, colors.shade, [
      -Math.max(1, Math.round(s)),
      0,
    ]);
    const mid = building.x + building.width / 2 - centre;
    if (Math.abs(mid) < 200 * s && -building.height < tallest[1]) tallest = [mid, -building.height];
  });
  return { sprite, base, tallest };
}

export function buildingsModel(options: BuildingsOptions, layer = 2, y = 260): PieceModel {
  return {
    kitType: 'paperBuildings',
    placement: { layer, x: 320, y },
    bind: (context) => {
      const { s, colors, clock } = context;
      const stripWidth = context.width + context.margin * 2;
      const depth = context.below;
      const cut = memo((key) =>
        cutSkyline(colors, options, stripWidth, depth, s, Number(key) * 16),
      );
      return (t) => {
        const skyline = cut(String(Math.floor(clock.frame(t) / 16)));
        return {
          parts: [{ sprite: skyline.sprite, x: 0, y: 0, pivot: [stripWidth / 2, skyline.base] }],
          anchors: { tallest: { x: skyline.tallest[0], y: skyline.tallest[1] } },
        };
      };
    },
  };
}

export const paperBuildings = defineProp({
  name: 'paperBuildings',
  description:
    'A city skyline strip of cut-paper buildings with punched windows (some switch on and off), spanning the frame. y = street line.',
  params: z.object({
    count: z.int().min(3).max(16).default(8).describe('Buildings across the strip (about)'),
    height: z
      .tuple([z.number().min(10).max(300), z.number().min(10).max(300)])
      .default([50, 130])
      .describe('Height range (640x360 px)'),
    tone: toneParam('stone'),
    roof: toneParam('heroDark'),
    window: toneParam('sun'),
    lit: z.number().min(0).max(1).default(0.35).describe('Share of lit windows'),
    seed: seedParam,
  }),
  anchors: { tallest: 'Roof of the tallest building near the frame centre' },
  build: (params, tools) =>
    createPiece(
      tools,
      buildingsModel({
        ...params,
        tone: params.tone ?? 'stone',
        roof: params.roof ?? 'heroDark',
        window: params.window ?? 'sun',
        seed: params.seed ?? tools.rng.int(0, 99_999),
      }),
    ),
});
