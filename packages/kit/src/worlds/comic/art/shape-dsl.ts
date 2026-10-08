/**
 * The comic shape DSL (PLAN.md#13.15a): plain-JSON parts in the comic ink style, the body of a
 * project prop/character/backdrop (`{ parts: [...] }`) and of `page.art.shape(g, part | parts)`.
 * Model units, (0, 0) = where the thing stands, up = negative y. Every filled part is a flat
 * colour plate (printed off register) with a boiled ink outline; `shade` adds the halftone of
 * the left light, `hatch` parallel ink lines, `wobble` a hand-cut edge.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { ellipsePts } from '../draw/shapes.js';
import { colorSchema, fillSchema, parseArt, pointSchema } from './common.js';
import { GENERATORS, isGeneratorName } from './generators.js';
import type { Sketch } from './sketch.js';
import { drawSprite, spriteSchema } from './sprite.js';

export const SHAPE_LIMITS = { parts: 80, points: 128, depth: 4 } as const;

const pts = z
  .array(z.number())
  .min(4)
  .max(SHAPE_LIMITS.points * 2)
  .refine((list) => list.length % 2 === 0, 'points are pairs [x0, y0, x1, y1, ...]');

const look = {
  fill: fillSchema.default('paper'),
  shade: z.number().min(0).max(0.9).default(0).describe('Halftone shade from the left light'),
  shadeInk: colorSchema.optional(),
  outline: z
    .union([z.boolean(), z.number().min(0.2).max(20)])
    .default(true)
    .describe('true = silhouette weight, a number = model units'),
  hatch: z
    .strictObject({
      gap: z.number().min(1).max(40).default(4),
      angle: z.number().default(0.8),
      color: colorSchema.default('ink'),
    })
    .optional(),
  wobble: z.number().min(0).max(0.25).default(0),
};

export const shapePartSchema = z.discriminatedUnion('shape', [
  z.strictObject({
    shape: z.literal('ellipse'),
    at: pointSchema,
    r: z.union([z.number().positive(), pointSchema]),
    ...look,
  }),
  z.strictObject({
    shape: z.literal('rect'),
    at: pointSchema.describe('Top left'),
    size: pointSchema,
    ...look,
  }),
  z.strictObject({
    shape: z.literal('poly'),
    pts: pts.refine((list) => list.length >= 6, 'a polygon needs 3 points'),
    ...look,
  }),
  z.strictObject({
    shape: z.literal('capsule'),
    from: pointSchema,
    to: pointSchema,
    r: z.number().positive(),
    ...look,
  }),
  z.strictObject({
    shape: z.literal('line'),
    pts,
    w: z.number().min(0.2).max(40).default(1.5),
    color: colorSchema.default('ink'),
    closed: z.boolean().default(false),
  }),
  z.strictObject({
    shape: z.literal('dots'),
    pts,
    r: z.number().positive().default(1.5),
    color: colorSchema.default('ink'),
  }),
  z.strictObject({
    shape: z.literal('sprite'),
    at: pointSchema.default([0, 0]),
    sprite: spriteSchema,
  }),
  z.strictObject({
    shape: z.literal('use'),
    id: z.string().min(1).max(40),
    at: pointSchema.default([0, 0]),
    scale: z.number().positive().max(20).default(1),
    flip: z.boolean().default(false),
  }),
  z.strictObject({
    shape: z.literal('gen'),
    gen: z.string().min(1),
    options: z.record(z.string(), z.unknown()).default({}),
  }),
]);
export type ShapePart = z.output<typeof shapePartSchema>;

export const shapePartsSchema = z.array(shapePartSchema).min(1).max(SHAPE_LIMITS.parts);

/** Draws a registered id at a sub-sketch (the registry's `use`). */
export type UseResolver = (id: string, sk: Sketch, depth: number) => void;

