/**
 * Server side of the render service: turns a request about a shot into the same isolated render
 * manifest the CLI builds for its own (Playwright) renders, read from the project on disk. Scene
 * paths are confined to the project folder (`resolveInProject`).
 */
import type { RenderManifest } from '@reelforge/shared';
import { readProjectFiles } from '../project/files.js';
import {
  isolatedManifest,
  planForScene,
  planForShot,
  renderSetup,
  type ShotPlan,
} from '../project/shots.js';
import { UsageError } from '../errors.js';
import type { ShotTargetRequest } from './protocol.js';

export interface ServiceShotPlan {
  readonly plan: ShotPlan;
  readonly manifest: RenderManifest;
  readonly fps: number;
}

/**
 * The plan of `target`. A standalone scene without `duration` lasts like in `reelforge frames`:
 * max(5, last local time + 1). Throws the CLI's UsageError / ProjectError.
 */
export async function planServiceShot(
  target: Pick<ShotTargetRequest, 'projectDir' | 'shot' | 'scene' | 'duration'>,
  times: readonly number[] = [],
): Promise<ServiceShotPlan> {
  const files = await readProjectFiles(target.projectDir);
  const setup = renderSetup(files);
  let plan: ShotPlan;
  if (target.shot !== undefined) {
    plan = await planForShot(files, target.shot, target.scene);
  } else if (target.scene !== undefined) {
    plan = await planForScene(
      files,
      target.scene,
      (minimum) => target.duration ?? Math.max(minimum, Math.max(0, ...times) + 1),
    );
  } else {
    throw new UsageError('pass "shot" or "scene"');
  }
  const duration = plan.t1 - plan.t0;
  const outside = times.find((t) => t >= duration);
  if (outside !== undefined) {
    throw new UsageError(
      `time ${String(outside)} is outside shot ${plan.id} (${duration.toFixed(2)} s long; local times start at 0)`,
    );
  }
  return { plan, manifest: isolatedManifest(setup, plan), fps: setup.fps };
}
