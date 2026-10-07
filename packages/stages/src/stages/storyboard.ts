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
 * characters and mascot (PLAN.md#12.20, characters.ts) add their prompt sections and checks.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  storyboardCharacterVars,
  storyboardOutputSchema,
  storyboardShotRangeVars,
  validateStoryboard,
  type CharacterCheckOptions,
  type InterruptCheckOptions,
  type StoryboardOutput,
  type ValidationIssue,
} from '@reelforge/prompts';
import {
  assignTransitionStyles,
  DEFAULT_MAX_ASSET_NEEDS,
  projectContinuityLinks,
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
  type TensionFile,
  type WordsFile,
} from '@reelforge/shared';
import { loadCharacterSettings, storyboardCharacterOptions } from '../characters.js';
import { applyStoryboardContinuity, storyboardContinuityVars } from '../continuity.js';
import { finishStoryboardDramaturgy, prepareStoryboardDramaturgy } from '../dramaturgy.js';
import { storyboardGenreCheckOptions, storyboardGenrePromptVars } from '../genre.js';
import { readProjectText, requireProjectJson, writeProjectJson } from '../files.js';
import { storyboardLookOptions, storyboardLookVars } from '../looks.js';
import {
  assignWorldTransitions,
  lookSetup,
  storyboardWorldOptions,
  storyboardWorldPromptVars,
  worldScope,
  worldTransitionOptions,
  type LookSetup,
} from '../worlds.js';
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
import {
  onlyAnnotationCountErrors,
  softenAnnotationCounts,
  trimAnnotations,
  trimWarning,
} from './annotation-trim.js';
import { readLockedShots } from '../locks.js';
import { beatSyncCheckOptions, storyboardBeatSync } from '../beat-sync/storyboard-step.js';
import { currentAssetIds, storyboardAssetVars } from './storyboard-assets.js';
import { storyboardSourceChipVars } from '../claims/source-chips.js';

/** Economy mode (PLAN.md §2.2): shorter storyboards. */
export const ECONOMY_STORYBOARD_HINT =
  '\n\nEconomy mode: keep the storyboard lean — prefer fewer, longer shots (5–8 s) and simple treatments the kit already covers.';

type FileCheck = OutputCheck<StoryboardOutput> & { readonly issues: readonly ValidationIssue[] };

function fileCheck(
  value: StoryboardOutput | undefined,
  issues: readonly ValidationIssue[],
  notes: readonly string[] = [],
): FileCheck {
  return {
    value,
    issues,
    problems: errorLines(issues),
    warnings: [...notes, ...warningLines(issues)],
  };
}

async function validateFile(
  ctx: StageContext,
  words: WordsFile,
  setup: LookSetup,
  research: boolean,
  tension: TensionFile | undefined,
  characters: CharacterCheckOptions,
  interrupts?: InterruptCheckOptions,
): Promise<FileCheck> {
  const { project } = ctx.snapshot;
  // Scenes per minute (ADR-027): absent = the checks as before.
  const range = project.status === 'ok' ? projectShotsPerMinute(project.value) : undefined;
  const text = await readProjectText(ctx.projectDir, FILES.storyboard);
  if (!text.ok)
    return { value: undefined, issues: [], problems: [text.error.message], warnings: [] };
  if (text.value === undefined) {
    const problems = [`${FILES.storyboard} was not written`];
    return { value: undefined, issues: [], problems, warnings: [] };
  }
  const report = validateStoryboard(text.value, {
    words,
    ...storyboardLookOptions(setup.lookMode, setup.looks),
    // A world names only its page-native transitions (PLAN.md#13.6); built-in styles: nothing.
    ...storyboardWorldOptions(
      setup,
      ctx.settings.worldQuotaOverride,
      project.status === 'ok' && projectContinuityLinks(project.value),
    ),
    assetNeeds: { research },
    ...withAssetIds(await currentAssetIds(ctx.projectDir)),
    ...(tension === undefined ? {} : { tension }),
    ...beatSyncCheckOptions(ctx.snapshot.project),
    ...(interrupts === undefined ? {} : { interrupts }),
    characters,
    ...(range === undefined ? {} : { shotsPerMinute: range }),
    // The genre preset's wow pace (ADR-035); no preset = the checks as before.
    ...(project.status === 'ok' ? storyboardGenreCheckOptions(project.value) : {}),
  });
  return fileCheck(report.value, report.issues);
}

/**
 * Validates storyboard.json; when the only errors are annotation count rules the weakest unlocked
 * marks are trimmed (written back, validated again) and what a lock keeps becomes a warning, so
 * neither a repair turn nor the stage is spent on them (annotation-trim.ts).
 */
async function checkStoryboard(
  ctx: StageContext,
  words: WordsFile,
  setup: LookSetup,
  research: boolean,
  tension: TensionFile | undefined,
  characters: CharacterCheckOptions,
  interrupts?: InterruptCheckOptions,
): Promise<OutputCheck<StoryboardOutput>> {
  const validate = (): Promise<FileCheck> =>
    validateFile(ctx, words, setup, research, tension, characters, interrupts);
  const first = await validate();
  if (first.value === undefined || !onlyAnnotationCountErrors(first.issues)) return first;
  const locked = await readLockedShots(ctx.projectDir);
  if (!locked.ok) return first;
  const trimmed = trimAnnotations(first.value, words, locked.value);
  if (trimmed.removed.length === 0) {
    return fileCheck(first.value, softenAnnotationCounts(first.issues));
  }
  const written = await writeProjectJson(
    ctx.projectDir,
    FILES.storyboard,
    storyboardOutputSchema,
    trimmed.storyboard,
  );
  if (!written.ok) return { value: undefined, problems: [written.error.message], warnings: [] };
  const second = await validate();
  return fileCheck(second.value, softenAnnotationCounts(second.issues), [
    trimWarning(trimmed.removed),
  ]);
}

function withAssetIds(ids: string[] | undefined): { assetIds?: string[] } {
  return ids === undefined ? {} : { assetIds: ids };
}

/**
 * `mixed` projects: fills the transition-kit styles the storyboard left out (ADR-011); a world's
 * project gets the world's page-native styles instead (PLAN.md#13.6).
 */
async function assignStyles(
  ctx: StageContext,
  storyboard: StoryboardOutput,
  seed: number,
  setup: LookSetup,
): Promise<Result<StoryboardOutput, StageError>> {
  const assigned =
    setup.world === undefined
      ? assignTransitionStyles(storyboard.shots, seed)
      : assignWorldTransitions(storyboard.shots, worldTransitionOptions(setup.world), seed);
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
      ),
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
  const durationS = last?.t1 ?? 0;
  const summary = `${String(storyboard.shots.length)} shots, ${String(Object.keys(treatments).length)} treatments${missingProps.length > 0 ? `, ${String(missingProps.length)} missing props` : ''}`;
  return ok({
    // With a range (ADR-027) the line the user checks the effect by comes first.
    message:
      range === undefined
        ? summary
        : `${shotsSummary(storyboard.shots.length, durationS, range)} · ${summary}`,
    outputs: [FILES.storyboard, ...synced.value.outputs, ...stubs.value],
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
