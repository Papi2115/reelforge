/**
 * Which shots a command works on, and the render manifest for one shot. A shot is rendered on
 * its own (only its scene is built) but at its real place on the timeline: an empty padding shot
 * covers [0, t0), so seeds, local times and anchors are exactly those of the full video.
 * Transitions from the previous shot are not shown (they need both shots).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadManifestAssets, locateAssetFfmpeg } from '@reelforge/pipeline';
import {
  ambientShotInputs,
  projectAmbientVariation,
  projectTensionMap,
  withShotTension,
  type AmbientShot,
  type AmbientVariationSettings,
  type KitExtensionSource,
  type ManifestCastRoles,
  type ManifestWorldAssets,
  type NamedPalette,
  type ProjectFile,
  type RenderManifest,
  type StoryboardFile,
  type WordsFile,
} from '@reelforge/shared';
import { describeUnknown, ProjectError } from '../errors.js';
import { manifestCastRoles, NO_CAST_ROLES } from './cast-roles.js';
import type { FileCheck, ProjectFiles } from './files.js';
import { projectRelative, resolveInProject, samePath } from './paths.js';
import { manifestWorldAssets } from './world-assets.js';

export interface RenderSetup {
  /** Project folder. */
  readonly root: string;
  readonly style: string;
  readonly fps: number;
  readonly seed: number;
  readonly palette: NamedPalette | undefined;
  /** Timed words for `ctx.anchor` (absent before the "Words timed" stage). */
  readonly words: WordsFile | undefined;
  /** Project props (`kit-ext/props/*.js`), registered in every shot. */
  readonly kitExtensions: readonly KitExtensionSource[];
  /** Project roles (`characters/`, ADR-026); undefined without any. */
  readonly castRoles?: ManifestCastRoles | undefined;
  /** Ambient variation switch (PLAN.md#12.8); absent when the project has it off. */
  readonly ambientVariation?: AmbientVariationSettings | undefined;
  /** World asset files (PLAN.md#13.15); undefined outside a world or without any. */
  readonly worldAssets?: ManifestWorldAssets | undefined;
}

export interface ShotPlan {
  readonly id: string;
  /** Global start/end (seconds). */
  readonly t0: number;
  readonly t1: number;
  /** Project-relative scene path (forward slashes). */
  readonly file: string;
  readonly source: string;
  /** True for a scene that is not in storyboard.json (rendered from t = 0). */
  readonly standalone: boolean;
  /** Storyboard position for ambient variation (storyboard shots only). */
  readonly ambient?: AmbientShot | undefined;
}

const MIN_STANDALONE_DURATION = 5;

const PAD_SCENE_SOURCE = `export const meta = { id: 'pad' };
export function build() {
  return null;
}
export function update() {}
`;

function invalidFix(file: string): string {
  return `run \`reelforge validate\` and fix ${file} first`;
}

function required<T>(check: FileCheck<T>, missingFix: string): T {
  if (check.status === 'ok') return check.data;
  if (check.status === 'missing') {
    throw new ProjectError(`${check.file} is missing in this folder`, missingFix);
  }
  throw new ProjectError(`${check.file} is invalid`, invalidFix(check.file));
}

export function requireProject(files: ProjectFiles): ProjectFile {
  return required(
    files.project,
    'run reelforge inside the video project folder (the one with project.json)',
  );
}

export function requireStoryboard(files: ProjectFiles): StoryboardFile {
  return required(files.storyboard, 'the Storyboard stage has not run yet; write storyboard.json');
}

/**
 * Render settings of the project. `withoutWords`: renders that never resolve anchors (a prop
 * turntable) work before "Words timed" and with a broken words file.
 */
export function renderSetup(
  files: ProjectFiles,
  options: { readonly withoutWords?: boolean } = {},
): RenderSetup {
  const project = requireProject(files);
  if (files.words.status === 'invalid' && options.withoutWords !== true) {
    throw new ProjectError(`${files.words.file} is invalid`, invalidFix(files.words.file));
  }
  const words =
    files.words.status === 'ok' && options.withoutWords !== true
      ? {
          version: 1 as const,
          words: files.words.data.words.map(({ text, t, tEnd, confidence, status }) => ({
            text,
            t,
            tEnd,
            confidence,
            status,
          })),
        }
      : undefined;
  return {
    root: files.root,
    style: project.style,
    fps: project.fps,
    seed: project.seed,
    palette: project.palette,
    words,
    kitExtensions: files.kitExtensions.extensions,
    castRoles: manifestCastRoles(files.castRoles ?? NO_CAST_ROLES),
    worldAssets: manifestWorldAssets(files.worldAssets),
    ...(projectAmbientVariation(project)
      ? { ambientVariation: { enabled: true, seed: project.seed } }
      : {}),
  };
}

async function readScene(root: string, scene: string): Promise<{ file: string; source: string }> {
  const absolute = resolveInProject(root, scene, 'scene');
  try {
    return { file: projectRelative(root, absolute), source: await readFile(absolute, 'utf8') };
  } catch (error) {
    throw new ProjectError(
      `cannot read scene file ${projectRelative(root, absolute)} (${describeUnknown(error)})`,
      'check the path (it is relative to the project folder) or write the scene first',
    );
  }
}

