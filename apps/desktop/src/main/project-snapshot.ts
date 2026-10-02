/**
 * What the main layout shows of the open project (PLAN.md#6.3): the file listing (pipeline stage
 * status is computed from it in the renderer) and storyboard / words / cues, each validated with
 * the schema its writer uses (shared for storyboard and words, the pipeline's for cues).
 */
import { CuesFileSchema, type CuesFile } from '@reelforge/pipeline';
import { storyboardFileSchema, wordsFileSchema } from '@reelforge/shared';
import {
  SNAPSHOT_FILES,
  type CuesView,
  type FileState,
  type ProjectSnapshot,
} from '../shared/snapshot-contract.js';
import { cueLabel } from '../shared/timeline-edits.js';
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

/** Throws only when the project folder itself is unreadable. */
export async function readProjectSnapshot(dir: string): Promise<ProjectSnapshot> {
  const [listing, storyboard, words, cues] = await Promise.all([
    listProjectFiles(dir),
    readProjectJson(dir, SNAPSHOT_FILES.storyboard, storyboardFileSchema),
    readProjectJson(dir, SNAPSHOT_FILES.words, wordsFileSchema),
    readProjectJson(dir, SNAPSHOT_FILES.cues, CuesFileSchema),
  ]);
  return {
    dir,
    files: listing.files,
    filesTruncated: listing.truncated,
    storyboard,
    words,
    cues: mapState(cues, cuesView),
  };
}
