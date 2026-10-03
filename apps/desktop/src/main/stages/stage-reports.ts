/**
 * Reports the stage panels show (PLAN.md#7.2, #7.4-7.7), read from `.reelforge/` of the open
 * project and validated with their zod schemas. A missing or invalid report is null (the panel
 * says "not yet"); the files are app state written by the stages, never by the renderer.
 */
import { readFile } from 'node:fs/promises';
import {
  finalReviewSchema,
  propsReportSchema,
  scenesReportSchema,
  syncReportSchema,
  voiceoverRecordSchema,
  voReportSchema,
  wordsReportSchema,
} from '@reelforge/shared';
import { FILES, inProject, REPORTS } from '@reelforge/stages';
import type { z } from 'zod';
import type { StageReports } from '../../shared/voiceover-contract.js';

async function readReport<S extends z.ZodType>(
  dir: string,
  relative: string,
  schema: S,
): Promise<z.output<S> | null> {
  try {
    const parsed = schema.safeParse(JSON.parse(await readFile(inProject(dir, relative), 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null; // not written yet, or unreadable JSON: the panel shows "not yet"
  }
}

export async function readStageReports(dir: string | undefined): Promise<StageReports> {
  if (dir === undefined) {
    return {
      projectDir: null,
      voiceover: null,
      voReport: null,
      words: null,
      scenes: null,
      sync: null,
      props: null,
      finalReview: null,
    };
  }
  const [voiceover, voReport, words, scenes, sync, props, finalReview] = await Promise.all([
    readReport(dir, FILES.voiceoverRecord, voiceoverRecordSchema),
    readReport(dir, REPORTS.voiceover, voReportSchema),
    readReport(dir, REPORTS.words, wordsReportSchema),
    readReport(dir, FILES.scenesReport, scenesReportSchema),
    readReport(dir, FILES.syncReport, syncReportSchema),
    readReport(dir, FILES.propsReport, propsReportSchema),
    readReport(dir, FILES.finalReview, finalReviewSchema),
  ]);
  return { projectDir: dir, voiceover, voReport, words, scenes, sync, props, finalReview };
}
