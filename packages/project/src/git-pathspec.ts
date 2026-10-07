/**
 * Pathspecs of a path-limited commit (`autocommit` with `paths`): project-relative, literal (no
 * glob magic in file names) and only those git can stage, i.e. tracked (also when deleted) or
 * untracked and not ignored. `git add` fails on a pathspec that matches nothing or names an
 * ignored file, so a shot whose scene was never written simply has nothing to commit.
 */
import { gitChecked, type GitOptions } from './git-runner.js';
import { toProjectRelative } from './paths.js';
import { ok, type Result } from './result.js';

export function literalPathspec(relative: string): string {
  return `:(literal)${relative}`;
}

/** Windows file systems (and git there, `core.ignorecase`) do not distinguish case. */
function comparable(relative: string): string {
  return process.platform === 'win32' ? relative.toLowerCase() : relative;
}

/** Literal pathspecs of `paths` that match a file git can stage, in the given order. */
export async function stageablePathspecs(
  dir: string,
  paths: readonly string[],
  options: GitOptions,
): Promise<Result<string[]>> {
  const relatives: string[] = [];
  for (const file of paths) {
    const relative = toProjectRelative(dir, file);
    if (!relative.ok) return relative;
    if (!relatives.includes(relative.value)) relatives.push(relative.value);
  }
  if (relatives.length === 0) return ok([]);
  const listed = await gitChecked(
    dir,
    [
      'ls-files',
      '-z',
      '--cached',
      '--others',
      '--exclude-standard',
      '--',
      ...relatives.map(literalPathspec),
    ],
    options,
  );
  if (!listed.ok) return listed;
  const files = listed.value
    .split('\0')
    .filter((file) => file !== '')
    .map(comparable);
  return ok(
    relatives
      .filter((relative) => {
        const key = comparable(relative);
        return files.some((file) => file === key || file.startsWith(`${key}/`));
      })
      .map(literalPathspec),
  );
}
