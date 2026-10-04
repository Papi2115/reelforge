/**
 * `kit.fx.flatInfographic`: flat infographics in five layouts (`kind`): icons (row/grid of icon
 * badges with captions and a connector), progress (labelled bars), ring (donut gauges), versus
 * (split screen with a VS badge) and stat (big count-up numbers on cards). Items appear on their
 * cues; numbers count up from 0.
 */
import { z } from 'zod';
import { KitError } from '../../errors.js';
import { boardParams, defineBoard, type BoardContext, type BoardContent } from './board.js';
import { ringLayout, statLayout, versusLayout } from './info-cards.js';
import { INFO_KINDS, infoItem, schedule, type InfoLayout } from './info-common.js';
import { iconsLayout, progressLayout } from './info-lists.js';

const LIMITS: Readonly<Record<(typeof INFO_KINDS)[number], readonly [number, number]>> = {
  icons: [1, 8],
  progress: [1, 5],
  ring: [1, 3],
  versus: [2, 2],
  stat: [1, 3],
};

const infographicParams = z
  .object({
    kind: z
      .enum(INFO_KINDS)
      .default('icons')
      .describe(
        'icons (row/grid, <= 8), progress (bars, <= 5), ring (gauges, <= 3), versus (2), stat (cards, <= 3)',
      ),
    items: z.array(infoItem).min(1).max(8).describe('{ label, value?, icon?, color?, at? }'),
    title: z.string().max(32).default('').describe('Heading at the top'),
    prefix: z.string().max(3).default('').describe('Before numbers, e.g. "$"'),
    suffix: z.string().max(6).default('').describe('After numbers, e.g. "%" or "M"'),
    decimals: z.int().min(0).max(2).default(0),
    max: z.number().positive().default(100).describe('progress/ring: the full bar or ring'),
    duration: z.number().min(0.1).max(5).default(1.2).describe('Count-up / fill length (s)'),
    connect: z.boolean().default(true).describe('icons: dotted connector between steps'),
    columns: z.int().min(1).max(4).optional().describe('icons: columns of the grid'),
    highlight: z.int().min(0).max(7).optional().describe('Item that wins (versus) or stands out'),
    start: z.number().default(0.3).describe('First item when it has no `at` (s)'),
    stagger: z.number().min(0).default(0.4).describe('Seconds between default item cues'),
  })
  .extend(boardParams('gradient'));

type InfographicParams = z.output<typeof infographicParams>;

function setupInfographic(params: InfographicParams, context: BoardContext): BoardContent {
  const [min, max] = LIMITS[params.kind];
  if (params.items.length < min || params.items.length > max) {
    throw new KitError(
      'invalid-params',
      `${context.call}: kind "${params.kind}" takes ${min === max ? String(min) : `${String(min)}-${String(max)}`} items, got ${String(params.items.length)}`,
    );
  }
  const items = schedule(params.items, context, params.start, params.stagger);
  const settings = {
    title: params.title,
    prefix: params.prefix,
    suffix: params.suffix,
    decimals: params.decimals,
    max: params.max,
    duration: params.duration,
    connect: params.connect,
    highlight: params.highlight,
  };
  const layouts: Record<(typeof INFO_KINDS)[number], () => InfoLayout> = {
    icons: () => iconsLayout(items, settings, context, params.columns),
    progress: () => progressLayout(items, settings, context),
    ring: () => ringLayout(items, settings, context),
    versus: () => versusLayout(items, settings, context),
    stat: () => statLayout(items, settings, context),
  };
  return layouts[params.kind]();
}

export const flatInfographic = defineBoard({
  name: 'flatInfographic',
  description:
    'Flat infographic board: icons (row/grid of icon badges with captions and a dotted connector, steps of a process), progress (labelled bars filling up), ring (1-3 donut gauges), versus (split screen, two cards and a VS badge) or stat (1-3 cards with big count-up numbers); items appear on spoken cues. Call update(t) every frame.',
  params: infographicParams,
  targets: 'item:<i> (each item: badge, bar, ring or card), vs (versus)',
  setup: (params, context) => setupInfographic(params, context),
});
