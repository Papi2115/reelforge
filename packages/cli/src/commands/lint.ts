/** `reelforge lint [scene.js...]`: determinism + scene-contract lint (engine lintScene). */
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { formatDiagnostics, lintScene, type LintDiagnostic } from '@reelforge/engine';
import { COMMON_OPTIONS, parseCommandArgs } from '../args.js';
import { result, type Command } from '../command.js';
import { describeUnknown, ProjectError } from '../errors.js';
import { plural, verdictLine } from '../format.js';
import { PROJECT_PATHS, projectPath, projectRelative, resolveInProject } from '../project/paths.js';

export const LINT_USAGE = `usage: reelforge lint [--json] [scene.js...]
Checks scene modules for non-deterministic APIs (Date, Math.random, timers, fetch, ...) and
scene-contract problems. Without files: every scenes/*.js.
Exit code: 0 no errors (warnings allowed), 1 lint errors, 2 usage error.`;

export interface LintedFile {
  readonly file: string;
  readonly diagnostics: readonly LintDiagnostic[];
}

async function defaultScenes(root: string): Promise<string[]> {
  const directory = projectPath(root, PROJECT_PATHS.scenes);
  const names = existsSync(directory) ? await readdir(directory) : [];
  const scenes = names.filter((name) => name.endsWith('.js')).sort();
  if (scenes.length === 0) {
    throw new ProjectError(
      'no scene files in scenes/',
      'write scenes as scenes/<shot id>_<slug>.js, or pass the files to lint',
    );
  }
  return scenes.map((name) => `${PROJECT_PATHS.scenes}/${name}`);
}

export async function lintFiles(root: string, inputs: readonly string[]): Promise<LintedFile[]> {
  return Promise.all(
    inputs.map(async (input) => {
      const absolute = resolveInProject(root, input, 'lint');
      const file = projectRelative(root, absolute);
      let source: string;
      try {
        source = await readFile(absolute, 'utf8');
      } catch (error) {
        throw new ProjectError(
          `cannot read ${file}: ${describeUnknown(error)}`,
          'check the path (relative to the project folder)',
        );
      }
      return { file, diagnostics: lintScene(source, { filename: file }) };
    }),
  );
}

export const lintCommand: Command = {
  name: 'lint',
  summary: 'determinism + scene-contract lint of scenes/*.js',
  usage: LINT_USAGE,
  async run(argv, context) {
    const { positionals } = parseCommandArgs(argv, COMMON_OPTIONS, true);
    const inputs = positionals.length > 0 ? positionals : await defaultScenes(context.root);
    const results = await lintFiles(context.root, inputs);
    const all = results.flatMap((entry) => entry.diagnostics);
    const errors = all.filter((diagnostic) => diagnostic.severity === 'error').length;
    const lines = results.map((entry) =>
      entry.diagnostics.length === 0
        ? `ok      ${entry.file}`
        : formatDiagnostics(entry.file, entry.diagnostics),
    );
    lines.push(
      `${plural(results.length, 'file')}: ${plural(errors, 'error')}, ${plural(all.length - errors, 'warning')}`,
      verdictLine(errors, 'fix each error as its `fix:` line says, then run reelforge lint again'),
    );
    return result(errors, lines, { files: results, errors, warnings: all.length - errors });
  },
};
