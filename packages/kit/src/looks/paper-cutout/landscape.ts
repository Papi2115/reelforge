/**
 * Landscape pieces of the paper look: torn hill strips, rows of cut-out trees that sway on the
 * stop-motion clock, and scalloped clouds that drift across the sky. Strips span the frame plus
 * the stage margin, so camera pans never reveal their ends.
 */
import { z } from 'zod';
import { hashCell } from '../../env/shared.js';
import { defineProp } from '../../registry.js';
import type { PaperColors } from './colors.js';
import { finishPaper, PAPER_GRAIN, tearPolygon, tornOffset } from './paper.js';
import { createPiece, memo, type PieceModel, type PosedPart } from './piece.js';
import {
  createSprite,
  fillEllipse,
  fillPolygon,
  transform,
  type Point,
  type Sprite,
} from './sprite.js';

export const seedParam = z
  .int()
  .min(0)
  .max(99_999)
  .optional()
  .describe('Seed of the cut (shapes, positions); default: a seed of its own per call');

export const toneParam = (fallback: string) =>
  z
    .string()
    .optional()
    .describe(`Paper colour: a palette name or a look role (default: ${fallback})`);

export const HILL_KINDS = ['rolling', 'peaks', 'dunes', 'flat'] as const;
export type HillKind = (typeof HILL_KINDS)[number];

const TAU = Math.PI * 2;

/** Ridge height (0..1) of a hill kind at u (one bump per unit), seeded phase. */
function ridge(kind: HillKind, u: number, seed: number): number {
  const phase = hashCell(seed, 1, 1, 0) * TAU;
  const wave = 0.5 + 0.5 * Math.sin(u * TAU + phase);
  const second = 0.5 + 0.5 * Math.sin(u * TAU * 2.3 + phase * 1.7);
  if (kind === 'peaks') return Math.abs(Math.sin(u * Math.PI + phase)) * 0.75 + second * 0.25;
  if (kind === 'dunes') {
    const k = (u + phase) % 1;
    return (k < 0.7 ? k / 0.7 : (1 - k) / 0.3) * 0.8 + second * 0.2;
  }
  if (kind === 'flat') return 0.3 * wave + 0.15 * second;
  return 0.65 * wave + 0.35 * second;
}

export interface HillsSpec {
  readonly kind: HillKind;
  readonly tone: number;
  /** Bump height and width in frame pixels. */
  readonly height: number;
  readonly width: number;
  readonly seed: number;
}

/** A hill strip `stripWidth` wide whose ridge baseline is `base` px from the top; fills to `bottom`. */
export function cutHills(
  spec: HillsSpec,
  colors: PaperColors,
  stripWidth: number,
  bottom: number,
  s: number,
): { sprite: Sprite; base: number; peak: Point } {
  const top = Math.ceil(spec.height + 8 * s);
  const sprite = createSprite(stripWidth, top + bottom);
  const centre = stripWidth / 2;
  const ridgeY = new Float64Array(sprite.width);
  let peak: Point = [0, 0];
  for (let x = 0; x < sprite.width; x += 1) {
    const lift = ridge(spec.kind, x / Math.max(8, spec.width), spec.seed) * spec.height;
    const y = Math.round(top - lift + tornOffset(x, 1.6 * s, spec.seed));
    ridgeY[x] = y;
    if (Math.abs(x - centre) <= 160 * s && y - top < peak[1]) peak = [x - centre, y - top];
    for (let row = Math.max(0, y); row < sprite.height; row += 1) {
      sprite.data[row * sprite.width + x] = spec.tone;
    }
  }
  if (spec.kind === 'flat') {
    // Grass tufts cut along the edge: three blades each, every 14-34 px.
    for (
      let x = 6 * s;
      x < sprite.width - 6 * s;
      x += (14 + 20 * hashCell(x, 3, 3, spec.seed)) * s
    ) {
      const ground = (ridgeY[Math.round(x)] ?? top) + 2 * s;
      for (const [dx, h] of [
        [-2.5, 4],
        [0, 6],
        [2.5, 4.5],
      ] as const) {
        const tip = ground - h * s * (0.7 + 0.6 * hashCell(x, dx, 5, spec.seed));
        fillPolygon(
          sprite,
          [
            [x + (dx - 1.2) * s, ground],
            [x + (dx * 1.6 + 0.3) * s, tip],
            [x + (dx + 1.2) * s, ground],
          ],
          spec.tone,
        );
      }
    }
  }
  finishPaper(sprite, colors, { rim: 'torn', grain: PAPER_GRAIN, seed: spec.seed });
  return { sprite, base: top, peak };
}

