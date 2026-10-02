/**
 * One engine renderer as seen from main: the hidden render window (render-window.ts) in the app,
 * fakes in unit tests. The pool, the export FrameSource and the render service only use this
 * interface, so they are tested without Electron.
 */
import type { Result } from '@reelforge/claude-bridge';
import type { CardDiagnostic, LoadInfo } from '@reelforge/engine';
import type { RenderManifest } from '@reelforge/shared';

export type RenderErrorKind =
  /** The engine rejected the call (broken scene, lint, invalid manifest): a result, not a crash. */
  | 'engine'
  /** The window's renderer process died or the window closed mid-call. */
  | 'crashed'
  | 'timeout'
  | 'closed'
  /** Window could not be created/loaded, or sent a malformed reply. */
  | 'protocol';

export interface RenderError {
  readonly kind: RenderErrorKind;
  readonly message: string;
  /** Engine error code (`scene-lint`, `scene-build`, ...) for kind `engine`. */
  readonly code?: string;
}

export interface RenderTarget {
  /** Loads a whole video (replacing the previous one). */
  load(manifest: RenderManifest): Promise<Result<LoadInfo, RenderError>>;
  /** Renders global time `t` of the loaded video: RGBA8, top-down, width*height*4 bytes. */
  frame(t: number): Promise<Result<Uint8Array, RenderError>>;
  /** Text-card QA of one loaded shot. */
  cards(shotId: string): Promise<Result<readonly CardDiagnostic[], RenderError>>;
  /** Console errors (page and engine frame) since the last call, then forgets them. */
  takeConsoleErrors(): string[];
  /** False once the window is closed or its renderer died. */
  readonly alive: boolean;
  /** Closes the window (graceful close, awaited); safe to call more than once. */
  close(): Promise<void>;
}

export type OpenRenderTarget = () => Promise<Result<RenderTarget, RenderError>>;

/** True for errors after which the target must not be reused. */
export function isFatalRenderError(error: RenderError): boolean {
  return error.kind !== 'engine';
}
