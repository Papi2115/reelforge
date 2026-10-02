/**
 * Audio cleaned (PLAN.md §3, ADR-003): `audio/vo.original.*` -> pipeline `cleanAudio` with the
 * preset from the settings -> `audio/vo.clean.wav` (48 kHz) + the LUFS before/after report in
 * `.reelforge/reports/clean.json` (app state, not tracked by git).
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { CleanReportSchema } from '@reelforge/pipeline';
import { writeProjectJson } from '../files.js';
import { FILES, REPORTS, inProject } from '../paths.js';
import {
  stageError,
  type StageContext,
  type StageDefinition,
  type StageError,
  type StageSummary,
} from '../types.js';
import type { ToolError } from '../audio-tools.js';

export function toolFailure(what: string, error: ToolError): StageError {
  return error.kind === 'cancelled'
    ? stageError('cancelled', 'cancelled')
    : stageError('tool', `${what} failed (${error.kind}): ${error.message}`);
}

async function run(ctx: StageContext): Promise<Result<StageSummary, StageError>> {
  const voiceover = ctx.snapshot.voiceover;
  if (voiceover === undefined) return err(stageError('not-ready', 'no voice-over imported'));
  if (ctx.audio === undefined) return err(stageError('missing-tool', 'ffmpeg is not configured'));
  const { clean } = ctx.settings;
  ctx.step(`Cleaning (${clean.preset})`, 0);
  const report = await ctx.audio.clean({
    input: inProject(ctx.projectDir, voiceover.file),
    output: inProject(ctx.projectDir, FILES.voClean),
    preset: clean.preset,
    targetLufs: clean.targetLufs,
    shortenSilence: clean.shortenSilence,
    arnndnModelPath: clean.arnndnModelPath,
    signal: ctx.signal,
    onProgress: (progress) => {
      ctx.step(
        `Cleaning: ${progress.label}`,
        progress.ratio === null ? undefined : Math.round(progress.ratio * 95),
      );
    },
  });
  if (!report.ok) return err(toolFailure('audio clean', report.error));
  const saved = await writeProjectJson(
    ctx.projectDir,
    REPORTS.clean,
    CleanReportSchema,
    report.value,
  );
  if (!saved.ok) return saved;
  const { before, after, withinTolerance, skipped, silence } = report.value;
  const warnings: string[] = [];
  if (!withinTolerance) {
    warnings.push(
      `loudness ${String(after.integratedLufs)} LUFS is outside ${String(report.value.targetLufs)} ±${String(report.value.toleranceLu)} LU`,
    );
  }
  for (const entry of skipped) warnings.push(`${entry.step} skipped: ${entry.reason}`);
  return ok({
    message: `${String(before.integratedLufs)} -> ${String(after.integratedLufs)} LUFS (${report.value.preset})`,
    outputs: [FILES.voClean],
    changed: true,
    warnings,
    metrics: {
      preset: report.value.preset,
      lufsBefore: before.integratedLufs,
      lufsAfter: after.integratedLufs,
      truePeakAfter: after.truePeakDbtp,
      silenceRemovedS: silence?.removedS ?? 0,
    },
  });
}

export const cleanStage: StageDefinition<'clean'> = {
  id: 'clean',
  inputs: ['audio/vo.original.<ext>'],
  outputs: [FILES.voClean, REPORTS.clean],
  run,
};
