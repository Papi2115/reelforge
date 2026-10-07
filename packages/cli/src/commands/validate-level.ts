/**
 * `reelforge validate level <scene.js | level.json>` (PLAN.md#13.4 part c): checks the Game B2
 * levels a scene writes (read from its source, see project/level-source.ts) or a level JSON file
 * against the kit's level format (`checkLevel`: grid <= 32x32 with a closed border, the legend,
 * doors, <= 12 lights, <= 40 sprites, placements and labels). Errors name the grid row or field.
 */
import { readFile } from 'node:fs/promises';
import { BUILT_IN_LEVELS, checkLevel } from '@reelforge/kit';
import { COMMON_OPTIONS, parseCommandArgs } from '../args.js';
import { result, type CommandResult, type CommandContext } from '../command.js';
import { describeUnknown, ProjectError, UsageError } from '../errors.js';
import { plural, verdictLine } from '../format.js';
import { levelsInScene, type SourceLevel } from '../project/level-source.js';
import { projectRelative, resolveInProject } from '../project/paths.js';

export const VALIDATE_LEVEL_USAGE = `usage: reelforge validate level <scenes/<shot>.js | level.json> [--json]
Checks the Game B2 levels of a scene (every object with a \`grid\` and a \`legend\`, read from the
source, and every built-in 'office' / 'warehouse' it names) or a level JSON file against the
level format: grid <= 32x32 with walls all round the border, one legend entry per character, doors
between two walls, <= 12 lights, <= 40 sprites inside open cells, labels the pixel face can draw.
Every error names the grid row or the field.
Exit code: 0 valid (warnings allowed), 1 errors found, 2 usage error.`;

/** Messages listed per level in the text report (a broken border repeats per cell). */
const MAX_LISTED = 12;

export interface LevelReport {
  readonly line: number | undefined;
  readonly level: string;
  readonly severity: 'ok' | 'error' | 'warning';
  readonly messages: readonly string[];
}

function nameOf(value: unknown): string {
  return typeof value === 'object' && value !== null && 'name' in value
    ? String(value.name)
    : '(no name)';
}

function checked(line: number | undefined, value: unknown): LevelReport {
  const check = checkLevel(value);
  if (!check.ok) {
    return { line, level: `level "${nameOf(value)}"`, severity: 'error', messages: check.errors };
  }
  const { level } = check;
  const size = `${String(level.grid[0]?.length ?? 0)}x${String(level.grid.length)} grid`;
  const parts = [
    size,
    plural(level.lights.length, 'light'),
    plural(level.sprites.length, 'sprite'),
  ];
  return { line, level: `level "${level.name}"`, severity: 'ok', messages: [parts.join(', ')] };
}

function report(entry: SourceLevel): LevelReport {
  if (entry.kind === 'object') return checked(entry.line, entry.value);
  if (entry.kind === 'unreadable') {
    return {
      line: entry.line,
      level: 'a level',
      severity: 'warning',
      messages: [
        `cannot be read without running the scene (${entry.reason}); write it as a literal object (strings, numbers, arrays, objects, consts) so it can be checked, or check it with reelforge frames`,
      ],
    };
  }
  const known = (BUILT_IN_LEVELS as readonly string[]).includes(entry.name);
  return {
    line: entry.line,
    level: `built-in level "${entry.name}"`,
    severity: known ? 'ok' : 'error',
    messages: [
      known ? 'built in' : `unknown; the built-in levels are ${BUILT_IN_LEVELS.join(', ')}`,
    ],
  };
}

async function readInput(absolute: string, file: string): Promise<string> {
  try {
    return await readFile(absolute, 'utf8');
  } catch (error) {
    throw new ProjectError(
      `cannot read ${file}: ${describeUnknown(error)}`,
      'check the path (relative to the project folder)',
    );
  }
}

function jsonLevel(text: string): LevelReport[] {
  try {
    return [checked(undefined, JSON.parse(text) as unknown)];
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return [{ line: undefined, level: 'level', severity: 'error', messages: [error.message] }];
  }
}

function sceneLevels(text: string): LevelReport[] {
  const found = levelsInScene(text);
  if (!found.ok) {
    return [{ line: undefined, level: 'scene', severity: 'error', messages: [found.error] }];
  }
  if (found.levels.length === 0) {
    return [
      {
        line: undefined,
        level: 'scene',
        severity: 'error',
        messages: [
          "no level found: write `const LEVEL = { name, mood, floor, ceiling, grid, legend, lights, sprites }` and pass it to kit.fx.b2View({ level: LEVEL }) (or a built-in level: 'office' | 'warehouse')",
        ],
      },
    ];
  }
  return found.levels.map(report);
}

function line(file: string, entry: LevelReport): string[] {
  const where = entry.line === undefined ? file : `${file}:${String(entry.line)}`;
  const [first = '', ...rest] = entry.messages;
  const head = `${entry.severity.padEnd(7)} ${where} ${entry.level}`;
  if (entry.severity === 'ok') return [`${head}: ${first}`];
  const all = [first, ...rest];
  const shown = all.slice(0, MAX_LISTED).map((message) => `  - ${message}`);
  const more = all.length - MAX_LISTED;
  return [
    head,
    ...shown,
    ...(more > 0 ? [`  - … and ${String(more)} more (--json lists all)`] : []),
  ];
}

export async function runValidateLevel(
  argv: readonly string[],
  context: CommandContext,
): Promise<CommandResult> {
  const { positionals } = parseCommandArgs(argv, COMMON_OPTIONS, true);
  const [input, ...extra] = positionals;
  if (input === undefined || extra.length > 0) {
    throw new UsageError('give one file: a scene (scenes/<shot>.js) or a level JSON file');
  }
  const absolute = resolveInProject(context.root, input, 'validate level');
  const file = projectRelative(context.root, absolute);
  const lower = file.toLowerCase();
  if (!lower.endsWith('.js') && !lower.endsWith('.mjs') && !lower.endsWith('.json')) {
    throw new UsageError(`"${input}" is neither a scene (.js) nor a level (.json)`);
  }
  const text = await readInput(absolute, file);
  const levels = lower.endsWith('.json') ? jsonLevel(text) : sceneLevels(text);
  const errors = levels.filter((entry) => entry.severity === 'error').length;
  const warnings = levels.filter((entry) => entry.severity === 'warning').length;
  const lines = [
    ...levels.flatMap((entry) => line(file, entry)),
    `${plural(errors, 'error')}, ${plural(warnings, 'warning')}`,
    verdictLine(errors, `fix the level and run reelforge validate level ${file} again`),
  ];
  return result(errors, lines, { file, levels, errors, warnings });
}
