/**
 * `kit.env.retroDesktop`: the backdrop of retro-UI shots. `os` = a retro-OS desktop (menu bar with
 * a blinking clock, desktop icons, synthwave/checker/plain wallpaper); `desk` = a dark dithered
 * wall with a voxel wooden desk in front, for a CRT standing on it. A flat plane facing +z centred
 * on the origin; put templates in front of it (z = 0.02, 0.04...).
 */
import { z } from 'zod';
import { defineEnv, type KitTools } from '../../registry.js';
import {
  checkerRect,
  ditherFill,
  ditherPick,
  drawSprite,
  drawText,
  fillRect,
  rect,
  textWidth,
  type PixelCanvas,
  type Rect,
} from './canvas.js';
import { drawIcon, iconKindOf } from './chrome.js';
import { ACCENT_BRIGHT, ACCENT_RAMP, C, resolveRoles } from './colors.js';
import { accentParam, pixelParam, seedParam } from './marks.js';
import { createSurface, type AnchorMap, type RetroPainter } from './surface.js';

const MENU = 12;
const DESK_VOXEL = 4;
const LOGO = ['..#..', '.###.', '#####', '.....', '#####'];

export const retroDesktopParams = z.object({
  variant: z
    .enum(['os', 'desk'])
    .default('os')
    .describe('os = retro-OS desktop; desk = wall + voxel desk'),
  size: z
    .tuple([z.int().min(96).max(640), z.int().min(64).max(400)])
    .default([400, 240])
    .describe('[width, height] in UI pixels (larger than 320x180 leaves room for camera moves)'),
  wallpaper: z.enum(['synth', 'checker', 'plain']).default('synth').describe('os wallpaper'),
  title: z.string().max(20).default('REELFORGE OS').describe('Menu bar name'),
  menu: z
    .array(z.string().max(8))
    .max(5)
    .default(['FILE', 'EDIT', 'VIEW', 'SPECIAL'])
    .describe('Menu items'),
  clock: z.string().max(8).default('12:00').describe('Menu bar clock (colon blinks)'),
  icons: z
    .array(z.string().max(12))
    .max(6)
    .default(['MY PC', 'FILES', 'MAIL', 'TRASH'])
    .describe('Desktop icons'),
  accent: accentParam,
  pixel: pixelParam,
  seed: seedParam,
});

export type RetroDesktopParams = z.output<typeof retroDesktopParams>;

function synthWallpaper(
  canvas: PixelCanvas,
  area: Rect,
  accent: RetroDesktopParams['accent'],
): void {
  const horizon = area.y + Math.round(area.h * 0.6);
  const sky = rect(area.x, area.y, area.w, horizon - area.y);
  ditherFill(canvas, sky, [C.navy, C.indigo, C.purple, C.wine], (_u, v) => v * 0.95);
  const cx = area.x + area.w / 2;
  const radius = Math.round(area.h * 0.24);
  const sunY = horizon - Math.round(radius * 0.3);
  for (let y = sunY - radius; y < horizon; y += 1) {
    const depth = (y - (sunY - radius)) / (horizon - (sunY - radius));
    const gap = depth > 0.45 ? (depth > 0.75 ? 2 : 1) : 0;
    if ((horizon - y) % 5 < gap) continue;
    const half = Math.sqrt(Math.max(0, radius * radius - (y - sunY) ** 2));
    for (let x = Math.round(cx - half); x < Math.round(cx + half); x += 1) {
      fillRect(
        canvas,
        { x, y, w: 1, h: 1 },
        ditherPick(x, y, 1 - depth, [C.pink, C.orange, C.amber]),
      );
    }
  }
  const ground = rect(area.x, horizon, area.w, area.y + area.h - horizon);
  fillRect(canvas, ground, C.navy);
  const line = ACCENT_BRIGHT[accent];
  for (let step = 0; step < 9; step += 1) {
    const y = horizon + Math.round(ground.h * (step / 8) ** 2);
    if (step === 0) fillRect(canvas, { x: area.x, y, w: area.w, h: 1 }, line);
    else if (step < 3) checkerRect(canvas, { x: area.x, y, w: area.w, h: 1 }, line);
    else fillRect(canvas, { x: area.x, y, w: area.w, h: 1 }, line);
  }
  for (let ray = -12; ray <= 12; ray += 1) {
    const bottomX = cx + ray * area.w * 0.12;
    for (let y = horizon; y < area.y + area.h; y += 1) {
      const k = (y - horizon) / Math.max(1, ground.h);
      const x = Math.round(cx + (bottomX - cx) * k);
      if (k < 0.15 && ((x + y) & 1) === 1) continue;
      fillRect(canvas, { x, y, w: 1, h: 1 }, line);
    }
  }
}

