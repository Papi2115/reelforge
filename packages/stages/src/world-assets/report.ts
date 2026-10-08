/** `.reelforge/world-assets.json` (PLAN.md#13.15 phase 2): what the world-assets step built for which storyboard. */
import { createHash } from 'node:crypto';
import { ok, type Result } from '@reelforge/claude-bridge';
import {
  WORLD_ASSETS_REPORT_FILE,
  worldAssetsReportSchema,
  type WorldAssetsReport,
} from '@reelforge/shared';
import { readProjectText, writeProjectJson } from '../files.js';
import { FILES } from '../paths.js';
import type { StageError } from '../types.js';

/** The report, or undefined when there is none (or it is unreadable: the step runs again). */
export async function readWorldAssetsReport(
  projectDir: string,
): Promise<Result<WorldAssetsReport | undefined, StageError>> {
  const text = await readProjectText(projectDir, WORLD_ASSETS_REPORT_FILE);
  if (!text.ok || text.value === undefined) return text.ok ? ok(undefined) : text;
  try {
    const parsed = worldAssetsReportSchema.safeParse(JSON.parse(text.value));
    return ok(parsed.success ? parsed.data : undefined);
  } catch (error) {
    if (error instanceof SyntaxError) return ok(undefined);
    throw error;
  }
}

export function saveWorldAssetsReport(
  projectDir: string,
  report: WorldAssetsReport,
): Promise<Result<WorldAssetsReport, StageError>> {
  return writeProjectJson(projectDir, WORLD_ASSETS_REPORT_FILE, worldAssetsReportSchema, report);
}

/** sha256 of storyboard.json as it is now (undefined: no storyboard). */
export async function storyboardHash(
  projectDir: string,
): Promise<Result<string | undefined, StageError>> {
  const text = await readProjectText(projectDir, FILES.storyboard);
  if (!text.ok || text.value === undefined) return text.ok ? ok(undefined) : text;
  return ok(createHash('sha256').update(text.value).digest('hex'));
}
