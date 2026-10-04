/**
 * Lettered paper: `paperSign` (a board on a stick), `paperLabel` (a tag pinned with a tack or
 * tape) and `paperCard` (a torn title strip that slides in). Text is the kit's 5x7 pixel caps at
 * whole scales, never rotated (the paper may tilt, the letters stay crisp). Entrances run on the
 * stop-motion clock: a few eased frames, then a hand-placed jitter.
 */
import { z } from 'zod';
import { defineProp } from '../../registry.js';
import type { PaperColors } from './colors.js';
import { seedParam, toneParam } from './landscape.js';
import { finishPaper, PAPER_GRAIN, tearPolygon } from './paper.js';
import { createPiece, ease, memo, type PieceModel, type StopMotion } from './piece.js';
import {
  createSprite,
  drawText,
  fillEllipse,
  fillLine,
  fillPolygon,
  fillRect,
  fitTextScale,
  rectPoints,
  stamp,
  TEXT_ROWS,
  textWidth,
  transform,
  type Point,
  type Sprite,
} from './sprite.js';

export const ENTRANCES = ['bottom', 'top', 'left', 'right', 'drop', 'none'] as const;
export type Entrance = (typeof ENTRANCES)[number];

const atParam = z.number().min(0).default(0).describe('Time (s) the piece enters');

/** Offset [x, y] px of an entering piece at stop-motion time (0 once it has landed). */
export function entranceOffset(
  entrance: Entrance,
  time: number,
  at: number,
  distance: number,
): readonly [number, number] {
  if (entrance === 'none') return [0, 0];
  const k = ease((time - at) / 0.5);
  const rest = 1 - k;
  if (entrance === 'left') return [-distance * rest, 0];
  if (entrance === 'right') return [distance * rest, 0];
  if (entrance === 'top' || entrance === 'drop') return [0, -distance * rest];
  return [0, distance * rest];
}

/** Hidden (before its time) or posed: shared by all lettered pieces. */
function entering(
  clock: StopMotion,
  t: number,
  at: number,
  entrance: Entrance,
  distance: number,
  salt: number,
): { visible: boolean; x: number; y: number } {
  const time = clock.time(t);
  if (entrance !== 'none' && time < at) return { visible: false, x: 0, y: 0 };
  const [dx, dy] = entranceOffset(entrance, time, at, distance);
  // Lettering stays readable: the hand nudges it on one stop-motion frame in four.
  const frame = clock.frame(t);
  const nudged = frame % 4 === salt % 4;
  return {
    visible: true,
    x: Math.round(dx) + (nudged ? clock.jitter(frame, salt, 1) : 0),
    y: Math.round(dy) + (nudged ? clock.jitter(frame, salt + 1, 1) : 0),
  };
}

function lineHeight(scale: number): number {
  return TEXT_ROWS * scale;
}

/** A board on a stick: the board swings about the stick's top on the stop-motion clock. */
function cutSign(
  colors: PaperColors,
  text: string,
  tones: { readonly board: number; readonly ink: number; readonly post: number },
  scale: number,
  post: number,
  angle: number,
  seed: number,
): { sprite: Sprite; origin: Point; centre: Point } {
  const pad = scale * 4;
  const boardWidth = textWidth(text, scale) + pad * 2;
  const boardHeight = lineHeight(scale) + pad * 1.6;
  const width = Math.ceil(boardWidth * 1.3 + 8);
  const height = Math.ceil(boardHeight * 1.3 + post + 8);
  const sprite = createSprite(width, height);
  const cx = width / 2;
  const groundY = height - 1;
  const pivot: Point = [cx, groundY - post];
  const board = createSprite(width, height);
  const corners = rectPoints(cx - boardWidth / 2, pivot[1] - boardHeight, boardWidth, boardHeight);
  fillPolygon(board, transform(tearPolygon(corners, 0.7, seed, 5), angle, pivot), tones.board);
  if (post > 0)
    fillLine(
      sprite,
      [cx, groundY + 1],
      [cx, pivot[1] - boardHeight * 0.4],
      Math.max(2, scale + 1),
      tones.post,
    );
  stamp(sprite, board, 0, 0, colors.shade);
  finishPaper(sprite, colors, { rim: 'cut', grain: PAPER_GRAIN, seed });
  const [tx, ty] = transform([[cx, pivot[1] - boardHeight / 2]], angle, pivot)[0] ?? pivot;
  drawText(sprite, text, tx, ty - lineHeight(scale) / 2, scale, tones.ink, 'center');
  return { sprite, origin: [cx, groundY], centre: [tx - cx, ty - groundY] };
}

