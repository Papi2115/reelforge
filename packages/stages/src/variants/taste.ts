/**
 * The local taste log (PLAN.md#11.3, foundation for #12.13): every decision about a shot's
 * variants — pick, keep the current scene, discard all — appended to `.reelforge/taste.json`
 * with the directions offered and their QA scores. Local only; nothing reads it yet.
 */
import { JsonFileStore, err, ok, type Result } from '@reelforge/claude-bridge';
import {
  TASTE_LOG_FILE,
  emptyTasteLog,
  tasteLogSchema,
  type ShotVariantSet,
  type StoryboardShot,
  type TasteDecision,
  type TasteEntry,
  type TasteLog,
  type TasteScore,
} from '@reelforge/shared';
import { inProject } from '../paths.js';
import { stageError, type StageError } from '../types.js';

const logs = new JsonFileStore<TasteLog>(tasteLogSchema, emptyTasteLog);

export async function readTasteLog(projectDir: string): Promise<Result<TasteLog, StageError>> {
  const read = await logs.read(inProject(projectDir, TASTE_LOG_FILE));
  return read.ok ? read : err(stageError('io', `${TASTE_LOG_FILE}: ${read.error.message}`));
}

export async function appendTasteEntry(
  projectDir: string,
  entry: TasteEntry,
): Promise<Result<TasteLog, StageError>> {
  const written = await logs.update(inProject(projectDir, TASTE_LOG_FILE), (current) => ({
    version: current.version,
    entries: [...current.entries, entry],
  }));
  return written.ok
    ? written
    : err(stageError('io', `${TASTE_LOG_FILE}: ${written.error.message}`));
}

function scoresOf(set: ShotVariantSet): TasteScore[] {
  return set.variants.map((variant) => ({
    direction: variant.direction.id,
    status:
      variant.status === 'ready' && variant.record !== undefined
        ? variant.record.status
        : 'dropped',
    findings: variant.record?.findings.length ?? 0,
  }));
}

/** The log entry of a decision about `set` (`chosen`: the picked variant's index). */
export function tasteEntry(
  set: ShotVariantSet,
  shot: StoryboardShot,
  decision: TasteDecision,
  at: Date,
  chosen?: number,
): TasteEntry {
  const picked = set.variants.find((variant) => variant.index === chosen);
  return {
    shotId: shot.id,
    treatment: shot.treatment,
    decision,
    offered: set.variants.map((variant) => variant.direction.id),
    chosen: picked?.direction.id ?? 'none',
    ...(set.note === undefined ? {} : { note: set.note }),
    scores: scoresOf(set),
    at: at.toISOString(),
  };
}

/** Variant decisions already made for a shot (rotates the directions of the next set). */
export async function decidedRounds(
  projectDir: string,
  shotId: string,
): Promise<Result<number, StageError>> {
  const log = await readTasteLog(projectDir);
  if (!log.ok) return log;
  return ok(log.value.entries.filter((entry) => entry.shotId === shotId).length);
}
