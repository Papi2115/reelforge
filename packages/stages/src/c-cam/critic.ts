/**
 * The Grim Ink scene critic (PLAN.md#14.19): prototype fidelity needs a stronger eye than the
 * general Haiku critic. For a `c-cam` scene the critic turn runs at least on Sonnet, reads two
 * reference frames of the shot's look (authored frames of the concept films, packages/stages/
 * assets/c-cam-reference, copied into the project's QA folder so the read-only critic can open
 * them), reviews at least three times per framing of the cut table (framing-times.ts) and the
 * shot gets at least two fix turns, also with Faster checks. Other worlds and styles: unchanged.
 * Without the reference files (a packaged app that does not ship them) the critic runs without
 * references: the CI-safe fallback.
 */
import { existsSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { ModelAlias } from '@reelforge/claude-bridge';
import { C_CAM_ID, type World } from '@reelforge/kit';
import type { AnchorIndex } from '@reelforge/pipeline';
import type { StoryboardShot } from '@reelforge/shared';
import { FILES, inProject } from '../paths.js';
import type { SceneSettings } from '../settings.js';
import { framingQaTimes, type LocalAnchor } from './framing-times.js';

/** The world's critic policy. */
export const C_CAM_CRITIC = {
  /** The critic model at least (the app's setting wins when it is stronger). */
  minModel: 'sonnet' satisfies ModelAlias,
  /** Fix turns per shot at least (Faster checks would lower it to 1). */
  minFixIterations: 2,
  /** Reference frames per look given to the critic. */
  referencesPerLook: 2,
} as const;

/** The world's looks with reference frames (`<look>-1.png`, `<look>-2.png`). */
const REFERENCE_LOOKS: readonly string[] = ['ink-scene', 'ink-insert', 'ink-poster'];

/** Where the repository keeps the reference frames (src and dist alike: ../../assets). */
export const C_CAM_REFERENCE_DIR = fileURLToPath(
  new URL('../../assets/c-cam-reference/', import.meta.url),
);

/** Project-relative folder the critic reads the references from. */
export const C_CAM_REFERENCE_QA_DIR = `${FILES.qaFramesDir}/reference`;

export const isCCam = (world: Pick<World, 'id'> | undefined): boolean => world?.id === C_CAM_ID;

/** Scene settings of a Grim Ink project: at least two fix turns; others unchanged. */
export function worldSceneSettings(
  settings: SceneSettings,
  world: Pick<World, 'id'> | undefined,
): SceneSettings {
  if (!isCCam(world) || settings.maxFixIterations >= C_CAM_CRITIC.minFixIterations) {
    return settings;
  }
  return { ...settings, maxFixIterations: C_CAM_CRITIC.minFixIterations };
}

/** The critic turn's model floor (undefined outside the world). */
export function criticMinModel(world: Pick<World, 'id'> | undefined): ModelAlias | undefined {
  return isCCam(world) ? C_CAM_CRITIC.minModel : undefined;
}

/**
 * Copies the look's reference frames into the project's QA folder and returns their
 * project-relative paths for the critic prompt (`referencePaths`); {} outside the world, for a
 * look without references or when the files are not there.
 */
export async function criticReferenceVars(
  projectDir: string,
  world: Pick<World, 'id'> | undefined,
  lookId: string | undefined,
  sourceDir: string = C_CAM_REFERENCE_DIR,
): Promise<Record<string, string>> {
  const look = lookId ?? 'ink-scene';
  if (!isCCam(world) || !REFERENCE_LOOKS.includes(look)) return {};
  const names = Array.from(
    { length: C_CAM_CRITIC.referencesPerLook },
    (_, index) => `${look}-${String(index + 1)}.png`,
  ).filter((name) => existsSync(path.join(sourceDir, name)));
  if (names.length === 0) return {};
  await mkdir(inProject(projectDir, C_CAM_REFERENCE_QA_DIR), { recursive: true });
  const paths: string[] = [];
  for (const name of names) {
    const relative = `${C_CAM_REFERENCE_QA_DIR}/${name}`;
    await copyFile(path.join(sourceDir, name), inProject(projectDir, relative));
    paths.push(relative);
  }
  return { referencePaths: paths.join(', ') };
}

/** Local seconds of a phrase in the shot (the occurrence spoken in it, else the nth overall). */
export function shotLocalAnchor(
  index: AnchorIndex | undefined,
  shot: Pick<StoryboardShot, 't0' | 't1'>,
): LocalAnchor {
  return (phrase, nth) => {
    if (index === undefined) return undefined;
    const all = index.occurrences(phrase);
    const inShot = all.filter((match) => match.t >= shot.t0 - 0.15 && match.t < shot.t1);
    const match = inShot[nth - 1] ?? all[nth - 1];
    return match === undefined ? undefined : match.t - shot.t0;
  };
}

/** QA sample times: three per framing in the world, `smoke` elsewhere. */
export function worldQaTimes(input: {
  readonly world: Pick<World, 'id'> | undefined;
  readonly source: string;
  readonly shot: Pick<StoryboardShot, 't0' | 't1'>;
  readonly anchors: AnchorIndex | undefined;
  readonly smoke: readonly number[];
}): number[] {
  const { world, source, shot, anchors, smoke } = input;
  if (!isCCam(world)) return [...smoke];
  return framingQaTimes(source, shot.t1 - shot.t0, shotLocalAnchor(anchors, shot), smoke);
}
