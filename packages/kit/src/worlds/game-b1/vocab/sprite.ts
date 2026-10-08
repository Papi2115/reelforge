/**
 * The 2600 SPRITE DSL of the open vocabulary (PLAN.md#13.15): a film defines the TV's things
 * itself (a ranger, a deer, a rowing boat) instead of replaying the showcase's cartridges. The
 * hardware's rules are the grammar, and the validator explains every violation as a sentence:
 * - a player is 8 bits wide ('#' on, '.' off) and any height (<= 48 rows);
 * - ONE colour per row (the colour register changes once per scanline);
 * - NUSIZ: a player is stretched (size 1, 2, 4) OR copied (2 copies close / medium / wide, 3 close
 *   / medium), never both;
 * - frames of one sprite share its height; `rowH` doubles lines as a 2-line kernel does.
 */
import { z } from 'zod';
import { resolveColours } from './colours.js';

export const PLAYER_BITS = 8;
export const MAX_ROWS = 48;
export const MAX_FRAMES = 8;

export const idSchema = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9-]{0,31}$/, 'ids are camelCase or kebab-case, <= 32 characters');

export const colourTableSchema = z
  .union([
    z.string(),
    z.array(z.union([z.string(), z.null()])).max(96),
    z.record(z.string(), z.string()),
  ])
  .describe('One ink, one ink per row (null = row off), or row stops { "0": "tan", "3": "teal" }');

export const spriteSpecSchema = z.strictObject({
  describe: z.string().min(1).max(80).optional().describe('What it is, in the narration`s words'),
  rows: z.array(z.string()).min(1).max(MAX_ROWS).optional(),
  frames: z.array(z.array(z.string()).min(1).max(MAX_ROWS)).min(1).max(MAX_FRAMES).optional(),
  colours: colourTableSchema,
  fps: z.number().min(0.5).max(30).default(6).describe('Animation cadence (held frames)'),
  size: z
    .union([z.literal(1), z.literal(2), z.literal(4)])
    .default(1)
    .describe('NUSIZ stretch'),
  copies: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  gap: z.enum(['close', 'medium', 'wide']).default('close').describe('Copy spacing (NUSIZ)'),
  rowH: z.int().min(1).max(4).default(1).describe('TV lines per row (line doubling)'),
  faces: z.enum(['right', 'left']).default('right').describe('Which way the drawing looks'),
});

export type SpriteSpec = z.input<typeof spriteSpecSchema>;

/** Start of each copy in TV units (colour clocks): close 16, medium 32, wide 64. */
const GAPS = { close: 16, medium: 32, wide: 64 } as const;

export interface B1Sprite {
  readonly id: string;
  readonly describe: string | undefined;
  readonly frames: readonly (readonly string[])[];
  readonly colours: readonly (string | null)[];
  readonly fps: number;
  readonly size: 1 | 2 | 4;
  /** Copy offsets in TV units ([0] = one copy). */
  readonly copies: readonly number[];
  readonly rowH: number;
  readonly faces: 'right' | 'left';
  /** Widest row in bits and rows per frame. */
  readonly width: number;
  readonly height: number;
}

function rowProblems(what: string, rows: readonly string[]): string[] {
  const problems: string[] = [];
  rows.forEach((row, i) => {
    const bad = [...new Set(row.replace(/[#.]/g, ''))];
    if (bad.length > 0)
      problems.push(
        `${what} row ${String(i)} "${row}" uses ${bad.map((ch) => `'${ch}'`).join(' ')}: rows are '#' (on) and '.' (off)`,
      );
    if (row.length > PLAYER_BITS)
      problems.push(
        `${what} row ${String(i)} is ${String(row.length)} bits wide: a 2600 player is ${String(PLAYER_BITS)} bits. Draw it narrower and stretch it (size 2 or 4), split it into two sprites side by side (they count as two on the scanline), or make it playfield`,
      );
  });
  if (rows.every((row) => !row.includes('#'))) problems.push(`${what}: every row is empty`);
  return problems;
}

/** Every rule the spec breaks, as sentences (empty = valid). */
export function spriteProblems(id: string, input: unknown): string[] {
  const what = `sprite "${id}"`;
  const idCheck = idSchema.safeParse(id);
  const problems = idCheck.success ? [] : [`${what}: ${idCheck.error.issues[0]?.message ?? ''}`];
  const parsed = spriteSpecSchema.safeParse(input);
  if (!parsed.success)
    return [
      ...problems,
      ...parsed.error.issues.map(
        (issue) => `${what}: ${issue.path.join('.') || '(spec)'} ${issue.message}`,
      ),
    ];
  const spec = parsed.data;
  if ((spec.rows === undefined) === (spec.frames === undefined))
    return [...problems, `${what}: give rows (one picture) or frames (an animation), not both`];
  const frames = spec.frames ?? [spec.rows ?? []];
  const height = frames[0]?.length ?? 0;
  frames.forEach((rows, f) => {
    problems.push(...rowProblems(frames.length > 1 ? `${what} frame ${String(f)}` : what, rows));
    if (rows.length !== height)
      problems.push(
        `${what}: frame ${String(f)} has ${String(rows.length)} rows, frame 0 ${String(height)}; every frame of a sprite has the same height`,
      );
  });
  if (spec.copies > 1 && spec.size > 1)
    problems.push(
      `${what}: size ${String(spec.size)} with ${String(spec.copies)} copies; NUSIZ either stretches a player or copies it, not both`,
    );
  if (spec.copies === 3 && spec.gap === 'wide')
    problems.push(`${what}: three copies come close or medium only (NUSIZ has no wide triple)`);
  if (height * spec.rowH > 180)
    problems.push(`${what}: ${String(height * spec.rowH)} lines tall, the picture has 180`);
  problems.push(...resolveColours(spec.colours, height, `${what} colours`).problems);
  return problems;
}

/** The checked sprite; throws `fail(sentences)` when the spec breaks a rule. */
export function compileSprite(
  id: string,
  input: unknown,
  fail: (message: string) => never,
): B1Sprite {
  const problems = spriteProblems(id, input);
  if (problems.length > 0) fail(problems.join('\n'));
  const spec = spriteSpecSchema.parse(input);
  const frames = spec.frames ?? [spec.rows ?? []];
  const height = frames[0]?.length ?? 0;
  return {
    id,
    describe: spec.describe,
    frames,
    colours: resolveColours(spec.colours, height, id).colours,
    fps: spec.fps,
    size: spec.size,
    copies: Array.from({ length: spec.copies }, (_, i) => i * GAPS[spec.gap]),
    rowH: spec.rowH,
    faces: spec.faces,
    width: Math.max(...frames.flat().map((row) => row.length)),
    height,
  };
}
