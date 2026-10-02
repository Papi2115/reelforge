/** Frame renderer call as a Result: a rejection (renderer down) becomes a `tool` stage error. */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { stageError, type StageError } from '../types.js';
import type { FrameRenderer, ShotRender, ShotRenderRequest } from './tools.js';

export async function renderShot(
  frames: FrameRenderer,
  request: ShotRenderRequest,
  signal: AbortSignal,
): Promise<Result<ShotRender, StageError>> {
  try {
    return ok(await frames.renderShot(request, signal));
  } catch (error) {
    if (signal.aborted) return err(stageError('cancelled', 'cancelled'));
    const message = error instanceof Error ? error.message : String(error);
    return err(stageError('tool', `the frame renderer is not available: ${message}`));
  }
}
