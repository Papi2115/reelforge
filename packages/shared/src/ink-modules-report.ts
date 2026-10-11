/**
 * `.reelforge/ink-modules.json` (PLAN.md#14.11): what the Grim Ink (`c-cam`) people-and-places
 * step built for which storyboard. One record per designed module (`kit-ext/people/<id>.js`,
 * `kit-ext/places/<id>.js`): `built` passed every check, `warning` is kept with findings the code
 * checks did not raise (the critic's), `placeholder` failed the code checks after its fix turn and
 * was replaced by a plain sketched stand-in so the scenes still render (the module moved to
 * `.reelforge/ink-failed/`).
 */
import { z } from 'zod';
import { inkModuleIdSchema } from './ink-modules.js';

export const INK_MODULES_REPORT_FILE = '.reelforge/ink-modules.json';
/** Where a module that failed its checks is kept for reference (outside git). */
export const INK_MODULES_FAILED_DIR = '.reelforge/ink-failed';
export const INK_MODULES_REPORT_VERSION = 1;

export const INK_MODULE_KINDS = ['people', 'places'] as const;
export const inkModuleKindSchema = z.enum(INK_MODULE_KINDS);
export type InkModuleKind = z.infer<typeof inkModuleKindSchema>;

export const INK_MODULE_STATUSES = ['built', 'warning', 'placeholder'] as const;
export const inkModuleStatusSchema = z.enum(INK_MODULE_STATUSES);
export type InkModuleStatus = z.infer<typeof inkModuleStatusSchema>;

export const inkModuleRecordSchema = z.object({
  kind: inkModuleKindSchema,
  id: inkModuleIdSchema,
  status: inkModuleStatusSchema,
  /** Project-relative module path. */
  file: z.string().min(1),
  /** What it must be (the storyboard's tag description, or the shots set there). */
  brief: z.string(),
  /** Storyboard shots that name it. */
  shots: z.array(z.string().min(1)),
  /** Build turns run for it so far (build + fixes). */
  attempts: z.int().nonnegative(),
  /** Project-relative contact sheet of the last QA round. */
  sheet: z.string().optional(),
  /** Problems left after the last QA round (empty when built). */
  findings: z.array(z.string()),
  notes: z.array(z.string()),
  updatedAt: z.iso.datetime(),
});
export type InkModuleRecord = z.infer<typeof inkModuleRecordSchema>;

export const inkModulesReportSchema = z.object({
  version: z.literal(INK_MODULES_REPORT_VERSION),
  /** sha256 of storyboard.json the modules were designed for. */
  storyboardHash: z.string().min(1),
  modules: z.array(inkModuleRecordSchema),
  updatedAt: z.iso.datetime(),
});
export type InkModulesReport = z.infer<typeof inkModulesReportSchema>;
