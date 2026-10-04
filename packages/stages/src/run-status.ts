/** Stage status rules of the runner: the status a failed run leaves, and review runs. */
import type { StageRunStatus } from '@reelforge/shared';
import type { StageError, StageRequest } from './types.js';

/** Stage status after a failed run. */
export function statusAfter(error: StageError): StageRunStatus {
  switch (error.kind) {
    case 'cancelled':
      return 'idle';
    case 'limit':
      return 'paused';
    case 'blocked':
    case 'missing-tool':
      return 'blocked';
    default:
      return 'failed';
  }
}

/**
 * A scene run that reviews the built scenes (chips, final review) instead of building them, or a
 * storyboard run that only proposes the tension curve (PLAN.md#12.22): when it stops or fails,
 * the stage keeps the status it had.
 */
export function isReviewRun(request: StageRequest): boolean {
  if (request.stage === 'storyboard') return (request.action ?? 'build') !== 'build';
  return request.stage === 'scenes' && (request.action ?? 'build') !== 'build';
}
