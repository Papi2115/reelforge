/**
 * `reelforge <command>`: dispatch, --help/--json handling and the mapping of failures to exit
 * codes (0 ok, 1 problems found, 2 usage error). This and main.ts are the only output layer.
 */
import type { CliIo, Command } from './command.js';
import { anchorsCommand } from './commands/anchors.js';
import { contactSheetCommand } from './commands/contact-sheet.js';
import { framesCommand } from './commands/frames.js';
import { kitDocsCommand } from './commands/kit-docs.js';
import { lintCommand } from './commands/lint.js';
import { looksCommand } from './commands/looks.js';
import { propPreviewCommand } from './commands/prop-preview.js';
import { renderShotCommand } from './commands/render-shot.js';
import { statusCommand } from './commands/status.js';
import { validateCommand } from './commands/validate.js';
import { describeUnknown, ProjectError, UsageError } from './errors.js';

export const COMMANDS: readonly Command[] = [
  statusCommand,
  validateCommand,
  lintCommand,
  framesCommand,
  contactSheetCommand,
  renderShotCommand,
  anchorsCommand,
  kitDocsCommand,
  looksCommand,
  propPreviewCommand,
];

export function mainUsage(): string {
  const width = Math.max(...COMMANDS.map((command) => command.name.length));
  return [
    'usage: reelforge <command> [options]   (run inside the video project folder)',
    '',
    'commands:',
    ...COMMANDS.map((command) => `  ${command.name.padEnd(width)}  ${command.summary}`),
    '',
    'Every command accepts --json (machine-readable output) and --help.',
    'Exit code: 0 ok, 1 problems found, 2 usage error.',
  ].join('\n');
}

const HELP_FLAGS = new Set(['--help', '-h']);

function printJson(io: CliIo, value: unknown): void {
  io.stdout(`${JSON.stringify(value, null, 2)}\n`);
}

export async function runReelforgeCli(
  argv: readonly string[],
  io: CliIo,
  cwd: string,
): Promise<number> {
  const [name, ...rest] = argv;
  if (name === undefined || HELP_FLAGS.has(name) || name === 'help') {
    io.stdout(`${mainUsage()}\n`);
    return name === undefined ? 2 : 0;
  }
  const command = COMMANDS.find((candidate) => candidate.name === name);
  if (!command) {
    io.stderr(`reelforge: unknown command "${name}"\n\n${mainUsage()}\n`);
    return 2;
  }
  if (rest.some((arg) => HELP_FLAGS.has(arg))) {
    io.stdout(`${command.usage}\n`);
    return 0;
  }
  const json = rest.includes('--json');
  try {
    const outcome = await command.run(rest, { root: cwd });
    if (json) printJson(io, outcome.json);
    else io.stdout(outcome.text);
    return outcome.code;
  } catch (error) {
    if (error instanceof UsageError) {
      if (json) printJson(io, { ok: false, error: { kind: 'usage', message: error.message } });
      else io.stderr(`reelforge ${name}: ${error.message}\n(see: reelforge ${name} --help)\n`);
      return 2;
    }
    if (error instanceof ProjectError) {
      if (json)
        printJson(io, {
          ok: false,
          error: { kind: 'project', message: error.message, fix: error.fix },
        });
      else io.stdout(`reelforge ${name}: ${error.message}\nfix: ${error.fix}\n`);
      return 1;
    }
    const message = `internal error (a bug in reelforge, not in your project): ${describeUnknown(error)}`;
    if (json) printJson(io, { ok: false, error: { kind: 'internal', message } });
    else io.stderr(`reelforge ${name}: ${message}\n`);
    return 1;
  }
}
