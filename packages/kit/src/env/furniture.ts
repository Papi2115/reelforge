/**
 * `kit.env.desk` and `kit.env.bench`: voxel furniture to stand props on (a calculator on an exam
 * desk, tools on a workbench). Both are greedy voxel meshes with their top as the `top` anchor.
 */
import { z } from 'zod';
import { createKitObject, type KitObject } from '../object.js';
import { defineEnv, type KitTools } from '../registry.js';
import type { Vec3 } from '../types.js';
import type { VoxelColor } from '../voxel/model.js';
import { asEnv, colorParam, voxels, WOOD, WOOD_ALT, WOOD_DARK, type EnvObject } from './shared.js';

const FURNITURE_VOXEL = 0.125;

const woodFields = {
  wood: z.string().optional().describe('Palette name of the top (default: a warm wood swatch)'),
  woodAlt: z.string().optional().describe('Palette name of trims and alternate planks'),
  woodDark: z.string().optional().describe('Palette name of legs and shadows'),
};

/** Palette slots of the furniture models: 1 wood, 2 alt, 3 dark, 4 metal/handles. */
function woodPalette(
  tools: KitTools,
  params: {
    wood?: string | undefined;
    woodAlt?: string | undefined;
    woodDark?: string | undefined;
  },
): VoxelColor[] {
  const { palette } = tools;
  const wood = colorParam(palette, params.wood, WOOD);
  // A custom wood without a custom alt colour: one-colour planks.
  const alt = params.woodAlt ?? (params.wood === undefined ? undefined : wood);
  return [
    wood,
    colorParam(palette, alt, WOOD_ALT),
    colorParam(palette, params.woodDark, WOOD_DARK),
    'textDim',
  ];
}

function isLeg(x: number, z: number, sx: number, sz: number): boolean {
  const legX = x === 1 || x === 2 || x === sx - 2 || x === sx - 3;
  const legZ = z === 1 || z === 2 || z === sz - 2 || z === sz - 3;
  return legX && legZ;
}

function wrap(
  tools: KitTools,
  kitType: string,
  size: Vec3,
  fill: (x: number, y: number, z: number) => number,
  palette: readonly VoxelColor[],
): EnvObject {
  const model = tools.voxel.generate(size, fill, palette);
  const mesh = tools.voxel.mesh(model, { voxelSize: FURNITURE_VOXEL });
  const [sx, sy] = size;
  const top = sy * FURNITURE_VOXEL;
  const quarter = (sx * FURNITURE_VOXEL) / 4;
  const object: KitObject = createKitObject(tools.three, {
    kitType,
    anchors: { spotLeft: [-quarter, top, 0], spotRight: [quarter, top, 0] },
  });
  object.add(mesh);
  return asEnv(object);
}

export const deskParams = z.object({
  width: z.number().min(1).max(12).default(4).describe('Width in units (the hero is 2 tall)'),
  depth: z.number().min(0.75).max(6).default(2).describe('Depth in units'),
  height: z.number().min(0.5).max(3).default(1).describe('Height of the top surface in units'),
  drawers: z.boolean().default(true).describe('Drawer block under the right side'),
  ...woodFields,
});

export const desk = defineEnv({
  name: 'desk',
  description:
    'Voxel desk (top, apron, four legs, optional drawer block with handles). Put props on it with prop.on(desk) or at spotLeft/spotRight. Static.',
  params: deskParams,
  anchors: {
    spotLeft: 'on the top, left quarter',
    spotRight: 'on the top, right quarter (above the drawers)',
  },
  build(params, tools) {
    const sx = voxels(params.width, FURNITURE_VOXEL);
    const sy = voxels(params.height, FURNITURE_VOXEL);
    const sz = voxels(params.depth, FURNITURE_VOXEL);
    const drawerStart = params.drawers ? sx - 1 - Math.max(4, Math.round(sx / 3)) : sx;
    const fill = (x: number, y: number, z: number): number => {
      if (y === sy - 1) return z === sz - 1 ? 2 : 1;
      const inside = x >= 1 && x <= sx - 2 && z >= 1 && z <= sz - 2;
      if (!inside) return 0;
      if (x >= drawerStart && y >= 1) {
        if (z === sz - 2 && (sy - 2 - y) % 3 === 0) return 3;
        if (z === sz - 2 && x === Math.round((drawerStart + sx - 2) / 2) && (sy - 2 - y) % 3 === 2)
          return 4;
        return 2;
      }
      if (y === sy - 2 && (z === 1 || z === sz - 2 || x === 1 || x === sx - 2)) return 3;
      return isLeg(x, z, sx, sz) ? 3 : 0;
    };
    return wrap(tools, 'desk', [sx, sy, sz], fill, woodPalette(tools, params));
  },
});

export const benchParams = z.object({
  width: z.number().min(1.5).max(12).default(5).describe('Width in units'),
  depth: z.number().min(0.75).max(4).default(1.5).describe('Depth in units'),
  height: z.number().min(0.5).max(3).default(1.125).describe('Height of the top surface in units'),
  vise: z.boolean().default(true).describe('Metal vise on the front-left edge'),
  ...woodFields,
});

export const bench = defineEnv({
  name: 'bench',
  description:
    'Voxel workbench: thick planked top, four legs, a lower shelf and an optional vise. Props go on it with prop.on(bench) or at spotLeft/spotRight. Static.',
  params: benchParams,
  anchors: { spotLeft: 'on the top, left quarter', spotRight: 'on the top, right quarter' },
  build(params, tools) {
    const sx = voxels(params.width, FURNITURE_VOXEL);
    const sy = Math.max(5, voxels(params.height, FURNITURE_VOXEL));
    const sz = Math.max(6, voxels(params.depth, FURNITURE_VOXEL));
    const plank = (z: number): number => (Math.floor(z / 3) % 2 === 0 ? 1 : 2);
    const fill = (x: number, y: number, z: number): number => {
      if (y >= sy - 2) return y === sy - 2 && (x === 0 || x === sx - 1) ? 3 : plank(z);
      const vise = params.vise && y === sy - 3 && z === sz - 1 && x >= 2 && x <= 5;
      if (vise) return 4;
      const inside = x >= 1 && x <= sx - 2 && z >= 1 && z <= sz - 2;
      if (!inside) return 0;
      if (y === 2) return plank(z) === 1 ? 1 : 3;
      return isLeg(x, z, sx, sz) ? 3 : 0;
    };
    return wrap(tools, 'bench', [sx, sy, sz], fill, woodPalette(tools, params));
  },
});
