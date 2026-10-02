/**
 * `kit.fx.timeline3d`: a horizontal axis drawn left to right as a trail of voxel cubes;
 * milestone blocks pop up as the drawing front passes them (or at their own `at`), with a
 * label above and a caption (date) below. The latest milestone glows.
 */
import type * as THREE from 'three';
import { z } from 'zod';
import { colorOf } from '../env/shared.js';
import { createKitObject, type KitObject } from '../object.js';
import { defineFx, type KitTools } from '../registry.js';
import type { Vec3 } from '../types.js';
import { asFx, EASES, easeParam, progress, SERIES_COLORS, timeParam } from './shared.js';
import { fitLabel, fitLabelRow, staggerStep, textBlock } from './text.js';
import { createTrail } from './trail.js';

const milestone = z.object({
  label: z.string().max(40).default('').describe('Text above the block'),
  caption: z.string().max(24).default('').describe('Text below the axis, e.g. a year'),
  color: z.string().optional().describe('Palette name (default: series colours in turn)'),
  at: z.number().optional().describe('Local time it pops up (default: when the axis reaches it)'),
});

export const timeline3dParams = z.object({
  items: z.array(milestone).min(1).max(12).describe('Milestones, left to right'),
  length: z.number().positive().default(8).describe('Axis length in units'),
  start: timeParam.default(0).describe('Local time the axis starts drawing'),
  drawTime: z.number().positive().default(3).describe('Seconds the axis takes to draw'),
  ease: easeParam.default('linear'),
  blockSize: z.number().positive().default(0.5).describe('Milestone block edge in units'),
  labelHeight: z.number().positive().default(0.26).describe('Max label text height in units'),
  axisColor: z.string().default('textDim').describe('Palette name'),
  highlightColor: z.string().default('accent2').describe('Colour of the latest milestone'),
  highlightLatest: z.boolean().default(true).describe('Latest revealed milestone glows'),
});

export type Timeline3dParams = z.output<typeof timeline3dParams>;

const POP_TIME = 0.35;
const BLOCK_VOXELS = 4;

/** X of milestone i (the axis is centred on the origin). */
export function milestoneX(params: Timeline3dParams, index: number): number {
  const count = params.items.length;
  return -params.length / 2 + ((index + 0.5) / count) * params.length;
}

/** Drawn share of the axis at time t. */
export function axisProgress(params: Timeline3dParams, t: number): number {
  return EASES[params.ease](progress(t, params.start, params.start + params.drawTime));
}

/** Pop-up time of every milestone (when the drawing front reaches it, unless `at` is given). */
export function milestoneTimes(params: Timeline3dParams): number[] {
  return params.items.map((item, index) => {
    if (item.at !== undefined) return item.at;
    const share = (index + 0.5) / params.items.length;
    // Invert the (monotonic) ease numerically: first time step whose progress reaches share.
    let low = params.start;
    let high = params.start + params.drawTime;
    for (let step = 0; step < 30; step += 1) {
      const middle = (low + high) / 2;
      if (axisProgress(params, middle) < share) low = middle;
      else high = middle;
    }
    return high;
  });
}

/** Thin glowing stick from the block top up to a raised label. */
function stem(tools: KitTools, voxel: number, from: number, length: number): KitObject {
  const rows = Math.max(1, Math.round(length / (voxel / 2)));
  const model = tools.voxel.box([1, rows, 1], { color: 'textDim', glow: true });
  const object = tools.voxel.mesh(model, { voxelSize: voxel / 2 });
  object.position.y = from;
  return object;
}

interface MilestoneView {
  readonly root: THREE.Group;
  readonly normal: KitObject;
  readonly lit: KitObject;
}

