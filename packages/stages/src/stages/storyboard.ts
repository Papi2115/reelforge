/**
 * Storyboard (PLAN.md#7.3): Claude (storyboard prompt; script, words, style bible, kit catalog via
 * `reelforge kit-docs`) writes `storyboard.json`; it is validated (schema, contiguous shots from 0,
 * boundaries on word starts, no treatment more than twice in a row, scene paths; in `mixed` look
 * mode rolls, looks and their rhythm, ADR-009) with one repair turn; errors that are only the
 * annotation count rules are trimmed in code instead (annotation-trim.ts). In `mixed` mode non-cut
 * transitions without a transition-kit style get one picked for their look pair (PLAN.md#12.15,
 * written back to storyboard.json). Then stub scene modules are created for new shots and
 * `missingProps` is collected. With the tension map on (PLAN.md#12.22) the curve is read (or
 * proposed by Claude first, tension.ts), handed to the prompt as a table and checked against the
 * cut tempo (`tension-tempo`); the `tension` action only proposes the curve. The project's
 * characters and mascot (PLAN.md#12.20, characters.ts) add their prompt sections and checks. A
 * Grim Ink film plans its direction first (`direction.json`, c-cam/direction*.ts, PLAN.md#14.16;
 * the `direction` action plans it again); the storyboard is checked against it. Checks:
 * storyboard-check.ts.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { storyboardCharacterVars, storyboardShotRangeVars } from '@reelforge/prompts';
import {
  DEFAULT_MAX_ASSET_NEEDS,
  projectResearchMode,
  projectShotsPerMinute,
  projectTensionMap,
  shotRangeRules,
  shotsSummary,
  storyboardAssetIds,
  storyboardAssetNeeds,
  STORYBOARD_REPORT_VERSION,
  storyboardReportSchema,
  wordsFileSchema,
} from '@reelforge/shared';
import { loadCharacterSettings, storyboardCharacterOptions } from '../characters.js';
import { applyStoryboardContinuity, storyboardContinuityVars } from '../continuity.js';
import { finishStoryboardDramaturgy, prepareStoryboardDramaturgy } from '../dramaturgy.js';
import { storyboardGenrePromptVars } from '../genre.js';
import { requireProjectJson, writeProjectJson } from '../files.js';
import { storyboardLookVars } from '../looks.js';
import {
  lookSetup,
  storyboardWorldPromptVars,
  worldScope,
  worldTransitionOptions,
} from '../worlds.js';
import { runDirectionAction, storyboardDirection } from '../c-cam/direction-stage.js';
import { assignStyles, treatmentCounts } from './storyboard-styles.js';
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
import { checkWithRepair, render } from './repair.js';
import { writeSceneStubs } from './scene-stub.js';
import { storyboardBeatSync } from '../beat-sync/storyboard-step.js';
import { storyboardAssetVars } from './storyboard-assets.js';
import { checkStoryboard } from './storyboard-check.js';
import { storyboardSourceChipVars } from '../claims/source-chips.js';
import { appendShortEndCard, storyboardShortPromptVars } from '../shorts/storyboard-step.js';

/** Economy mode (PLAN.md §2.2): shorter storyboards. */
export const ECONOMY_STORYBOARD_HINT =
  '\n\nEconomy mode: keep the storyboard lean — prefer fewer, longer shots (5–8 s) and simple treatments the kit already covers.';

