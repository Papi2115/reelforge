/**
 * Paperwork props: `kit.props.paper` (a sheet with ruled lines, text lines or a stamp),
 * `kit.props.folder` (manila folder with papers, opening cover) and `kit.props.documentStack`.
 * Writing is voxel colour on the sheet's top face (pixel font for titles, bars for text lines).
 */
import { z } from 'zod';
import { hashCell } from '../env/shared.js';
import { defineProp } from '../registry.js';
import type { Vec3 } from '../types.js';
import { drawText } from './font.js';
import {
  amountArg,
  asProp,
  colorField,
  gridPoint,
  INK,
  METAL,
  PAPER,
  pick,
  propShell,
  RED,
  scaleParam,
  seedParam,
  setAnchors,
  SMALL_VOXEL,
} from './shared.js';
import { Sketch } from './sketch.js';

const SHEET_WIDTH = 24;
const SHEET_DEPTH = 34;
const MANILA = ['lightOrange', 'amber', 'sand', 'keyLight'] as const;

export const SHEET_VARIANTS = ['blank', 'lines', 'text', 'stamp'] as const;
export type SheetVariant = (typeof SHEET_VARIANTS)[number];

type SheetSlot = 'paper' | 'ink' | 'rule' | 'stamp';

interface SheetSpec {
  readonly variant: SheetVariant;
  readonly title: string;
  readonly seed: number;
}

/** Draws a sheet's writing on layer y of `sketch`, the sheet's back-left corner at (x0, z0). */
function writeSheet<Slot extends string>(
  sketch: Sketch<Slot | SheetSlot>,
  [x0, y, z0]: Vec3,
  spec: SheetSpec,
): void {
  if (spec.variant === 'blank') return;
  if (spec.variant === 'lines') {
    for (let z = 4; z < SHEET_DEPTH - 1; z += 3)
      sketch.paint('rule', [x0, y, z0 + z], [x0 + SHEET_WIDTH, y + 1, z0 + z + 1]);
    sketch.paint('stamp', [x0 + 3, y, z0], [x0 + 4, y + 1, z0 + SHEET_DEPTH]);
    return;
  }
  if (spec.title.length > 0) {
    drawText(spec.title, { x: 2, y: 2, width: SHEET_WIDTH - 4 }, 1, 'left', (x, row) => {
      sketch.paint('ink', [x0 + x, y, z0 + row], [x0 + x + 1, y + 1, z0 + row + 1]);
    });
  } else {
    sketch.paint('ink', [x0 + 2, y, z0 + 2], [x0 + 13, y + 1, z0 + 4]);
  }
  for (let z = 9, line = 0; z < SHEET_DEPTH - 2; z += 2, line += 1) {
    if (hashCell(line, 0, 1, spec.seed) < 0.12) continue;
    const length = 10 + Math.floor(hashCell(line, 0, 2, spec.seed) * 11);
    sketch.paint('ink', [x0 + 2, y, z0 + z], [x0 + 2 + length, y + 1, z0 + z + 1]);
  }
  if (spec.variant === 'stamp') stamp(sketch, [x0 + 16, y, z0 + 25]);
}

/** Red round stamp (ring with a bar) centred on cell (cx, y, cz). */
function stamp<Slot extends string>(sketch: Sketch<Slot | SheetSlot>, [cx, y, cz]: Vec3): void {
  const radius = 5.5;
  for (let z = -6; z <= 6; z += 1) {
    for (let x = -6; x <= 6; x += 1) {
      const distance = Math.hypot(x, z);
      const ring = distance <= radius && distance > radius - 1.3;
      const bar = Math.abs(z) <= 1 && Math.abs(x) <= 3;
      if (ring || bar) sketch.paint('stamp', [cx + x, y, cz + z], [cx + x + 1, y + 1, cz + z + 1]);
    }
  }
}

const sheetFields = {
  variant: z
    .enum(SHEET_VARIANTS)
    .default('text')
    .describe('blank, lines (ruled), text (title + text lines), stamp (text + red stamp)'),
  title: z
    .string()
    .max(12)
    .default('')
    .describe('Title in pixel letters (~5 characters fit; empty = a title bar)'),
};

function sheetColors(
  tools: Parameters<typeof pick>[0],
  paper: string | undefined,
): Record<SheetSlot, string> {
  return {
    paper: pick(tools, paper, PAPER),
    ink: pick(tools, undefined, INK),
    rule: pick(tools, undefined, METAL),
    stamp: pick(tools, undefined, RED),
  };
}

export const paperParams = z.object({
  ...sheetFields,
  color: colorField('the paper'),
  seed: seedParam,
  scale: scaleParam,
});

export const paper = defineProp({
  name: 'paper',
  description:
    'A sheet of paper (~0.75 x 1.05 units, 1 voxel thin, lies flat): blank, ruled lines, text lines with an optional pixel-letter title, or text with a red stamp. For exams, contracts, leaked memos. Static.',
  params: paperParams,
  anchors: { title: 'title line on the sheet', stamp: 'centre of the stamp area' },
  build(params, tools) {
    const sketch = new Sketch<SheetSlot>(
      [SHEET_WIDTH, 1, SHEET_DEPTH],
      sheetColors(tools, params.color),
    );
    sketch.box('paper', [0, 0, 0], [SHEET_WIDTH, 1, SHEET_DEPTH]);
    writeSheet(sketch, [0, 0, 0], params);
    const shell = propShell(tools, 'paper', SMALL_VOXEL, params.scale);
    const sheet = shell.mesh(sketch);
    setAnchors(shell.object, {
      title: gridPoint(sheet, [8, 1, 4]),
      stamp: gridPoint(sheet, [16.5, 1, 25.5]),
    });
    return asProp(shell.object, {});
  },
});

