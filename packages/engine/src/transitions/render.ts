/**
 * Renders a transition-kit frame (ADR-011): the outgoing and the incoming shot each go through the
 * full GPU post pass on their own (exactly their normal frames), are read back, and are composited
 * on the CPU by `compositeTransition`. The result is what `EngineRuntime.readFrame` returns.
 */
import type { FrameRenderer, RenderView } from '../gl/frame-renderer.js';
import { compositeTransition, type EngineTransition, type TransitionParams } from './index.js';

export interface PixelTransitionInput {
  readonly a: RenderView;
  readonly b: RenderView;
  readonly transition: EngineTransition;
  readonly progress: number;
  readonly seed: number;
}

export interface PixelTransitionRenderer {
  /** Renders and composites one frame; the returned buffer is reused by the next call. */
  render(input: PixelTransitionInput): Uint8Array<ArrayBuffer>;
}

export function createPixelTransitionRenderer(
  frameRenderer: FrameRenderer,
  params: TransitionParams,
): PixelTransitionRenderer {
  const { width, height } = frameRenderer;
  const bytes = width * height * 4;
  const frameA = new Uint8Array(bytes);
  const frameB = new Uint8Array(bytes);
  const out = new Uint8Array(bytes);
  const single = (view: RenderView, target: Uint8Array<ArrayBuffer>): void => {
    frameRenderer.render({ a: view, mode: 'single', progress: 0, seed: 0 });
    frameRenderer.readFrame(target);
  };
  return {
    render({ a, b, transition, progress, seed }) {
      single(a, frameA);
      single(b, frameB);
      return compositeTransition(
        transition.id,
        params,
        { width, height, data: frameA },
        { width, height, data: frameB },
        progress,
        seed,
        out,
      );
    },
  };
}
