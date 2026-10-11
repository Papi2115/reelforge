/**
 * The world-assets turn may write only `assets/<world>/*.json` and `assets/cast.json`
 * (PLAN.md#13.15 phase 2). The turn runs with the scene builder's permissions (project edits),
 * so the rule is enforced in code (write-guard.ts): the bytes of every other project file are
 * taken before the turn, and afterwards a changed or deleted one is put back and a new one is
 * removed ("the world-assets turn changed scenes/s01.js; change discarded").
 */
import type { Result } from '@reelforge/claude-bridge';
import { WORLD_CAST_FILE, worldAssetsDir, type WorldAssetWorld } from '@reelforge/shared';
import type { StageError } from '../types.js';
import { restoreTurnWrites, snapshotTurnWrites, type TurnWriteSnapshot } from '../write-guard.js';

export type WriteSnapshot = TurnWriteSnapshot;

/** True for the files the turn may write. */
export function writableByWorldAssets(file: string, world: WorldAssetWorld): boolean {
  return file === WORLD_CAST_FILE || file.startsWith(`${worldAssetsDir(world)}/`);
}

/** The bytes of every watched file the turn must not write. */
export function snapshotProject(
  projectDir: string,
  world: WorldAssetWorld,
): Promise<Result<WriteSnapshot, StageError>> {
  return snapshotTurnWrites(projectDir, 'the world-assets turn', (file) =>
    writableByWorldAssets(file, world),
  );
}

/** Puts back what the turn changed outside its files; returns the discarded paths. */
export function discardOutsideWrites(
  snapshot: WriteSnapshot,
): Promise<Result<string[], StageError>> {
  return restoreTurnWrites(snapshot);
}
