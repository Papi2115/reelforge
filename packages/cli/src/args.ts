/** Argument parsing shared by the commands (pure, unit-tested). */
import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';
import { UsageError } from './errors.js';

/** Options every command accepts. */
export const COMMON_OPTIONS = {
  json: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
} as const satisfies ParseArgsOptionsConfig;

/** `node:util` parseArgs with strict options; parse failures become usage errors. */
export function parseCommandArgs<const Options extends ParseArgsOptionsConfig>(
  argv: readonly string[],
  options: Options,
  allowPositionals: boolean,
): ReturnType<typeof parseArgs<{ options: Options; allowPositionals: boolean; strict: true }>> {
  try {
    return parseArgs({
      args: argv.filter((arg) => arg !== '--'),
      options,
      allowPositionals,
      strict: true,
    });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
}

/** `0,2.5,5` -> [0, 2.5, 5]; seconds >= 0, at least one. */
export function parseTimes(text: string, option = '--at'): number[] {
  const times = text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => {
      const value = Number(part);
      if (!Number.isFinite(value) || value < 0) {
        throw new UsageError(`${option}: "${part}" is not a time in seconds (>= 0)`);
      }
      return value;
    });
  if (times.length === 0) {
    throw new UsageError(`${option} needs at least one time in seconds, e.g. ${option} 0,2.5,5`);
  }
  return times;
}

export function parseInteger(text: string, option: string, min: number, max: number): number {
  const value = Number(text);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new UsageError(
      `${option}: "${text}" must be a whole number from ${String(min)} to ${String(max)}`,
    );
  }
  return value;
}

export function parsePositiveSeconds(text: string, option: string): number {
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) {
    throw new UsageError(`${option}: "${text}" must be a number of seconds > 0`);
  }
  return value;
}
