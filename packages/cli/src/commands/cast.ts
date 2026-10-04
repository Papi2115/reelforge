/**
 * `reelforge cast list | check <file> | preview <id>` (PLAN.md#12.20, ADR-026): the people a scene
 * can use (`kit.cast`: mascots, cast, mannequin, the project's roles and accessories), the check
 * of one role or accessory file with readable errors ("did you mean" for vocabulary ids), and the
 * lineup preview of a role (cast-preview.ts).
 */
import { readFile } from 'node:fs/promises';
import {
  castListing,
  parseAccessoryFile,
  parseRoleFile,
  roleSpecChecks,
  type CastFileProblem,
} from '@reelforge/kit';
import { castFileOf, castRoleFile } from '@reelforge/shared';
import { COMMON_OPTIONS, parseCommandArgs } from '../args.js';
import { result, type Command, type CommandResult } from '../command.js';
import { describeUnknown, ProjectError, UsageError } from '../errors.js';
import { verdictLine } from '../format.js';
import { readCastRoles } from '../project/cast-roles.js';
import { projectRelative, resolveInProject } from '../project/paths.js';
import { castPreview, checkLine, projectCastOf } from './cast-preview.js';

export const CAST_USAGE = `usage: reelforge cast list | check <file> | preview <id> [--json]
  list            the people scenes can use: mascots, cast members, the mannequin (kit.cast) and
                  this project's roles (characters/roles/<id>.json) and accessories
  check <file>    validates characters/roles/<id>.json or characters/accessories/<id>.json with
                  readable errors (unknown ids get a "did you mean"), plus the role's spec checks
  preview <id>    the role alone, 4 angles + 2 poses, through the scene renderer, as ONE labelled
                  image (Read it) plus checks: outfit colours, palette, face, accessories, height
                  within the pack's range, views not blank, vibe guard, determinism
Writing a role: reelforge kit-docs characters (vocabulary, colours, accessory extensions).
Exit code: 0 ok, 1 problems, 2 usage error.`;

function problemLines(problems: readonly CastFileProblem[]): string[] {
  return problems.flatMap((problem) => [
    `  ${problem.file}:`,
    ...problem.errors.map((error) => `    ${error}`),
  ]);
}

async function list(root: string): Promise<CommandResult> {
  const files = await readCastRoles(root);
  const { cast, problems } = projectCastOf(files);
  const entries = castListing(cast).filter((entry) =>
    ['mascot', 'person', 'mannequin', 'role'].includes(entry.kind),
  );
  const project = [...cast.accessories.values()];
  const lines = [
    'people (kit.cast.mascot(id) for mascots, kit.cast.person(id) for the rest):',
    ...entries.map((entry) => `  ${entry.kind.padEnd(9)} ${entry.id} — ${entry.description}`),
    ...(project.length === 0
      ? []
      : [
          'project accessories (characters/accessories):',
          ...project.map((entry) => `  ${entry.id} (${entry.slot}) — ${entry.description}`),
        ]),
    ...files.ignored.map((file) => `ignored: ${file} (file names are camelCase ids)`),
    ...(problems.length === 0 ? [] : ['invalid files (not loaded):', ...problemLines(problems)]),
    verdictLine(problems.length, 'run reelforge cast check <file> and fix it'),
  ];
  return result(problems.length, lines, {
    people: entries,
    accessories: project,
    ignored: files.ignored,
    problems,
  });
}

/** Whether a file is an accessory: by folder, else by content (`slot` + `boxes`). */
function isAccessory(relative: string, text: string): boolean {
  const known = castFileOf(relative);
  if (known !== undefined) return known.kind === 'accessory';
  return /"slot"\s*:/.test(text) && /"boxes"\s*:/.test(text);
}

async function check(root: string, input: string): Promise<CommandResult> {
  const absolute = resolveInProject(root, input, 'file');
  const relative = projectRelative(root, absolute);
  let text: string;
  try {
    text = await readFile(absolute, 'utf8');
  } catch (error) {
    throw new ProjectError(`cannot read ${relative} (${describeUnknown(error)})`, 'check the path');
  }
  const id =
    relative
      .split('/')
      .at(-1)
      ?.replace(/\.json$/, '') ?? '';
  const source = { id, file: relative, source: text };
  const files = await readCastRoles(root);
  if (isAccessory(relative, text)) {
    const parsed = parseAccessoryFile(source);
    const errors = parsed.ok ? [] : parsed.problem.errors;
    const lines = [
      `accessory ${id} · ${relative}`,
      ...(parsed.ok
        ? [`  ok  slot ${parsed.accessory.slot}, ${String(parsed.accessory.boxes.length)} boxes`]
        : errors.map((error) => `  ${error}`)),
      verdictLine(errors.length, 'fix the file and run reelforge cast check again'),
    ];
    return result(errors.length, lines, { id, file: relative, kind: 'accessory', errors });
  }
  // Roles see the project's accessories (the file itself is never one of them).
  const { cast } = projectCastOf({ ...files, roles: [] });
  const parsed = parseRoleFile(source, cast);
  if (!parsed.ok) {
    const lines = [
      `role ${id} · ${relative}`,
      ...parsed.problem.errors.map((error) => `  ${error}`),
      verdictLine(parsed.problem.errors.length, 'fix the file and run reelforge cast check again'),
    ];
    return result(parsed.problem.errors.length, lines, {
      id,
      file: relative,
      kind: 'role',
      errors: parsed.problem.errors,
      checks: [],
    });
  }
  const checks = roleSpecChecks(parsed.role.spec, cast);
  const failed = checks.filter((entry) => !entry.ok);
  const lines = [
    `role ${id} · ${relative}${relative === castRoleFile(id) ? '' : ` (roles live in ${castRoleFile(id)})`}`,
    ...checks.map(checkLine),
    verdictLine(failed.length, `fix the file; then reelforge cast preview ${id}`),
  ];
  return result(failed.length, lines, { id, file: relative, kind: 'role', errors: [], checks });
}

export const castCommand: Command = {
  name: 'cast',
  summary:
    'people for scenes (kit.cast) and project roles: list, check a role file, preview a role',
  usage: CAST_USAGE,
  async run(argv, context) {
    const { positionals } = parseCommandArgs(argv, COMMON_OPTIONS, true);
    const [action, target, ...rest] = positionals;
    if (rest.length > 0) throw new UsageError('too many arguments; see reelforge cast --help');
    switch (action) {
      case 'list':
        if (target !== undefined) throw new UsageError('cast list takes no argument');
        return list(context.root);
      case 'check':
        if (target === undefined)
          throw new UsageError(
            'pass a file, e.g. reelforge cast check characters/roles/firefighter.json',
          );
        return check(context.root, target);
      case 'preview':
        if (target === undefined)
          throw new UsageError('pass a role id, e.g. reelforge cast preview firefighter');
        return castPreview(context.root, target);
      default:
        throw new UsageError('use reelforge cast list | check <file> | preview <id>');
    }
  },
};
