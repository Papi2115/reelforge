/**
 * Contact sheets for the critic and the whole-video review: the CLI's labelled grid (one row per
 * shot, tiles "<shot> <local time>"), written as PNG under `.reelforge/frames/qa/` (git-ignored,
 * readable by Claude's Read tool).
 */
import { composeSheet, type SheetRow } from '@reelforge/cli/service';
import { encodePng } from '@reelforge/engine/raster';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { writeAtomic } from '@reelforge/project';
import { inProject } from '../paths.js';
import { stageError, type StageError } from '../types.js';
import type { ShotRender } from './tools.js';

export interface SheetShot {
  readonly shotId: string;
  /** Times that were asked for (labels of failed tiles). */
  readonly times: readonly number[];
  readonly render: ShotRender;
}

export function sheetRow(shot: SheetShot): SheetRow {
  const label = (t: number): string => `${shot.shotId} ${t.toFixed(2)}s`;
  const { render } = shot;
  if (render.ok) {
    return { tiles: render.frames.map((frame) => ({ label: label(frame.t), frame: frame.image })) };
  }
  const failure = render.timedOut === true ? 'TIMED OUT' : 'FAILED TO LOAD';
  return { tiles: shot.times.map((t) => ({ label: label(t), failure })) };
}

/** Writes the sheet; returns its project-relative path. */
export async function writeContactSheet(
  projectDir: string,
  relative: string,
  title: string,
  shots: readonly SheetShot[],
): Promise<Result<string, StageError>> {
  const size = shots.map((shot) => shot.render).find((render) => render.ok) ?? {
    width: 640,
    height: 360,
  };
  const columns = Math.max(0, ...shots.map((shot) => shot.times.length));
  const sheet = composeSheet(
    {
      title,
      frameWidth: size.width,
      frameHeight: size.height,
      factor: shots.length > 1 || columns > 2 ? 2 : 1,
    },
    shots.map(sheetRow),
  );
  try {
    await writeAtomic(inProject(projectDir, relative), encodePng(sheet));
    return ok(relative);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(stageError('io', `cannot write ${relative}: ${message}`));
  }
}
