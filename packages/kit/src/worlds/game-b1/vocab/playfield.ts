/**
 * The 2600 PLAYFIELD DSL of the open vocabulary (PLAN.md#13.15): the big, blocky scenery of a
 * film's own place (a forest canopy, dunes, a castle wall, a skyline). Rules:
 * - a row is 20 bits for the left half of the screen ('#' / '.'; one bit = a 4-unit block, 16 px),
 *   `mirror`ed or `repeat`ed on the right half, or 40 bits for an asymmetric line (the kernel
 *   rewrites the registers mid-line);
 * - ONE colour per row (COLUPF changes per scanline, not inside one);
 * - `rowH` = TV units per row (one number, or one per row).
 * Drawing (`g.field(id, y, { shift })`) scrolls in whole blocks, the way a 2600 scrolls playfield.
 */
import { z } from 'zod';
import { resolveColours } from './colours.js';
import { colourTableSchema, idSchema } from './sprite.js';

export const HALF_BITS = 20;
export const FULL_BITS = 40;
export const BLOCK = 4;

export const playfieldSpecSchema = z.strictObject({
  describe: z.string().min(1).max(80).optional(),
  rows: z.array(z.string()).min(1).max(90),
  rowH: z
    .union([z.int().min(1).max(60), z.array(z.int().min(1).max(60)).max(90)])
    .default(4)
    .describe('TV units per row (one number or one per row)'),
  colours: colourTableSchema,
  mode: z.enum(['mirror', 'repeat']).default('mirror').describe('Right half of a 20-bit row'),
});

export type PlayfieldSpec = z.input<typeof playfieldSpecSchema>;

export interface B1Playfield {
  readonly id: string;
  readonly describe: string | undefined;
  /** Full 40-block lines, one per row. */
  readonly lines: readonly string[];
  readonly heights: readonly number[];
  readonly colours: readonly (string | null)[];
  readonly height: number;
}

/** The full 40-block line of a 20-bit row (mirrored or repeated) or a 40-bit row as it is. */
export function fullLine(row: string, mode: 'mirror' | 'repeat'): string {
  if (row.length === FULL_BITS) return row;
  return row + (mode === 'mirror' ? Array.from(row).reverse().join('') : row);
}

export function playfieldProblems(id: string, input: unknown): string[] {
  const what = `playfield "${id}"`;
  const idCheck = idSchema.safeParse(id);
  const problems = idCheck.success ? [] : [`${what}: ${idCheck.error.issues[0]?.message ?? ''}`];
  const parsed = playfieldSpecSchema.safeParse(input);
  if (!parsed.success)
    return [
      ...problems,
      ...parsed.error.issues.map(
        (issue) => `${what}: ${issue.path.join('.') || '(spec)'} ${issue.message}`,
      ),
    ];
  const spec = parsed.data;
  spec.rows.forEach((row, i) => {
    const bad = [...new Set(row.replace(/[#.]/g, ''))];
    if (bad.length > 0)
      problems.push(`${what} row ${String(i)} uses ${bad.join(' ')}: rows are '#' and '.'`);
    if (row.length !== HALF_BITS && row.length !== FULL_BITS)
      problems.push(
        `${what} row ${String(i)} has ${String(row.length)} bits: a playfield row is ${String(HALF_BITS)} bits (the left half, mirrored or repeated) or ${String(FULL_BITS)} (an asymmetric line)`,
      );
  });
  if (Array.isArray(spec.rowH) && spec.rowH.length !== spec.rows.length)
    problems.push(
      `${what}: ${String(spec.rowH.length)} row heights for ${String(spec.rows.length)} rows`,
    );
  const heights = spec.rows.map((_, i) =>
    Array.isArray(spec.rowH) ? (spec.rowH[i] ?? 1) : spec.rowH,
  );
  const total = heights.reduce((a, b) => a + b, 0);
  if (total > 180) problems.push(`${what}: ${String(total)} units tall, the picture has 180`);
  problems.push(...resolveColours(spec.colours, spec.rows.length, `${what} colours`).problems);
  return problems;
}

export function compilePlayfield(
  id: string,
  input: unknown,
  fail: (message: string) => never,
): B1Playfield {
  const problems = playfieldProblems(id, input);
  if (problems.length > 0) fail(problems.join('\n'));
  const spec = playfieldSpecSchema.parse(input);
  const heights = spec.rows.map((_, i) =>
    Array.isArray(spec.rowH) ? (spec.rowH[i] ?? 1) : spec.rowH,
  );
  return {
    id,
    describe: spec.describe,
    lines: spec.rows.map((row) => fullLine(row, spec.mode)),
    heights,
    colours: resolveColours(spec.colours, spec.rows.length, id).colours,
    height: heights.reduce((a, b) => a + b, 0),
  };
}

/** Runs of set blocks [start, length] of a 40-block line rotated left by `shift` blocks. */
export function blockRuns(line: string, shift: number): (readonly [number, number])[] {
  const n = line.length;
  const s = ((Math.round(shift) % n) + n) % n;
  const runs: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= n; i += 1) {
    const on = i < n && line[(i + s) % n] === '#';
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      runs.push([start, i - start]);
      start = -1;
    }
  }
  return runs;
}
