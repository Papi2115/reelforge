/**
 * `kit.props.paperRoom`: a cut-away paper room like a toy theatre. The shell (back wall with a
 * dotted wallpaper, side walls, ceiling, a planked floor in one-point perspective) lies on the
 * piece's layer, the furniture one layer nearer (so it shades the wall) and optional theatre
 * curtains two layers nearer. Laid out in 640x360 reference pixels around the frame centre.
 */
import { z } from 'zod';
import { defineProp } from '../../registry.js';
import type { PaperColors } from './colors.js';
import { seedParam, toneParam } from './landscape.js';
import { finishPaper, PAPER_GRAIN } from './paper.js';
import { createPiece, type PieceModel, type PosedPart } from './piece.js';
import {
  createSprite,
  fillEllipse,
  fillLine,
  fillPolygon,
  fillRect,
  type Point,
  type Sprite,
} from './sprite.js';

export const FURNITURE = [
  'window',
  'frame',
  'shelf',
  'table',
  'chair',
  'lamp',
  'plant',
  'rug',
] as const;
export type Furniture = (typeof FURNITURE)[number];

/** Back wall corners and the floor's vanishing point (reference pixels). */
const WALL = { left: 110, right: 530, top: 50, bottom: 250 } as const;
const VANISH: Point = [320, 40];

/** Box of each furniture item [x0, y0, x1, y1] and its anchor (reference pixels). */
const SLOTS: Readonly<
  Record<Furniture, { box: readonly [number, number, number, number]; anchor: Point }>
> = {
  window: { box: [370, 72, 472, 162], anchor: [421, 115] },
  frame: { box: [262, 82, 318, 128], anchor: [290, 105] },
  shelf: { box: [138, 112, 238, 254], anchor: [188, 150] },
  table: { box: [268, 226, 394, 292], anchor: [331, 232] },
  chair: { box: [398, 206, 446, 294], anchor: [422, 250] },
  lamp: { box: [484, 136, 532, 262], anchor: [508, 150] },
  plant: { box: [222, 232, 268, 304], anchor: [245, 255] },
  rug: { box: [220, 290, 420, 336], anchor: [320, 313] },
};

interface RoomTones {
  readonly wall: number;
  readonly floor: number;
  readonly wood: number;
  readonly curtain: number;
}

/** Point along the ray from the vanishing point through p, `k` times as far. */
function away(p: Point, k: number): Point {
  return [VANISH[0] + (p[0] - VANISH[0]) * k, VANISH[1] + (p[1] - VANISH[1]) * k];
}

function cutShell(
  colors: PaperColors,
  tones: RoomTones,
  size: readonly [number, number],
  map: (p: Point) => Point,
  s: number,
): Sprite {
  const sprite = createSprite(size[0], size[1]);
  const shade = (tone: number): number => colors.shade[tone] ?? tone;
  const tl: Point = [WALL.left, WALL.top];
  const tr: Point = [WALL.right, WALL.top];
  const bl: Point = [WALL.left, WALL.bottom];
  const br: Point = [WALL.right, WALL.bottom];
  const poly = (points: Point[], tone: number): void => {
    fillPolygon(sprite, points.map(map), tone);
  };
  poly([tl, tr, away(tr, 12), away(tl, 12)], shade(shade(tones.wall)));
  poly([tl, away(tl, 12), away(bl, 12), bl], shade(tones.wall));
  poly([tr, br, away(br, 12), away(tr, 12)], shade(tones.wall));
  poly([bl, br, away(br, 12), away(bl, 12)], tones.floor);
  poly([tl, tr, br, bl], tones.wall);
  for (let x = WALL.left + 9; x < WALL.right - 4; x += 14) {
    for (let y = WALL.top + 10; y < WALL.bottom - 16; y += 14) {
      const [px, py] = map([x + ((y / 14) % 2) * 7, y]);
      fillRect(
        sprite,
        px,
        py,
        Math.max(1, Math.round(2 * s)),
        Math.max(1, Math.round(2 * s)),
        colors.light[tones.wall] ?? tones.wall,
      );
    }
  }
  poly([[WALL.left, WALL.bottom - 9], [WALL.right, WALL.bottom - 9], br, bl], tones.wood);
  for (let x = WALL.left + 30; x < WALL.right; x += 30) {
    const back: Point = [x, WALL.bottom];
    fillLine(
      sprite,
      map(back),
      map(away(back, 12)),
      Math.max(1, Math.round(s)),
      shade(tones.floor),
    );
  }
  finishPaper(sprite, colors, { rim: 'none', grain: PAPER_GRAIN, seed: 3 });
  for (const [a, b] of [
    [tl, bl],
    [tr, br],
    [bl, br],
  ] as const) {
    fillLine(
      sprite,
      map(a),
      map(b),
      Math.max(1, Math.round(s)),
      colors.light[shade(tones.wall)] ?? tones.wall,
    );
  }
  return sprite;
}

