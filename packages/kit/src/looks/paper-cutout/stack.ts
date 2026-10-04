/**
 * `kit.props.paperStack`: a pile of photos and documents dealt onto the set one by one on the
 * stop-motion clock. The top photo shows a real picture (`asset`, stylised by the engine into the
 * style palette, ADR-014) or a small cut-paper landscape; documents carry a title bar and lines
 * of grey "text". Lower sheets lie at seeded angles; each sheet shades the ones below it.
 */
import { z } from 'zod';
import { assetParam, type AssetImage } from '../../assets/handle.js';
import { hashCell } from '../../env/shared.js';
import { defineProp } from '../../registry.js';
import type { PaperColors } from './colors.js';
import { seedParam, toneParam } from './landscape.js';
import { finishPaper, PAPER_GRAIN } from './paper.js';
import { createPiece, ease, memo, type PieceModel } from './piece.js';
import {
  createSprite,
  drawText,
  fillEllipse,
  fillPolygon,
  fillRect,
  rectPoints,
  stamp,
  transform,
  type Point,
  type Sprite,
} from './sprite.js';

export const STACK_KINDS = ['photos', 'documents', 'mixed'] as const;

interface Sheet {
  readonly photo: boolean;
  readonly angle: number;
  readonly dx: number;
  readonly dy: number;
}

/** Picture pixels (asset or a cut-paper landscape) as colour indices, w x h. */
function picture(colors: PaperColors, w: number, h: number, asset: AssetImage | undefined): Sprite {
  const sprite = createSprite(w, h);
  if (asset !== undefined) {
    const pixels = asset.pixels(sprite.width, sprite.height);
    const map = pixels.colors.map((hex) => colors.hex(hex));
    pixels.indices.forEach((index, offset) => {
      sprite.data[offset] = map[index] ?? colors.role('ink');
    });
    return sprite;
  }
  fillRect(sprite, 0, 0, w, h, colors.role('skyLight'));
  fillEllipse(sprite, w * 0.72, h * 0.3, h * 0.14, h * 0.14, colors.role('sun'));
  fillPolygon(
    sprite,
    [
      [0, h * 0.62],
      [w * 0.3, h * 0.38],
      [w * 0.62, h * 0.66],
      [w, h * 0.5],
      [w, h],
      [0, h],
    ],
    colors.role('greenMid'),
  );
  fillPolygon(
    sprite,
    [
      [0, h * 0.82],
      [w * 0.5, h * 0.7],
      [w, h * 0.86],
      [w, h],
      [0, h],
    ],
    colors.role('green'),
  );
  return sprite;
}

/** One sheet (photo with a white border, or a document) drawn into a sprite of `size`. */
function cutSheet(
  colors: PaperColors,
  size: readonly [number, number],
  centre: Point,
  sheet: Sheet,
  w: number,
  paper: number,
  top: boolean,
  asset: AssetImage | undefined,
  caption: string,
): Sprite {
  const sprite = createSprite(size[0], size[1]);
  const h = sheet.photo ? w * 1.12 : w * 1.3;
  const [cx, cy] = centre;
  const at = (points: Point[]): Point[] =>
    transform(points, sheet.angle, [cx, cy], [sheet.dx, sheet.dy]);
  fillPolygon(sprite, at(rectPoints(cx - w / 2, cy - h / 2, w, h)), paper);
  finishPaper(sprite, colors, {
    rim: 'cut',
    grain: PAPER_GRAIN,
    seed: Math.round(w + sheet.angle),
  });
  const border = Math.max(2, Math.round(w * 0.07));
  if (sheet.photo) {
    const pw = Math.round(w - border * 2);
    const ph = Math.round(pw * 0.86);
    const left = Math.round(cx - w / 2 + border + sheet.dx);
    const upper = Math.round(cy - h / 2 + border + sheet.dy);
    if (top && sheet.angle === 0) {
      stamp(sprite, picture(colors, pw, ph, asset), left, upper);
      if (caption !== '') {
        drawText(
          sprite,
          caption,
          cx + sheet.dx,
          upper + ph + border * 0.9,
          1,
          colors.role('ink'),
          'center',
        );
      }
    } else {
      fillPolygon(
        sprite,
        at(rectPoints(cx - w / 2 + border, cy - h / 2 + border, pw, ph)),
        colors.role('skyMid'),
      );
      fillPolygon(
        sprite,
        at([
          [cx - w / 2 + border, cy - h / 2 + border + ph * 0.7],
          [cx, cy - h / 2 + border + ph * 0.45],
          [cx + w / 2 - border, cy - h / 2 + border + ph * 0.75],
          [cx + w / 2 - border, cy - h / 2 + border + ph],
          [cx - w / 2 + border, cy - h / 2 + border + ph],
        ]),
        colors.role('greenMid'),
      );
    }
    return sprite;
  }
  const ink = colors.role('inkDim');
  const line = Math.max(1, Math.round(w / 60));
  fillPolygon(
    sprite,
    at(rectPoints(cx - w / 2 + border, cy - h / 2 + border, w * 0.55, line * 3)),
    colors.role('ink'),
  );
  for (let row = 0; row < 9; row += 1) {
    const y = cy - h / 2 + border + line * 7 + row * line * 4;
    if (y > cy + h / 2 - border) break;
    const length =
      (w - border * 2) * (row % 4 === 3 ? 0.55 : 0.9 - 0.1 * hashCell(row, 1, 1, Math.round(w)));
    fillPolygon(sprite, at(rectPoints(cx - w / 2 + border, y, length, line)), ink);
  }
  return sprite;
}

