/** Reading the project history: commit list with ReelForge trailers and per-commit file changes. */
import {
  KIND_TRAILER,
  parseKind,
  REVERT_TRAILER,
  STEP_TRAILER,
  type HistoryKind,
} from './commit-message.js';
import { gitChecked, runGit, type GitOptions } from './git-runner.js';
import { withLock } from './mutex.js';
import { err, ok, projectError, type Result } from './result.js';

export type FileChangeStatus = 'added' | 'modified' | 'deleted' | 'type-changed' | 'other';

export interface FileChange {
  readonly status: FileChangeStatus;
  /** Project-relative, forward slashes. */
  readonly path: string;
}

export interface ChangeCounts {
  readonly added: number;
  readonly modified: number;
  readonly deleted: number;
}

export interface HistoryEntry {
  readonly hash: string;
  readonly shortHash: string;
  /** Commit time, ISO 8601 (UTC). */
  readonly time: string;
  readonly subject: string;
  readonly kind: HistoryKind;
  /** `ReelForge-Step` trailer; null for commits made outside ReelForge. */
  readonly step: string | null;
  /** Commit whose content a revert restored. */
  readonly revertOf: string | null;
  readonly files: readonly FileChange[];
  readonly counts: ChangeCounts;
}

export interface DiffFile extends FileChange {
  /** Null for binary files. */
  readonly additions: number | null;
  readonly deletions: number | null;
}

export interface DiffSummary {
  readonly hash: string;
  readonly files: readonly DiffFile[];
  readonly additions: number;
  readonly deletions: number;
}

const RECORD = '\x1e';
const FIELD = '\x1f';
const trailer = (key: string): string => `%(trailers:key=${key},valueonly,separator=%x2c)`;
export const LOG_FORMAT = `${RECORD}${['%H', '%ct', '%s', trailer(STEP_TRAILER), trailer(KIND_TRAILER), trailer(REVERT_TRAILER)].join('%x1f')}`;

export const DEFAULT_HISTORY_LIMIT = 50;
const MAX_HISTORY_LIMIT = 1000;

function changeStatus(letter: string): FileChangeStatus {
  switch (letter.charAt(0)) {
    case 'A':
      return 'added';
    case 'M':
      return 'modified';
    case 'D':
      return 'deleted';
    case 'T':
      return 'type-changed';
    default:
      return 'other';
  }
}

/** `M\0path\0A\0path\0...` (`--name-status -z --no-renames`). */
function parseNameStatus(raw: string): FileChange[] {
  const parts = raw.split('\0');
  const changes: FileChange[] = [];
  for (let index = 0; index + 1 < parts.length; index += 2) {
    const letter = parts[index]?.trim() ?? '';
    const file = parts[index + 1] ?? '';
    if (letter !== '' && file !== '') changes.push({ status: changeStatus(letter), path: file });
  }
  return changes;
}

export function countChanges(files: readonly FileChange[]): ChangeCounts {
  const count = (status: FileChangeStatus): number =>
    files.filter((file) => file.status === status).length;
  return {
    added: count('added'),
    modified: count('modified') + count('type-changed') + count('other'),
    deleted: count('deleted'),
  };
}

const orNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
};

/** Parses `git log -z --no-renames --name-status --format=LOG_FORMAT`. */
export function parseLog(raw: string): HistoryEntry[] {
  return raw
    .split(RECORD)
    .filter((record) => record.trim() !== '')
    .map((record) => {
      const headerEnd = record.indexOf('\0');
      const header = headerEnd < 0 ? record : record.slice(0, headerEnd);
      const rest = headerEnd < 0 ? '' : record.slice(headerEnd + 1).replace(/^\n/, '');
      const [hash = '', time = '0', subject = '', step, kind, revertOf] = header.split(FIELD);
      const files = parseNameStatus(rest);
      const stepValue = orNull(step);
      return {
        hash,
        shortHash: hash.slice(0, 7),
        time: new Date(Number(time) * 1000).toISOString(),
        subject,
        kind: parseKind(orNull(kind) ?? '') ?? 'external',
        step: stepValue,
        revertOf: orNull(revertOf),
        files,
        counts: countChanges(files),
      };
    });
}

/** Newest first. An empty repository (no commit yet) has an empty history. */
export function history(
  dir: string,
  options: { readonly limit?: number; readonly git?: GitOptions } = {},
): Promise<Result<HistoryEntry[]>> {
  const git = options.git ?? {};
  const limit = Math.min(
    Math.max(1, Math.floor(options.limit ?? DEFAULT_HISTORY_LIMIT)),
    MAX_HISTORY_LIMIT,
  );
  return withLock(dir, async () => {
    const head = await runGit(dir, ['rev-parse', '--verify', '--quiet', 'HEAD'], git);
    if (!head.ok) return head;
    if (head.value.code !== 0) return ok([]);
    const log = await gitChecked(
      dir,
      [
        'log',
        `--max-count=${String(limit)}`,
        '-z',
        '--no-renames',
        '--name-status',
        `--format=${LOG_FORMAT}`,
        'HEAD',
      ],
      git,
    );
    return log.ok ? ok(parseLog(log.value)) : log;
  });
}

/** `12\t3\tpath\0` per file; binary files report `-\t-`. */
function parseNumstat(
  raw: string,
): Map<string, { additions: number | null; deletions: number | null }> {
  const stats = new Map<string, { additions: number | null; deletions: number | null }>();
  for (const line of raw.split('\0')) {
    const match = /^(-|\d+)\t(-|\d+)\t(.+)$/s.exec(line.replace(/^\n/, ''));
    if (!match) continue;
    const [, added = '-', deleted = '-', file = ''] = match;
    stats.set(file, {
      additions: added === '-' ? null : Number(added),
      deletions: deleted === '-' ? null : Number(deleted),
    });
  }
  return stats;
}

/** Files of one commit (vs. its first parent; the first commit vs. nothing) with line counts. */
export function diffSummary(
  dir: string,
  hash: string,
  options: GitOptions = {},
): Promise<Result<DiffSummary>> {
  if (!/^[0-9a-f]{4,64}$/i.test(hash)) {
    return Promise.resolve(
      err(projectError('unknown-commit', `no commit ${hash} in this project's history`)),
    );
  }
  return withLock(dir, async () => {
    const common = ['diff-tree', '-r', '--root', '--no-commit-id', '--no-renames', '-z'];
    const resolved = await runGit(
      dir,
      ['rev-parse', '--verify', '--quiet', `${hash}^{commit}`],
      options,
    );
    if (!resolved.ok) return resolved;
    const full = resolved.value.stdout.trim();
    if (resolved.value.code !== 0 || full === '') {
      return err(projectError('unknown-commit', `no commit ${hash} in this project's history`));
    }
    const names = await gitChecked(dir, [...common, '--name-status', full], options);
    if (!names.ok) return names;
    const numbers = await gitChecked(dir, [...common, '--numstat', full], options);
    if (!numbers.ok) return numbers;
    const stats = parseNumstat(numbers.value);
    const files: DiffFile[] = parseNameStatus(names.value).map((change) => ({
      ...change,
      ...(stats.get(change.path) ?? { additions: null, deletions: null }),
    }));
    const sum = (pick: (file: DiffFile) => number | null): number =>
      files.reduce((total, file) => total + (pick(file) ?? 0), 0);
    return ok({
      hash: full,
      files,
      additions: sum((file) => file.additions),
      deletions: sum((file) => file.deletions),
    });
  });
}
