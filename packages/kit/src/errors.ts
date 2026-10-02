/** Typed kit errors; messages are written for the scene author (often an LLM). */

export type KitErrorCode =
  | 'invalid-grid'
  | 'invalid-model'
  | 'invalid-color'
  | 'invalid-params'
  | 'invalid-anchor'
  | 'invalid-surface'
  | 'kit-outside-build'
  | 'invalid-extension'
  | 'unknown-definition';

export class KitError extends Error {
  readonly code: KitErrorCode;

  constructor(code: KitErrorCode, message: string) {
    super(message);
    this.name = 'KitError';
    this.code = code;
  }
}
