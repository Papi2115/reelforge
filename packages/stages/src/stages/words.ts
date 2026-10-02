/**
 * Words timed (PLAN.md §3, ADR-003): whisper.cpp on the ORIGINAL recording (the cleaned one only
 * when cleaning shortened pauses, so times match the final audio), language from project.json,
 * aligned to script.txt -> `timing/words.raw.json` + `timing/words.json`. Poor results (coverage
 * < 0.85 or a decoder loop) are retried (see words-quality.ts); the report lists every attempt and
 * the mismatch regions. Scenes reference words through anchors, so they follow a new timing.
 */
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  WordsFileSchema,
  WordsRawSchema,
  alignRawWords,
  type WordsFile,
  type WordsRaw,
} from '@reelforge/pipeline';
import { WORDS_REPORT_VERSION, wordsReportSchema, type WordsAttempt } from '@reelforge/shared';
import { requireProjectText, writeProjectJson } from '../files.js';
import { wordsUseCleanAudio } from '../gating.js';
import { FILES, REPORTS, inProject } from '../paths.js';
import {
  stageError,
  type StageContext,
  type StageDefinition,
  type StageError,
  type StageSummary,
} from '../types.js';
import { toolFailure } from './clean.js';
import { addAlignmentToVoReport } from './vo-report.js';
import { attemptPlan, findRepetitionLoop, isBetter, type AttemptPlan } from './words-quality.js';

const MAX_REPORTED_MISMATCHES = 50;

interface Candidate {
  readonly index: number;
  readonly raw: WordsRaw;
  readonly words: WordsFile;
  readonly coverage: number;
  readonly loop: boolean;
}

function attemptRecord(
  plan: AttemptPlan,
  outcome: Partial<Candidate>,
  error: string | null,
): WordsAttempt {
  return {
    model: plan.model,
    beamSize: plan.decoding?.beamSize ?? null,
    temperature: plan.decoding?.temperature ?? null,
    coverage: outcome.coverage ?? null,
    loop: outcome.loop ?? false,
    error,
  };
}

interface Transcribed {
  readonly best: Candidate;
  readonly attempts: readonly WordsAttempt[];
}

async function transcribeWithRetries(
  ctx: StageContext,
  audioPath: string,
  script: string,
  lang: 'en' | 'pl',
): Promise<Result<Transcribed, StageError>> {
  const audio = ctx.audio;
  if (audio === undefined)
    return err(stageError('missing-tool', 'ffmpeg/whisper are not configured'));
  const { whisper } = ctx.settings;
  const plan = attemptPlan(whisper.model, whisper.fallbackModel, (model) =>
    audio.hasWhisperModel(model),
  );
  const attempts: WordsAttempt[] = [];
  let best: Candidate | undefined;
  for (const [index, entry] of plan.entries()) {
    const label = entry.decoding === undefined ? entry.model : `${entry.model}, -bs 5 -tp 0.2`;
    ctx.step(`Transcribing (${label})`, Math.round((index / plan.length) * 90));
    const raw = await audio.transcribe({
      input: audioPath,
      workDir: inProject(ctx.projectDir, FILES.asrWorkDir),
      lang,
      model: entry.model,
      decoding: entry.decoding,
      threads: whisper.threads,
      signal: ctx.signal,
    });
    if (!raw.ok) {
      if (raw.error.kind === 'cancelled' || index === 0)
        return err(toolFailure('transcription', raw.error));
      attempts.push(attemptRecord(entry, {}, raw.error.message));
      continue;
    }
    const words = alignRawWords(script, raw.value);
    const candidate: Candidate = {
      index,
      raw: raw.value,
      words,
      coverage: words.stats.coverage,
      loop: findRepetitionLoop(raw.value.words) !== undefined,
    };
    attempts.push(attemptRecord(entry, candidate, null));
    if (isBetter(candidate, best)) best = candidate;
    if (!candidate.loop && candidate.coverage >= whisper.minCoverage) break;
  }
  return best === undefined
    ? err(stageError('tool', 'every transcription attempt failed'))
    : ok({ best, attempts });
}

async function run(ctx: StageContext): Promise<Result<StageSummary, StageError>> {
  const { snapshot } = ctx;
  if (snapshot.voiceover === undefined || snapshot.project.status !== 'ok') {
    return err(stageError('not-ready', 'a project with an imported voice-over is required'));
  }
  const script = await requireProjectText(ctx.projectDir, FILES.script);
  if (!script.ok) return script;
  const audioFile = wordsUseCleanAudio(snapshot) ? FILES.voClean : snapshot.voiceover.file;
  const transcribed = await transcribeWithRetries(
    ctx,
    inProject(ctx.projectDir, audioFile),
    script.value,
    snapshot.project.value.language,
  );
  if (!transcribed.ok) return transcribed;
  const { best, attempts } = transcribed.value;

  ctx.step('Saving timing', 95);
  const raw = await writeProjectJson(ctx.projectDir, FILES.wordsRaw, WordsRawSchema, best.raw);
  if (!raw.ok) return raw;
  const words = await writeProjectJson(ctx.projectDir, FILES.words, WordsFileSchema, best.words);
  if (!words.ok) return words;
  const { stats, mismatches } = best.words;
  const warnings: string[] = [];
  if (best.coverage < ctx.settings.whisper.minCoverage) {
    warnings.push(
      `only ${String(Math.round(best.coverage * 100))} % of the script was found in the recording: check the mismatch regions`,
    );
  }
  if (best.loop) warnings.push('whisper repeated itself (decoder loop) in every attempt');
  if (attempts.length > 1)
    warnings.push(`kept attempt ${String(best.index + 1)} of ${String(attempts.length)}`);
  const report = await writeProjectJson(ctx.projectDir, REPORTS.words, wordsReportSchema, {
    version: WORDS_REPORT_VERSION,
    audio: audioFile,
    lang: best.words.lang,
    attempts: [...attempts],
    chosen: best.index,
    coverage: best.coverage,
    mismatches: mismatches.slice(0, MAX_REPORTED_MISMATCHES).map((region) => ({
      t: region.t,
      tEnd: region.tEnd,
      script: region.script,
      heard: region.heard,
    })),
    warnings,
  });
  if (!report.ok) return report;
  const vo = await addAlignmentToVoReport(ctx.projectDir, {
    coverage: best.coverage,
    mismatches: mismatches.length,
    missingWords: stats.missing,
  });
  if (!vo.ok) warnings.push(vo.error.message);
  return ok({
    message: `${String(best.words.words.length)} words timed, ${String(Math.round(best.coverage * 100))} % coverage (${best.raw.model}, ${path.basename(audioFile)})`,
    outputs: [FILES.wordsRaw, FILES.words],
    changed: true,
    warnings,
    metrics: {
      words: best.words.words.length,
      coverage: best.coverage,
      wer: stats.wer,
      mismatches: mismatches.length,
      attempts: attempts.length,
      model: best.raw.model,
    },
  });
}

export const wordsStage: StageDefinition<'words'> = {
  id: 'words',
  inputs: ['audio/vo.original.<ext> (or audio/vo.clean.wav after pause shortening)', FILES.script],
  outputs: [FILES.wordsRaw, FILES.words, REPORTS.words],
  run,
};
