/** `reelforge status`: pipeline stages, shots, missing files and the last recorded errors. */
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { pipelineStateSchema, type PipelineState } from '@reelforge/shared';
import { COMMON_OPTIONS, parseCommandArgs } from '../args.js';
import { result, type Command } from '../command.js';
import {
  countBySeverity,
  formatProblem,
  plural,
  seconds,
  timeRange,
  verdictLine,
} from '../format.js';
import {
  checkJsonFile,
  readProjectFiles,
  type FileCheck,
  type ProjectFiles,
} from '../project/files.js';
import { PROJECT_PATHS, projectPath } from '../project/paths.js';
import { allProblems } from './validate.js';

export const STATUS_USAGE = `usage: reelforge status [--json]
Shows the pipeline stages (which files exist), the shots with their times and scene files, and
the last errors recorded by the app (.reelforge/pipeline.json).
Exit code: 0 ok, 1 invalid files or missing scene files, 2 usage error.`;

type StageState = 'done' | 'partial' | 'todo';

export interface StageStatus {
  readonly stage: string;
  readonly state: StageState;
  readonly detail: string;
}

export interface ShotStatus {
  readonly id: string;
  readonly t0: number;
  readonly t1: number;
  readonly treatment: string;
  readonly scene: string;
  readonly sceneExists: boolean;
}

const MARK: Readonly<Record<StageState, string>> = { done: '[x]', partial: '[~]', todo: '[ ]' };
const MAX_ERROR_LENGTH = 300;

async function listFiles(root: string, directory: string, pattern: RegExp): Promise<string[]> {
  const absolute = projectPath(root, directory);
  if (!existsSync(absolute)) return [];
  const entries = await readdir(absolute, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => `${directory}/${entry.name}`)
    .sort();
}

function fileStage(root: string, stage: string, file: string): StageStatus {
  const present = existsSync(projectPath(root, file));
  return { stage, state: present ? 'done' : 'todo', detail: present ? file : `missing ${file}` };
}

async function scriptStage(root: string): Promise<StageStatus> {
  const file = projectPath(root, PROJECT_PATHS.script);
  if (!existsSync(file))
    return { stage: 'Script', state: 'todo', detail: `missing ${PROJECT_PATHS.script}` };
  const words = (await readFile(file, 'utf8')).split(/\s+/).filter((word) => word !== '').length;
  return {
    stage: 'Script',
    state: 'done',
    detail: `${PROJECT_PATHS.script} (${plural(words, 'word')})`,
  };
}

function shotStatuses(files: ProjectFiles): ShotStatus[] {
  if (files.storyboard.status !== 'ok') return [];
  return files.storyboard.data.shots.map((shot) => ({
    id: shot.id,
    t0: shot.t0,
    t1: shot.t1,
    treatment: shot.treatment,
    scene: shot.scene,
    sceneExists: existsSync(projectPath(files.root, shot.scene)),
  }));
}

function jsonStage(
  stage: string,
  file: string,
  state: FileCheck<unknown>,
  detail: string,
): StageStatus {
  if (state.status === 'missing') return { stage, state: 'todo', detail: `missing ${file}` };
  if (state.status === 'invalid')
    return { stage, state: 'partial', detail: `${file} is invalid (run reelforge validate)` };
  return { stage, state: 'done', detail };
}

async function stageStatuses(
  files: ProjectFiles,
  shots: readonly ShotStatus[],
): Promise<StageStatus[]> {
  const { root } = files;
  const voiceovers = await listFiles(root, PROJECT_PATHS.audio, /^vo\.original\./);
  const videos = await listFiles(root, PROJECT_PATHS.out, /\.mp4$/i);
  const words = files.words.status === 'ok' ? files.words.data.words : [];
  const end = shots.at(-1)?.t1 ?? 0;
  const built = shots.filter((shot) => shot.sceneExists).length;
  const missingScenes = shots.filter((shot) => !shot.sceneExists).map((shot) => shot.scene);
  return [
    await scriptStage(root),
    voiceovers.length > 0
      ? { stage: 'Voiceover', state: 'done', detail: voiceovers.join(', ') }
      : { stage: 'Voiceover', state: 'todo', detail: 'missing audio/vo.original.*' },
    fileStage(root, 'Audio cleaned', PROJECT_PATHS.voClean),
    jsonStage(
      'Words timed',
      PROJECT_PATHS.words,
      files.words,
      `${PROJECT_PATHS.words} (${plural(words.length, 'word')}, voice-over ends ${seconds(words.at(-1)?.tEnd ?? 0)})`,
    ),
    jsonStage(
      'Storyboard',
      PROJECT_PATHS.storyboard,
      files.storyboard,
      `${PROJECT_PATHS.storyboard} (${plural(shots.length, 'shot')}, ${seconds(end)})`,
    ),
    shots.length === 0
      ? { stage: 'Scenes built', state: 'todo', detail: 'needs storyboard.json' }
      : {
          stage: 'Scenes built',
          state: built === shots.length ? 'done' : built > 0 ? 'partial' : 'todo',
          detail: `${String(built)}/${String(shots.length)} scene files${missingScenes.length ? ` (missing: ${missingScenes.join(', ')})` : ''}`,
        },
    fileStage(root, 'Sound design mixed', PROJECT_PATHS.mix),
    videos.length > 0
      ? { stage: 'Video exported', state: 'done', detail: videos.join(', ') }
      : { stage: 'Video exported', state: 'todo', detail: 'no out/*.mp4 yet' },
  ];
}

