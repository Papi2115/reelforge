/**
 * `kit.props.veiledProp` (PLAN.md#12.26, open loops): a question-mark crate that covers an object
 * until the loop's closing phrase, then dissolves from the top in an ordered dither (one
 * instanced voxel shell, reveal.ts) and leaves the object standing. Pure function of t: the
 * crate trembles for 0.3 s before `revealAt`, dissolves over `duration`, and is gone after it.
 */
import { z } from 'zod';
import { isKitObject, type KitObject } from '../object.js';
import { defineProp } from '../registry.js';
import { QUESTION_GLYPH, revealProgress, veilStep, veilStepShown } from '../reveal.js';
import { KitError } from '../errors.js';
import {
  asProp,
  colorField,
  DARKEST,
  finiteArg,
  GOLD_DARK,
  MEDIUM_VOXEL,
  PAPER,
  pick,
  propShell,
  scaleParam,
  setAnchors,
} from './shared.js';

const edge = (label: string) =>
  z.number().min(0.25).max(4).describe(`${label} in units (16 voxels per unit)`);

export const veiledPropParams = z.object({
  size: z
    .tuple([edge('Width'), edge('Height'), edge('Depth')])
    .default([1, 1, 1])
    .describe('Crate size [w, h, d] in units: a little larger than what it covers'),
  revealAt: z
    .number()
    .default(1)
    .describe("Local time the reveal starts: the closing phrase, e.g. ctx.anchor('the answer').t"),
  duration: z.number().min(0).max(3).default(0.6).describe('Seconds the dissolve takes'),
  mark: z.boolean().default(true).describe('Question marks on the front and side faces'),
  shake: z.boolean().default(true).describe('The crate trembles for 0.3 s before the reveal'),
  color: colorField('the crate panels'),
  scale: scaleParam,
});

export type VeiledPropParams = z.output<typeof veiledPropParams>;

const VOXELS_PER_UNIT = 16;
const SHAKE_S = 0.3;

type Cell = 'frame' | 'panel' | 'mark';

/** Cell of the hollow crate at (x, y, z), or undefined inside/outside the shell. */
export function crateCell(
  x: number,
  y: number,
  z: number,
  size: readonly [number, number, number],
  mark: boolean,
): Cell | undefined {
  const [w, h, d] = size;
  const onX = x === 0 || x === w - 1;
  const onY = y === 0 || y === h - 1;
  const onZ = z === 0 || z === d - 1;
  if (!onX && !onY && !onZ) return undefined;
  if ([onX, onY, onZ].filter(Boolean).length >= 2) return 'frame';
  if (mark && !onY && glyphAt(faceU(x, z, size), y, onZ ? w : d, h)) return 'mark';
  return 'panel';
}

/** Horizontal position on a side face as seen from outside it (so the glyph is not mirrored). */
function faceU(x: number, z: number, size: readonly [number, number, number]): number {
  const [w, , d] = size;
  if (z === d - 1) return x;
  if (z === 0) return w - 1 - x;
  return x === w - 1 ? d - 1 - z : z;
}

/** The question mark, scaled to the face and centred on it. */
function glyphAt(u: number, v: number, width: number, height: number): boolean {
  const scale = Math.max(1, Math.floor(Math.min(width / 8, height / 10)));
  const glyphW = 5 * scale;
  const glyphH = 7 * scale;
  const left = Math.floor((width - glyphW) / 2);
  const bottom = Math.floor((height - glyphH) / 2);
  const gx = Math.floor((u - left) / scale);
  const gy = 6 - Math.floor((v - bottom) / scale);
  if (u < left || v < bottom || gx < 0 || gx > 4 || gy < 0 || gy > 6) return false;
  return QUESTION_GLYPH[gy]?.[gx] === '#';
}

function crateSize(params: VeiledPropParams): [number, number, number] {
  const [w, h, d] = params.size.map((units) => Math.max(4, Math.round(units * VOXELS_PER_UNIT)));
  return [w ?? 16, h ?? 16, d ?? 16];
}