function paintOs(canvas: PixelCanvas, params: RetroDesktopParams, t: number): AnchorMap {
  const wall = rect(0, MENU, canvas.width, canvas.height - MENU);
  if (params.wallpaper === 'synth') synthWallpaper(canvas, wall, params.accent);
  else if (params.wallpaper === 'checker') {
    fillRect(canvas, wall, C.indigo);
    checkerRect(canvas, wall, C.purple);
  } else fillRect(canvas, wall, C.slateBlue);
  fillRect(canvas, rect(0, 0, canvas.width, MENU), C.grey);
  fillRect(canvas, rect(0, 0, canvas.width, 1), C.cream);
  fillRect(canvas, rect(0, MENU - 1, canvas.width, 1), C.black);
  const [dark, light] = ACCENT_RAMP[params.accent];
  drawSprite(canvas, LOGO, { '#': light }, 5, 3);
  drawSprite(canvas, ['#####'], { '#': dark }, 5, 6);
  let x = 15;
  x += drawText(canvas, params.title, x, 2, C.black, { bold: true }) + 10;
  const anchors: AnchorMap = { menu: [canvas.width / 2, MENU / 2], logo: [7, 5] };
  params.menu.forEach((item, index) => {
    const width = drawText(canvas, item, x, 2, C.black);
    anchors[`menu:${String(index)}`] = [x + width / 2, 5.5];
    x += width + 10;
  });
  const colonOn = Math.floor(t * 2) % 2 === 0;
  const clock = colonOn ? params.clock : params.clock.replaceAll(':', ' ');
  const clockX = canvas.width - 6 - textWidth(params.clock);
  drawText(canvas, clock, clockX, 2, C.black);
  anchors['clock'] = [clockX + textWidth(params.clock) / 2, 5.5];
  params.icons.forEach((label, index) => {
    const y = MENU + 8 + index * 34;
    if (y + 26 > canvas.height) return;
    drawIcon(canvas, iconKindOf(label), 14, y);
    const width = textWidth(label, { font: 'small' });
    const left = Math.round(22 - width / 2);
    fillRect(canvas, rect(left - 1, y + 16, width + 2, 7), C.black);
    drawText(canvas, label, left, y + 17, C.cream, { font: 'small' });
    anchors[`icon:${String(index)}`] = [22, y + 7];
  });
  anchors['screen'] = [canvas.width / 2, (canvas.height + MENU) / 2];
  return anchors;
}

function paintWall(canvas: PixelCanvas): AnchorMap {
  const area = rect(0, 0, canvas.width, canvas.height);
  ditherFill(canvas, area, [C.black, C.navy, C.indigo, C.purple], (u, v) => {
    const glow = Math.max(0, 1 - Math.hypot((u - 0.5) * 1.6, (v - 0.62) * 1.2));
    return 0.18 + v * 0.22 + glow * 0.45;
  });
  for (let x = 12; x < canvas.width; x += 24)
    checkerRect(canvas, rect(x, 0, 1, canvas.height), C.navy);
  return {
    screen: [canvas.width / 2, canvas.height / 2],
    wall: [canvas.width / 2, canvas.height / 2],
  };
}

export function desktopPainter(params: RetroDesktopParams): RetroPainter {
  return {
    width: params.size[0],
    height: params.size[1],
    paint(canvas, t) {
      return params.variant === 'os' ? paintOs(canvas, params, t) : paintWall(canvas);
    },
  };
}

/** The desk slab of the `desk` variant (top at 30 % of the wall height, 1.3 units deep). */
function deskParts(tools: KitTools, params: RetroDesktopParams) {
  const names = resolveRoles(tools.palette).names;
  const voxel = params.pixel * DESK_VOXEL;
  const width = Math.ceil(params.size[0] / DESK_VOXEL);
  const depth = Math.max(8, Math.round(1.3 / voxel));
  const thick = 2;
  const model = tools.voxel.generate(
    [width, thick, depth],
    (x, y, zIndex) =>
      y === thick - 1 && zIndex % 6 === 0 ? 2 : x % 23 === 0 && y === thick - 1 ? 2 : 1,
    [names.burnt, names.rust],
  );
  const mesh = tools.voxel.mesh(model, { voxelSize: voxel, pivot: [width / 2, thick, 0] });
  const top = -params.size[1] * params.pixel * 0.5 + params.size[1] * params.pixel * 0.3;
  mesh.position.set(0, top, 0);
  return { mesh, top, depth: depth * voxel };
}

export const retroDesktop = defineEnv({
  name: 'retroDesktop',
  description:
    'Backdrop of the retro-ui look: os = retro-OS desktop (menu bar, blinking clock, icons, synthwave/checker wallpaper); desk = dithered dark wall with a voxel wooden desk for a CRT. A flat plane facing +z; put retro templates in front of it.',
  params: retroDesktopParams,
  anchors: {
    screen: 'centre of the free desktop / wall',
    menu: 'menu bar',
    'menu:<i>': 'menu item i',
    clock: 'menu bar clock',
    'icon:<i>': 'desktop icon i',
    desk: 'desk variant: middle of the desk top (stand a CRT on it with on(env, { at: "desk" }))',
  },
  methods: {
    'update(t)': 'blinks the clock colon; call every frame',
    'fitDistance(px = 2, fov = 50)': 'camera distance for one UI pixel = px frame pixels',
  },
  build(params, tools) {
    const desk = params.variant === 'desk' ? deskParts(tools, params) : undefined;
    const object = createSurface(tools, {
      kitType: 'retroDesktop',
      painter: desktopPainter(params),
      pixel: params.pixel,
      parts: desk ? [desk.mesh] : [],
    });
    if (desk) object.setAnchor('desk', [0, desk.top, desk.depth / 2]);
    return object;
  },
});
