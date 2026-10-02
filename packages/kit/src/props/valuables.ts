/** `kit.props.cash` (banded bill bricks or coin stacks) and `kit.props.suitcase` (briefcase / trolley). */
import { z } from 'zod';
import { hashCell } from '../env/shared.js';
import { defineProp } from '../registry.js';
import {
  asProp,
  colorField,
  DARK,
  DARKEST,
  GOLD,
  GOLD_DARK,
  GREEN,
  GREEN_DARK,
  gridPoint,
  METAL,
  pick,
  propShell,
  scaleParam,
  seedParam,
  setAnchors,
  SMALL_VOXEL,
} from './shared.js';
import { Sketch } from './sketch.js';

const BRICK = [20, 4, 10] as const;
const BRICKS_PER_LAYER = 4;
const COIN_RADIUS = 3.5;

export const cashParams = z.object({
  kind: z
    .enum(['bills', 'coins'])
    .default('bills')
    .describe('bills: banded bill bricks; coins: stacks of coins'),
  count: z
    .number()
    .int()
    .min(1)
    .max(24)
    .default(6)
    .describe('Number of bill bricks (stacked 4 per layer) or coin stacks'),
  seed: seedParam,
  scale: scaleParam,
});

type CashSlot = 'bill' | 'billDark' | 'billLight' | 'band' | 'gold' | 'goldDark';

function drawBrick(sketch: Sketch<CashSlot>, x0: number, y0: number, z0: number): void {
  const [bx, by, bz] = BRICK;
  sketch.box('bill', [x0, y0, z0], [x0 + bx, y0 + by, z0 + bz]);
  for (let y = 1; y < by; y += 2)
    sketch.paint('billLight', [x0, y0 + y, z0], [x0 + bx, y0 + y + 1, z0 + bz]);
  const top = y0 + by - 1;
  sketch.paint('billDark', [x0, top, z0], [x0 + bx, top + 1, z0 + bz]);
  sketch.paint('bill', [x0 + 1, top, z0 + 1], [x0 + bx - 1, top + 1, z0 + bz - 1]);
  for (const cx of [x0 + 4, x0 + bx - 4]) {
    for (let z = z0 + 3; z < z0 + bz - 3; z += 1)
      sketch.paint('billLight', [cx - 1, top, z], [cx + 1, top + 1, z + 1]);
  }
  sketch.paint('band', [x0 + 8, y0, z0], [x0 + 12, y0 + by, z0 + bz]);
}

function bills(
  count: number,
  seed: number,
  sketch: (size: [number, number, number]) => Sketch<CashSlot>,
): Sketch<CashSlot> {
  const layers = Math.ceil(count / BRICKS_PER_LAYER);
  const canvas = sketch([2 * BRICK[0] + 3, layers * BRICK[1], 2 * BRICK[2] + 3]);
  for (let index = 0; index < count; index += 1) {
    const layer = Math.floor(index / BRICKS_PER_LAYER);
    const slot = index % BRICKS_PER_LAYER;
    const jitter = (axis: number): number =>
      layer === 0 ? 0 : Math.round(hashCell(index, axis, 3, seed) * 2 - 1);
    const x = 1 + (slot % 2) * (BRICK[0] + 1) + jitter(0);
    const z = 1 + Math.floor(slot / 2) * (BRICK[2] + 1) + jitter(1);
    drawBrick(canvas, x, layer * BRICK[1], z);
  }
  return canvas;
}

function coins(
  count: number,
  seed: number,
  sketch: (size: [number, number, number]) => Sketch<CashSlot>,
): Sketch<CashSlot> {
  const columns = Math.min(3, count);
  const rows = Math.ceil(count / columns);
  const heights = Array.from(
    { length: count },
    (_, index) => 2 + Math.floor(hashCell(index, 0, 5, seed) * 9),
  );
  const canvas = sketch([columns * 8 + 5, Math.max(...heights), rows * 7 + 2]);
  heights.forEach((height, index) => {
    const row = Math.floor(index / columns);
    const cx = 4 + (index % columns) * 8 + (row % 2) * 4;
    const cz = 4.5 + row * 7;
    for (let y = 0; y < height; y += 1) {
      canvas.cylinderY(y % 2 === 0 ? 'gold' : 'goldDark', [cx, cz], COIN_RADIUS, y, y + 1);
    }
    canvas.cylinderY('goldDark', [cx, cz], 1.6, height - 1, height);
  });
  return canvas;
}

