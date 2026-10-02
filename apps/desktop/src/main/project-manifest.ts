/**
 * The preview's render manifest for the open project (PLAN.md#6.3): project.json + storyboard +
 * scene sources + timed words, inlined so the sandboxed engine never touches the disk (ADR-004).
 * Any reason the video cannot be built is returned as text for the preview's note.
 */
import {
  projectFileSchema,
  renderManifestSchema,
  storyboardFileSchema,
  wordsFileSchema,
} from '@reelforge/shared';
import {
  SNAPSHOT_FILES,
  type FileState,
  type ProjectManifestResult,
} from '../shared/snapshot-contract.js';
import { describeIssues, readProjectJson, readProjectText } from './project-files.js';

function unavailable(reason: string): ProjectManifestResult {
  return { status: 'unavailable', reason };
}

function stateProblem(state: FileState<unknown>, file: string): string | undefined {
  if (state.status === 'error') return state.error.message;
  if (state.status === 'missing') return `${file} is missing`;
  return undefined;
}

export async function buildProjectManifest(dir: string): Promise<ProjectManifestResult> {
  const [project, storyboard, words] = await Promise.all([
    readProjectJson(dir, SNAPSHOT_FILES.project, projectFileSchema),
    readProjectJson(dir, SNAPSHOT_FILES.storyboard, storyboardFileSchema),
    readProjectJson(dir, SNAPSHOT_FILES.words, wordsFileSchema),
  ]);
  if (storyboard.status === 'missing') return { status: 'no-storyboard' };
  if (project.status !== 'ok') {
    return unavailable(stateProblem(project, SNAPSHOT_FILES.project) ?? 'project.json');
  }
  if (storyboard.status === 'error') return unavailable(storyboard.error.message);
  if (words.status === 'error') return unavailable(words.error.message);

  const shots = storyboard.data.shots;
  const sources = await Promise.all(shots.map((shot) => readProjectText(dir, shot.scene)));
  const manifestShots = [];
  for (const [index, shot] of shots.entries()) {
    const source = sources[index];
    if (source?.status !== 'ok') {
      const problem = source ? stateProblem(source, shot.scene) : undefined;
      return unavailable(`shot ${shot.id}: ${problem ?? `${shot.scene} is missing`}`);
    }
    manifestShots.push({
      id: shot.id,
      t0: shot.t0,
      t1: shot.t1,
      ...(shot.transitionIn ? { transitionIn: shot.transitionIn } : {}),
      scene: { file: shot.scene, source: source.data },
    });
  }

  const { style, fps, seed, palette } = project.data;
  const manifest = renderManifestSchema.safeParse({
    version: 1,
    style,
    fps,
    seed,
    ...(palette ? { palette } : {}),
    ...(words.status === 'ok' ? { words: words.data } : {}),
    shots: manifestShots,
  });
  if (!manifest.success) {
    return unavailable(`storyboard cannot be previewed: ${describeIssues(manifest.error)}`);
  }
  return { status: 'ready', manifest: manifest.data };
}
