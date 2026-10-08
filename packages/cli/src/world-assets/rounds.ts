/**
 * Self-QA rounds of a world-assets design session (real run Comic 2: the turn ignored "at most 2
 * rounds" and ran ~20 contact sheets). `reelforge world-assets sheet` counts its runs in
 * `.reelforge/world-assets-rounds.json` and warns after the allowed 2; the world-assets step
 * starts a fresh session before its turn and reads the count after it. Best effort: without a
 * session file (or with one older than a few hours) the command starts a session itself.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  MAX_WORLD_ASSET_SHEET_ROUNDS,
  WORLD_ASSET_SHEET_ROUNDS_FILE,
  worldAssetSheetRoundsSchema,
  type WorldAssetSheetRounds,
} from '@reelforge/shared';

/** A session older than this is not the current one (a later manual run starts over). */
export const SHEET_ROUNDS_SESSION_MS = 3 * 60 * 60 * 1000;

const roundsFile = (root: string): string =>
  path.join(root, ...WORLD_ASSET_SHEET_ROUNDS_FILE.split('/'));

async function writeRounds(root: string, value: WorldAssetSheetRounds): Promise<void> {
  const file = roundsFile(root);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${String(process.pid)}.tmp`;
  await writeFile(temporary, `${JSON.stringify(worldAssetSheetRoundsSchema.parse(value))}\n`);
  await rename(temporary, file);
}

/** The session's count, or undefined (no file, unreadable or invalid: a new session). */
export async function readSheetRounds(root: string): Promise<WorldAssetSheetRounds | undefined> {
  let text: string;
  try {
    text = await readFile(roundsFile(root), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
  try {
    const parsed = worldAssetSheetRoundsSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : undefined;
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

/** Starts a new design session (0 rounds). */
export function startSheetRounds(root: string, now: Date): Promise<void> {
  return writeRounds(root, { version: 1, startedAt: now.toISOString(), rounds: 0 });
}

/** Counts one `world-assets sheet` run; returns the round number of this run. */
export async function countSheetRound(root: string, now: Date): Promise<number> {
  const current = await readSheetRounds(root);
  const fresh =
    current !== undefined &&
    now.getTime() - Date.parse(current.startedAt) <= SHEET_ROUNDS_SESSION_MS;
  const rounds = (fresh ? current.rounds : 0) + 1;
  await writeRounds(root, {
    version: 1,
    startedAt: fresh ? current.startedAt : now.toISOString(),
    rounds,
  });
  return rounds;
}

/** The line `world-assets sheet` prints about its round (a warning after the allowed rounds). */
export function sheetRoundLine(round: number): string {
  const allowed = MAX_WORLD_ASSET_SHEET_ROUNDS;
  if (round <= allowed) return `self-QA round ${String(round)} of ${String(allowed)}`;
  return `warning: self-QA round ${String(round)}; the world-assets turn allows ${String(allowed)}: stop drawing sheets, keep what works and reply (the step's own QA checks every asset at film size)`;
}