export const cash = defineProp({
  name: 'cash',
  description:
    'Money: banded bill bricks stacked in a pile (~1.3 x 0.7 units footprint) or stacks of coins. For salaries, bribes, profit, "millions". Static.',
  params: cashParams,
  build(params, tools) {
    const colors = {
      bill: pick(tools, undefined, GREEN),
      billDark: pick(tools, undefined, GREEN_DARK),
      billLight: pick(tools, undefined, ['mint', 'cream', 'bone', 'heroTrim']),
      band: 'hero',
      gold: pick(tools, undefined, GOLD),
      goldDark: pick(tools, undefined, GOLD_DARK),
    };
    const create = (size: [number, number, number]) => new Sketch<CashSlot>(size, colors);
    const sketch =
      params.kind === 'bills'
        ? bills(params.count, params.seed, create)
        : coins(params.count, params.seed, create);
    const shell = propShell(tools, 'cash', SMALL_VOXEL, params.scale);
    shell.mesh(sketch);
    return asProp(shell.object, {});
  },
});

export const suitcaseParams = z.object({
  style: z
    .enum(['briefcase', 'trolley'])
    .default('briefcase')
    .describe('briefcase (handle on top) or trolley (wheels, telescopic handle)'),
  color: colorField('the case (default: dark for briefcase, accent1 for trolley)'),
  scale: scaleParam,
});

type CaseSlot = 'case' | 'trim' | 'metal' | 'latch' | 'handle' | 'wheel';

function caseCorners(
  sketch: Sketch<CaseSlot>,
  [x1, y0, y1, z1]: readonly [number, number, number, number],
): void {
  for (const x of [0, x1 - 2]) {
    for (const y of [y0, y1 - 2]) {
      for (const z of [0, z1 - 2]) sketch.paint('metal', [x, y, z], [x + 2, y + 2, z + 2]);
    }
  }
}

function briefcase(sketch: Sketch<CaseSlot>): void {
  sketch.box('case', [0, 0, 0], [38, 28, 10]).paint('trim', [0, 0, 5], [38, 28, 6]);
  sketch.paint('trim', [2, 21, 9], [36, 22, 10]);
  caseCorners(sketch, [38, 0, 28, 10]);
  sketch.box('latch', [6, 22, 10], [10, 25, 11]).box('latch', [28, 22, 10], [32, 25, 11]);
  sketch.box('metal', [13, 28, 4], [15, 29, 6]).box('metal', [23, 28, 4], [25, 29, 6]);
  sketch.box('handle', [13, 29, 4], [15, 31, 6]).box('handle', [23, 29, 4], [25, 31, 6]);
  sketch.box('handle', [13, 31, 4], [25, 32, 6]);
}

function trolley(sketch: Sketch<CaseSlot>): void {
  sketch.box('case', [0, 4, 0], [30, 40, 15]).paint('trim', [0, 4, 7], [30, 40, 8]);
  for (let x = 2; x < 28; x += 6) sketch.box('case', [x, 7, 15], [x + 2, 37, 16]);
  caseCorners(sketch, [30, 4, 40, 15]);
  for (const x of [1, 26]) {
    for (const z of [1, 11]) sketch.box('wheel', [x, 0, z], [x + 3, 4, z + 3]);
  }
  sketch.box('metal', [8, 40, 2], [10, 47, 4]).box('metal', [20, 40, 2], [22, 47, 4]);
  sketch.box('handle', [8, 47, 1], [22, 49, 5]);
}

export const suitcase = defineProp({
  name: 'suitcase',
  description:
    'Case standing upright: a briefcase (~1.2 x 1 units, latches, handle on top) or a trolley suitcase (~0.95 x 1.5 units, ribbed shell, wheels, telescopic handle). For travel, deals, "the money case". Static.',
  params: suitcaseParams,
  anchors: { handle: 'top of the handle' },
  build(params, tools) {
    const trolleyStyle = params.style === 'trolley';
    const sketch = new Sketch<CaseSlot>(trolleyStyle ? [30, 49, 16] : [38, 32, 11], {
      case: pick(tools, params.color, trolleyStyle ? ['accent1'] : DARK),
      trim: pick(tools, undefined, DARKEST),
      metal: pick(tools, undefined, METAL),
      latch: pick(tools, undefined, GOLD),
      handle: pick(tools, undefined, DARKEST),
      wheel: pick(tools, undefined, DARKEST),
    });
    if (trolleyStyle) trolley(sketch);
    else briefcase(sketch);
    const shell = propShell(tools, 'suitcase', SMALL_VOXEL, params.scale);
    const body = shell.mesh(sketch);
    setAnchors(shell.object, { handle: gridPoint(body, trolleyStyle ? [15, 49, 3] : [19, 32, 5]) });
    return asProp(shell.object, {});
  },
});
