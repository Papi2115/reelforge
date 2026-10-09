/**
 * The end card shot of a SHORT in "Scenes built" (PLAN.md#13.18): the app writes its scene from
 * the template (end-card-scene.ts) instead of a Claude turn, then QA's it by code only: the
 * regular checks (lint, render, blank, cards, safe area) plus phone legibility, no critic and no
 * fix turn (nothing to ask Claude: a finding stays in the report as ⚠/✗).
 */
import type { Result } from '@reelforge/claude-bridge';
import { findStylePreset } from '@reelforge/engine';
import {
  isEndCardShot,
  orientFrameSize,
  type ShotBuildRecord,
  type StoryboardShot,
  type VideoFormat,
} from '@reelforge/shared';
import { writeProjectText } from '../files.js';
import { legibilityCheck } from '../scenes/final-checks.js';
import type { SceneJob } from '../scenes/job.js';
import { refineShot } from '../scenes/shot-job.js';
import type { StageError } from '../types.js';
import { endCardSceneSource } from './end-card-scene.js';

/** Frame width of `styleId` in `format` (the legibility rule scales with it). */
export function endCardFrameWidth(styleId: string, format: VideoFormat): number {
  const preset = findStylePreset(styleId);
  if (preset === undefined) return format === 'portrait' ? 360 : 640;
  return orientFrameSize(preset.resolution, format).width;
}

/** Whether this shot is a short's end card the app builds (a film has none). */
export function isAppEndCard(job: SceneJob, shot: StoryboardShot): boolean {
  return job.short !== undefined && isEndCardShot(shot);
}

/** Writes the end card scene and checks it by code; never runs a Claude turn. */
export async function buildEndCard(
  job: SceneJob,
  shot: StoryboardShot,
): Promise<Result<ShotBuildRecord, StageError>> {
  const short = job.short;
  const format = short?.format ?? 'landscape';
  job.ctx.step(`${shot.id}: writing the end card`);
  const source = endCardSceneSource({ shot, text: short?.endCardText ?? '', format });
  const written = await writeProjectText(job.ctx.projectDir, shot.scene, source);
  if (!written.ok) return written;
  const checks: SceneJob = {
    ...job,
    settings: { ...job.settings, critic: false, maxFixIterations: 0 },
  };
  return refineShot(checks, shot, {
    label: 'build',
    notes: ['end card written by the app (no Claude turn)'],
    extraChecks: legibilityCheck(job, shot, endCardFrameWidth(job.styleId, format)),
  });
}
