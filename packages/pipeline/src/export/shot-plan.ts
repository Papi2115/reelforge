/**
 * Splits the video's frame sequence into per-shot runs. Frame `i` shows global time `i / fps`;
 * a shot [t0, t1) owns frames round(t0*fps) .. round(t1*fps)-1, so consecutive shots tile the
 * video without gaps or overlaps.
 */
import type { ManifestShot, RenderManifest } from '@reelforge/shared';

export interface PlannedShot {
  readonly index: number;
  readonly shot: ManifestShot;
  /** The previous shot when this one transitions in from it (its frames show both). */
  readonly incoming: ManifestShot | null;
  /** First frame index (inclusive) and end (exclusive), in global frames. */
  readonly startFrame: number;
  readonly endFrame: number;
}

export interface ShotPlan {
  readonly fps: number;
  readonly totalFrames: number;
  readonly durationS: number;
  /** Shots with at least one frame, in manifest order. */
  readonly shots: readonly PlannedShot[];
}

export function frameTime(frameIndex: number, fps: number): number {
  return frameIndex / fps;
}

export function planShots(manifest: RenderManifest): ShotPlan {
  const fps = manifest.fps;
  const planned: PlannedShot[] = [];
  manifest.shots.forEach((shot, index) => {
    const startFrame = Math.round(shot.t0 * fps);
    const endFrame = Math.round(shot.t1 * fps);
    if (endFrame <= startFrame) return;
    const previous = index > 0 ? manifest.shots[index - 1] : undefined;
    const transitions = shot.transitionIn !== undefined && shot.transitionIn.type !== 'cut';
    planned.push({
      index,
      shot,
      incoming: transitions && previous !== undefined ? previous : null,
      startFrame,
      endFrame,
    });
  });
  const totalFrames = planned.at(-1)?.endFrame ?? 0;
  return { fps, totalFrames, durationS: totalFrames / fps, shots: planned };
}

/** The planned shot whose frames contain global time `t` (clamped to the video). */
export function shotAtTime(plan: ShotPlan, t: number): PlannedShot | undefined {
  const frame = Math.min(Math.max(Math.floor(t * plan.fps), 0), Math.max(plan.totalFrames - 1, 0));
  return plan.shots.find((planned) => frame >= planned.startFrame && frame < planned.endFrame);
}
