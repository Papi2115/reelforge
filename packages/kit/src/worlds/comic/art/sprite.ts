/**
 * The comic spot-art DSL (PLAN.md#13.15a): small props and icons written as rows of characters
 * with a legend onto the 22 inks, e.g. `{ rows: ['.##.', '#yy#', '.##.'], legend: { '#': 'ink',
 * y: 'yellow' } }`. Ink pixels print on the key plate, every other ink on the colour plate (off
 * register); an ink outline is grown around the silhouette so it reads at thumbnail size. '.'
 * and ' ' are transparent unless the legend names them.
 */
import { z } from 'zod';
import { colorSchema } from './common.js';
import type { Sketch } from './sketch.js';

export const SPRITE_LIMITS = { rows: 64, cols: 64, legend: 16 } as const;

export const spriteSchema = z
  .strictObject({
    rows: z.array(z.string().max(SPRITE_LIMITS.cols)).min(1).max(SPRITE_LIMITS.rows),
    legend: z.record(z.string().length(1, 'legend keys are single characters'), colorSchema),
    px: z.number().min(0.25).max(40).default(4).describe('Pixel size in model units'),
    outline: z.boolean().default(true),
    anchor: z.enum(['bottom', 'center', 'top-left']).default('bottom'),
  })
  .superRefine((spec, ctx) => {
    if (Object.keys(spec.legend).length > SPRITE_LIMITS.legend) {
      ctx.addIssue({
        code: 'custom',
        message: `at most ${String(SPRITE_LIMITS.legend)} legend entries`,
        path: ['legend'],
      });
    }
    const unknown = new Set<string>();
    for (const row of spec.rows) {
      for (const char of row)
        if (char !== '.' && char !== ' ' && !(char in spec.legend)) unknown.add(char);
    }
    if (unknown.size > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['rows'],
        message: `characters not in the legend: ${[...unknown].map((c) => JSON.stringify(c)).join(', ')} ('.' and ' ' are transparent)`,
      });
    }
  });
export type SpriteSpec = z.output<typeof spriteSchema>;

/** A run of equal pixels in one row: [x0, x1) of colour. */
type Run = readonly [x0: number, x1: number, color: string];

function runsOf(row: string, legend: Readonly<Record<string, string>>): Run[] {
  const runs: Run[] = [];
  let start = 0;
  for (let x = 1; x <= row.length; x += 1) {
    const prev = row[x - 1] ?? '.';
    if (x < row.length && row[x] === prev) continue;
    const color = legend[prev];
    if (color !== undefined) runs.push([start, x, color]);
    start = x;
  }
  return runs;
}

/** Draws a sprite with its anchor at the sketch origin (model units, px per pixel). */
export function drawSprite(sk: Sketch, spec: SpriteSpec): void {
  const width = Math.max(...spec.rows.map((row) => row.length));
  const height = spec.rows.length;
  const { px } = spec;
  const ox = spec.anchor === 'top-left' ? 0 : (-width * px) / 2;
  const oy =
    spec.anchor === 'bottom' ? -height * px : spec.anchor === 'center' ? (-height * px) / 2 : 0;
  const rows = spec.rows.map((row) => runsOf(row, spec.legend));
  const rect = (x0: number, x1: number, y: number, grow: number) => {
    const [l, r] = [ox + x0 * px - grow, ox + x1 * px + grow];
    const [t, b] = [oy + y * px - grow, oy + (y + 1) * px + grow];
    return [l, t, r, t, r, b, l, b];
  };
  if (spec.outline) {
    const grow = 1 / Math.max(0.01, sk.px);
    rows.forEach((runs, y) => {
      for (const [x0, x1] of runs) sk.solid(rect(x0, x1, y, grow), 'ink');
    });
  }
  rows.forEach((runs, y) => {
    for (const [x0, x1, color] of runs) {
      const pts = rect(x0, x1, y, 0);
      if (color === 'ink') sk.solid(pts, color);
      else sk.flat(pts, color);
    }
  });
}
