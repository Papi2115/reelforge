/**
 * Storyboard (PLAN.md#7.3): Claude (storyboard prompt; script, words, style bible, kit catalog via
 * `reelforge kit-docs`) writes `storyboard.json`; it is validated (schema, contiguous shots from 0,
 * boundaries on word starts, no treatment more than twice in a row, scene paths) with one repair
 * turn. Then stub scene modules are created for new shots and `missingProps` is collected.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { validateStoryboard, type StoryboardOutput } from '@reelforge/prompts';
import {
  STORYBOARD_REPORT_VERSION,
  storyboardReportSchema,
  wordsFileSchema,
  type WordsFile,
} from '@reelforge/shared';
import { readProjectText, requireProjectJson, writeProjectJson } from '../files.js';
import { FILES, REPORTS } from '../paths.js';
import {
  stageError,
  type StageContext,
  type StageDefinition,
  type StageError,
  type StageSummary,
} from '../types.js';
import { checkWithRepair, errorLines, render, warningLines, type OutputCheck } from './repair.js';
import { writeSceneStubs } from './scene-stub.js';

/** Economy mode (PLAN.md §2.2): shorter storyboards. */
export const ECONOMY_STORYBOARD_HINT =
  '\n\nEconomy mode: keep the storyboard lean — prefer fewer, longer shots (5–8 s) and simple treatments the kit already covers.';

async function checkStoryboard(
  ctx: StageContext,
  words: WordsFile,
): Promise<OutputCheck<StoryboardOutput>> {
  const text = await readProjectText(ctx.projectDir, FILES.storyboard);
  if (!text.ok) return { value: undefined, problems: [text.error.message], warnings: [] };
  if (text.value === undefined) {
    return { value: undefined, problems: [`${FILES.storyboard} was not written`], warnings: [] };
  }
  const report = validateStoryboard(text.value, { words });
  return {
    value: report.value,
    problems: errorLines(report.issues),
    warnings: warningLines(report.issues),
  };
}

function treatmentCounts(storyboard: StoryboardOutput): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const shot of storyboard.shots) counts[shot.treatment] = (counts[shot.treatment] ?? 0) + 1;
  return counts;
}

async function run(ctx: StageContext): Promise<Result<StageSummary, StageError>> {
  const { project } = ctx.snapshot;
  if (project.status !== 'ok') return err(stageError('not-ready', 'project.json is invalid'));
  const words = await requireProjectJson(ctx.projectDir, FILES.words, wordsFileSchema);
  if (!words.ok) return words;
  const prompt = render('storyboard', { styleId: project.value.style });
  if (!prompt.ok) return prompt;
  ctx.step('Writing the storyboard', 10);
  const turn = await ctx.claude({
    prompt: 'storyboard',
    text: ctx.settings.economy ? `${prompt.value}${ECONOMY_STORYBOARD_HINT}` : prompt.value,
    purpose: 'main',
    newSession: false,
    label: 'storyboard',
  });
  if (!turn.ok) return turn;
  ctx.step('Validating', 70);
  const checked = await checkWithRepair({
    ctx,
    prompt: 'storyboard',
    purpose: 'main',
    file: FILES.storyboard,
    label: 'storyboard',
    check: () => checkStoryboard(ctx, words.value),
  });
  if (!checked.ok) return checked;
  const { value: storyboard, problems, repairs } = checked.value;
  if (problems.length > 0 || storyboard === undefined) {
    return err(
      stageError(
        'validation',
        `storyboard.json is still invalid after a repair: ${problems.join('; ')}`,
        problems,
      ),
    );
  }
  ctx.step('Creating scene placeholders', 90);
  const stubs = await writeSceneStubs(ctx.projectDir, storyboard.shots);
  if (!stubs.ok) return stubs;
  const missingProps = [...new Set(storyboard.missingProps ?? [])];
  const treatments = treatmentCounts(storyboard);
  const warnings = [...checked.value.warnings];
  if (missingProps.length > 0) warnings.push(`missing props: ${missingProps.join(', ')}`);
  const report = await writeProjectJson(
    ctx.projectDir,
    REPORTS.storyboard,
    storyboardReportSchema,
    {
      version: STORYBOARD_REPORT_VERSION,
      shots: storyboard.shots.length,
      treatments,
      missingProps,
      stubs: stubs.value,
      repairs,
      warnings,
    },
  );
  if (!report.ok) return report;
  const last = storyboard.shots.at(-1);
  return ok({
    message: `${String(storyboard.shots.length)} shots, ${String(Object.keys(treatments).length)} treatments${missingProps.length > 0 ? `, ${String(missingProps.length)} missing props` : ''}`,
    outputs: [FILES.storyboard, ...stubs.value],
    changed: true,
    warnings,
    metrics: {
      shots: storyboard.shots.length,
      durationS: last?.t1 ?? 0,
      missingProps: missingProps.length,
      stubs: stubs.value.length,
      repairs,
      annotations: storyboard.shots.reduce((sum, shot) => sum + (shot.annotations?.length ?? 0), 0),
    },
  });
}

export const storyboardStage: StageDefinition<'storyboard'> = {
  id: 'storyboard',
  inputs: [FILES.script, FILES.words, 'project.json (style)', 'kit catalog (reelforge kit-docs)'],
  outputs: [FILES.storyboard, 'scenes/<shot>.js (stubs for new shots)', REPORTS.storyboard],
  run,
};
