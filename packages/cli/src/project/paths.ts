/**
 * Project layout (PLAN.md §3.1) and path confinement: every path the CLI reads or writes is
 * resolved inside the project folder (the working directory); `..`, absolute paths elsewhere and
 * links pointing out of the project are rejected.
 */
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { UsageError } from '../errors.js';

/** Project-relative locations, with forward slashes (also used in messages). */
export const PROJECT_PATHS = {
  project: 'project.json',
  brief: 'brief.json',
  script: 'script.txt',
  storyboard: 'storyboard.json',
  /** Tension curve (PLAN.md#12.22). */
  tension: 'tension.json',
  cues: 'cues.json',
  words: 'timing/words.json',
  scenes: 'scenes',
  kitExtProps: 'kit-ext/props',
  /** Grim Ink people / places modules (PLAN.md#14.8). */
  kitExtPeople: 'kit-ext/people',
  kitExtPlaces: 'kit-ext/places',
  audio: 'audio',
  voClean: 'audio/vo.clean.wav',
  mix: 'audio/mix.wav',
  out: 'out',
  pipelineState: '.reelforge/pipeline.json',
  /** Output of frames / contact-sheet / render-shot (git-ignored app data). */
  frames: '.reelforge/frames',
} as const;

const caseInsensitive = process.platform === 'win32';

/** True when `candidate` is `root` or inside it (lexically). */
export function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  if (relative === '') return true;
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/** Same file location, ignoring case on Windows. */
export function samePath(first: string, second: string): boolean {
  const a = path.resolve(first);
  const b = path.resolve(second);
  return caseInsensitive ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/**
 * Resolves a user/project-supplied path inside the project. Throws a UsageError naming `label`
 * when it points outside (lexically, or through a symlink/junction when it exists).
 */
export function resolveInProject(root: string, input: string, label: string): string {
  const absolute = path.resolve(root, input);
  const outside = (): UsageError =>
    new UsageError(
      `${label}: "${input}" is outside the project folder; use a path inside the project, e.g. scenes/s01_intro.js`,
    );
  if (!isInside(root, absolute)) throw outside();
  if (existsSync(absolute) && !isInside(realpathSync(root), realpathSync(absolute))) {
    throw outside();
  }
  return absolute;
}

/** Project-relative path with forward slashes (for messages and JSON output). */
export function projectRelative(root: string, absolute: string): string {
  const relative = path.relative(root, absolute);
  return relative.split(path.sep).join('/');
}

export function projectPath(root: string, relative: string): string {
  return path.join(root, ...relative.split('/'));
}
