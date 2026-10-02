/**
 * `kit.fx.bars3d`: animated 3D bar chart - voxel bars growing one after another on a base
 * slab, category labels under the base and value labels popping in on top. Labels shrink and
 * wrap to fit the bar pitch, so they never overlap.
 */
import { z } from 'zod';
import { createKitObject, type KitObject } from '../object.js';
import { defineFx } from '../registry.js';
import type { Vec3 } from '../types.js';
import { formatCounter } from './counter.js';
import { asFx, EASES, easeParam, progress, SERIES_COLORS, timeParam } from './shared.js';
import { fitLabel, fitLabelRow, staggerStep, textBlock, type LabelRow } from './text.js';

const barDatum = z.object({
  label: z.string().max(40).default('').describe('Category label under the bar'),
  value: z.number().min(0).describe('Bar value (>= 0)'),
  color: z.string().optional().describe('Palette name (default: series colours in turn)'),
});

export const bars3dParams = z.object({
  data: z.array(barDatum).min(1).max(16).describe('Bars, left to right'),
  max: z
    .number()
    .positive()
    .optional()
    .describe('Value of the full height (default: the largest value)'),
  height: z.number().positive().default(3).describe('Height of a full bar in units'),
  barWidth: z.number().positive().default(0.75).describe('Bar width and depth in units'),
  gap: z.number().min(0).default(0.5).describe('Space between bars in units'),
  start: timeParam.default(0).describe('Local time the first bar starts growing'),
  stagger: z.number().min(0).default(0.2).describe('Delay between bars in seconds'),
  grow: z.number().positive().default(0.9).describe('Growth time of one bar in seconds'),
  ease: easeParam.default('easeOutCubic'),
  values: z
    .object({
      decimals: z.number().int().min(0).max(4).default(0),
      separator: z.string().max(1).default(','),
      point: z.string().length(1).default('.'),
      prefix: z.string().max(6).default(''),
      suffix: z.string().max(8).default(''),
    })
    .nullable()
    .default({ decimals: 0, separator: ',', point: '.', prefix: '', suffix: '' })
    .describe('Value labels on top of the bars (counter format) or null for none'),
  labelHeight: z.number().positive().default(0.32).describe('Max text height in units'),
  labelColor: z.string().default('text').describe('Label colour (palette name)'),
  baseColor: z.string().default('groundAlt').describe('Base slab colour (palette name)'),
});

export type Bars3dParams = z.output<typeof bars3dParams>;

const BAR_VOXELS = 6;

/** Bar heights (units) at time t: each grows from 0 after its stagger delay. */
export function barHeights(params: Bars3dParams, t: number): number[] {
  const max = params.max ?? Math.max(...params.data.map((datum) => datum.value), 1e-9);
  return params.data.map((datum, index) => {
    const begin = params.start + index * params.stagger;
    const k = EASES[params.ease](progress(t, begin, begin + params.grow));
    return (datum.value / max) * params.height * k;
  });
}

/** X centre of bar `index` (the chart is centred on the origin). */
export function barCenter(params: Bars3dParams, index: number): number {
  const pitch = params.barWidth + params.gap;
  return (index - (params.data.length - 1) / 2) * pitch;
}

/** Category label row of a chart (see fitLabelRow). */
export function categoryLayout(params: Bars3dParams): LabelRow {
  const labels = params.data.map((datum) => datum.label);
  return fitLabelRow(labels, params.barWidth + params.gap, params.labelHeight);
}

export const bars3d = defineFx({
  name: 'bars3d',
  description:
    'Animated 3D bar chart: voxel bars grow left to right on a base slab (stagger), category labels under the base, value labels pop in on top. Labels auto-fit the bar pitch. Face the camera from +z. fx.update(t) every frame.',
  params: bars3dParams,
  anchors: {
    'bar<i>': 'top centre of bar i at full height (bar0 = leftmost)',
    base: 'top centre of the base slab',
  },
  build(params, tools) {
    const { three } = tools;
    const pitch = params.barWidth + params.gap;
    const count = params.data.length;
    const totalWidth = count * pitch + params.gap;
    const baseThickness = 0.15;
    const full = barHeights(params, Infinity);
    const anchors: Record<string, Vec3> = { base: [0, 0, 0] };
    full.forEach((height, index) => {
      anchors[`bar${String(index)}`] = [barCenter(params, index), height, 0];
    });
    const object = createKitObject(three, { kitType: 'bars3d', anchors });
    const voxel = params.barWidth / BAR_VOXELS;
    const baseColumns = Math.max(1, Math.round(totalWidth / voxel));
    const baseDepth = Math.max(1, Math.round((params.barWidth + params.gap) / voxel));
    const base = tools.voxel.mesh(
      tools.voxel.box(
        [baseColumns, Math.max(1, Math.round(baseThickness / voxel)), baseDepth],
        params.baseColor,
      ),
      {
        voxelSize: voxel,
        pivot: [baseColumns / 2, Math.round(baseThickness / voxel), baseDepth / 2],
      },
    );
    object.add(base);
    const labelWidth = pitch * 0.92;
    const category = categoryLayout(params);
    const categoryHeight = category.height;
    const lowered = staggerStep(categoryHeight);
    const labelColor = { color: params.labelColor, glow: true };
    const bars: KitObject[] = [];
    const valueLabels: (KitObject | undefined)[] = [];
    params.data.forEach((datum, index) => {
      const x = barCenter(params, index);
      const color = datum.color ?? SERIES_COLORS[index % SERIES_COLORS.length] ?? 'accent1';
      const rows = Math.max(1, Math.round(params.height / voxel));
      const bar = tools.voxel.mesh(tools.voxel.box([BAR_VOXELS, rows, BAR_VOXELS], color), {
        voxelSize: voxel,
        pivot: [BAR_VOXELS / 2, 0, BAR_VOXELS / 2],
        mode: 'greedy',
      });
      bar.position.x = x;
      object.add(bar);
      bars.push(bar);
      if (datum.label.length > 0) {
        const { lines } = fitLabel(datum.label, category.width, categoryHeight);
        const label = textBlock(tools, lines, {
          height: categoryHeight,
          color: labelColor,
          anchor: 'top',
        });
        const drop = category.staggered && index % 2 === 1 ? lowered : 0;
        label.position.set(
          x,
          -baseThickness - categoryHeight * 0.5 - drop,
          params.barWidth / 2 + params.gap / 2,
        );
        object.add(label);
      }
      if (params.values) {
        const text = formatCounter(datum.value, params.values);
        const valueHeight = fitLabel(text, labelWidth, params.labelHeight).height;
        const label = textBlock(tools, [text], {
          height: valueHeight,
          color: labelColor,
          anchor: 'bottom',
        });
        object.add(label);
        valueLabels.push(label);
      } else {
        valueLabels.push(undefined);
      }
    });
    const rowsHeight = Math.max(1, Math.round(params.height / voxel)) * voxel;
    return asFx(object, (t) => {
      const heights = barHeights(params, t);
      bars.forEach((bar, index) => {
        const height = heights[index] ?? 0;
        bar.visible = height > 1e-4;
        bar.scale.y = Math.max(1e-4, height / rowsHeight);
        const label = valueLabels[index];
        if (!label) return;
        const begin = params.start + index * params.stagger + params.grow;
        const pop = EASES.easeOutBack(progress(t, begin - 0.1, begin + 0.15));
        label.visible = pop > 0;
        label.scale.setScalar(Math.max(1e-4, pop));
        label.position.set(barCenter(params, index), height + voxel * 2, 0);
      });
    });
  },
});
