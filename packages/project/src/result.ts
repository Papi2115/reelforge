/** Typed results and errors: every expected failure of a project operation is a value. */

export type Result<T, E = ProjectError> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

export function err<E>(error: E): { readonly ok: false; readonly error: E } {
  return { ok: false, error };
}

export type ProjectErrorKind =
  /** The folder (or a file a caller named) does not exist. */
  | 'not-found'
  /** The folder exists but has no project.json. */
  | 'not-a-project'
  /** createProject into a folder that already has files. */
  | 'not-empty'
  /** A JSON file is not valid JSON. */
  | 'corrupt'
  /** A JSON file does not match its schema. */
  | 'invalid'
  /** project.json from a newer app, or an older version without a migration. */
  | 'unsupported-version'
  | 'io'
  /** The `git` binary could not be started. */
  | 'git-missing'
  | 'git-failed'
  /** Another git process holds `.git/index.lock` (and it is not stale). */
  | 'locked'
  | 'unknown-commit'
  | 'invalid-argument';

export interface ProjectError {
  readonly kind: ProjectErrorKind;
  /** Human-readable, says what to do where possible. */
  readonly message: string;
  /** File or folder the error is about. */
  readonly path?: string;
  /** Schema issues (`path: message`) or the stderr of a failed git command. */
  readonly details?: readonly string[];
}

export function projectError(
  kind: ProjectErrorKind,
  message: string,
  extra: { readonly path?: string; readonly details?: readonly string[] } = {},
): ProjectError {
  return { kind, message, ...extra };
}

export function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

export function describeUnknown(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Wraps a throwing filesystem operation into a Result with an `io` error. */
export async function tryIo<T>(path: string, operation: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await operation());
  } catch (error) {
    return err(projectError('io', `${path}: ${describeUnknown(error)}`, { path }));
  }
}