export const paperHills = defineProp({
  name: 'paperHills',
  description:
    'A strip of torn-paper hills spanning the frame (rolling, peaks, dunes or flat ground). Add it to a paper stage on a depth layer; y = ridge baseline.',
  params: z.object({
    kind: z.enum(HILL_KINDS).default('rolling').describe('Ridge shape'),
    tone: toneParam('greenMid'),
    height: z.number().min(0).max(200).default(28).describe('Bump height (640x360 px)'),
    width: z.number().min(20).max(800).default(220).describe('Bump width (640x360 px)'),
    seed: seedParam,
  }),
  anchors: { peak: 'Highest point of the ridge (in the frame centre +-160 px)' },
  build: (params, tools) =>
    createPiece(
      tools,
      hillsModel({
        ...params,
        tone: params.tone ?? 'greenMid',
        seed: params.seed ?? tools.rng.int(0, 99_999),
      }),
    ),
});

export interface HillsOptions {
  readonly kind: HillKind;
  /** Palette or role name. */
  readonly tone: string;
  /** Bump height and width in 640x360 px. */
  readonly height: number;
  readonly width: number;
  readonly seed: number;
}

/** The hill strip model (paperHills and the stage's built-in scenery). */
export function hillsModel(options: HillsOptions, layer = 2, y = 250): PieceModel {
  return {
    kitType: 'paperHills',
    placement: { layer, x: 320, y },
    bind: (context) => {
      const { s, colors } = context;
      const stripWidth = context.width + context.margin * 2;
      const cut = cutHills(
        {
          kind: options.kind,
          tone: colors.index(options.tone),
          height: options.height * s,
          width: options.width * s,
          seed: options.seed,
        },
        colors,
        stripWidth,
        context.below,
        s,
      );
      const part: PosedPart = { sprite: cut.sprite, x: 0, y: 0, pivot: [stripWidth / 2, cut.base] };
      const peak = { x: cut.peak[0], y: cut.peak[1] };
      return () => ({ parts: [part], anchors: { peak } });
    },
  };
}

export const TREE_KINDS = ['round', 'pine', 'mixed'] as const;

function cutTree(
  colors: PaperColors,
  pine: boolean,
  height: number,
  crown: number,
  trunk: number,
  sway: number,
  seed: number,
): { sprite: Sprite; pivot: Point } {
  const width = Math.ceil(height * 0.8);
  const sprite = createSprite(width + 4, height + 4);
  const baseX = sprite.width / 2;
  const baseY = sprite.height - 1;
  const trunkWidth = Math.max(2, Math.round(height * 0.09));
  const trunkTop = baseY - height * (pine ? 0.3 : 0.45);
  const lean = (points: Point[]): Point[] => transform(points, sway, [baseX, baseY]);
  fillPolygon(
    sprite,
    lean([
      [baseX - trunkWidth / 2, baseY + 1],
      [baseX + trunkWidth / 2, baseY + 1],
      [baseX + trunkWidth / 2, trunkTop],
      [baseX - trunkWidth / 2, trunkTop],
    ]),
    trunk,
  );
  if (pine) {
    for (let tier = 0; tier < 3; tier += 1) {
      const bottom = baseY - height * (0.22 + tier * 0.22);
      const half = width * (0.42 - tier * 0.1);
      const tip = bottom - height * 0.36;
      fillPolygon(
        sprite,
        lean(
          tearPolygon(
            [
              [baseX - half, bottom],
              [baseX, tip],
              [baseX + half, bottom],
            ],
            0.8,
            seed + tier,
            3,
          ),
        ),
        crown,
      );
    }
  } else {
    const [cx, cy] = lean([[baseX, baseY - height * 0.62]])[0] ?? [baseX, baseY];
    const r = width * 0.3;
    fillEllipse(sprite, cx, cy, r * 1.25, r, crown);
    fillEllipse(sprite, cx - r * 0.7, cy + r * 0.25, r * 0.75, r * 0.7, crown);
    fillEllipse(sprite, cx + r * 0.7, cy + r * 0.2, r * 0.8, r * 0.72, crown);
    fillEllipse(sprite, cx + r * 0.1, cy - r * 0.6, r * 0.8, r * 0.7, crown);
  }
  finishPaper(sprite, colors, { rim: 'cut', grain: PAPER_GRAIN, seed });
  return { sprite, pivot: [baseX, baseY] };
}