export const paperStack = defineProp({
  name: 'paperStack',
  description:
    "A pile of photos and/or documents dealt onto the set one by one; the top photo shows a real picture (asset: ctx.assets.image('<id>')) or a cut-paper landscape. x, y = centre of the pile.",
  params: z.object({
    kind: z.enum(STACK_KINDS).default('mixed'),
    count: z.int().min(1).max(7).default(4),
    size: z.number().min(40).max(300).default(130).describe('Sheet width (640x360 px)'),
    asset: assetParam.optional(),
    caption: z.string().max(20).default('').describe('Line under the top photo (pixel caps)'),
    tone: toneParam('paper'),
    at: z.number().min(0).default(0).describe('Time (s) the first sheet lands'),
    interval: z.number().min(0.1).max(3).default(0.4).describe('Seconds between sheets'),
    seed: seedParam,
  }),
  anchors: { photo: 'Centre of the top sheet', caption: 'The caption line' },
  build: (params, tools) => {
    const seed = params.seed ?? tools.rng.int(0, 99_999);
    const model: PieceModel = {
      kitType: 'paperStack',
      placement: { layer: 4, x: 320, y: 190 },
      bind: ({ colors, s, clock }) => {
        const w = Math.round(params.size * s);
        const size: [number, number] = [Math.ceil(w * 2.2), Math.ceil(w * 2.2)];
        const centre: Point = [size[0] / 2, size[1] / 2];
        const paper = colors.index(params.tone ?? 'paper');
        const sheets: Sheet[] = Array.from({ length: params.count }, (_, index) => {
          const last = index === params.count - 1;
          const photo =
            params.kind === 'photos' ||
            (params.kind === 'mixed' && (last || hashCell(index, 2, 2, seed) < 0.4));
          return {
            photo,
            angle: last ? 0 : Math.round((hashCell(index, 3, 3, seed) - 0.5) * 22),
            dx: last ? 0 : Math.round((hashCell(index, 4, 4, seed) - 0.5) * w * 0.4),
            dy: last ? 0 : Math.round((hashCell(index, 5, 5, seed) - 0.5) * w * 0.25),
          };
        });
        const cuts = sheets.map((sheet, index) =>
          cutSheet(
            colors,
            size,
            centre,
            sheet,
            w,
            paper,
            index === sheets.length - 1,
            params.asset,
            params.caption,
          ),
        );
        const compose = memo((key) => {
          const offsets = key.split(',').map(Number);
          const pile = createSprite(size[0], size[1]);
          cuts.forEach((cut, index) => {
            const drop = offsets[index];
            if (drop === undefined || drop < 0) return;
            stamp(pile, cut, 0, -drop, colors.shade, [
              Math.max(1, Math.round(s)),
              Math.max(1, Math.round(2 * s)),
            ]);
          });
          return pile;
        });
        const photoTop = -w * 0.56;
        return (t) => {
          const time = clock.time(t);
          const key = sheets
            .map((_, index) => {
              const k = (time - params.at - index * params.interval) / 0.375;
              return k < 0 ? -1 : Math.round((1 - ease(k)) * w * 0.8);
            })
            .join(',');
          const pile = compose(key);
          const empty = key.split(',').every((value) => value === '-1');
          const pw = w - Math.max(2, Math.round(w * 0.07)) * 2;
          return {
            parts: empty ? [] : [{ sprite: pile, x: 0, y: 0, pivot: centre }],
            anchors: {
              photo: { x: 0, y: photoTop + w * 0.07 + pw * 0.43 },
              caption: { x: 0, y: photoTop + w * 0.07 + pw * 0.86 + w * 0.1 },
            },
          };
        };
      },
    };
    return createPiece(tools, model);
  },
});
