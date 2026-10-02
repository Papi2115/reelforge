/**
 * What the main layout shows of the open project (PLAN.md#6.3): the file listing (pipeline stage
 * status is computed from it in the renderer) and storyboard / words / cues, each validated with
 * the schema its writer uses (shared for storyboard and words, the pipeline's for cues), plus the
 * damaged files with the fix the app offers (PLAN.md#10.2).
 */
import { CuesFileSchema, type CuesFile } from '@reelforge/pipeline';
import { storyboardFileSchema, wordsFileSchema } from '@reelforge/shared';
import {
  SNAPSHOT_FILES,
  type CuesView,
  type FileProblem,
  type FileState,
  type ProjectSnapshot,
  type RepairableFile,
} from '../shared/snapshot-contract.js';
import { cueLabel } from '../shared/timeline-edits.js';
import { fileProblem, REPAIR_SPECS } from './file-repair.js';
import { listProjectFiles, readProjectJson } from './project-files.js';

export function cuesView(cues: CuesFile): CuesView {
  return {
    sfx: cues.sfx.map((cue) => ({ t: cue.t, label: cueLabel(cue, 'sfx'), gainDb: cue.gainDb })),
    ambience: cues.ambience.map((cue) => ({
      from: cue.from,
      to: cue.to,
      label: cueLabel(cue, 'ambience'),
      gainDb: cue.gainDb,
    })),
    music: cues.music.map((cue) => ({
      from: cue.from,
      to: cue.to,
      label: cueLabel(cue, 'music'),
      gainDb: cue.gainDb,
    })),
  };
}

function mapState<From, To>(state: FileState<From>, map: (data: From) => To): FileState<To> {
  return state.status === 'ok' ? { status: 'ok', data: map(state.data) } : state;
}

/** Files checked on their own (the documents above are checked by their read). */
const CHECKED_FILES = [
  'project.json',
  '.reelforge/pipeline.json',
  '.reelforge/sessions.json',
] as const;

function documentProblem<T>(file: RepairableFile, state: FileState<T>): FileProblem[] {
  if (state.status !== 'error') return [];
  return [{ file, message: state.error.message, fix: REPAIR_SPECS[file].fix }];
}

/** Throws only when the project folder itself is unreadable. */
export async function readProjectSnapshot(dir: string): Promise<ProjectSnapshot> {
  const [listing, storyboard, words, cues, checked] = await Promise.all([
    listProjectFiles(dir),
    readProjectJson(dir, SNAPSHOT_FILES.storyboard, storyboardFileSchema),
    readProjectJson(dir, SNAPSHOT_FILES.words, wordsFileSchema),
    readProjectJson(dir, SNAPSHOT_FILES.cues, CuesFileSchema),
    Promise.all(CHECKED_FILES.map((file) => fileProblem(dir, file))),
  ]);
  const problems = [
    ...documentProblem(SNAPSHOT_FILES.storyboard, storyboard),
    ...documentProblem(SNAPSHOT_FILES.words, words),
    ...documentProblem(SNAPSHOT_FILES.cues, cues),
    ...checked.filter((problem) => problem !== undefined),
  ];
  return {
    dir,
    files: listing.files,
    filesTruncated: listing.truncated,
    storyboard,
    words,
    cues: mapState(cues, cuesView),
    problems,
  };
}
