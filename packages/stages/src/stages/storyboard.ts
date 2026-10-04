/**
 * Storyboard (PLAN.md#7.3): Claude (storyboard prompt; script, words, style bible, kit catalog via
 * `reelforge kit-docs`) writes `storyboard.json`; it is validated (schema, contiguous shots from 0,
 * boundaries on word starts, no treatment more than twice in a row, scene paths; in `mixed` look
 * mode rolls, looks and their rhythm, ADR-009) with one repair turn. In `mixed` mode non-cut
 * transitions without a transition-kit style get one picked for their look pair (PLAN.md#12.15,
 * written back to storyboard.json). Then stub scene modules are created for new shots and
 * `missingProps` is collected. With the tension map on (PLAN.md#12.22) the curve is read (or
 * proposed by Claude first, tension.ts), handed to the prompt as a table and checked against the
 * cut tempo (`tension-tempo`); the `tension` action only proposes the curve.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  storyboardOutputSchema,
  validateStoryboard,
  type InterruptCheckOptions,
  type StoryboardOutput,
} from '@reelforge/prompts';
import {
  assignTransitionStyles,
  DEFAULT_MAX_ASSET_NEEDS,
  projectLookMode,
  projectResearchMode,
  projectTensionMap,
  storyboardAssetIds,
  storyboardAssetNeeds,
  STORYBOARD_REPORT_VERSION,
  storyboardReportSchema,
  wordsFileSchema,
  type LookMode,
  type TensionFile,
  type WordsFile,
} from '@reelforge/shared';
import { finishStoryboardDramaturgy, prepareStoryboardDramaturgy } from '../dramaturgy.js';
import { readProjectText, requireProjectJson, writeProjectJson } from '../files.js';
import { storyboardLookOptions, storyboardLookVars } from '../looks.js';
import { runTensionProposal, storyboardTension, storyboardTensionVars } from '../tension.js';
import { FILES, REPORTS } from '../paths.js';
import {
  stageError,
  type RequestOf,
  type StageContext,
  type StageDefinition,
  type StageError,
  type StageSummary,
} from '../types.js';
import { checkWithRepair, errorLines, render, warningLines, type OutputCheck } from './repair.js';
import { writeSceneStubs } from './scene-stub.js';
import { beatSyncCheckOptions, storyboardBeatSync } from '../beat-sync/storyboard-step.js';
import { currentAssetIds, storyboardAssetVars } from './storyboard-assets.js';
import { storyboardSourceChipVars } from '../claims/source-chips.js';

/** Economy mode (PLAN.md §2.2): shorter storyboards. */
export const ECONOMY_STORYBOARD_HINT =
  '\n\nEconomy mode: keep the storyboard lean — prefer fewer, longer shots (5–8 s) and simple treatments the kit already covers.';

async function checkStoryboard(
  ctx: StageContext,
  words: WordsFile,
  lookMode: LookMode,
  research: boolean,
  tension: TensionFile | undefined,
  interrupts?: InterruptCheckOptions,
): Promise<OutputCheck<StoryboardOutput>> {
  const text = await readProjectText(ctx.projectDir, FILES.storyboard);
  if (!text.ok) return { value: undefined, problems: [text.error.message], warnings: [] };
  if (text.value === undefined) {
    return { value: undefined, problems: [`${FILES.storyboard} was not written`], warnings: [] };
  }
  const report = validateStoryboard(text.value, {
    words,
    ...storyboardLookOptions(lookMode),
    assetNeeds: { research },
    ...withAssetIds(await currentAssetIds(ctx.projectDir)),
    ...(tension === undefined ? {} : { tension }),
    ...beatSyncCheckOptions(ctx.snapshot.project),
    ...(interrupts === undefined ? {} : { interrupts }),
  });
  return {
    value: report.value,
    problems: errorLines(report.issues),
    warnings: warningLines(report.issues),
  };
}

function withAssetIds(ids: string[] | undefined): { assetIds?: string[] } {
  return ids === undefined ? {} : { assetIds: ids };
}

/** `mixed` projects: fills the transition-kit styles the storyboard left out (ADR-011). */
async function assignStyles(
  ctx: StageContext,
  storyboard: StoryboardOutput,
  seed: number,
): Promise<Result<StoryboardOutput, StageError>> {
  const assigned = assignTransitionStyles(storyboard.shots, seed);
  if (assigned.changed.length === 0) return ok(storyboard);
  return writeProjectJson(ctx.projectDir, FILES.storyboard, storyboardOutputSchema, {
    ...storyboard,
    shots: assigned.shots,
  });
}

