/**
 * Asset screens of the voxel look (PLAN.md#12.11): `kit.props.billboard` (a roadside billboard on
 * posts with a catwalk and lamps) and `kit.props.assetScreen` (the kit's laptop or monitor with the
 * asset on its screen, optional scanlines, flicker and a top-down scan-in by t).
 */
import { z } from 'zod';
import { KitError } from '../errors.js';
import { laptop, laptopParams, monitor, monitorParams } from '../props/computers.js';
import {
  amountArg,
  asProp,
  colorField,
  DARK,
  finiteArg,
  gridPoint,
  MEDIUM_VOXEL,
  METAL,
  pick,
  propShell,
  scaleParam,
  seedParam,
  setAnchors,
  SMALL_VOXEL,
} from '../props/shared.js';
import { Sketch } from '../props/sketch.js';
import { defineProp } from '../registry.js';
import { assetCropSchema, assetParam, pictureSize } from './handle.js';
import { createPicturePlane, dimMap, screenFrame, type ScreenEffects } from './picture.js';

const cropField = assetCropSchema.optional().describe("Crop of this slot (default: the asset's)");

export const billboardParams = z.object({
  asset: assetParam,
  crop: cropField,
  pixels: z
    .int()
    .min(32)
    .max(320)
    .default(128)
    .describe('Picture width in pixels (2 per voxel; the height follows the picture, 1:1..3:1)'),
  posts: z.number().min(0).max(6).default(1.5).describe('Height of the posts in units'),
  glow: z
    .boolean()
    .default(true)
    .describe('true: lamp-lit picture glows (unlit); false: shaded by the scene lights'),
  frame: colorField('the frame and posts'),
  scale: scaleParam,
});

type BoardSlot = 'frame' | 'post' | 'lamp';
const BOARD_RIM = 2;

export const billboard = defineProp({
  name: 'billboard',
  description:
    "Roadside billboard showing an asset (ctx.assets.image('<id>')) on two posts with a catwalk and three lamps; ~4 units wide at 128 pixels, posts 1.5 units. For city streets, 'it was everywhere', advertising history. Static.",
  params: billboardParams,
  anchors: { picture: 'centre of the picture (faces +z)' },
  build(params, tools) {
    const width = params.pixels + (params.pixels % 2);
    const [, rawHeight] = pictureSize(params.asset.aspect, width, { minAspect: 1, maxAspect: 3 });
    const height = rawHeight + (rawHeight % 2);
    const boardW = width / 2 + 2 * BOARD_RIM;
    const boardH = height / 2 + 2 * BOARD_RIM;
    const postH = Math.round(params.posts / MEDIUM_VOXEL);
    const size = [boardW, postH + boardH + 3, 6] as const;
    const sketch = new Sketch<BoardSlot>(size, {
      frame: pick(tools, params.frame, DARK),
      post: pick(tools, params.frame, METAL),
      lamp: { color: 'keyLight', glow: true },
    });
    const top = postH + boardH;
    for (const x of [Math.floor(boardW * 0.2), Math.floor(boardW * 0.8) - 2]) {
      sketch.box('post', [x, 0, 1], [x + 2, postH, 3]);
    }
    sketch.box('frame', [0, postH, 1], [boardW, top, 3]);
    sketch.box(null, [BOARD_RIM, postH + BOARD_RIM, 2], [boardW - BOARD_RIM, top - BOARD_RIM, 3]);
    sketch.box('post', [0, postH - 1, 3], [boardW, postH, 6]);
    for (const x of [
      Math.floor(boardW / 6),
      Math.floor(boardW / 2),
      Math.floor((boardW * 5) / 6),
    ]) {
      sketch
        .box('post', [x, top, 2], [x + 1, top + 2, 3])
        .box('post', [x, top + 1, 3], [x + 1, top + 2, 5]);
      sketch.set('lamp', x, top + 1, 5);
    }
    const shell = propShell(tools, 'billboard', MEDIUM_VOXEL, params.scale);
    const body = shell.mesh(sketch, [boardW / 2, 0, 2]);
    const pixels = params.asset.pixels(width, height, { crop: params.crop });
    const plane = createPicturePlane(tools, {
      name: 'billboard.picture',
      pixels,
      pixelSize: MEDIUM_VOXEL / 2,
      lit: !params.glow,
    });
    const centre = gridPoint(body, [boardW / 2, postH + boardH / 2, 2.05]);
    plane.mesh.position.set(...centre);
    shell.object.add(plane.mesh);
    setAnchors(shell.object, { picture: centre });
    return asProp(shell.object, {});
  },
});

