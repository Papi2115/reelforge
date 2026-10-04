/**
 * Dramaturgy (PLAN.md#12.25–12.27, ADR-020): three project switches in project.json —
 * `patternInterrupts`, `openLoops`, `revealMoments`, each `off` | `auto`. Absent = `off`: projects
 * made before 2.2 render, prompt and mix exactly as before; new projects get `auto` from the
 * template. The dramaturgy report (`.reelforge/reports/dramaturgy.json`, app state) holds the
 * interrupt report (planned vs realised per minute) and the open-loop warnings of the last
 * Storyboard / final review.
 */
import { z } from 'zod';
import { interruptReportSchema } from './interrupts.js';

export const DRAMATURGY_MODES = ['off', 'auto'] as const;
export const dramaturgyModeSchema = z.enum(DRAMATURGY_MODES);
export type DramaturgyMode = z.infer<typeof dramaturgyModeSchema>;
export const DEFAULT_DRAMATURGY_MODE: DramaturgyMode = 'off';

interface DramaturgySwitches {
  readonly patternInterrupts?: DramaturgyMode | undefined;
  readonly openLoops?: DramaturgyMode | undefined;
  readonly revealMoments?: DramaturgyMode | undefined;
}

export function projectPatternInterrupts(project: DramaturgySwitches): DramaturgyMode {
  return project.patternInterrupts ?? DEFAULT_DRAMATURGY_MODE;
}

export function projectOpenLoops(project: DramaturgySwitches): DramaturgyMode {
  return project.openLoops ?? DEFAULT_DRAMATURGY_MODE;
}

export function projectRevealMoments(project: DramaturgySwitches): DramaturgyMode {
  return project.revealMoments ?? DEFAULT_DRAMATURGY_MODE;
}

export const DRAMATURGY_REPORT_VERSION = 1;
export const DRAMATURGY_REPORT_FILE = '.reelforge/reports/dramaturgy.json';

export const dramaturgyReportSchema = z.object({
  version: z.literal(DRAMATURGY_REPORT_VERSION),
  createdAt: z.iso.datetime(),
  /** Which run wrote it. */
  source: z.enum(['storyboard', 'final-review']),
  /** Present when pattern interrupts are on. */
  interrupts: interruptReportSchema.optional(),
  /** Present when open loops are on. */
  loops: z
    .object({
      count: z.int().nonnegative(),
      open: z.int().nonnegative(),
      /** "⚠ loop … is never closed" lines. */
      warnings: z.array(z.string()),
      /** loops.json is missing or invalid (the reason), else absent. */
      problem: z.string().optional(),
    })
    .optional(),
});
export type DramaturgyReport = z.infer<typeof dramaturgyReportSchema>;