/** One furniture item in its own sprite (local reference coordinates = box corner). */
function cutItem(
  colors: PaperColors,
  tones: RoomTones,
  item: Furniture,
  s: number,
  seed: number,
): Sprite {
  const [x0, y0, x1, y1] = SLOTS[item].box;
  const sprite = createSprite((x1 - x0) * s, (y1 - y0) * s);
  const w = x1 - x0;
  const h = y1 - y0;
  const rect = (x: number, y: number, rw: number, rh: number, tone: number): void => {
    fillRect(sprite, x * s, y * s, rw * s, rh * s, tone);
  };
  const ellipse = (x: number, y: number, rx: number, ry: number, tone: number): void => {
    fillEllipse(sprite, x * s, y * s, rx * s, ry * s, tone);
  };
  const poly = (points: Point[], tone: number): void => {
    fillPolygon(
      sprite,
      points.map(([x, y]) => [x * s, y * s] as Point),
      tone,
    );
  };
  const role = (name: Parameters<PaperColors['role']>[0]): number => colors.role(name);
  if (item === 'window') {
    rect(0, 0, w, h - 8, tones.wood);
    rect(5, 5, w - 10, h - 18, role('skyLight'));
    rect(5, h - 30, w - 10, 17, role('green'));
    ellipse(w * 0.7, 22, 7, 7, role('paper'));
    rect(w / 2 - 2, 5, 4, h - 18, tones.wood);
    rect(5, (h - 8) / 2 - 2, w - 10, 4, tones.wood);
    rect(-2, h - 10, w + 4, 6, colors.shade[tones.wood] ?? tones.wood);
  } else if (item === 'frame') {
    rect(0, 0, w, h, role('hero'));
    rect(4, 4, w - 8, h - 8, role('paper'));
    poly(
      [
        [4, h - 4],
        [w * 0.4, h * 0.4],
        [w * 0.65, h * 0.7],
        [w * 0.8, h * 0.5],
        [w - 4, h - 4],
      ],
      role('greenMid'),
    );
  } else if (item === 'shelf') {
    rect(0, 0, w, h, tones.wood);
    const books = ['hero', 'teal', 'pink', 'paper', 'wine', 'green', 'sun'] as const;
    for (let shelf = 0; shelf < 3; shelf += 1) {
      const top = 6 + shelf * 44;
      rect(5, top, w - 10, 38, colors.shade[tones.wood] ?? tones.wood);
      let x = 7;
      let index = shelf * 3;
      while (x < w - 14) {
        const bw = 6 + ((index * 7 + seed) % 5);
        const bh = 24 + ((index * 5 + seed) % 12);
        rect(x, top + 38 - bh, bw, bh, role(books[index % books.length] ?? 'hero'));
        x += bw + 1;
        index += 1;
      }
    }
  } else if (item === 'table') {
    rect(0, 0, w, 10, tones.wood);
    rect(8, 10, 7, h - 10, colors.shade[tones.wood] ?? tones.wood);
    rect(w - 15, 10, 7, h - 10, colors.shade[tones.wood] ?? tones.wood);
    rect(w * 0.62, -9, 12, 9, role('paper'));
    rect(w * 0.62 + 12, -6, 3, 4, role('paper'));
  } else if (item === 'chair') {
    rect(4, 0, 6, h, tones.wood);
    rect(4, 4, w - 14, 6, tones.wood);
    rect(4, 16, w - 14, 6, tones.wood);
    rect(0, 44, w, 8, role('hero'));
    rect(w - 9, 52, 6, h - 52, tones.wood);
  } else if (item === 'lamp') {
    poly(
      [
        [10, 0],
        [w - 10, 0],
        [w, 34],
        [0, 34],
      ],
      role('sun'),
    );
    rect(w / 2 - 2, 34, 4, h - 40, role('ink'));
    rect(w / 2 - 12, h - 6, 24, 6, role('ink'));
  } else if (item === 'plant') {
    poly(
      [
        [10, h - 30],
        [w - 10, h - 30],
        [w - 14, h],
        [14, h],
      ],
      role('heroDark'),
    );
    for (const [lx, ly, rx, ry] of [
      [w / 2, 16, 7, 16],
      [w / 2 - 12, 26, 6, 13],
      [w / 2 + 12, 24, 6, 14],
      [w / 2 - 4, 30, 5, 12],
    ] as const) {
      ellipse(lx, ly, rx, ry, role('greenMid'));
    }
  } else {
    ellipse(w / 2, h / 2, w / 2, h / 2, role('wine'));
    ellipse(w / 2, h / 2, w / 2 - 10, h / 2 - 6, role('pink'));
    ellipse(w / 2, h / 2, w / 2 - 22, h / 2 - 12, role('wine'));
  }
  finishPaper(sprite, colors, { rim: 'cut', grain: PAPER_GRAIN, seed });
  return sprite;
}

