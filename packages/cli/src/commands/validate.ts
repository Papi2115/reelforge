/** `reelforge validate`: zod-validates the project's JSON files and checks them against each other. */
import { COMMON_OPTIONS, parseCommandArgs } from '../args.js';
import { result, type Command } from '../command.js';
import { countBySeverity, formatProblem, plural, verdictLine } from '../format.js';
import { crossFileProblems } from '../project/checks.js';
import {
  fileProblems,
  readProjectFiles,
  type FileCheck,
  type Problem,
  type ProjectFiles,
} from '../project/files.js';
import { PROJECT_PATHS } from '../project/paths.js';

export const VALIDATE_USAGE = `usage: reelforge validate [--json]
Validates project.json, brief.json, storyboard.json, timing/words.json and cues.json (schema and
version) and checks them against each other (contiguous shots, scene files, style, time ranges).
Exit code: 0 valid (warnings allowed), 1 errors found, 2 usage error.`;

export interface FileStatus {
  readonly file: string;
  readonly status: 'ok' | 'missing' | 'invalid';
  readonly summary: string;
}

function describe<T>(
  check: FileCheck<T>,
  okSummary: (data: T) => string,
  missing: string,
): FileStatus {
  if (check.status === 'ok')
    return { file: check.file, status: 'ok', summary: okSummary(check.data) };
  if (check.status === 'missing') return { file: check.file, status: 'missing', summary: missing };
  return { file: check.file, status: 'invalid', summary: plural(check.problems.length, 'error') };
}

export function fileStatuses(files: ProjectFiles): FileStatus[] {
  return [
    describe(
      files.project,
      (data) => `v${String(data.version)}, "${data.title}", ${data.style}`,
      'required',
    ),
    describe(
      files.brief,
      (data) => `v${String(data.version)}, ${data.language}`,
      'not written yet (Script stage input)',
    ),
    describe(
      files.storyboard,
      (data) => `v${String(data.version)}, ${plural(data.shots.length, 'shot')}`,
      'not written yet (Storyboard stage)',
    ),
    describe(
      files.words,
      (data) => `v${String(data.version)}, ${plural(data.words.length, 'word')}`,
      'not written yet (Words timed stage)',
    ),
    describe(
      files.cues,
      (data) => `v${String(data.version)}, ${plural(data.sfx.length, 'sfx cue')}`,
      'not written yet (Sound design stage)',
    ),
  ];
}

/** Schema + cross-file problems, plus a missing project.json. */
export function allProblems(files: ProjectFiles): Problem[] {
  const missingProject: Problem[] =
    files.project.status === 'missing'
      ? [
          {
            severity: 'error',
            file: PROJECT_PATHS.project,
            at: '',
            message: 'missing: this folder is not a ReelForge project',
            fix: 'run reelforge inside the video project folder (the one with project.json)',
          },
        ]
      : [];
  return [...missingProject, ...fileProblems(files), ...crossFileProblems(files)];
}

export const validateCommand: Command = {
  name: 'validate',
  summary: 'zod-validate the project JSON files and cross-check them',
  usage: VALIDATE_USAGE,
  async run(argv, context) {
    parseCommandArgs(argv, COMMON_OPTIONS, false);
    const files = await readProjectFiles(context.root);
    const statuses = fileStatuses(files);
    const problems = allProblems(files);
    const { errors, warnings } = countBySeverity(problems);
    const lines = [
      'files:',
      ...statuses.map(
        (entry) => `  ${entry.status.padEnd(8)} ${entry.file.padEnd(18)} ${entry.summary}`,
      ),
    ];
    if (problems.length > 0) lines.push('problems:', ...problems.map(formatProblem));
    lines.push(
      `${plural(errors, 'error')}, ${plural(warnings, 'warning')}`,
      verdictLine(errors, 'fix the errors above and run reelforge validate again'),
    );
    return result(errors, lines, { files: statuses, problems, errors, warnings });
  },
};
