/**
 * Path containment for the runtime Claude's file access (PLAN.md#5.7): a path is "inside" a
 * directory only if it resolves (lexically and, for existing parts, through symlinks/junctions)
 * to that directory or below it. Windows: case-insensitive, other drives and UNC paths are outside.
 */
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { err, ok, type Result } from './result.js';

export interface PathGuardError {
  readonly kind: 'outside-project';
  readonly path: string;
  readonly resolved: string;
  readonly root: string;
}

export interface PathGuardOptions {
  /** Path flavour; default the current platform (tests use `path.win32`/`path.posix`). */
  readonly pathApi?: path.PlatformPath;
  /** Resolve symlinks/junctions of the existing part of the path. Default true (native only). */
  readonly followLinks?: boolean;
}

function comparable(value: string, api: path.PlatformPath): string {
  return api === path.win32 ? value.toLowerCase() : value;
}

/** Lexical containment: `target` (absolute or relative to `root`) is `root` or below it. */
export function isInsideDir(
  root: string,
  target: string,
  pathApi: path.PlatformPath = path,
): boolean {
  const resolvedRoot = pathApi.resolve(root);
  const resolved = pathApi.resolve(resolvedRoot, target);
  const relative = pathApi.relative(
    comparable(resolvedRoot, pathApi),
    comparable(resolved, pathApi),
  );
  return relative === '' || (!relative.startsWith('..') && !pathApi.isAbsolute(relative));
}

/** realpath of the longest existing prefix + the not-yet-existing rest (new files). */
function realpathOfExisting(target: string): string {
  const rest: string[] = [];
  let current = target;
  for (;;) {
    try {
      return path.join(realpathSync.native(current), ...rest.reverse());
    } catch (error) {
      const parent = path.dirname(current);
      if (parent === current) {
        throw error;
      }
      rest.push(path.basename(current));
      current = parent;
    }
  }
}

function linkResolved(value: string): string {
  try {
    return realpathOfExisting(value);
  } catch {
    return value; // nothing on the path exists (not even the drive): lexical result stands
  }
}

/**
 * Ok(absolute path) when `target` stays inside `projectDir`, else an `outside-project` error.
 * Relative targets are resolved against `projectDir` (the runtime Claude's cwd).
 */
export function assertInsideProject(
  projectDir: string,
  target: string,
  options: PathGuardOptions = {},
): Result<string, PathGuardError> {
  const api = options.pathApi ?? path;
  const root = api.resolve(projectDir);
  const resolved = api.resolve(root, target);
  const outside = (actual: string): Result<string, PathGuardError> =>
    err({ kind: 'outside-project', path: target, resolved: actual, root });
  if (!isInsideDir(root, resolved, api)) return outside(resolved);
  if ((options.followLinks ?? true) && api === path) {
    const realRoot = linkResolved(root);
    const realTarget = linkResolved(resolved);
    if (!isInsideDir(realRoot, realTarget, api)) return outside(realTarget);
  }
  return ok(resolved);
}
