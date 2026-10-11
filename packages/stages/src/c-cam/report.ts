/** `.reelforge/ink-modules.json` (PLAN.md#14.11): the Grim Ink people and places per storyboard. */
import { ok, type Result } from '@reelforge/claude-bridge';
import {
  INK_MODULES_REPORT_FILE,
  inkModulesReportSchema,
  type InkModulesReport,
} from '@reelforge/shared';
import { readProjectText, writeProjectJson } from '../files.js';
import type { StageError } from '../types.js';

/** The report, or undefined when there is none (or it is unreadable: the step runs again). */
export async function readInkModulesReport(
  projectDir: string,
): Promise<Result<InkModulesReport | undefined, StageError>> {
  const text = await readProjectText(projectDir, INK_MODULES_REPORT_FILE);
  if (!text.ok || text.value === undefined) return text.ok ? ok(undefined) : text;
  try {
    const parsed = inkModulesReportSchema.safeParse(JSON.parse(text.value));
    return ok(parsed.success ? parsed.data : undefined);
  } catch (error) {
    if (error instanceof SyntaxError) return ok(undefined);
    throw error;
  }
}

export function saveInkModulesReport(
  projectDir: string,
  report: InkModulesReport,
): Promise<Result<InkModulesReport, StageError>> {
  return writeProjectJson(projectDir, INK_MODULES_REPORT_FILE, inkModulesReportSchema, report);
}
