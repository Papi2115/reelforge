/**
 * `kit.props.retroCrt`: a CRT screen - in a voxel monitor or TV casing, or bare - showing a
 * content slot through the tube (crt-screen.ts): `crt.show(child)` displays another retro
 * template (terminal, window, browser, document) with curvature, scanlines, phosphor tint, glow,
 * flicker and power on/off; without a child it shows text, colour bars or a photo.
 */
import { z } from 'zod';
import { defineProp, type KitTools } from '../../registry.js';
import type { VoxelColor } from '../../voxel/model.js';
import {
  createCanvas,
  drawTextCentered,
  fillRect,
  lineHeight,
  textWidth,
  type PixelCanvas,
} from './canvas.js';
import { C, CRT_TINTS, resolveRoles, tintMap, type RoleColors } from './colors.js';
import { paintTube, powerState, tubePoint } from './crt-screen.js';
import { pixelParam, seedParam } from './marks.js';
import { drawPhoto, PHOTO_KINDS } from './photo.js';
import { adoptChild, createSurface, type AnchorMap, type RetroPainter } from './surface.js';

const DENSITY = 2;
/** UI pixels per casing voxel. */
const CASING_VOXEL = 4;
const BARS = [C.cream, C.amber, C.cyan, C.green, C.pink, C.magenta, C.teal, C.navy];

export const retroCrtParams = z.object({
  size: z
    .tuple([z.int().min(48).max(320), z.int().min(40).max(240)])
    .default([160, 120])
    .describe('Screen [width, height] in UI pixels (4:3 looks right)'),
  casing: z
    .enum(['monitor', 'tv', 'none'])
    .default('monitor')
    .describe('Voxel casing or bare tube'),
  tint: z.enum(CRT_TINTS).default('color').describe('Phosphor: color, green or amber monochrome'),
  curvature: z.number().min(0).max(1).default(0.5).describe('Barrel bulge and corner rounding'),
  scanlines: z.boolean().default(true).describe('Every other row one tone darker'),
  flicker: z.number().min(0).max(1).default(0.3).describe('Seeded flicker and rolling hum bar'),
  powerOn: z.number().optional().describe('Local time it switches on (line -> image, 0.5 s)'),
  powerOff: z.number().optional().describe('Local time it switches off (image -> line -> dot)'),
  content: z
    .enum(['text', 'bars', 'photo'])
    .default('text')
    .describe('Shown when no child: text, colour bars, photo'),
  text: z.array(z.string().max(20)).max(4).default(['NO SIGNAL']).describe('Text content lines'),
  photo: z.enum(PHOTO_KINDS).default('portrait').describe('Photo content kind'),
  pixel: pixelParam,
  seed: seedParam,
});

export type RetroCrtParams = z.output<typeof retroCrtParams>;

function paintContent(canvas: PixelCanvas, params: RetroCrtParams, seed: number): void {
  fillRect(canvas, { x: 0, y: 0, w: canvas.width, h: canvas.height }, C.navy);
  if (params.content === 'bars') {
    const width = canvas.width / BARS.length;
    BARS.forEach((color, index) => {
      fillRect(
        canvas,
        {
          x: Math.round(index * width),
          y: 0,
          w: Math.ceil(width),
          h: Math.round(canvas.height * 0.7),
        },
        color,
      );
    });
    fillRect(
      canvas,
      { x: 0, y: Math.round(canvas.height * 0.7), w: canvas.width, h: canvas.height },
      C.black,
    );
    return;
  }
  if (params.content === 'photo') {
    drawPhoto(canvas, { x: 0, y: 0, w: canvas.width, h: canvas.height }, params.photo, seed, [
      C.black,
      C.indigo,
      C.violet,
      C.pink,
      C.amber,
      C.cream,
    ]);
    return;
  }
  const wide = params.text.every((line) => textWidth(line, { scale: 2 }) <= canvas.width - 12);
  const style = wide ? { scale: 2 } : {};
  const total = params.text.length * lineHeight(style);
  params.text.forEach((line, index) => {
    const y = Math.round((canvas.height - total) / 2 + index * lineHeight(style));
    drawTextCentered(canvas, line, canvas.width / 2, y, C.cream, style);
  });
}

export function crtPainter(
  params: RetroCrtParams,
  colors: RoleColors,
): RetroPainter & { child?: RetroPainter } {
  const tint = tintMap(colors, params.tint);
  let content: PixelCanvas | undefined;
  const painter: RetroPainter & { child?: RetroPainter } = {
    width: params.size[0],
    height: params.size[1],
    paint(canvas, t) {
      const w = Math.max(1, Math.round(canvas.width / DENSITY));
      const h = Math.max(1, Math.round(canvas.height / DENSITY));
      if (content?.width !== w || content.height !== h) content = createCanvas(w, h);
      content.data.fill(0);
      let childAnchors: AnchorMap = {};
      if (painter.child) {
        fillRect(content, { x: 0, y: 0, w, h }, C.black);
        childAnchors = painter.child.paint(content, t);
      } else paintContent(content, params, params.seed);
      const power = powerState(t, params.powerOn, params.powerOff);
      paintTube(
        canvas,
        content,
        {
          tint,
          luminance: colors.luminance,
          curvature: params.curvature,
          scanlines: params.scanlines,
          flicker: params.flicker,
          seed: params.seed,
        },
        power,
        t,
      );
      const anchors: AnchorMap = {};
      for (const [name, point] of Object.entries(childAnchors)) {
        anchors[name] = tubePoint(point, content, canvas, params.curvature);
      }
      anchors['screen'] = [canvas.width / 2, canvas.height / 2];
      return anchors;
    },
  };
  return painter;
}