function unknownShot(id: string, storyboard: StoryboardFile): ProjectError {
  const ids = storyboard.shots.map((shot) => shot.id).join(', ');
  return new ProjectError(`unknown shot "${id}"`, `use one of the storyboard shot ids: ${ids}`);
}

/**
 * Ambient inputs of the storyboard shots, with each shot's tension when the project uses the
 * tension map (PLAN.md#12.22) and tension.json is valid.
 */
export function storyboardAmbient(files: ProjectFiles, storyboard: StoryboardFile): AmbientShot[] {
  const inputs = ambientShotInputs(storyboard.shots);
  const { project, tension } = files;
  if (project.status !== 'ok' || projectTensionMap(project.data) !== 'auto') return inputs;
  return tension?.status === 'ok'
    ? withShotTension(inputs, storyboard.shots, tension.data)
    : inputs;
}

export async function planForShot(
  files: ProjectFiles,
  id: string,
  scene?: string,
): Promise<ShotPlan> {
  const storyboard = requireStoryboard(files);
  const index = storyboard.shots.findIndex((candidate) => candidate.id === id);
  const shot = storyboard.shots[index];
  if (!shot) throw unknownShot(id, storyboard);
  const { file, source } = await readScene(files.root, scene ?? shot.scene);
  const ambient = storyboardAmbient(files, storyboard)[index];
  return { id: shot.id, t0: shot.t0, t1: shot.t1, file, source, standalone: false, ambient };
}

export async function allShotPlans(files: ProjectFiles): Promise<ShotPlan[]> {
  const storyboard = requireStoryboard(files);
  return Promise.all(storyboard.shots.map((shot) => planForShot(files, shot.id)));
}

/** Shot id for a scene outside the storyboard: its file name, made id-safe. */
export function standaloneShotId(file: string): string {
  const base = path.basename(file, path.extname(file)).toLowerCase();
  const safe = base.replace(/[^a-z0-9_-]+/g, '-').replace(/^[^a-z0-9]+/, '');
  return safe === '' ? 'scene' : safe;
}

/**
 * The storyboard shot that uses `scene`, or a standalone plan starting at 0 when no shot does
 * (a scene drafted before the storyboard lists it).
 */
export async function planForScene(
  files: ProjectFiles,
  scene: string,
  standaloneDuration: (minimum: number) => number,
): Promise<ShotPlan> {
  const absolute = resolveInProject(files.root, scene, '--scene');
  if (files.storyboard.status === 'ok') {
    const shot = files.storyboard.data.shots.find((candidate) =>
      samePath(path.resolve(files.root, candidate.scene), absolute),
    );
    if (shot) return planForShot(files, shot.id);
  }
  const { file, source } = await readScene(files.root, scene);
  return {
    id: standaloneShotId(file),
    t0: 0,
    t1: standaloneDuration(MIN_STANDALONE_DURATION),
    file,
    source,
    standalone: true,
  };
}

/** Manifest that builds only `plan`'s scene, at its real place on the timeline. */
export function isolatedManifest(setup: RenderSetup, plan: ShotPlan): RenderManifest {
  const pad =
    plan.t0 > 0
      ? [
          {
            id: `pad-${plan.id}`,
            t0: 0,
            t1: plan.t0,
            scene: { file: 'reelforge/padding.js', source: PAD_SCENE_SOURCE },
          },
        ]
      : [];
  return {
    version: 1,
    style: setup.style,
    fps: setup.fps,
    seed: setup.seed,
    ...(setup.palette ? { palette: setup.palette } : {}),
    ...(setup.words ? { words: setup.words } : {}),
    ...(setup.kitExtensions.length > 0 ? { kitExtensions: [...setup.kitExtensions] } : {}),
    ...(setup.castRoles === undefined ? {} : { castRoles: setup.castRoles }),
    ...(setup.worldAssets === undefined ? {} : { worldAssets: setup.worldAssets }),
    // Only storyboard shots vary: a standalone scene (a prop turntable, a draft the storyboard
    // does not list yet) has no storyboard position and renders neutral, so the camera drift
    // cannot make one view differ from itself at another time.
    ...(setup.ambientVariation && plan.ambient ? { ambientVariation: setup.ambientVariation } : {}),
    shots: [
      ...pad,
      {
        id: plan.id,
        t0: plan.t0,
        t1: plan.t1,
        scene: { file: plan.file, source: plan.source },
        ...(setup.ambientVariation && plan.ambient ? { ambient: plan.ambient } : {}),
      },
    ],
  };
}

/**
 * `manifest` plus the decoded asset pictures its scenes and project props name (PLAN.md#12.11);
 * unchanged when they name none. Decoding needs ffmpeg once per picture (cached in
 * .reelforge/assets/decoded).
 */
export async function withManifestAssets(
  root: string,
  manifest: RenderManifest,
): Promise<RenderManifest> {
  const assets = await loadManifestAssets({
    root,
    sources: [
      ...manifest.shots.map((shot) => shot.scene.source),
      ...(manifest.kitExtensions ?? []).map((prop) => prop.source),
    ],
    ffmpeg: () => locateAssetFfmpeg(),
  });
  if (!assets.ok) {
    throw new ProjectError(
      assets.error,
      'check `reelforge assets list` and the files in .reelforge/assets; decoding needs ffmpeg (install it or set REELFORGE_FFMPEG)',
    );
  }
  return assets.value ? { ...manifest, assets: assets.value } : manifest;
}
