/**
 * `kit.env.flatStage`: the bare flat-2d stage (field, dithered gradient / spot / pattern drifting
 * with t) with optional floating decor: small flat shapes along the frame edges, seeded per call
 * (`tools.rng`) and bobbing slowly, so the centre stays free for the shot's content, `ctx.text`
 * or voxel objects.
 */
import { z } from 'zod';
import type { KitRng } from '../../types.js';
import { defineEnv } from '../../registry.js';
import {
  boardMethods,
  boardParams,
  createBoard,
  type BoardContext,
  type BoardContent,
} from './board.js';
import { placeRings, shapeRings, type ShapeKind } from './geometry.js';

const DECOR_STYLES = ['subtle', 'confetti'] as const;

const stageParams = z
  .object({
    decor: z
      .int()
      .min(0)
      .max(12)
      .default(6)
      .describe('Floating decor shapes along the edges (0 = none)'),
    decorStyle: z
      .enum(DECOR_STYLES)
      .default('subtle')
      .describe('subtle (stage tone) or confetti (accent colours)'),
  })
  .extend(boardParams('gradient'));

type StageParams = z.output<typeof stageParams>;

const DECOR_KINDS: readonly ShapeKind[] = ['circle', 'ring', 'plus', 'triangle', 'diamond'];
const CONFETTI = ['primary', 'secondary', 'tertiary', 'good', 'gold'] as const;

interface Decor {
  readonly kind: ShapeKind;
  /** Position as shares of the board. */
  readonly u: number;
  readonly v: number;
  /** Size in 640x360-frame pixels. */
  readonly size: number;
  readonly phase: number;
  readonly spin: number;
  readonly color: string;
}

/** Seeded decor: positions on a ring along the frame edges, centre left free. */
export function decorLayout(count: number, rng: KitRng, style: StageParams['decorStyle']): Decor[] {
  return Array.from({ length: count }, (_, index) => {
    const slot = (index + rng() * 0.6) / Math.max(1, count);
    const angle = slot * Math.PI * 2;
    const reach = 0.74 + rng() * 0.16;
    return {
      kind: DECOR_KINDS[Math.floor(rng() * DECOR_KINDS.length)] ?? 'circle',
      u: 0.5 + (Math.cos(angle) * reach) / 2,
      v: 0.5 + (Math.sin(angle) * reach) / 2,
      size: 10 + Math.round(rng() * 16),
      phase: rng() * Math.PI * 2,
      spin: (rng() - 0.5) * 40,
      color: style === 'subtle' ? 'card' : (CONFETTI[index % CONFETTI.length] ?? 'primary'),
    };
  });
}

function setupStage(decor: readonly Decor[], context: BoardContext): BoardContent {
  const { theme, px } = context;
  const placed = decor.map((item) => ({
    ...item,
    rings: shapeRings(item.kind, {
      w: px(item.size),
      h: px(item.size),
      round: 0,
      thickness: Math.max(2, px(item.size / 4)),
    }),
    pixel: theme.color(item.color),
  }));
  return {
    paint: (raster, t) => {
      for (const item of placed) {
        const cx = Math.round(item.u * context.width);
        const cy = Math.round(item.v * context.height + Math.sin(t * 0.9 + item.phase) * px(5));
        raster.polygon(
          placeRings(item.rings, cx, cy, 1, item.spin * t + item.phase * 30),
          item.pixel,
        );
      }
    },
  };
}

export const flatStage = defineEnv({
  name: 'flatStage',
  description:
    'Flat 2D motion-graphics stage: a field in one tone family (indigo, violet, teal, night, wine, cream) with a dithered gradient, spot, stripes, dots, grid, checker or sunburst rays drifting slowly, plus optional floating decor shapes along the edges. Backdrop for flat boards, ctx.text or voxel objects: call update(t) every frame.',
  params: stageParams,
  methods: boardMethods('none'),
  build: (params, tools) => {
    const decor = decorLayout(params.decor, tools.rng, params.decorStyle);
    return createBoard(tools, 'flatStage', params, (context) => setupStage(decor, context), 'env');
  },
});
