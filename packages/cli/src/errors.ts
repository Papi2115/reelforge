/** Typed CLI failures; `runReelforgeCli` maps them to exit codes and readable messages. */

/** Wrong invocation (unknown option, bad value, path outside the project): exit code 2. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

/**
 * The project is not in a state the command can work with (missing or invalid file): exit
 * code 1. `fix` tells the reader (often the runtime Claude) what to do about it.
 */
export class ProjectError extends Error {
  constructor(
    message: string,
    readonly fix: string,
  ) {
    super(message);
    this.name = 'ProjectError';
  }
}

/** Human-readable description of an unknown thrown value. */
export function describeUnknown(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
