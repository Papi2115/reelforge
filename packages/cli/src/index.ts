/**
 * @reelforge/cli: the `reelforge` command the runtime Claude runs (through the Bash allowlist)
 * inside a video project to check its own work. The app uses this module to put the CLI on PATH.
 */
export const packageName = '@reelforge/cli';

export { COMMANDS, mainUsage, runReelforgeCli } from './cli.js';
export type { CliIo, Command, CommandContext, CommandResult } from './command.js';
export { CLI_BUNDLE_PATH, cmdShim, shShim, writeCliShims, type CliShimOptions } from './shims.js';