export const paperSign = defineProp({
  name: 'paperSign',
  description:
    'A paper sign on a wooden stick (lettered in pixel caps) that can swing a little; y = where the stick meets the ground. Good for place names and labels in the set.',
  params: z.object({
    text: z.string().min(1).max(24),
    scale: z.int().min(1).max(4).default(2).describe('Text scale (2 = 14-px caps)'),
    tone: toneParam('paper'),
    ink: toneParam('ink'),
    stick: z.number().min(0).max(200).default(40).describe('Stick height (640x360 px); 0 = none'),
    swing: z.number().min(0).max(15).default(3).describe('Swing in degrees'),
    at: atParam,
    enter: z.enum(ENTRANCES).default('none'),
    seed: seedParam,
  }),
  anchors: { text: 'Centre of the board', base: 'Foot of the stick' },
  build: (params, tools) => {
    const seed = params.seed ?? tools.rng.int(0, 99_999);
    const model: PieceModel = {
      kitType: 'paperSign',
      placement: { layer: 4, x: 470, y: 300 },
      bind: ({ colors, s, clock }) => {
        const scale = Math.max(1, Math.round(params.scale * s));
        const tones = {
          board: colors.index(params.tone ?? 'paper'),
          ink: colors.index(params.ink ?? 'ink'),
          post: colors.role('wood'),
        };
        const cut = memo((key) =>
          cutSign(colors, params.text, tones, scale, params.stick * s, Number(key), seed),
        );
        return (t) => {
          const time = clock.time(t);
          const angle = Math.round(params.swing * Math.sin(Math.PI * 2 * time * 0.35));
          const sign = cut(String(angle));
          const state = entering(clock, t, params.at, params.enter, 120 * s, 3);
          return {
            parts: state.visible
              ? [{ sprite: sign.sprite, x: state.x, y: state.y, pivot: sign.origin }]
              : [],
            anchors: {
              text: { x: state.x + sign.centre[0], y: state.y + sign.centre[1] },
              base: { x: state.x, y: state.y },
            },
          };
        };
      },
    };
    return createPiece(tools, model);
  },
});

export const PINS = ['tack', 'tape', 'string'] as const;

function cutLabel(
  colors: PaperColors,
  text: string,
  tones: { readonly paper: number; readonly ink: number; readonly pin: number },
  scale: number,
  pin: (typeof PINS)[number],
  tilt: number,
  seed: number,
): { sprite: Sprite; centre: Point } {
  const pad = scale * 3;
  const w = textWidth(text, scale) + pad * 2 + scale * 6;
  const h = lineHeight(scale) + pad * 2;
  const size = Math.ceil(Math.max(w, h) * 1.25 + 12);
  const sprite = createSprite(size, Math.ceil(h * 2 + 16));
  const cx = sprite.width / 2;
  const cy = sprite.height / 2;
  const left = cx - w / 2;
  const top = cy - h / 2;
  const notch = h * 0.35;
  const tag: Point[] = [
    [left + notch, top],
    [left + w, top],
    [left + w, top + h],
    [left + notch, top + h],
    [left, top + h - notch],
    [left, top + notch],
  ];
  const paper = createSprite(sprite.width, sprite.height);
  fillPolygon(paper, transform(tag, tilt, [cx, cy]), tones.paper);
  const [hx, hy] = transform([[left + notch * 0.8, cy]], tilt, [cx, cy])[0] ?? [cx, cy];
  fillEllipse(paper, hx, hy, scale * 1.2, scale * 1.2, 0);
  if (pin === 'string')
    fillLine(sprite, [hx, hy], [hx - h * 0.9, top - h * 0.6], 1, colors.role('inkDim'));
  stamp(sprite, paper, 0, 0, colors.shade);
  finishPaper(sprite, colors, { rim: 'cut', grain: PAPER_GRAIN, seed });
  drawText(sprite, text, cx + scale * 3, cy - lineHeight(scale) / 2, scale, tones.ink, 'center');
  if (pin === 'tack') {
    const r = Math.max(2, scale * 1.6);
    fillEllipse(sprite, cx + w * 0.32, top + r * 0.2, r, r, tones.pin);
    fillRect(
      sprite,
      cx + w * 0.32 - r * 0.4,
      top - r * 0.5,
      Math.max(1, r * 0.5),
      Math.max(1, r * 0.5),
      colors.light[tones.pin] ?? tones.pin,
    );
  } else if (pin === 'tape') {
    const tape = transform(rectPoints(cx - h * 0.6, top - h * 0.3, h * 1.2, h * 0.5), -12 + tilt, [
      cx,
      top,
    ]);
    fillPolygon(sprite, tape, colors.role('sun'));
  }
  return { sprite, centre: [cx, cy] };
}

