/**
 * The autocommit after a chat turn (CLAUDE.md §3.4). A turn may change any project file (Edit,
 * Write, `reelforge` commands), so it commits every change — except the scene files a scene build
 * running in parallel is writing right now: a half-built scene must not land in the turn's commit
 * (reverting the turn would then undo the wrong work). Those stay uncommitted for the shot's own
 * commit.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  autocommit,
  err,
  ok,
  runGit,
  type CommitResult,
  type GitOptions,
  type Result,
} from '@reelforge/project';
import { storyboardFileSchema } from '@reelforge/shared';

const STORYBOARD = 'storyboard.json';
const SCENES_DIR = 'scenes';

/** Windows file systems (and git there) do not distinguish case. */
function comparable(relative: string): string {
  const slashes = relative.replace(/\\/g, '/');
  return process.platform === 'win32' ? slashes.toLowerCase() : slashes;
}

/** Project-relative scene files of `shotIds` (from storyboard.json; `scenes/<id>.js` fallback). */
export async function sceneFilesOf(dir: string, shotIds: readonly string[]): Promise<string[]> {
  if (shotIds.length === 0) return [];
  let scenes = new Map<string, string>();
  try {
    const raw: unknown = JSON.parse(await readFile(path.join(dir, STORYBOARD), 'utf8'));
    const parsed = storyboardFileSchema.safeParse(raw);
    if (parsed.success) scenes = new Map(parsed.data.shots.map((shot) => [shot.id, shot.scene]));
  } catch {
    // No readable storyboard: a scene build uses the conventional paths then.
  }
  return shotIds.map((id) => scenes.get(id) ?? `${SCENES_DIR}/${id}.js`);
}

/** Project-relative paths git reports as changed (tracked or untracked, not ignored). */
export async function changedFiles(dir: string, git: GitOptions = {}): Promise<Result<string[]>> {
  const status = await runGit(
    dir,
    ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames'],
    git,
  );
  if (!status.ok) return status;
  if (status.value.code !== 0) {
    const reason = status.value.stderr.trim().split('\n')[0] ?? '';
    return err({ kind: 'git-failed', message: `git status failed: ${reason}` });
  }
  // Entries are `XY <path>`, NUL-terminated (no renames: one path each).
  return ok(
    status.value.stdout
      .split('\0')
      .filter((entry) => entry.length > 3)
      .map((entry) => entry.slice(3)),
  );
}

export interface ChatTurnCommitOptions {
  /** Shots a running scene build is writing in `dir` now. */
  readonly shotsInProgress: readonly string[];
  readonly git?: GitOptions;
}

/** Commits the turn's changes (kind `claude-turn`), leaving scenes still being built out. */
export async function commitChatTurn(
  dir: string,
  message: string,
  options: ChatTurnCommitOptions,
): Promise<Result<CommitResult>> {
  const git = options.git === undefined ? {} : { git: options.git };
  const building = await sceneFilesOf(dir, options.shotsInProgress);
  if (building.length === 0) return autocommit(dir, message, { kind: 'claude-turn', ...git });
  const changed = await changedFiles(dir, options.git);
  if (!changed.ok) return changed;
  const excluded = new Set(building.map(comparable));
  const paths = changed.value.filter((file) => !excluded.has(comparable(file)));
  return autocommit(dir, message, { kind: 'claude-turn', paths, ...git });
}