interface Casing {
  readonly model: {
    size: [number, number, number];
    fill: (x: number, y: number, z: number) => number;
  };
  readonly palette: VoxelColor[];
  /** Grid point of the screen centre on the front face. */
  readonly pivot: [number, number, number];
  readonly led: [number, number, number];
}

function casingModel(params: RetroCrtParams, colors: RoleColors): Casing {
  const tv = params.casing === 'tv';
  const sw = Math.ceil(params.size[0] / CASING_VOXEL);
  const sh = Math.ceil(params.size[1] / CASING_VOXEL);
  const side = 3;
  const right = tv ? 10 : 3;
  const bottom = tv ? 3 : 6;
  const stand = tv ? 0 : 3;
  const front = 5;
  const bulge = tv ? 9 : 8;
  const X = side + sw + right;
  const Y = stand + bottom + sh + 3;
  const Z = bulge + front;
  const n = colors.names;
  const palette: VoxelColor[] = tv
    ? [n.burnt, n.rust, n.black, n.darkGrey, { color: n.pink, glow: true }]
    : [n.grey, n.midGrey, n.black, n.darkGrey, { color: n.green, glow: true }];
  const [BODY, TRIM, HOLE, DARK, LED] = [1, 2, 3, 4, 5] as const;
  const sx0 = side;
  const sy0 = stand + bottom;
  const led: [number, number, number] = tv ? [X - 4, sy0 + 3, Z] : [X - 6, stand + 2, Z];
  const fill = (x: number, y: number, z: number): number => {
    if (y < stand) {
      const foot = y === 0 && Math.abs(x - X / 2) < sw * 0.3 && z >= bulge - 4 && z < Z;
      const neck = y > 0 && Math.abs(x - X / 2) < 5 && z >= bulge && z < Z - 1;
      return foot || neck ? TRIM : 0;
    }
    const inScreen = x >= sx0 && x < sx0 + sw && y >= sy0 && y < sy0 + sh;
    if (z >= bulge) {
      if (inScreen) return z < Z - 2 ? HOLE : 0;
      if (x === led[0] && y === led[1] && z === Z - 1) return LED;
      if (tv && x >= sx0 + sw + 2 && x < X - 2) {
        const knob = (y === sy0 + sh - 4 || y === sy0 + sh - 9) && x % 3 !== 0;
        if (knob && z === Z - 1) return DARK;
        if (y < sy0 + sh - 12 && y > sy0 + 4 && y % 2 === 0 && z === Z - 1) return DARK;
      }
      if (!tv && y === stand + 2 && x >= side + 2 && x < side + 7 && z === Z - 1) return DARK;
      const edge = x === 0 || x === X - 1 || y === stand || y === Y - 1;
      return edge && z === Z - 1 ? TRIM : BODY;
    }
    const taper = 3 + Math.floor((bulge - 1 - z) / 3);
    const inBulge = x >= taper && x < X - taper && y >= stand + taper - 1 && y < Y - taper;
    return inBulge ? TRIM : 0;
  };
  return { model: { size: [X, Y, Z], fill }, palette, pivot: [sx0 + sw / 2, sy0 + sh / 2, Z], led };
}

function casingParts(tools: KitTools, params: RetroCrtParams, colors: RoleColors) {
  if (params.casing === 'none') return { parts: [], led: undefined };
  const casing = casingModel(params, colors);
  const voxelSize = params.pixel * CASING_VOXEL;
  const model = tools.voxel.generate(casing.model.size, casing.model.fill, casing.palette);
  const mesh = tools.voxel.mesh(model, { voxelSize, pivot: casing.pivot });
  const led = mesh.gridToLocal([casing.led[0] + 0.5, casing.led[1] + 0.5, casing.led[2]]);
  return { parts: [mesh], led: [led.x, led.y, led.z] as [number, number, number] };
}

export const retroCrt = defineProp({
  name: 'retroCrt',
  description:
    'CRT screen (look retro-ui) in a voxel monitor/TV casing or bare: curvature, 1-px scanlines, phosphor tint (color/green/amber), glow, seeded flicker, power on/off by t. crt.show(child) displays another retro template through the tube (terminal in a CRT); else text, colour bars or a photo.',
  params: retroCrtParams,
  anchors: {
    screen: 'centre of the screen',
    led: 'power LED (casings)',
    '<child anchors>':
      "after show(child): the child's anchors (line:3, cursor, mark:...) mapped onto the tube",
  },
  methods: {
    'update(t)': 'repaints the tube for local time t (child, flicker, power); call every frame',
    'show(child)': 'displays a retro template through the tube; the child itself is hidden',
    'fitDistance(px = 2, fov = 50)': 'camera distance for one screen UI pixel = px frame pixels',
  },
  build(params, tools) {
    const colors = resolveRoles(tools.palette);
    const painter = crtPainter(params, colors);
    const { parts, led } = casingParts(tools, params, colors);
    const recess = params.casing === 'none' ? 0 : -params.pixel * CASING_VOXEL * 1.5;
    const object = createSurface(tools, {
      kitType: 'retroCrt',
      painter,
      pixel: params.pixel,
      density: DENSITY,
      parts,
      planeOffset: [0, 0, recess],
    });
    if (led) object.setAnchor('led', led);
    const show = (child: unknown): typeof object => {
      painter.child = adoptChild('retroCrt.show(child)', child);
      object.update(0);
      return object;
    };
    return Object.assign(object, { show });
  },
});
