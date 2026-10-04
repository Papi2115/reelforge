/**
 * Open loops (PLAN.md#12.26, ADR-020): `loops.json` in the project root (tracked, like
 * storyboard.json) lists the questions the film deliberately opens ("I'll show you in a moment")
 * and where it closes them. Written by the storyboard turn (from the script's open-loop notes in
 * beats.md) when the project switch `openLoops` is `auto`; checked by `analyzeLoops`: a loop that
 * is never closed, a closing without a foreshadow and a closing before the opening are ⚠
 * warnings (never errors: the film still builds). A closing shot may reveal a veiled object
 * (kit `veiledProp` / `redactedBlock` / `maskedRegion`) on its closing phrase.
 */
import { z } from 'zod';
import { shotIdSchema } from './storyboard.js';

export const LOOPS_FILE_VERSION = 1;
/** Project-relative location (tracked by git). */
export const LOOPS_FILE = 'loops.json';
export const MAX_LOOPS = 20;

export const loopIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,47}$/, 'loop id must be kebab case, e.g. why-red-bends');

/** A place on the film: time (s), optionally the shot and the spoken phrase there. */
export const loopPointSchema = z.object({
  t: z.number().nonnegative(),
  shotId: shotIdSchema.optional(),
  phrase: z.string().min(1).max(120).optional(),
});
export type LoopPoint = z.infer<typeof loopPointSchema>;

export const LOOP_STATUSES = ['open', 'closed'] as const;

export const loopSchema = z.object({
  id: loopIdSchema,
  /** The question the viewer carries ("why does red bend the least?"). */
  question: z.string().min(1).max(200),
  openedAt: loopPointSchema,
  plannedCloseAt: loopPointSchema,
  closedAt: loopPointSchema.optional(),
  /** The narration announced the answer ("I'll show you in a moment") before closing it. */
  foreshadowed: z.boolean(),
  status: z.enum(LOOP_STATUSES),
  /** The closing shot reveals a veiled object on the closing phrase. */
  veil: z.boolean().optional(),
});
export type OpenLoop = z.infer<typeof loopSchema>;

export const loopsFileSchema = z
  .object({
    version: z.literal(LOOPS_FILE_VERSION),
    loops: z.array(loopSchema).max(MAX_LOOPS),
  })
  .superRefine((file, issues) => {
    const ids = new Set<string>();
    file.loops.forEach((loop, index) => {
      if (ids.has(loop.id)) {
        issues.addIssue({
          code: 'custom',
          message: `loop id ${loop.id} repeats`,
          path: ['loops', index, 'id'],
        });
      }
      ids.add(loop.id);
    });
  });
export type LoopsFile = z.infer<typeof loopsFileSchema>;

export const LOOP_WARNING_CODES = [
  'loop-unclosed',
  'loop-no-foreshadow',
  'loop-close-before-open',
  'loop-late-close',
  'loop-unknown-shot',
  'loop-phrase-not-spoken',
] as const;
export type LoopWarningCode = (typeof LOOP_WARNING_CODES)[number];

export interface LoopWarning {
  readonly loopId: string;
  readonly code: LoopWarningCode;
  /** One line, starting with ⚠. */
  readonly message: string;
}

export interface LoopContext {
  /** Storyboard shots (ids and times), when there is a storyboard. */
  readonly shots?: readonly { readonly id: string; readonly t0: number; readonly t1: number }[];
  /** Timed words, when there are any: phrases are checked against them. */
  readonly words?: readonly { readonly text: string; readonly t: number }[];
}

/** A closing this far (s) after its planned place is reported as late. */
export const LOOP_LATE_TOLERANCE_S = 20;
const PHRASE_WINDOW_S = 3;

const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

