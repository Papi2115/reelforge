/**
 * Hook sets on disk (PLAN.md#12.16): `.reelforge/hooks/<n>.json`, one per "Hook lab" run, kept as
 * the history (app state, never committed), plus what a pick would affect: the locked shots that
 * cover the opening and whether a voice-over was already recorded.
 */
import { readdir } from 'node:fs/promises';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  HOOK_LAB_DIR,
  countSpokenWords,
  hookSetFile,
  hookSetSchema,
  spokenSeconds,
  storyboardFileSchema,
  wordsFileSchema,
  type HookSet,
} from '@reelforge/shared';
import { requireProjectJson, writeProjectJson } from '../files.js';
import { readLockedShots } from '../locks.js';
import { FILES, inProject } from '../paths.js';
import { stageError, type StageError } from '../types.js';

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Numbers of the stored sets, ascending. */
export async function hookSetNumbers(projectDir: string): Promise<Result<number[], StageError>> {
  try {
    const names = await readdir(inProject(projectDir, HOOK_LAB_DIR));
    return ok(
      names
        .map((name) => /^([1-9][0-9]{0,5})\.json$/.exec(name)?.[1])
        .filter((match): match is string => match !== undefined)
        .map(Number)
        .sort((first, second) => first - second),
    );
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return ok([]);
    return err(stageError('io', `cannot list ${HOOK_LAB_DIR}: ${describe(error)}`));
  }
}

export function readHookSet(
  projectDir: string,
  number: number,
): Promise<Result<HookSet, StageError>> {
  return requireProjectJson(projectDir, hookSetFile(number), hookSetSchema);
}

export function writeHookSet(
  projectDir: string,
  set: HookSet,
): Promise<Result<HookSet, StageError>> {
  return writeProjectJson(projectDir, hookSetFile(set.number), hookSetSchema, set);
}

/** The newest set, undefined when the lab never ran here. */
export async function latestHookSet(
  projectDir: string,
): Promise<Result<HookSet | undefined, StageError>> {
  const numbers = await hookSetNumbers(projectDir);
  if (!numbers.ok) return numbers;
  const last = numbers.value.at(-1);
  return last === undefined ? ok(undefined) : readHookSet(projectDir, last);
}

/**
 * Where the opening ends in the film (seconds): the end of its last word in timing/words.json
 * when the words are timed, else the estimate at 150 words per minute.
 */
async function openingEndS(projectDir: string, opening: string): Promise<number> {
  const words = countSpokenWords(opening);
  const timed = await requireProjectJson(projectDir, FILES.words, wordsFileSchema);
  const last = timed.ok ? timed.value.words[words - 1] : undefined;
  return last?.tEnd ?? spokenSeconds(words);
}

/** Locked shots that start inside the opening (they keep their scenes; a pick never rebuilds). */
export async function lockedShotsInOpening(
  projectDir: string,
  opening: string,
): Promise<Result<string[], StageError>> {
  const locked = await readLockedShots(projectDir);
  if (!locked.ok) return locked;
  if (locked.value.size === 0) return ok([]);
  const storyboard = await requireProjectJson(projectDir, FILES.storyboard, storyboardFileSchema);
  if (!storyboard.ok) return ok([]);
  const end = await openingEndS(projectDir, opening);
  return ok(
    storyboard.value.shots
      .filter((shot) => locked.value.has(shot.id) && shot.t0 < end)
      .map((shot) => shot.id),
  );
}
