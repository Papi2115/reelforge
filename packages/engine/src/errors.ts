/** Typed engine errors. Messages are written to be actionable for the scene author (often an LLM). */

export const ENGINE_ERROR_CODES = [
  'invalid-manifest',
  'not-loaded',
  'scene-import',
  'kit-extension',
  'scene-contract',
  'scene-lint',
  'scene-build',
  'scene-update',
  'anchor-not-found',
  'sfx-outside-build',
  'text-outside-update',
  'invalid-text-options',
  'annotate-outside-update',
  'invalid-annotation-options',
  'camera-move-outside-update',
  'invalid-camera-move',
  'asset-not-found',
  'assets-outside-build',
  'invalid-asset-options',
  'webgl',
  'protocol',
] as const;
export type EngineErrorCode = (typeof ENGINE_ERROR_CODES)[number];

export interface EngineErrorData {
  readonly code: EngineErrorCode;
  readonly message: string;
  readonly shotId?: string;
}

export class EngineError extends Error {
  readonly code: EngineErrorCode;
  readonly shotId: string | undefined;
  /** Message without the shot prefix (what crosses the sandbox boundary). */
  readonly detail: string;

  constructor(
    code: EngineErrorCode,
    message: string,
    options: { shotId?: string; cause?: unknown } = {},
  ) {
    super(options.shotId === undefined ? message : `[shot ${options.shotId}] ${message}`, {
      cause: options.cause,
    });
    this.name = 'EngineError';
    this.code = code;
    this.shotId = options.shotId;
    this.detail = message;
  }

  toData(): EngineErrorData {
    return this.shotId === undefined
      ? { code: this.code, message: this.detail }
      : { code: this.code, message: this.detail, shotId: this.shotId };
  }
}

/** Human-readable description of an unknown thrown value. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