/** The phrase is spoken within ±3 s of `t` (first word matched, then the following words). */
function spokenNear(
  phrase: string,
  t: number,
  words: readonly { readonly text: string; readonly t: number }[],
): boolean {
  const wanted = normalize(phrase).split(' ').filter(Boolean);
  if (wanted.length === 0) return true;
  const spoken = words.map((word) => normalize(word.text));
  return words.some((word, index) => {
    if (Math.abs(word.t - t) > PHRASE_WINDOW_S) return false;
    return wanted.every((part, offset) => spoken[index + offset] === part);
  });
}

function pointWarnings(
  loop: OpenLoop,
  label: string,
  point: LoopPoint,
  context: LoopContext,
): LoopWarning[] {
  const warnings: LoopWarning[] = [];
  const { shots, words } = context;
  if (shots !== undefined && point.shotId !== undefined) {
    if (!shots.some((shot) => shot.id === point.shotId)) {
      warnings.push({
        loopId: loop.id,
        code: 'loop-unknown-shot',
        message: `⚠ loop ${loop.id}: ${label} names shot ${point.shotId}, which is not in the storyboard`,
      });
    }
  }
  if (words !== undefined && words.length > 0 && point.phrase !== undefined) {
    if (!spokenNear(point.phrase, point.t, words)) {
      warnings.push({
        loopId: loop.id,
        code: 'loop-phrase-not-spoken',
        message: `⚠ loop ${loop.id}: ${label} phrase "${point.phrase}" is not spoken near ${point.t.toFixed(1)} s`,
      });
    }
  }
  return warnings;
}

/** Warnings of one loop (see the module comment). */
export function loopWarnings(loop: OpenLoop, context: LoopContext = {}): LoopWarning[] {
  const warnings: LoopWarning[] = [];
  const closed = loop.status === 'closed' && loop.closedAt !== undefined;
  const question = `"${loop.question}"`;
  if (!closed) {
    warnings.push({
      loopId: loop.id,
      code: 'loop-unclosed',
      message: `⚠ loop ${loop.id} ${question} is never closed (planned at ${loop.plannedCloseAt.t.toFixed(1)} s)`,
    });
  }
  const closing = loop.closedAt ?? loop.plannedCloseAt;
  if (closing.t <= loop.openedAt.t) {
    warnings.push({
      loopId: loop.id,
      code: 'loop-close-before-open',
      message: `⚠ loop ${loop.id} ${question} closes at ${closing.t.toFixed(1)} s, before it opens at ${loop.openedAt.t.toFixed(1)} s`,
    });
  }
  if (closed && !loop.foreshadowed) {
    warnings.push({
      loopId: loop.id,
      code: 'loop-no-foreshadow',
      message: `⚠ loop ${loop.id} ${question} is closed without a foreshadow (announce the answer before it comes)`,
    });
  }
  if (closed && closing.t - loop.plannedCloseAt.t > LOOP_LATE_TOLERANCE_S) {
    warnings.push({
      loopId: loop.id,
      code: 'loop-late-close',
      message: `⚠ loop ${loop.id} ${question} closes ${(closing.t - loop.plannedCloseAt.t).toFixed(0)} s after its planned place`,
    });
  }
  return [
    ...warnings,
    ...pointWarnings(loop, 'opening', loop.openedAt, context),
    ...(loop.closedAt === undefined ? [] : pointWarnings(loop, 'closing', loop.closedAt, context)),
  ];
}

/** Warnings of every loop, in file order. */
export function analyzeLoops(file: LoopsFile, context: LoopContext = {}): LoopWarning[] {
  return file.loops.flatMap((loop) => loopWarnings(loop, context));
}

/** Loops whose closing reveals a veiled object in `shotId` (scene-build directive). */
export function loopsClosingIn(file: LoopsFile, shotId: string): OpenLoop[] {
  return file.loops.filter((loop) => (loop.closedAt ?? loop.plannedCloseAt).shotId === shotId);
}

/** Loops opened in `shotId`. */
export function loopsOpeningIn(file: LoopsFile, shotId: string): OpenLoop[] {
  return file.loops.filter((loop) => loop.openedAt.shotId === shotId);
}