/** Theatre curtains: two drapes with folds and a scalloped valance, frame + margin wide. */
function cutCurtains(
  colors: PaperColors,
  tone: number,
  size: readonly [number, number],
  map: (p: Point) => Point,
  s: number,
): Sprite {
  const sprite = createSprite(size[0], size[1]);
  const fold = colors.shade[tone] ?? tone;
  const [left] = map([-300, 0]);
  const drape = (inner: number, side: 1 | -1): void => {
    const outer = side === 1 ? -300 : 940;
    fillPolygon(
      sprite,
      [
        map([outer, -300]),
        map([inner, -300]),
        map([inner, 150]),
        map([inner - 26 * side, 230]),
        map([inner + 4 * side, 500]),
        map([outer, 500]),
      ],
      tone,
    );
    for (let x = inner - 14 * side; side === 1 ? x > outer : x < outer; x -= 12 * side) {
      fillLine(
        sprite,
        map([x, -300]),
        map([x - 8 * side, 500]),
        Math.max(1, Math.round(2 * s)),
        fold,
      );
    }
    fillRect(
      sprite,
      ...map([inner - 34 * side - (side === 1 ? 0 : 8), 196]),
      8 * s,
      10 * s,
      colors.role('sun'),
    );
  };
  drape(70, 1);
  drape(570, -1);
  fillRect(sprite, left, 0, size[0], map([0, 22])[1], tone);
  for (let x = -300; x < 940; x += 32) {
    fillEllipse(sprite, ...map([x + 16, 22]), 16 * s, 10 * s, tone);
  }
  finishPaper(sprite, colors, { rim: 'cut', grain: PAPER_GRAIN, seed: 9 });
  return sprite;
}

export const paperRoom = defineProp({
  name: 'paperRoom',
  description:
    'A cut-away paper room like a toy theatre: wallpapered back wall, planked floor in perspective, furniture one layer nearer, optional curtains in front. Fills the frame; add it at layer 2 (puppets at 4, y about 300).',
  params: z.object({
    furniture: z
      .array(z.enum(FURNITURE))
      .default(['window', 'frame', 'shelf', 'table', 'chair', 'lamp', 'plant', 'rug'])
      .describe('Items to place (fixed spots)'),
    wall: toneParam('kraft'),
    floor: toneParam('woodLight'),
    wood: toneParam('wood'),
    curtains: z.boolean().default(true).describe('Theatre curtains in front (two layers nearer)'),
    curtain: toneParam('wine'),
    seed: seedParam,
  }),
  anchors: Object.fromEntries([
    ...FURNITURE.map((item) => [item, `The ${item} (when placed)`] as const),
    ['wall', 'Centre of the back wall'],
    ['floor', 'Middle of the floor'],
  ]),
  build: (params, tools) => {
    const seed = params.seed ?? tools.rng.int(0, 99_999);
    const model: PieceModel = {
      kitType: 'paperRoom',
      placement: { layer: 2, x: 320, y: 180 },
      bind: ({ colors, s, width, height, margin, clock }) => {
        const tones: RoomTones = {
          wall: colors.index(params.wall ?? 'kraft'),
          floor: colors.index(params.floor ?? 'woodLight'),
          wood: colors.index(params.wood ?? 'wood'),
          curtain: colors.index(params.curtain ?? 'wine'),
        };
        const size: [number, number] = [width + margin * 2, height + margin * 2];
        const map = ([x, y]: Point): Point => [x * s + margin, y * s + margin];
        const centre: Point = [size[0] / 2, size[1] / 2];
        const parts: PosedPart[] = [
          {
            sprite: cutShell(colors, tones, size, map, s),
            x: 0,
            y: 0,
            pivot: centre,
            shadow: false,
          },
        ];
        const anchors: Record<string, { x: number; y: number; layer?: number }> = {
          wall: { x: 0, y: (150 - 180) * s },
          floor: { x: 0, y: (300 - 180) * s, layer: 1 },
        };
        for (const item of params.furniture) {
          const [x0, y0] = SLOTS[item].box;
          const flat = item === 'rug';
          parts.push({
            sprite: cutItem(colors, tones, item, s, seed),
            x: (x0 - 320) * s,
            y: (y0 - 180) * s,
            pivot: [0, 0],
            layer: flat ? 0 : 1,
            shadow: !flat,
          });
          const [ax, ay] = SLOTS[item].anchor;
          anchors[item] = { x: (ax - 320) * s, y: (ay - 180) * s, layer: 1 };
        }
        const curtains = params.curtains
          ? cutCurtains(colors, tones.curtain, size, map, s)
          : undefined;
        return (t) => {
          if (curtains === undefined) return { parts, anchors };
          const sway = clock.jitter(clock.frame(t), 21, 1);
          return {
            parts: [...parts, { sprite: curtains, x: sway, y: 0, pivot: centre, layer: 2 }],
            anchors,
          };
        };
      },
    };
    return createPiece(tools, model);
  },
});