export const paperTrees = defineProp({
  name: 'paperTrees',
  description:
    'A row of cut-paper trees (round, pine or mixed) that sway on the stop-motion clock. y = ground line of the trunks; put the next hill layer in front to hide the bases.',
  params: z.object({
    kind: z.enum(TREE_KINDS).default('mixed'),
    count: z.int().min(1).max(12).default(5),
    spread: z
      .tuple([z.number(), z.number()])
      .default([40, 600])
      .describe('x range of the row (640x360 px)'),
    height: z.number().min(10).max(220).default(48).describe('Tree height (640x360 px), +-20 %'),
    tone: toneParam('greenMid'),
    trunk: toneParam('wood'),
    sway: z.number().min(0).max(10).default(2).describe('Sway in degrees (0 = still)'),
    seed: seedParam,
  }),
  anchors: { 'tree<i>': 'Crown of tree i (0-based, left to right)' },
  build: (params, tools) =>
    createPiece(
      tools,
      treesModel({
        ...params,
        tone: params.tone ?? 'greenMid',
        trunk: params.trunk ?? 'wood',
        seed: params.seed ?? tools.rng.int(0, 99_999),
      }),
    ),
});

export interface TreesOptions {
  readonly kind: (typeof TREE_KINDS)[number];
  readonly count: number;
  readonly spread: readonly [number, number];
  readonly height: number;
  readonly tone: string;
  readonly trunk: string;
  readonly sway: number;
  readonly seed: number;
}

/** The tree row model (paperTrees and the stage's built-in hills). */
export function treesModel(options: TreesOptions, layer = 2, y = 250): PieceModel {
  return {
    kitType: 'paperTrees',
    placement: { layer, x: 0, y },
    bind: (context) => {
      const { s, colors, clock } = context;
      const crown = colors.index(options.tone);
      const trunk = colors.index(options.trunk);
      const [from, to] = options.spread;
      const trees = Array.from({ length: options.count }, (_, index) => {
        const k = options.count === 1 ? 0.5 : index / (options.count - 1);
        const jitter =
          (hashCell(index, 2, 3, options.seed) - 0.5) * ((to - from) / options.count) * 0.6;
        const pine =
          options.kind === 'pine' ||
          (options.kind === 'mixed' && hashCell(index, 4, 5, options.seed) < 0.5);
        const height = options.height * s * (0.8 + 0.4 * hashCell(index, 6, 7, options.seed));
        return {
          x: (from + (to - from) * k + jitter) * s - context.originX,
          y: (hashCell(index, 8, 9, options.seed) - 0.5) * 6 * s,
          pine,
          height,
          phase: hashCell(index, 10, 11, options.seed),
          cut: memo((key) =>
            cutTree(colors, pine, height, crown, trunk, Number(key), options.seed + index * 31),
          ),
        };
      });
      return (t) => {
        const time = clock.time(t);
        const parts: PosedPart[] = [];
        const anchors: Record<string, { x: number; y: number }> = {};
        trees.forEach((tree, index) => {
          const angle = Math.round(options.sway * Math.sin(TAU * (time * 0.4 + tree.phase)));
          const cut = tree.cut(String(angle));
          parts.push({ sprite: cut.sprite, x: tree.x, y: tree.y, pivot: cut.pivot });
          anchors[`tree${String(index)}`] = { x: tree.x, y: tree.y - tree.height * 0.62 };
        });
        return { parts, anchors };
      };
    },
  };
}
