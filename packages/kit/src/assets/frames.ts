/**
 * Asset prints of the voxel look (PLAN.md#12.11): `kit.props.photoFrame` (a framed picture with a
 * matte, on a wall or standing on a desk) and `kit.props.polaroid` (an instant photo with a caption
 * strip that can develop by t). The picture is the asset stylised by the engine; the voxel parts
 * use the kit's colour chains, so both follow the style.
 */
import { z } from 'zod';
import { drawText, GLYPH_ADVANCE } from '../props/font.js';
import {
  asProp,
  colorField,
  DARK,
  finiteArg,
  gridPoint,
  INK,
  PAPER,
  pick,
  propShell,
  scaleParam,
  setAnchors,
  SMALL_VOXEL,
} from '../props/shared.js';
import { Sketch } from '../props/sketch.js';
import { defineProp } from '../registry.js';
import { assetCropSchema, assetParam, pictureSize } from './handle.js';
import { createPicturePlane, dimMap } from './picture.js';

/** Picture pixels per voxel (like the kit's screens). */
export const PICTURE_DENSITY = 2;
const PIXEL = SMALL_VOXEL / PICTURE_DENSITY;
const BORDER = 2;
/** Lean of a standing frame (radians, top away from the camera). */
const STAND_LEAN = 0.12;

const cropField = assetCropSchema.optional().describe("Crop of this slot (default: the asset's)");
const glowField = (fallback: boolean, what: string) =>
  z
    .boolean()
    .default(fallback)
    .describe(`true: the picture glows (unlit); false: ${what} shaded by the scene lights`);

/** Even pixel size of a picture `pixels` wide following the asset's aspect (1:2 .. 2:1). */
function evenSize(aspect: number, pixels: number): readonly [number, number] {
  const width = pixels + (pixels % 2);
  const [, height] = pictureSize(aspect, width, { minAspect: 0.5, maxAspect: 2 });
  return [width, height + (height % 2)];
}

export const photoFrameParams = z.object({
  asset: assetParam,
  crop: cropField,
  pixels: z
    .int()
    .min(16)
    .max(256)
    .default(64)
    .describe('Picture width in pixels (2 per voxel; the height follows the picture, 1:2..2:1)'),
  mount: z
    .enum(['wall', 'stand'])
    .default('wall')
    .describe('wall: flat, back at z = 0 (hang it on a wall); stand: leans back on a foot (desk)'),
  matte: z.int().min(0).max(8).default(2).describe('Matte width in voxels (0 = none)'),
  frame: colorField('the frame'),
  matteColor: colorField('the matte'),
  glow: glowField(false, 'a print'),
  scale: scaleParam,
});

type FrameSlot = 'frame' | 'matte';

export const photoFrame = defineProp({
  name: 'photoFrame',
  description:
    "Framed picture of an asset (ctx.assets.image('<id>')) with a matte: hangs flat on a wall (mount 'wall', back at z = 0) or stands leaning on a foot ('stand'). The picture is pixelised into the style palette; ~1 unit wide at the default 64 pixels. Evidence, portraits, 'the real photo'. Static.",
  params: photoFrameParams,
  anchors: { picture: 'centre of the picture (faces +z)' },
  build(params, tools) {
    const [pw, ph] = evenSize(params.asset.aspect, params.pixels);
    const rim = BORDER + params.matte;
    const size = [pw / PICTURE_DENSITY + 2 * rim, ph / PICTURE_DENSITY + 2 * rim, 2] as const;
    const sketch = new Sketch<FrameSlot>(size, {
      frame: pick(tools, params.frame, DARK),
      matte: pick(tools, params.matteColor, PAPER),
    });
    sketch.box('frame', [0, 0, 0], [size[0], size[1], 2]);
    sketch.box('matte', [BORDER, BORDER, 1], [size[0] - BORDER, size[1] - BORDER, 2]);
    sketch.box(null, [rim, rim, 1], [size[0] - rim, size[1] - rim, 2]);
    const shell = propShell(tools, 'photoFrame', SMALL_VOXEL, params.scale);
    const holder = tools.voxel.group();
    shell.object.add(holder);
    const lift = params.mount === 'stand' ? 1 : 0;
    const body = tools.voxel.mesh(sketch.model(tools.voxel), {
      voxelSize: SMALL_VOXEL,
      pivot: [size[0] / 2, -lift, 0],
    });
    holder.add(body);
    if (params.mount === 'stand') {
      const foot = new Sketch<'frame'>([size[0], 1, 8], { frame: pick(tools, params.frame, DARK) });
      foot.box('frame', [0, 0, 0], [size[0], 1, 8]);
      shell.mesh(foot, [size[0] / 2, 0, 6]);
      holder.rotation.x = -STAND_LEAN;
    }
    const pixels = params.asset.pixels(pw, ph, { crop: params.crop });
    const plane = createPicturePlane(tools, {
      name: 'photoFrame.picture',
      pixels,
      pixelSize: PIXEL,
      lit: !params.glow,
    });
    plane.mesh.position.set(...gridPoint(body, [size[0] / 2, size[1] / 2, 1.05]));
    holder.add(plane.mesh);
    holder.updateMatrix();
    const centre = plane.mesh.position.clone().applyMatrix4(holder.matrix);
    setAnchors(shell.object, { picture: [centre.x, centre.y, centre.z] });
    return asProp(shell.object, {});
  },
});