function treatmentCounts(storyboard: StoryboardOutput): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const shot of storyboard.shots) counts[shot.treatment] = (counts[shot.treatment] ?? 0) + 1;
  return counts;
}

async function run(
  ctx: StageContext,
  request: RequestOf<'storyboard'>,
): Promise<Result<StageSummary, StageError>> {
  if (request.action === 'tension') return runTensionProposal(ctx);
  const { project } = ctx.snapshot;
  if (project.status !== 'ok') return err(stageError('not-ready', 'project.json is invalid'));
  const words = await requireProjectJson(ctx.projectDir, FILES.words, wordsFileSchema);
  if (!words.ok) return words;
  const tension =
    projectTensionMap(project.value) === 'auto'
      ? await storyboardTension(ctx, words.value)
      : ok({ file: undefined, warnings: [], repairs: 0 });
  if (!tension.ok) return tension;
  const curve = tension.value.file;
  const lookMode = projectLookMode(project.value);
  const research = projectResearchMode(project.value) !== 'off';
  // Pattern interrupts and open loops (PLAN.md#12.25-12.26); both off = nothing changes.
  const drama = await prepareStoryboardDramaturgy(
    ctx.projectDir,
    project.value,
    words.value,
    curve,
  );
  if (!drama.ok) return drama;
  const prompt = render('storyboard', {
    styleId: project.value.style,
    ...storyboardLookVars(lookMode),
    ...storyboardTensionVars(curve, words.value),
    ...(research ? { assetResearch: true, maxAssetNeeds: DEFAULT_MAX_ASSET_NEEDS } : {}),
    ...(await storyboardAssetVars(ctx, research)),
    ...(await storyboardSourceChipVars(ctx.projectDir)),
    ...drama.value.vars,
    // The user's taste profile (PLAN.md#12.13); absent = the prompt is exactly as without it.
    tasteProfile: ctx.taste?.profile(),
  });
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
    check: () =>
      checkStoryboard(ctx, words.value, lookMode, research, curve, drama.value.interrupts),
  });
  if (!checked.ok) return checked;
  const { value: validated, problems, repairs } = checked.value;
  if (problems.length > 0 || validated === undefined) {
    return err(
      stageError(
        'validation',
        `storyboard.json is still invalid after a repair: ${problems.join('; ')}`,
        problems,
      ),
    );
  }
  const styled =
    lookMode === 'mixed' ? await assignStyles(ctx, validated, project.value.seed) : ok(validated);
  if (!styled.ok) return styled;
  // Beat sync (PLAN.md#12.21): snaps unlocked cuts to the beat grid, validated again; off = no-op.
  const synced = await storyboardBeatSync(
    ctx,
    project.value,
    styled.value,
    words.value,
    curve,
    () => checkStoryboard(ctx, words.value, lookMode, research, curve, drama.value.interrupts),
  );
  if (!synced.ok) return synced;
  const storyboard = synced.value.storyboard;
  ctx.step('Creating scene placeholders', 90);
  const stubs = await writeSceneStubs(ctx.projectDir, storyboard.shots);
  if (!stubs.ok) return stubs;
  const dramaturgy = await finishStoryboardDramaturgy(
    ctx.projectDir,
    ctx.now(),
    project.value,
    storyboard.shots,
    words.value,
  );
  if (!dramaturgy.ok) return dramaturgy;
  const missingProps = [...new Set(storyboard.missingProps ?? [])];
  const treatments = treatmentCounts(storyboard);
  const warnings = [
    ...tension.value.warnings,
    ...checked.value.warnings,
    ...synced.value.warnings,
    ...dramaturgy.value,
  ];
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
    outputs: [FILES.storyboard, ...synced.value.outputs, ...stubs.value],
    changed: true,
    warnings,
    metrics: {
      shots: storyboard.shots.length,
      durationS: last?.t1 ?? 0,
      missingProps: missingProps.length,
      stubs: stubs.value.length,
      repairs,
      annotations: storyboard.shots.reduce((sum, shot) => sum + (shot.annotations?.length ?? 0), 0),
      assetNeeds: storyboardAssetNeeds(storyboard.shots).length,
      assignedAssets: storyboardAssetIds(storyboard.shots).length,
    },
  });
}

export const storyboardStage: StageDefinition<'storyboard'> = {
  id: 'storyboard',
  inputs: [FILES.script, FILES.words, 'project.json (style)', 'kit catalog (reelforge kit-docs)'],
  outputs: [FILES.storyboard, 'scenes/<shot>.js (stubs for new shots)', REPORTS.storyboard],
  run,
};
