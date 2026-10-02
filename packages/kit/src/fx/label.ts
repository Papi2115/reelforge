/**
 * `kit.fx.label3d`: static voxel text in the kit font (signs, captions in 3D, chart titles),
 * optionally on a dark plate and popping in at a time. One greedy mesh.
 */
import { z } from 'zod';
import { createKitObject } from '../object.js';
import { defineFx } from '../registry.js';
import { asFx, EASES, progress } from './shared.js';
import { textBlock, textHeight, textWidth } from './text.js';

export const label3dParams = z.object({
  text: z.string().min(1).max(120).describe('Text; "\\n" starts a new line'),
  height: z.number().positive().default(0.4).describe('Cap height in units'),
  color: z.string().default('text').describe('Palette name'),
  glow: z.boolean().default(true).describe('Unlit (always readable) or lit by the scene'),
  bold: z.boolean().default(false).describe('Chunky strokes'),
  align: z.enum(['left', 'center', 'right']).default('center'),
  anchor: z
    .enum(['center', 'bottom', 'top'])
    .default('center')
    .describe('Vertical position of the origin on the text block'),
  plate: z.boolean().default(false).describe('Dark plate behind the text'),
  plateColor: z.string().default('shadow').describe('Plate colour (palette name)'),
  at: z.number().optional().describe('Local time the label pops in (default: always visible)'),
});

const POP_TIME = 0.3;

export const label3d = defineFx({
  name: 'label3d',
  description:
    'Voxel text label in the kit font (caps; signs, 3D captions, chart titles), optional dark plate and pop-in at `at`. Faces +z. fx.update(t) every frame when `at` is set.',
  params: label3dParams,
  build(params, tools) {
    const lines = params.text.split('\n');
    const color = params.glow ? { color: params.color, glow: true } : params.color;
    const style = { height: params.height, color, bold: params.bold };
    const text = textBlock(tools, lines, { ...style, align: params.align, anchor: params.anchor });
    const object = createKitObject(tools.three, { kitType: 'label3d' });
    object.add(text);
    if (params.plate) {
      const margin = params.height * 0.5;
      const width = textWidth(lines, style) + margin * 2;
      const height = textHeight(lines.length, style) + margin * 2;
      const voxel = params.height / 7;
      const size = [Math.round(width / voxel), Math.round(height / voxel), 1] as const;
      const plate = tools.voxel.mesh(tools.voxel.box(size, params.plateColor), {
        voxelSize: voxel,
        pivot: [size[0] / 2, size[1] / 2, 2],
        ao: 0,
      });
      const shiftX =
        params.align === 'left'
          ? width / 2 - margin
          : params.align === 'right'
            ? margin - width / 2
            : 0;
      const shiftY =
        params.anchor === 'bottom'
          ? height / 2 - margin
          : params.anchor === 'top'
            ? margin - height / 2
            : 0;
      plate.position.set(shiftX, shiftY, 0);
      object.add(plate);
    }
    return asFx(object, (t) => {
      const pop =
        params.at === undefined
          ? 1
          : EASES.easeOutBack(progress(t, params.at, params.at + POP_TIME));
      object.visible = pop > 0;
      object.scale.setScalar(Math.max(1e-4, pop));
    });
  },
});
