/**
 * Engine dev CLI commands (Node only):
 *   render-frames  (pnpm render:frames)
 *   lint           (pnpm lint:scene) — the determinism lint for scene files
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describeError } from '../errors.js';
import { runLintCli } from '../lint/cli.js';
import { processIo, type CliIo } from './io.js';
import { runRenderFramesCli } from './render-frames.js';

const COMMANDS = ['render-frames', 'lint'] as const;

/** pnpm runs root scripts in the repo root; INIT_CWD is where the user typed the command. */
function userCwd(): string {
  return process.env['INIT_CWD'] ?? process.cwd();
}

export async function runEngineCli(
  argv: readonly string[],
  io: CliIo = processIo,
): Promise<number> {
  const [command, ...rest] = argv;
  const cwd = userCwd();
  try {
    if (command === 'render-frames') return await runRenderFramesCli(rest, io, cwd);
    if (command === 'lint') {
      return await runLintCli(rest, {
        ...io,
        readFile: (file) => readFile(path.resolve(cwd, file), 'utf8'),
      });
    }
    io.stderr(`unknown command "${command ?? ''}"; expected one of: ${COMMANDS.join(', ')}\n`);
    return 2;
  } catch (error) {
    io.stderr(`${command ?? 'engine cli'}: ${describeError(error)}\n`);
    return 1;
  }
}