export const assetScreenParams = z.object({
  asset: assetParam,
  crop: cropField,
  device: z.enum(['monitor', 'laptop']).default('monitor').describe('Kit monitor or laptop'),
  open: z.number().min(0).max(1).default(1).describe('Laptop lid 0 closed .. 1 open'),
  scanlines: z.boolean().default(false).describe('Every other row one tone darker'),
  flicker: z.number().min(0).max(1).default(0).describe('Seeded dim frames and a rolling hum bar'),
  revealAt: z
    .number()
    .optional()
    .describe('Local time the picture scans in top-down (omit = already shown)'),
  revealTime: z.number().positive().max(10).default(0.8).describe('Seconds of the scan-in'),
  shell: colorField('the case'),
  seed: seedParam,
  scale: scaleParam,
});

export const assetScreen = defineProp({
  name: 'assetScreen',
  description:
    "The kit's monitor (~1.5 units wide) or laptop with an asset (ctx.assets.image('<id>')) on its screen, pixelised into the style palette; optional scanlines, flicker and a top-down scan-in by t; power(on) switches it off. 'Someone looks at the evidence', a web photo on a screen. Call update(t) every frame.",
  params: assetScreenParams,
  anchors: { screen: 'centre of the screen (faces +z; laptop: as built with `open`)' },
  methods: {
    'update(t)': 'scan-in, flicker and scanlines for local time t; call every frame',
    'power(on)': 'screen on/off (true/false or 0..1)',
    'open(amount)': 'laptop lid 0 (closed) .. 1 (open)',
  },
  build(params, tools) {
    // The device is built at scale 1 inside the assetScreen object, which carries the scale.
    const common = { screen: 'blank', shell: params.shell, scale: 1 } as const;
    let openLid: (amount: number) => void = () => undefined;
    let device;
    if (params.device === 'laptop') {
      const built = laptop.build(laptopParams.parse({ ...common, open: params.open }), tools);
      openLid = (amount) => {
        built.open(amount);
      };
      device = built;
    } else device = monitor.build(monitorParams.parse(common), tools);
    const screenMesh = device.getObjectByName(`${params.device}.screen`);
    const parent = screenMesh?.parent;
    if (!screenMesh || !parent) {
      throw new KitError('invalid-model', `assetScreen: the ${params.device} has no screen mesh`);
    }
    const pixels = params.asset.pixels(device.screen.width, device.screen.height, {
      crop: params.crop,
    });
    const plane = createPicturePlane(tools, {
      name: 'assetScreen.picture',
      pixels,
      pixelSize: SMALL_VOXEL / 2,
      lit: false,
    });
    plane.mesh.position.copy(screenMesh.position);
    plane.mesh.quaternion.copy(screenMesh.quaternion);
    screenMesh.visible = false;
    parent.add(plane.mesh);
    const dim = dimMap(pixels.colors);
    let on = true;
    let lastT = 0;
    const effects = (): ScreenEffects => ({
      scanlines: params.scanlines,
      flicker: params.flicker,
      revealAt: params.revealAt,
      revealTime: params.revealTime,
      on,
      seed: params.seed,
    });
    const pose = (t: number): void => {
      lastT = finiteArg('assetScreen.update(t)', t);
      plane.show(screenFrame(pixels, dim, effects(), lastT));
    };
    pose(0);
    const power = (value: boolean | number): void => {
      on = amountArg('assetScreen.power(on)', value) >= 0.5;
      pose(lastT);
    };
    const open = (amount: number): void => {
      openLid(amount);
    };
    const shell = propShell(tools, 'assetScreen', SMALL_VOXEL, params.scale);
    shell.object.add(device);
    const screen = device.anchor('screen');
    shell.object.setAnchor('screen', [screen.x, screen.y, screen.z]);
    return asProp(shell.object, { power, open }, pose);
  },
});