/** Sideways tremble (voxel steps) before the reveal; 0 outside the 0.3 s before `revealAt`. */
export function veilShake(t: number, revealAt: number): number {
  if (t < revealAt - SHAKE_S || t >= revealAt) return 0;
  const phase = Math.floor((t - (revealAt - SHAKE_S)) * 30);
  return phase % 2 === 0 ? 1 : -1;
}

export const veiledProp = defineProp({
  name: 'veiledProp',
  description:
    'Open-loop veil (voxel look): a question-mark crate that hides an object until the answer is spoken, then dissolves top-down in a pixel dither. cover(object) puts the object inside; update(t) every frame; revealAt on the closing phrase.',
  params: veiledPropParams,
  anchors: {
    top: 'top centre of the crate',
    mark: 'centre of the front question mark',
    inside: 'centre of the crate (where the covered object stands)',
  },
  methods: {
    'update(t)': 'trembles, dissolves and removes the crate for local time t; call every frame',
    'cover(object)': 'puts a kit object inside the crate (at its bottom centre); returns it',
    'progress(t)': 'reveal progress 0..1 at local time t',
  },
  build(params, tools) {
    const size = crateSize(params);
    const [w, h, d] = size;
    const colors: Record<Cell, string> = {
      frame: pick(tools, undefined, DARKEST),
      panel: pick(tools, params.color, GOLD_DARK),
      mark: pick(tools, undefined, PAPER),
    };
    const palette = [colors.frame, colors.panel, colors.mark];
    const index: Record<Cell, number> = { frame: 1, panel: 2, mark: 3 };
    const shell = propShell(tools, 'veiledProp', MEDIUM_VOXEL, params.scale);
    // One instanced shell (connected, no floating parts): a dissolve step hides its voxels by
    // scaling them to 0, so the crate breaks up voxel by voxel in the Bayer order.
    const model = tools.voxel.generate(
      size,
      (x, y, z) => {
        const cell = crateCell(x, y, z, size, params.mark);
        return cell === undefined ? 0 : index[cell];
      },
      palette,
    );
    const crate = tools.voxel.mesh(model, {
      voxelSize: MEDIUM_VOXEL,
      pivot: [w / 2, 0, d / 2],
      mode: 'instanced',
    });
    crate.name = 'veilCrate';
    shell.object.add(crate);
    const steps = Uint8Array.from({ length: crate.instanceCount }, (_, instance) => {
      const [x, y, z] = crate.instanceCell(instance);
      return veilStep(x, y, z, h);
    });
    /** Shown flags as last applied (instances are only touched when their flag changes). */
    const shown = new Uint8Array(crate.instanceCount).fill(1);
    const unit = MEDIUM_VOXEL;
    setAnchors(shell.object, {
      top: [0, h * unit, 0],
      mark: [0, (h / 2) * unit, (d / 2) * unit],
      inside: [0, (h / 2) * unit, 0],
    });
    const progress = (t: number): number =>
      revealProgress(finiteArg('veiledProp.progress(t)', t), params.revealAt, params.duration);
    const pose = (t: number): void => {
      const amount = revealProgress(t, params.revealAt, params.duration);
      crate.position.x = params.shake ? veilShake(t, params.revealAt) * unit : 0;
      steps.forEach((step, instance) => {
        const visible = veilStepShown(step, amount) ? 1 : 0;
        if (shown[instance] === visible) return;
        shown[instance] = visible;
        crate.setVoxelTransform(instance, { scale: visible });
      });
      crate.visible = amount < 1;
    };
    pose(0);
    const cover = (object: unknown): KitObject => {
      if (!isKitObject(object)) {
        throw new KitError(
          'invalid-params',
          'veiledProp.cover(object): pass a kit object (a prop or kit.voxel.mesh)',
        );
      }
      shell.object.add(object);
      return object;
    };
    return asProp(shell.object, { cover, progress }, pose);
  },
});
