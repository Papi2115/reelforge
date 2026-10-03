/**
 * Sound design mixed (PLAN.md#8.3): `cues.json` + `audio/vo.clean.wav` (+ SFX/ambience recipes,
 * music files) -> pipeline `mixAudio` -> `audio/mix.wav`, `.reelforge/reports/mix.json` and the QA
 * verdict `.reelforge/mix-report.json` (ducking, speech clarity, music low band, clipping, SFX
 * density: warnings). The stage fails when the master misses the loudness bar: target (−14 LUFS)
 * ± 1 LU, true peak ≤ −1 dBTP.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  CuesFileSchema,
  MixQaReportSchema,
  MixReportSchema,
  buildMixQaReport,
  type MixReport,
} from '@reelforge/pipeline';
import { requireProjectJson, writeProjectJson } from '../files.js';
import { FILES, REPORTS, inProject } from '../paths.js';
import {
  stageError,
  type StageContext,
  type StageDefinition,
  type RequestOf,
  type StageError,
  type StageSummary,
} from '../types.js';
import { toolFailure } from './clean.js';

/** Problems with the master's loudness (empty = passes PLAN.md#8.3). */
export function loudnessProblems(report: MixReport, toleranceLu: number): string[] {
  const problems: string[] = [];
  const { integratedLufs, truePeakDbtp } = report.after;
  if (Math.abs(integratedLufs - report.targetLufs) > toleranceLu) {
    problems.push(
      `loudness ${String(integratedLufs)} LUFS is outside ${String(report.targetLufs)} ±${String(toleranceLu)} LU`,
    );
  }
  if (truePeakDbtp > report.truePeakMaxDbtp) {
    problems.push(
      `true peak ${String(truePeakDbtp)} dBTP is above ${String(report.truePeakMaxDbtp)} dBTP`,
    );
  }
  return problems;
}

async function run(
  ctx: StageContext,
  request: RequestOf<'mix'>,
): Promise<Result<StageSummary, StageError>> {
  if (ctx.audio === undefined) return err(stageError('missing-tool', 'ffmpeg is not configured'));
  const cues = await requireProjectJson(ctx.projectDir, FILES.cues, CuesFileSchema);
  if (!cues.ok) return cues;
  ctx.step('Mixing', 0);
  const report = await ctx.audio.mix(cues.value, {
    voPath: inProject(ctx.projectDir, FILES.voClean),
    outputPath: inProject(ctx.projectDir, FILES.mix),
    baseDir: ctx.projectDir,
    workDir: inProject(ctx.projectDir, FILES.mixWorkDir),
    stemsDir: request.stems === true ? inProject(ctx.projectDir, FILES.stemsDir) : undefined,
    signal: ctx.signal,
    onProgress: (progress) => {
      ctx.step(
        `Mixing: ${progress.label}`,
        progress.ratio === null ? undefined : Math.round(progress.ratio * 95),
      );
    },
  });
  if (!report.ok) return err(toolFailure('mix', report.error));
  const saved = await writeProjectJson(ctx.projectDir, REPORTS.mix, MixReportSchema, report.value);
  if (!saved.ok) return saved;
  const qa = buildMixQaReport(report.value, cues.value, {
    toleranceLu: ctx.settings.mixToleranceLu,
    createdAt: ctx.now().toISOString(),
  });
  const savedQa = await writeProjectJson(ctx.projectDir, FILES.mixQaReport, MixQaReportSchema, qa);
  if (!savedQa.ok) return savedQa;
  const problems = loudnessProblems(report.value, ctx.settings.mixToleranceLu);
  if (problems.length > 0) {
    return err(
      stageError('quality', `mix.wav misses the loudness target: ${problems.join('; ')}`, problems),
    );
  }
  const { after } = report.value;
  const measured = report.value.qa;
  return ok({
    message: `${String(after.integratedLufs)} LUFS, true peak ${String(after.truePeakDbtp)} dBTP`,
    outputs: [FILES.mix],
    changed: true,
    warnings: [...report.value.warnings, ...qa.warnings],
    metrics: {
      duckingDb: measured?.duckingDepthDb ?? null,
      speechMarginDb: measured?.speechMarginDb ?? null,
      musicLowShare: measured?.musicLowShare ?? null,
      lufs: after.integratedLufs,
      truePeakDbtp: after.truePeakDbtp,
      durationS: report.value.durationS,
      sfx: report.value.cues.sfx,
      ambience: report.value.cues.ambience,
      music: report.value.cues.music,
    },
  });
}

export const mixStage: StageDefinition<'mix'> = {
  id: 'mix',
  inputs: [FILES.cues, FILES.voClean, 'audio/music/*, audio/sfx/* (referenced by cues)'],
  outputs: [FILES.mix, REPORTS.mix, FILES.mixQaReport],
  run,
};
