/**
 * Script (PLAN.md#7.1): brief.json -> research turn (web tools) -> research.md -> script turn ->
 * beats.md + script.txt, both in the `script` side session. Outputs are validated (research: a
 * source on every claim; script: spoken text only, word count within ±15 % of the target) with one
 * automatic repair turn each. An unsourced research note is a warning; an invalid script fails.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  WORDS_PER_MINUTE,
  targetWordsFor,
  validateResearch,
  validateScript,
  worldWordBudget,
} from '@reelforge/prompts';
import {
  genrePresetScriptTone,
  isShort,
  SCRIPT_REPORT_VERSION,
  scriptReportSchema,
  type BriefFile,
} from '@reelforge/shared';
import { scriptDramaturgyVars } from '../dramaturgy.js';
import { runShortScript } from '../shorts/script-step.js';
import { activeWorld, promptWorld, scriptWorldPromptVars, worldScope } from '../worlds.js';
import { readProjectText, writeProjectJson } from '../files.js';
import { FILES, REPORTS } from '../paths.js';
import {
  stageError,
  type StageContext,
  type StageDefinition,
  type StageError,
  type StageSummary,
} from '../types.js';
import { checkWithRepair, errorLines, render, warningLines, type OutputCheck } from './repair.js';

const NOT_SPECIFIED = 'not specified';

/**
 * The script prompt's `tone`: the brief's, with the genre preset's hint after it (PLAN.md#13.8).
 * Without a preset exactly the brief's tone (or "not specified"), so older prompts are unchanged.
 */
export function scriptToneVar(
  briefTone: string | undefined,
  presetTone: string | undefined,
): string {
  if (presetTone === undefined) return briefTone ?? NOT_SPECIFIED;
  const own = briefTone?.trim() ?? '';
  return own === '' ? presetTone : `${own}; genre: ${presetTone}`;
}

export function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  return `${String(Math.floor(rounded / 60))}:${String(rounded % 60).padStart(2, '0')}`;
}

async function checkResearch(ctx: StageContext): Promise<OutputCheck<number>> {
  const text = await readProjectText(ctx.projectDir, FILES.research);
  if (!text.ok) return { value: undefined, problems: [text.error.message], warnings: [] };
  if (text.value === undefined) {
    return { value: undefined, problems: [`${FILES.research} was not written`], warnings: [] };
  }
  const report = validateResearch(text.value);
  return {
    value: report.value?.sources,
    problems: errorLines(report.issues),
    warnings: warningLines(report.issues),
  };
}

interface ScriptStats {
  readonly wordCount: number;
  readonly estimatedSeconds: number;
}

async function checkScript(
  ctx: StageContext,
  targetWords: number,
  budget: { readonly words: number; readonly over: number } | undefined,
): Promise<OutputCheck<ScriptStats>> {
  const [beats, script] = await Promise.all([
    readProjectText(ctx.projectDir, FILES.beats),
    readProjectText(ctx.projectDir, FILES.script),
  ]);
  const problems: string[] = [];
  if (!beats.ok) problems.push(beats.error.message);
  else if (beats.value === undefined || beats.value.trim() === '') {
    problems.push(`${FILES.beats} was not written`);
  }
  if (!script.ok)
    return { value: undefined, problems: [...problems, script.error.message], warnings: [] };
  if (script.value === undefined) {
    return {
      value: undefined,
      problems: [...problems, `${FILES.script} was not written`],
      warnings: [],
    };
  }
  const report = validateScript(script.value, {
    targetWords,
    ...(budget === undefined ? {} : { budget }),
  });
  const stats =
    report.value === undefined
      ? undefined
      : {
          wordCount: report.value.wordCount,
          estimatedSeconds: (report.value.wordCount / WORDS_PER_MINUTE) * 60,
        };
  return {
    value: stats,
    problems: [...problems, ...errorLines(report.issues)],
    warnings: warningLines(report.issues),
  };
}

async function runResearch(
  ctx: StageContext,
  brief: BriefFile,
): Promise<Result<{ sources: number; warnings: string[] }, StageError>> {
  const prompt = render('research', { brief });
  if (!prompt.ok) return prompt;
  ctx.step('Research', 5);
  const turn = await ctx.claude({
    prompt: 'research',
    text: prompt.value,
    purpose: 'script',
    newSession: true,
    label: 'research',
  });
  if (!turn.ok) return turn;
  const checked = await checkWithRepair({
    ctx,
    prompt: 'research',
    purpose: 'script',
    file: FILES.research,
    label: 'research',
    check: () => checkResearch(ctx),
  });
  if (!checked.ok) return checked;
  const warnings = [...checked.value.warnings];
  if (checked.value.problems.length > 0) {
    warnings.push(`research.md still has problems: ${checked.value.problems.join('; ')}`);
  }
  return ok({ sources: checked.value.value ?? 0, warnings });
}

