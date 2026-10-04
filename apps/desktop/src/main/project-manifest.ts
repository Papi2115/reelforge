/**
 * The preview's render manifest for the open project (PLAN.md#6.3): project.json + storyboard +
 * scene sources + timed words + project props (kit-ext/props, PLAN.md#7.4) + the decoded asset
 * pictures the scenes name (PLAN.md#12.11), inlined so the sandboxed engine never touches the
 * disk (ADR-004). With the tension map on (PLAN.md#12.22) each shot's ambient inputs carry its
 * tension; an invalid tension.json renders as if there were none (the Tension panel reports it).
 * Any reason the video cannot be built is returned as text for the preview's note.
 */
import { describeUnknown, readKitExtensions, type KitExtensionFiles } from '@reelforge/cli/service';
import { loadManifestAssets, locateAssetFfmpeg } from '@reelforge/pipeline';
import {
  ambientShotInputs,
  DIRECTIONS_FILE,
  directionsFileSchema,
  manifestDirections,
  momentRenderEffects,
  MOMENTS_FILE,
  momentsFileSchema,
  projectAmbientVariation,
  projectFileSchema,
  projectRevealMoments,
  projectTensionMap,
  renderManifestSchema,
  storyboardFileSchema,
  TENSION_FILE,
  tensionFileSchema,
  withShotTension,
  wordsFileSchema,
  type AmbientShot,
  type ProjectFile,
  type ShotMomentEffects,
  type StoryboardShot,
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

/** Ambient inputs per shot (with tension when the project uses the map), or undefined when off. */
async function ambientInputs(
  dir: string,
  project: ProjectFile,
  shots: readonly StoryboardShot[],
): Promise<AmbientShot[] | undefined> {
  if (!projectAmbientVariation(project)) return undefined;
  const inputs = ambientShotInputs(shots);
  if (projectTensionMap(project) !== 'auto') return inputs;
  const tension = await readProjectJson(dir, TENSION_FILE, tensionFileSchema);
  return tension.status === 'ok' ? withShotTension(inputs, shots, tension.data) : inputs;
}

/**
 * Slow motion and palette flashes of the accepted reveal moments per shot (PLAN.md#12.27), or
 * none when the switch is off or moments.json is missing/invalid (the panel reports it).
 */
async function momentEffects(
  dir: string,
  project: ProjectFile,
  shots: readonly StoryboardShot[],
): Promise<ReadonlyMap<string, ShotMomentEffects>> {
  if (projectRevealMoments(project) !== 'auto') return new Map();
  const moments = await readProjectJson(dir, MOMENTS_FILE, momentsFileSchema);
  return moments.status === 'ok' ? momentRenderEffects(moments.data.moments, shots) : new Map();
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
  // Ambient variation (PLAN.md#12.8): off (and the manifest unchanged) unless project.json asks.
  const ambient = await ambientInputs(dir, project.data, shots);
  const moments = await momentEffects(dir, project.data, shots);
  // Live co-direction (PLAN.md#12.14); a missing or invalid directions.json = none.
  const directionsFile = await readProjectJson(dir, DIRECTIONS_FILE, directionsFileSchema);
  const directions = manifestDirections(
    directionsFile.status === 'ok' ? directionsFile.data : undefined,
    shots,
  );
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
      ...(ambient?.[index] ? { ambient: ambient[index] } : {}),
      ...moments.get(shot.id),
      ...(directions.has(shot.id) ? { direction: directions.get(shot.id) } : {}),
    });
  }

  let props: KitExtensionFiles;
  try {
    props = await readKitExtensions(dir);
  } catch (error) {
    return unavailable(`kit-ext/props cannot be read: ${describeUnknown(error)}`);
  }
  // Asset pictures the scenes name (PLAN.md#12.11), decoded once into .reelforge/assets/decoded.
  const assets = await loadManifestAssets({
    root: dir,
    sources: [
      ...manifestShots.map((shot) => shot.scene.source),
      ...props.extensions.map((prop) => prop.source),
    ],
    ffmpeg: () => locateAssetFfmpeg(),
  });
  if (!assets.ok) return unavailable(assets.error);
  const { style, fps, seed, palette } = project.data;
  const manifest = renderManifestSchema.safeParse({
    version: 1,
    style,
    fps,
    seed,
    ...(palette ? { palette } : {}),
    ...(words.status === 'ok' ? { words: words.data } : {}),
    ...(props.extensions.length > 0 ? { kitExtensions: props.extensions } : {}),
    ...(ambient ? { ambientVariation: { enabled: true, seed } } : {}),
    ...(assets.value ? { assets: assets.value } : {}),
    shots: manifestShots,
  });
  if (!manifest.success) {
    return unavailable(`storyboard cannot be previewed: ${describeIssues(manifest.error)}`);
  }
  return { status: 'ready', manifest: manifest.data };
}