export const folderParams = z.object({
  open: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .describe('Cover: 0 closed .. 1 fully open (animate with folder.open)'),
  papers: z.boolean().default(true).describe('Papers inside (peeking out at the front)'),
  title: z
    .string()
    .max(12)
    .default('')
    .describe('Title on the cover in pixel letters (~6 characters fit)'),
  stamp: z.boolean().default(false).describe('Red stamp on the cover ("classified")'),
  color: colorField('the folder (default: manila)'),
  seed: seedParam,
  scale: scaleParam,
});

type FolderSlot = SheetSlot | 'folder' | 'label';

export const folder = defineProp({
  name: 'folder',
  description:
    'Manila case folder (~0.95 x 1.25 units, lies flat) with a tab, a label, papers peeking out and an optional title/stamp. folder.open(amount) swings the cover open to the left, showing the top document.',
  params: folderParams,
  anchors: { cover: 'centre of the closed cover', document: 'centre of the top document inside' },
  methods: { 'open(amount)': 'cover 0 (closed) .. 1 (open); set every frame when animating' },
  build(params, tools) {
    const colors = {
      ...sheetColors(tools, undefined),
      folder: pick(tools, params.color, MANILA),
      label: pick(tools, undefined, PAPER),
    };
    const base = new Sketch<FolderSlot>([30, 2, 40], colors);
    base.box('folder', [0, 0, 2], [30, 1, 39]).box('folder', [3, 0, 0], [13, 1, 2]);
    if (params.papers) {
      base.box('paper', [3, 1, 3], [3 + SHEET_WIDTH, 2, 3 + SHEET_DEPTH + 3]);
      writeSheet(base, [3, 1, 4], { variant: 'text', title: '', seed: params.seed });
    }
    const cover = new Sketch<FolderSlot>([30, 1, 36], colors);
    cover.box('folder', [0, 0, 0], [30, 1, 36]).paint('label', [4, 0, 3], [16, 1, 8]);
    cover.paint('ink', [5, 0, 4], [14, 1, 5]).paint('ink', [5, 0, 6], [11, 1, 7]);
    drawText(params.title, { x: 3, y: 12, width: 24 }, 1, 'left', (x, z) => {
      cover.paint('ink', [x, 0, z], [x + 1, 1, z + 1]);
    });
    if (params.stamp) stamp(cover, [21, 0, 26]);
    const shell = propShell(tools, 'folder', SMALL_VOXEL, params.scale);
    const baseMesh = shell.mesh(base);
    const hinge = tools.voxel.group();
    hinge.position.set(...gridPoint(baseMesh, [0, params.papers ? 2 : 1, 20]));
    hinge.add(
      tools.voxel.mesh(cover.model(tools.voxel), { voxelSize: SMALL_VOXEL, pivot: [0, 0, 18] }),
    );
    shell.object.add(hinge);
    const open = (amount: number): void => {
      hinge.rotation.z = Math.PI * amountArg('folder.open(amount)', amount);
    };
    open(params.open);
    setAnchors(shell.object, {
      cover: gridPoint(baseMesh, [15, 3, 20]),
      document: gridPoint(baseMesh, [15, 2, 21]),
    });
    const methods: { open(amount: number): void } = { open };
    return asProp(shell.object, methods);
  },
});

export const documentStackParams = z.object({
  count: z.number().int().min(2).max(60).default(12).describe('Number of sheets (1 voxel each)'),
  messy: z
    .number()
    .int()
    .min(0)
    .max(3)
    .default(1)
    .describe('Max sideways offset of a sheet in voxels'),
  ...sheetFields,
  seed: seedParam,
  scale: scaleParam,
});

export const documentStack = defineProp({
  name: 'documentStack',
  description:
    'A stack of paper sheets (~0.8 x 1.1 units, height = count voxels) with a few manila dividers; the top sheet carries text lines/title/stamp. For bureaucracy, evidence, "thousands of pages". Static.',
  params: documentStackParams,
  anchors: { title: 'title line of the top sheet' },
  build(params, tools) {
    const margin = params.messy;
    const sketch = new Sketch<FolderSlot>(
      [SHEET_WIDTH + 2 * margin, params.count, SHEET_DEPTH + 2 * margin],
      {
        ...sheetColors(tools, undefined),
        folder: pick(tools, undefined, MANILA),
        label: pick(tools, undefined, PAPER),
      },
    );
    const offset = (sheet: number, axis: number): number =>
      margin + Math.round((hashCell(sheet, axis, 7, params.seed) * 2 - 1) * margin);
    let top: Vec3 = [margin, 0, margin];
    for (let sheet = 0; sheet < params.count; sheet += 1) {
      const x0 = offset(sheet, 0);
      const z0 = offset(sheet, 1);
      const slot = sheet % 5 === 3 && sheet < params.count - 1 ? 'folder' : 'paper';
      sketch.box(slot, [x0, sheet, z0], [x0 + SHEET_WIDTH, sheet + 1, z0 + SHEET_DEPTH]);
      top = [x0, sheet, z0];
    }
    writeSheet(sketch, top, params);
    const shell = propShell(tools, 'documentStack', SMALL_VOXEL, params.scale);
    const stack = shell.mesh(sketch);
    setAnchors(shell.object, { title: gridPoint(stack, [top[0] + 8, params.count, top[2] + 4]) });
    return asProp(shell.object, {});
  },
});
