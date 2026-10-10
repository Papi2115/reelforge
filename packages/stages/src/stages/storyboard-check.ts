/**
 * Validation of storyboard.json for the Storyboard stage (PLAN.md#7.3): the prompts package's
 * checks with the project's options (looks, world, research, tension, characters, interrupts, shot
 * range, genre, short, the Grim Ink direction plan); errors that are only the annotation count
 * rules are trimmed in code (annotation-trim.ts) instead of spending a repair turn on them.
 */
import {
  storyboardOutputSchema,
  validateStoryboard,
  type CharacterCheckOptions,
  type InterruptCheckOptions,
  type StoryboardOutput,
  type ValidationIssue,
} from '@reelforge/prompts';
import {
  projectContinuityLinks,
  projectShotsPerMinute,
  type DirectionFile,
  type TensionFile,
  type WordsFile,
} from '@reelforge/shared';
import { beatSyncCheckOptions } from '../beat-sync/storyboard-step.js';
import { readProjectText, writeProjectJson } from '../files.js';
import { storyboardGenreCheckOptions } from '../genre.js';
import { readLockedShots } from '../locks.js';
import { storyboardLookOptions } from '../looks.js';
import { FILES } from '../paths.js';
import { storyboardShortCheckOptions } from '../shorts/storyboard-step.js';
import type { StageContext } from '../types.js';
import { storyboardWorldOptions, type LookSetup } from '../worlds.js';
import {
  onlyAnnotationCountErrors,
  softenAnnotationCounts,
  trimAnnotations,
  trimWarning,
} from './annotation-trim.js';
import { errorLines, warningLines, type OutputCheck } from './repair.js';
import { currentAssetIds } from './storyboard-assets.js';

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
  direction?: DirectionFile,
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
    // A short's cut rules (PLAN.md#13.18); a film: nothing changes.
    ...(project.status === 'ok' ? storyboardShortCheckOptions(project.value) : {}),
    // A Grim Ink film's direction plan (PLAN.md#14.16); every other project: none.
    ...(direction === undefined ? {} : { direction }),
  });
  return fileCheck(report.value, report.issues);
}

/**
 * Validates storyboard.json; when the only errors are annotation count rules the weakest unlocked
 * marks are trimmed (written back, validated again) and what a lock keeps becomes a warning, so
 * neither a repair turn nor the stage is spent on them (annotation-trim.ts).
 */
export async function checkStoryboard(
  ctx: StageContext,
  words: WordsFile,
  setup: LookSetup,
  research: boolean,
  tension: TensionFile | undefined,
  characters: CharacterCheckOptions,
  interrupts?: InterruptCheckOptions,
  direction?: DirectionFile,
): Promise<OutputCheck<StoryboardOutput>> {
  const validate = (): Promise<FileCheck> =>
    validateFile(ctx, words, setup, research, tension, characters, interrupts, direction);
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