async function run(
  ctx: StageContext,
  request: RequestOf<'storyboard'>,
): Promise<Result<StageSummary, StageError>> {
  if (request.action === 'tension') return runTensionProposal(ctx);
  if (request.action === 'direction') return runDirectionAction(ctx);
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
  // A Grim Ink film plans its direction first (PLAN.md#14.16); every other project: none.
  const direction = await storyboardDirection(ctx, project.value, words.value);
  if (!direction.ok) return direction;
  const plan = direction.value.file;
  // Look mode, looks and world (PLAN.md#13.6): a world's project always mixes its own looks.
  const setup = lookSetup(project.value, worldScope(ctx.settings));
  const lookMode = setup.lookMode;
  const research = projectResearchMode(project.value) !== 'off';
  // Pattern interrupts and open loops (PLAN.md#12.25-12.26); both off = nothing changes.
  const drama = await prepareStoryboardDramaturgy(
    ctx.projectDir,
    project.value,
    words.value,
    curve,
  );
  if (!drama.ok) return drama;
  // Characters and mascot (PLAN.md#12.20); classic without a mascot = nothing changes.
  const characters = await loadCharacterSettings(ctx.projectDir, project.value);
  const characterChecks = storyboardCharacterOptions(characters);
  // Scenes per minute (ADR-027); no range = nothing changes.
  const range = projectShotsPerMinute(project.value);
  const narrationEnd = words.value.words.at(-1)?.tEnd ?? 0;
  const lookVars = storyboardLookVars(
    lookMode,
    setup.looks,
    narrationEnd + 0.5,
    setup.world !== undefined,
  );
  const prompt = render('storyboard', {
    styleId: project.value.style,
    ...lookVars,
    // Genre preset (ADR-035): favoured looks, wow pace; no preset = nothing changes.
    ...storyboardGenrePromptVars(project.value, lookVars, setup.looks, narrationEnd + 0.5),
    ...storyboardWorldPromptVars(setup, narrationEnd + 0.5, ctx.settings.worldQuotaOverride),
    ...storyboardTensionVars(
      curve,
      words.value,
      range === undefined ? undefined : shotRangeRules(range).tempo,
    ),
    ...(research ? { assetResearch: true, maxAssetNeeds: DEFAULT_MAX_ASSET_NEEDS } : {}),
    ...(await storyboardAssetVars(ctx, research)),
    ...(await storyboardSourceChipVars(ctx.projectDir)),
    ...drama.value.vars,
    ...storyboardCharacterVars(characters),
    ...storyboardShotRangeVars(range, narrationEnd),
    // Continuity links (PLAN.md#13.2); switch off = nothing changes.
    ...storyboardContinuityVars(project.value, narrationEnd),
    // The user's taste profile (PLAN.md#12.13); absent = the prompt is exactly as without it.
    tasteProfile: ctx.taste?.profile(),
    // A short (PLAN.md#13.18): retention editing, vertical framing; a film: nothing changes.
    ...storyboardShortPromptVars(project.value),
    ...direction.value.vars,
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
      checkStoryboard(
        ctx,
        words.value,
        setup,
        research,
        curve,
        characterChecks,
        drama.value.interrupts,
        plan,
      ),
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
  // Linked shots get their continuity transition (PLAN.md#13.2, #13.5); no links = no-op.
  const linked = await applyStoryboardContinuity(
    ctx,
    validated,
    worldTransitionOptions(setup.world),
  );
  if (!linked.ok) return linked;
  const styled =
    lookMode === 'mixed'
      ? await assignStyles(ctx, linked.value, project.value.seed, setup)
      : ok(linked.value);
  if (!styled.ok) return styled;
  // Beat sync (PLAN.md#12.21): snaps unlocked cuts to the beat grid, validated again; off = no-op.
  const synced = await storyboardBeatSync(
    ctx,
    project.value,
    styled.value,
    words.value,
    curve,
    () =>
      checkStoryboard(
        ctx,
        words.value,
        setup,
        research,
        curve,
        characterChecks,
        drama.value.interrupts,
        plan,
      ),
  );
  if (!synced.ok) return synced;
  // A short's fixed end card goes after the narration shots (PLAN.md#13.18); a film: no-op.
  const finished = await appendShortEndCard(ctx, project.value, synced.value.storyboard);
  if (!finished.ok) return finished;
  const storyboard = finished.value;
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
    ...direction.value.warnings,
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
  const durationS = last?.t1 ?? 0;
  const summary = `${String(storyboard.shots.length)} shots, ${String(Object.keys(treatments).length)} treatments${missingProps.length > 0 ? `, ${String(missingProps.length)} missing props` : ''}`;
  return ok({
    // With a range (ADR-027) the line the user checks the effect by comes first.
    message:
      range === undefined
        ? summary
        : `${shotsSummary(storyboard.shots.length, durationS, range)} · ${summary}`,
    outputs: [
      FILES.storyboard,
      ...direction.value.outputs,
      ...synced.value.outputs,
      ...stubs.value,
    ],
    changed: true,
    warnings,
    metrics: {
      shots: storyboard.shots.length,
      durationS,
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
