/** Contract of a `reelforge` subcommand. */

/** Output streams (injected, so commands are testable; main.ts wires the process streams). */
export interface CliIo {
  stdout(text: string): void;
  stderr(text: string): void;
}

export interface CommandContext {
  /** Project folder: the working directory the command was started in. */
  readonly root: string;
}

export interface CommandResult {
  /** 0 = ok, 1 = problems found. Usage errors (2) are thrown as UsageError. */
  readonly code: 0 | 1;
  /** Human/LLM-readable report (ends with a newline). */
  readonly text: string;
  /** Machine-readable report printed with --json. */
  readonly json: unknown;
}

export interface Command {
  readonly name: string;
  /** One line for the command list. */
  readonly summary: string;
  readonly usage: string;
  run(argv: readonly string[], context: CommandContext): Promise<CommandResult>;
}

export function result(
  problemCount: number,
  lines: readonly string[],
  json: unknown,
): CommandResult {
  return { code: problemCount > 0 ? 1 : 0, text: `${lines.join('\n')}\n`, json };
}