async function run(ctx: StageContext): Promise<Result<StageSummary, StageError>> {
  const { brief } = ctx.snapshot;
  if (brief.status !== 'ok' || brief.value.targetMinutes === undefined) {
    return err(stageError('not-ready', 'brief.json with a target length is required'));
  }
  // A short (PLAN.md#13.18): a teaser written from its film, no research turn.
  const { project } = ctx.snapshot;
  if (project.status === 'ok' && isShort(project.value)) {
    return runShortScript(ctx, project.value, brief.value);
  }
  const targetMinutes = brief.value.targetMinutes;
  const targetWords = targetWordsFor(targetMinutes);
  const world =
    project.status === 'ok'
      ? activeWorld(project.value.style, worldScope(ctx.settings))
      : undefined;
  // A world with length control (Grim Ink, PLAN.md#14.18): the budget in the prompt and a warning.
  const worldText = promptWorld(world)?.text;
  const budget = worldText === undefined ? undefined : worldWordBudget(worldText, targetMinutes);
  const research = await runResearch(ctx, brief.value);
  if (!research.ok) return research;

  const prompt = render('script', {
    brief: brief.value,
    language: brief.value.language,
    targetMinutes,
    targetWords,
    tone: scriptToneVar(
      brief.value.tone,
      ctx.snapshot.project.status === 'ok'
        ? genrePresetScriptTone(ctx.snapshot.project.value)
        : undefined,
    ),
    audience: brief.value.audience ?? NOT_SPECIFIED,
    // Surprise beats / open loops in beats.md (PLAN.md#12.25-12.26); nothing with the switches off.
    ...(ctx.snapshot.project.status === 'ok'
      ? scriptDramaturgyVars(ctx.snapshot.project.value)
      : {}),
    // A world's surprise beats are page moments, not camera moves (real run Sketchbook 1).
    ...(project.status === 'ok' ? scriptWorldPromptVars(world, targetMinutes) : {}),
  });
  if (!prompt.ok) return prompt;
  ctx.step('Beat sheet and script', 45);
  const turn = await ctx.claude({
    prompt: 'script',
    text: prompt.value,
    purpose: 'script',
    newSession: false,
    label: 'script',
  });
  if (!turn.ok) return turn;
  const checked = await checkWithRepair({
    ctx,
    prompt: 'script',
    purpose: 'script',
    file: FILES.script,
    label: 'script',
    check: () => checkScript(ctx, targetWords, budget),
  });
  if (!checked.ok) return checked;
  const { value: stats, problems, repairs } = checked.value;
  if (problems.length > 0 || stats === undefined) {
    return err(
      stageError(
        'validation',
        `script.txt is still invalid after a repair: ${problems.join('; ')}`,
        problems,
      ),
    );
  }
  ctx.step('Saving report', 95);
  const warnings = [...research.value.warnings, ...checked.value.warnings];
  const report = await writeProjectJson(ctx.projectDir, REPORTS.script, scriptReportSchema, {
    version: SCRIPT_REPORT_VERSION,
    wordCount: stats.wordCount,
    targetWords,
    estimatedSeconds: Math.round(stats.estimatedSeconds * 10) / 10,
    repairs,
    researchSources: research.value.sources,
    issues: warnings,
  });
  if (!report.ok) return report;
  return ok({
    message: `${String(stats.wordCount)} words, about ${formatDuration(stats.estimatedSeconds)} at ${String(WORDS_PER_MINUTE)} wpm`,
    outputs: [FILES.research, FILES.beats, FILES.script],
    changed: true,
    warnings,
    metrics: {
      wordCount: stats.wordCount,
      targetWords,
      estimatedSeconds: report.value.estimatedSeconds,
      researchSources: research.value.sources,
      repairs,
    },
  });
}

export const scriptStage: StageDefinition<'script'> = {
  id: 'script',
  inputs: [FILES.brief],
  outputs: [FILES.research, FILES.beats, FILES.script],
  run,
};