function clip(text: string): string {
  const single = text.replace(/\s+/g, ' ').trim();
  return single.length > MAX_ERROR_LENGTH ? `${single.slice(0, MAX_ERROR_LENGTH)}...` : single;
}

/** Failed/blocked/paused stages and failed work items from the app's pipeline.json. */
export function pipelineErrors(state: PipelineState): string[] {
  const stages = Object.entries(state.stages)
    .filter(
      ([, stage]) =>
        stage.status === 'failed' || stage.status === 'blocked' || stage.status === 'paused',
    )
    .map(
      ([name, stage]) =>
        `stage ${name} ${stage.status}${stage.message ? `: ${clip(stage.message)}` : ''}`,
    );
  const items = state.queue
    .filter((item) => item.status === 'failed' || item.lastError !== undefined)
    .map(
      (item) =>
        `${item.stage}/${item.id} ${item.status}${item.lastError ? `: ${clip(item.lastError)}` : ''}`,
    );
  const pause = state.pause
    ? [
        `paused (${state.pause.reason})${state.pause.pausedUntil ? ` until ${state.pause.pausedUntil}` : ''}`,
      ]
    : [];
  return [...pause, ...stages, ...items];
}

export const statusCommand: Command = {
  name: 'status',
  summary: 'stages, files, shots, durations and last errors of the project',
  usage: STATUS_USAGE,
  async run(argv, context) {
    parseCommandArgs(argv, COMMON_OPTIONS, false);
    const files = await readProjectFiles(context.root);
    const shots = shotStatuses(files);
    const stages = await stageStatuses(files, shots);
    const pipelineFile = await checkJsonFile(
      context.root,
      PROJECT_PATHS.pipelineState,
      pipelineStateSchema,
    );
    const lastErrors = pipelineFile.status === 'ok' ? pipelineErrors(pipelineFile.data) : [];
    const problems = allProblems(files);
    const { errors } = countBySeverity(problems);
    const project = files.project.status === 'ok' ? files.project.data : undefined;
    const lines = [
      project
        ? `project: "${project.title}" (${project.language}, style ${project.style}, ${String(project.fps)} fps, seed ${String(project.seed)})`
        : `project: ${files.project.status === 'missing' ? 'no project.json in this folder' : 'project.json is invalid'}`,
      'stages:',
      ...stages.map((stage) => `  ${MARK[stage.state]} ${stage.stage.padEnd(19)} ${stage.detail}`),
    ];
    if (shots.length > 0) {
      lines.push(
        'shots (global times):',
        ...shots.map(
          (shot) =>
            `  ${shot.id.padEnd(8)} ${timeRange(shot.t0, shot.t1).padEnd(14)} ${seconds(shot.t1 - shot.t0).padStart(7)}  ${shot.treatment.padEnd(20)} ${shot.scene}${shot.sceneExists ? '' : ' (missing)'}`,
        ),
      );
    }
    if (lastErrors.length > 0)
      lines.push(
        'last errors (.reelforge/pipeline.json):',
        ...lastErrors.map((line) => `  ${line}`),
      );
    if (problems.length > 0) lines.push('problems:', ...problems.map(formatProblem));
    lines.push(verdictLine(errors, 'run reelforge validate for details'));
    return result(errors, lines, { project: project ?? null, stages, shots, lastErrors, problems });
  },
};