function outlineOf(outline: boolean | number): false | 'outer' | number {
  if (outline === false) return false;
  return outline === true ? 'outer' : outline;
}

function wobbled(list: readonly number[], amount: number, key: string, sk: Sketch): number[] {
  if (amount <= 0) return [...list];
  return list.map((value, i) => value + (sk.g.rnd(key, i) - 0.5) * amount * 20);
}

export function drawParts(
  sk: Sketch,
  parts: readonly ShapePart[],
  use: UseResolver,
  depth = 0,
): void {
  if (depth > SHAPE_LIMITS.depth) {
    throw new KitError(
      'invalid-params',
      `art: 'use' nested deeper than ${String(SHAPE_LIMITS.depth)} (a prop that uses itself?)`,
    );
  }
  parts.forEach((part, index) => {
    drawPart(sk, part, use, depth, `${sk.f.key}p${String(index)}`);
  });
}

function drawPart(sk: Sketch, part: ShapePart, use: UseResolver, depth: number, key: string): void {
  switch (part.shape) {
    case 'line':
      sk.stroke(part.closed ? [...part.pts, part.pts[0] ?? 0, part.pts[1] ?? 0] : part.pts, {
        w: part.w,
        color: part.color,
      });
      return;
    case 'dots':
      for (let i = 0; i + 1 < part.pts.length; i += 2)
        sk.dot(part.pts[i] ?? 0, part.pts[i + 1] ?? 0, part.r, part.color);
      return;
    case 'sprite':
      drawSprite(sk.sub(part.at[0], part.at[1]), part.sprite);
      return;
    case 'use':
      use(
        part.id,
        part.flip
          ? sk.sub(part.at[0], part.at[1], part.scale).mirrored()
          : sk.sub(part.at[0], part.at[1], part.scale),
        depth + 1,
      );
      return;
    case 'gen': {
      if (!isGeneratorName(part.gen)) {
        throw new KitError(
          'invalid-params',
          `art: unknown generator '${part.gen}'; generators: ${Object.keys(GENERATORS).join(', ')}`,
        );
      }
      const generator = GENERATORS[part.gen];
      generator.draw(
        sk.g,
        parseArt(generator.schema, sk.placeOptions(part.options), `art gen '${part.gen}'`),
      );
      return;
    }
    default: {
      const outline = outlineOf(part.outline);
      const style = {
        shade: part.shade,
        shadeInk: part.shadeInk,
        outline,
        ...(part.hatch === undefined ? {} : { hatch: part.hatch }),
      };
      sk.shape(wobbled(outlinePoints(part), part.wobble, key, sk), part.fill, style);
    }
  }
}

function outlinePoints(
  part: Extract<ShapePart, { shape: 'ellipse' | 'rect' | 'poly' | 'capsule' }>,
): number[] {
  switch (part.shape) {
    case 'ellipse': {
      const [rx, ry] = typeof part.r === 'number' ? [part.r, part.r] : part.r;
      return ellipsePts(part.at[0], part.at[1], rx, ry, 20);
    }
    case 'rect': {
      const [x, y] = part.at;
      const [w, h] = part.size;
      return [x, y, x + w, y, x + w, y + h, x, y + h];
    }
    case 'poly':
      return [...part.pts];
    case 'capsule': {
      const [x0, y0] = part.from;
      const [x1, y1] = part.to;
      const a = Math.atan2(y1 - y0, x1 - x0);
      const out: number[] = [];
      for (let i = 0; i <= 8; i += 1) {
        const t = a + Math.PI / 2 + (i / 8) * Math.PI;
        out.push(x0 + Math.cos(t) * part.r, y0 + Math.sin(t) * part.r);
      }
      for (let i = 0; i <= 8; i += 1) {
        const t = a - Math.PI / 2 + (i / 8) * Math.PI;
        out.push(x1 + Math.cos(t) * part.r, y1 + Math.sin(t) * part.r);
      }
      return out;
    }
  }
}