export const timeline3d = defineFx({
  name: 'timeline3d',
  description:
    'Horizontal 3D timeline: the axis draws left to right, milestone blocks pop up as it reaches them (or at their own `at`, e.g. an anchor), label above and caption/date below; the latest milestone glows. Faces +z. fx.update(t) every frame.',
  params: timeline3dParams,
  anchors: {
    'item<i>': 'top of milestone block i (item0 = leftmost)',
    axisEnd: 'right end of the axis',
  },
  build(params, tools) {
    const { three } = tools;
    const count = params.items.length;
    const pitch = params.length / count;
    const half = params.blockSize / 2;
    const anchors: Record<string, Vec3> = { axisEnd: [params.length / 2 + 0.3, 0, 0] };
    params.items.forEach((_, index) => {
      anchors[`item${String(index)}`] = [milestoneX(params, index), half, 0];
    });
    const object = createKitObject(three, { kitType: 'timeline3d', anchors });
    const voxel = params.blockSize / BLOCK_VOXELS;
    const trail = createTrail(
      tools,
      [
        [
          [-params.length / 2 - 0.3, 0, 0],
          [params.length / 2 + 0.3, 0, 0],
        ],
      ],
      { spacing: voxel * 1.5, size: voxel * 1.2 },
    );
    trail.tint(0, () => colorOf(tools, params.axisColor));
    object.add(trail.mesh);
    const head = tools.voxel.mesh(tools.voxel.box([2, 2, 2], { color: 'heroTrim', glow: true }), {
      voxelSize: voxel * 1.2,
      pivot: 'center',
    });
    object.add(head);
    const labelStyle = { color: { color: 'text', glow: true } };
    const labelRow = fitLabelRow(
      params.items.map((item) => item.label),
      pitch,
      params.labelHeight,
    );
    const labelHeight = labelRow.height;
    const captionRow = fitLabelRow(
      params.items.map((item) => item.caption),
      pitch,
      params.labelHeight,
    );
    const captionHeight = captionRow.height;
    const views: MilestoneView[] = params.items.map((item, index) => {
      const color = item.color ?? SERIES_COLORS[index % SERIES_COLORS.length] ?? 'accent1';
      const root = new three.Group();
      root.position.set(milestoneX(params, index), 0, 0);
      const box = [BLOCK_VOXELS, BLOCK_VOXELS, BLOCK_VOXELS] as const;
      const options = { voxelSize: voxel, pivot: 'center' as const };
      const normal = tools.voxel.mesh(tools.voxel.box(box, color), options);
      const lit = tools.voxel.mesh(
        tools.voxel.box(box, { color: params.highlightColor, glow: true }),
        options,
      );
      root.add(normal, lit);
      const odd = index % 2 === 1;
      if (item.label.length > 0) {
        const { lines } = fitLabel(item.label, labelRow.width, labelHeight);
        const label = textBlock(tools, lines, {
          ...labelStyle,
          height: labelHeight,
          anchor: 'bottom',
        });
        const raise = labelRow.staggered && odd ? staggerStep(labelHeight) : 0;
        label.position.set(0, half + labelHeight * 0.6 + raise, 0);
        root.add(label);
        if (raise > 0) root.add(stem(tools, voxel, half, raise));
      }
      if (item.caption.length > 0) {
        const { lines } = fitLabel(item.caption, captionRow.width, captionHeight);
        const caption = textBlock(tools, lines, {
          height: captionHeight,
          color: { color: 'textDim', glow: true },
          anchor: 'top',
        });
        const drop = captionRow.staggered && odd ? staggerStep(captionHeight) : 0;
        caption.position.set(0, -half - captionHeight * 0.6 - drop, 0);
        root.add(caption);
      }
      object.add(root);
      return { root, normal, lit };
    });
    const times = milestoneTimes(params);
    const axisStart = -params.length / 2 - 0.3;
    const axisLength = params.length + 0.6;
    return asFx(object, (t) => {
      const drawn = axisProgress(params, t);
      trail.reveal(0, drawn);
      head.visible = drawn > 0 && drawn < 1;
      head.position.set(axisStart + drawn * axisLength, 0, 0);
      const latest = times.reduce(
        (found, begin, index) =>
          t >= begin && (found < 0 || begin >= (times[found] ?? -Infinity)) ? index : found,
        -1,
      );
      views.forEach((view, index) => {
        const begin = times[index] ?? 0;
        const pop = EASES.easeOutBack(progress(t, begin, begin + POP_TIME));
        view.root.visible = pop > 0;
        view.root.scale.setScalar(Math.max(1e-4, pop));
        const hot = params.highlightLatest && index === latest;
        view.normal.visible = !hot;
        view.lit.visible = hot;
      });
    });
  },
});