export const polaroidParams = z.object({
  asset: assetParam,
  crop: cropField,
  pixels: z.int().min(16).max(160).default(48).describe('Square picture size in pixels'),
  caption: z
    .string()
    .max(14)
    .default('')
    .describe(
      'Line on the strip (A-Z 0-9 . , : - + = % $ / ! ?); fits pixels / 8 characters, the rest is cut',
    ),
  developAt: z
    .number()
    .optional()
    .describe('Local time the photo develops from dark (2 s; omit = developed)'),
  tilt: z.number().min(-45).max(45).default(-6).describe('Roll in degrees (a casual angle)'),
  glow: glowField(false, 'the photo is'),
  scale: scaleParam,
});

type CardSlot = 'card' | 'ink';
const STRIP = 9;
const DEVELOP_TIME = 2;
const DEVELOP_STEPS = 3;

export const polaroid = defineProp({
  name: 'polaroid',
  description:
    "Instant photo of an asset (ctx.assets.image('<id>')): square picture on a white card with a caption strip, slightly tilted, standing upright facing +z (rotate x by -90 deg to lay it on a desk). developAt makes it develop from dark. ~0.9 units tall at 48 pixels. Call polaroid.update(t) every frame when developing.",
  params: polaroidParams,
  anchors: {
    picture: 'centre of the picture (faces +z)',
    caption: 'centre of the caption strip',
  },
  methods: { 'update(t)': 'develops the photo (developAt); call every frame' },
  build(params, tools) {
    const side = params.pixels + (params.pixels % 2);
    const inner = side / PICTURE_DENSITY;
    const size = [inner + 2 * BORDER, inner + BORDER + STRIP, 1] as const;
    const sketch = new Sketch<CardSlot>(size, {
      card: pick(tools, undefined, PAPER),
      ink: pick(tools, undefined, INK),
    });
    sketch.box('card', [0, 0, 0], size);
    const fits = Math.floor((inner + 1) / GLYPH_ADVANCE);
    const caption = Array.from(params.caption).slice(0, fits).join('');
    drawText(caption, { x: BORDER, y: 0, width: inner }, 1, 'center', (x, y) => {
      sketch.paint('ink', [x, STRIP - 2 - y, 0], [x + 1, STRIP - 1 - y, 1]);
    });
    const shell = propShell(tools, 'polaroid', SMALL_VOXEL, params.scale);
    const holder = tools.voxel.group();
    shell.object.add(holder);
    const card = tools.voxel.mesh(sketch.model(tools.voxel), {
      voxelSize: SMALL_VOXEL,
      pivot: [size[0] / 2, size[1] / 2, 0],
    });
    holder.add(card);
    holder.position.y = (size[1] / 2) * SMALL_VOXEL;
    holder.rotation.z = (params.tilt * Math.PI) / 180;
    const pixels = params.asset.pixels(side, side, { crop: params.crop ?? 'cover' });
    const plane = createPicturePlane(tools, {
      name: 'polaroid.picture',
      pixels,
      pixelSize: PIXEL,
      lit: !params.glow,
    });
    plane.mesh.position.set(...gridPoint(card, [size[0] / 2, STRIP + inner / 2, 1.02]));
    holder.add(plane.mesh);
    holder.updateMatrix();
    const at = (point: readonly [number, number, number]) => {
      const local = new tools.three.Vector3(...gridPoint(card, point)).applyMatrix4(holder.matrix);
      return [local.x, local.y, local.z] as const;
    };
    setAnchors(shell.object, {
      picture: at([size[0] / 2, STRIP + inner / 2, 1]),
      caption: at([size[0] / 2, STRIP / 2, 1]),
    });
    const dim = dimMap(pixels.colors);
    const developed = (steps: number): Uint8Array =>
      pixels.indices.map((index) => {
        let value = index;
        for (let step = 0; step < steps; step += 1) value = dim[value] ?? value;
        return value;
      });
    const stages = Array.from({ length: DEVELOP_STEPS + 1 }, (_, steps) => developed(steps));
    const pose = (t: number): void => {
      const time = finiteArg('polaroid.update(t)', t);
      if (params.developAt === undefined) return;
      const k = Math.min(1, Math.max(0, (time - params.developAt) / DEVELOP_TIME));
      const steps = DEVELOP_STEPS - Math.floor(k * DEVELOP_STEPS);
      plane.show(stages[steps] ?? pixels.indices);
    };
    pose(0);
    return asProp(shell.object, {}, pose);
  },
});