export const paperLabel = defineProp({
  name: 'paperLabel',
  description:
    'A small paper tag (pixel caps) pinned with a tack, a piece of tape or hung on a string; x, y = its centre. For naming things in the set.',
  params: z.object({
    text: z.string().min(1).max(28),
    scale: z.int().min(1).max(3).default(1).describe('Text scale (1 = 7-px caps)'),
    tone: toneParam('paper'),
    ink: toneParam('ink'),
    pin: z.enum(PINS).default('tack'),
    tilt: z
      .number()
      .min(-12)
      .max(12)
      .default(-3)
      .describe('Paper tilt in degrees (text stays level)'),
    at: atParam,
    enter: z.enum(ENTRANCES).default('drop'),
    seed: seedParam,
  }),
  anchors: { text: 'Centre of the tag' },
  build: (params, tools) => {
    const seed = params.seed ?? tools.rng.int(0, 99_999);
    const model: PieceModel = {
      kitType: 'paperLabel',
      placement: { layer: 5, x: 320, y: 100 },
      bind: ({ colors, s, clock }) => {
        const scale = Math.max(1, Math.round(params.scale * s));
        const tones = {
          paper: colors.index(params.tone ?? 'paper'),
          ink: colors.index(params.ink ?? 'ink'),
          pin: colors.role('pink'),
        };
        const label = cutLabel(colors, params.text, tones, scale, params.pin, params.tilt, seed);
        return (t) => {
          const state = entering(clock, t, params.at, params.enter, 40 * s, 5);
          return {
            parts: state.visible
              ? [{ sprite: label.sprite, x: state.x, y: state.y, pivot: label.centre }]
              : [],
            anchors: { text: { x: state.x, y: state.y } },
          };
        };
      },
    };
    return createPiece(tools, model);
  },
});

function cutCard(
  colors: PaperColors,
  title: string,
  subtitle: string,
  tones: { readonly paper: number; readonly ink: number; readonly band: number },
  width: number,
  s: number,
  seed: number,
): { sprite: Sprite; titleY: number; subtitleY: number } {
  const titleScale = fitTextScale(title, width - 24 * s, Math.max(1, Math.round(4 * s)));
  const subScale =
    subtitle === '' ? 0 : fitTextScale(subtitle, width - 30 * s, Math.max(1, Math.round(2 * s)));
  const gap = Math.round(8 * s);
  const height =
    Math.round(18 * s) +
    lineHeight(titleScale) +
    (subScale > 0 ? gap + lineHeight(subScale) + gap : 0) +
    Math.round(14 * s);
  const sprite = createSprite(width + 24 * s, height + 24 * s);
  const left = 12 * s;
  const top = 12 * s;
  const strip = tearPolygon(rectPoints(left, top, width, height), 1.6 * s, seed, 4);
  fillPolygon(sprite, strip, tones.paper);
  fillRect(sprite, left, top + height - 7 * s, width, 3 * s, tones.band);
  finishPaper(sprite, colors, { rim: 'torn', grain: PAPER_GRAIN, seed });
  const cx = left + width / 2;
  const titleY = top + Math.round(16 * s);
  drawText(sprite, title, cx, titleY, titleScale, tones.ink, 'center');
  const subtitleY = titleY + lineHeight(titleScale) + gap;
  if (subScale > 0)
    drawText(sprite, subtitle, cx, subtitleY, subScale, colors.role('inkDim'), 'center');
  for (const [x, angle] of [
    [left + 10 * s, -24],
    [left + width - 10 * s, 22],
  ] as const) {
    fillPolygon(
      sprite,
      transform(rectPoints(x - 13 * s, top - 4 * s, 26 * s, 9 * s), angle, [x, top]),
      colors.role('sun'),
    );
  }
  // Anchors: the middle of each text line, relative to the sprite centre.
  const middle = sprite.height / 2;
  return {
    sprite,
    titleY: titleY + lineHeight(titleScale) / 2 - middle,
    subtitleY: subtitleY + lineHeight(Math.max(1, subScale)) / 2 - middle,
  };
}

export const paperCard = defineProp({
  name: 'paperCard',
  description:
    'Title card: a torn strip of paper taped onto the set with a big pixel-caps title (and subtitle) that slides in on the stop-motion clock. x, y = its centre.',
  params: z.object({
    title: z.string().min(1).max(32),
    subtitle: z.string().max(48).default(''),
    width: z.number().min(0.3).max(0.95).default(0.72).describe('Width as a share of the frame'),
    tone: toneParam('paper'),
    ink: toneParam('ink'),
    band: toneParam('hero'),
    at: atParam,
    enter: z.enum(ENTRANCES).default('bottom'),
    seed: seedParam,
  }),
  anchors: { title: 'Centre of the title line', subtitle: 'Centre of the subtitle line' },
  build: (params, tools) => {
    const seed = params.seed ?? tools.rng.int(0, 99_999);
    const model: PieceModel = {
      kitType: 'paperCard',
      placement: { layer: 5, x: 320, y: 180 },
      bind: ({ colors, s, clock, height }) => {
        const tones = {
          paper: colors.index(params.tone ?? 'paper'),
          ink: colors.index(params.ink ?? 'ink'),
          band: colors.index(params.band ?? 'hero'),
        };
        const width = Math.round(params.width * 640 * s);
        const card = cutCard(colors, params.title, params.subtitle, tones, width, s, seed);
        const pivot: Point = [card.sprite.width / 2, card.sprite.height / 2];
        return (t) => {
          const state = entering(clock, t, params.at, params.enter, height * 0.75, 7);
          return {
            parts: state.visible ? [{ sprite: card.sprite, x: state.x, y: state.y, pivot }] : [],
            anchors: {
              title: { x: state.x, y: state.y + card.titleY },
              subtitle: { x: state.x, y: state.y + card.subtitleY },
            },
          };
        };
      },
    };
    return createPiece(tools, model);
  },
});
