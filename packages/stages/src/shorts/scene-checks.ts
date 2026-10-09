/**
 * Scenes of a SHORT (PLAN.md#13.18): what the scene stage knows about the short (loaded once per
 * run; a film: undefined, so every film check and prompt stays as before), the build prompt's
 * short section, and the short's own QA: a scene must never be a copy of one of the parent film's
 * scenes (an error: the fix turn writes a new one), and a shot must not go more than
 * SHORT_MAX_STILL_S without a registered beat (a warning: retention editing).
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { sceneBuildShortVars } from '@reelforge/prompts';
import {
  isEndCardShot,
  isShort,
  videoFormatOf,
  type ProjectFile,
  type QaFinding,
  type ShortLength,
  type StoryboardShot,
  type VideoFormat,
} from '@reelforge/shared';
import { finding } from '../scenes/checks.js';
import type { ShotRenderOk } from '../scenes/tools.js';

/** Longest stretch of a short's shot without a registered beat before QA warns (s). */
export const SHORT_MAX_STILL_S = 3;

export interface ShortSceneSetup {
  readonly lengthS: ShortLength;
  readonly format: VideoFormat;
  readonly endCardText: string;
  readonly captions: boolean;
  readonly parentTitle: string;
  /** sha256 of every scene of the parent film (line endings normalized) → its file name. */
  readonly parentScenes: ReadonlyMap<string, string>;
}

/** sha256 of a scene source with LF line endings (a copy saved with CRLF is still a copy). */
export function sceneHash(source: string): string {
  return createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex');
}

/** Hashes of the `.js` files in `<parent>/scenes` (none when the folder is gone). */
export async function parentSceneHashes(parentFolder: string): Promise<Map<string, string>> {
  const dir = path.join(parentFolder, 'scenes');
  const hashes = new Map<string, string>();
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return hashes; // the film was moved or has no scenes yet: nothing a scene could copy
  }
  for (const name of names.filter((entry) => entry.endsWith('.js')).sort()) {
    try {
      hashes.set(sceneHash(await readFile(path.join(dir, name), 'utf8')), `scenes/${name}`);
    } catch {
      continue; // a file that cannot be read cannot be copied either
    }
  }
  return hashes;
}

/** The short's scene setup; undefined for a film. */
export async function loadShortScenes(project: ProjectFile): Promise<ShortSceneSetup | undefined> {
  if (!isShort(project)) return undefined;
  const parent = project.parentProject;
  return {
    lengthS: project.short.lengthS,
    format: videoFormatOf(project),
    endCardText: project.short.endCardText,
    captions: project.short.captions,
    parentTitle: parent?.title ?? project.title,
    parentScenes: parent === undefined ? new Map() : await parentSceneHashes(parent.folder),
  };
}

/** The scene-build prompt's short section; a film: none (the prompt exactly as before). */
export function sceneShortPromptVars(setup: ShortSceneSetup | undefined): Record<string, unknown> {
  if (setup === undefined) return {};
  return sceneBuildShortVars({
    lengthS: setup.lengthS,
    parentTitle: setup.parentTitle,
    captions: setup.captions,
  });
}

/** An error when the scene is byte for byte a scene of the parent film. */
export function shortCopyFindings(
  setup: ShortSceneSetup | undefined,
  source: string,
  file: string,
): QaFinding[] {
  const copied = setup?.parentScenes.get(sceneHash(source));
  if (copied === undefined) return [];
  return [
    finding(
      'scene',
      'error',
      `${file} is a copy of ${copied} of the full film "${setup?.parentTitle ?? ''}": every scene of a short is new (its props and characters may be reused). Build a new scene for this shot.`,
    ),
  ];
}

/** Local times of the beats a scene registered (sfx cues and anchors) inside the shot. */
function beatTimes(shot: StoryboardShot, render: ShotRenderOk): number[] {
  const duration = shot.t1 - shot.t0;
  return [...render.cues, ...render.anchors]
    .filter((event) => event.shotId === shot.id)
    .map((event) => event.t - shot.t0)
    .filter((t) => t > 0 && t < duration);
}

/** A warning when a short's shot holds longer than SHORT_MAX_STILL_S without a beat. */
export function shortMotionFindings(
  setup: ShortSceneSetup | undefined,
  shot: StoryboardShot,
  render: ShotRenderOk,
): QaFinding[] {
  if (setup === undefined || isEndCardShot(shot)) return [];
  const duration = shot.t1 - shot.t0;
  if (duration <= SHORT_MAX_STILL_S) return [];
  const points = [0, ...beatTimes(shot, render).sort((a, b) => a - b), duration];
  let gap = { from: 0, to: 0 };
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1] ?? 0;
    const to = points[index] ?? 0;
    if (to - from > gap.to - gap.from) gap = { from, to };
  }
  if (gap.to - gap.from <= SHORT_MAX_STILL_S) return [];
  return [
    finding(
      'scene',
      'warning',
      `${shot.id}: no visual event for ${(gap.to - gap.from).toFixed(1)} s (t ${gap.from.toFixed(1)}–${gap.to.toFixed(1)} s); a short needs one every 1.5–3 s (a punch-in, an object swap, a count-up), each on a beat (ctx.anchor or ctx.sfx.at)`,
      { t: gap.from },
    ),
  ];
}
