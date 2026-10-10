/**
 * Test support: loads the ORIGINAL classic scripts (core.js + brushes.js of film 3, kept in
 * docs/concepts/c-cam-style, plus any `extra` engine scripts such as face.js, grime.js, poses.js)
 * into a `node:vm` context so ported code can be compared with them output for output. Never
 * imported by production code.
 */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { RecordingPaint } from './recording-paint.js';

const JS_DIR = fileURLToPath(
  new URL('../../../../../../docs/concepts/c-cam-style/films/03-apollo-11/js/', import.meta.url),
);

/** Loosely typed view of the original `window.ST` (a test oracle, not an API). */
export type OriginalST = Record<string, (...args: never[]) => unknown> & {
  LW: number;
  camZ: number;
  C: Record<string, string>;
  ease: Record<string, (x: number) => number>;
  W: number;
  H: number;
  FPS: number;
  ANIM: number;
};

export function loadOriginal(extra: readonly string[] = []): OriginalST {
  const sandbox: { window: { ST?: OriginalST } } = { window: {} };
  for (const file of ['core.js', 'brushes.js', ...extra]) {
    runInNewContext(readFileSync(`${JS_DIR}${file}`, 'utf8'), sandbox);
  }
  const st = sandbox.window.ST;
  if (!st) throw new Error('original core.js did not define window.ST');
  return st;
}

/**
 * A `RecordingPaint` the original scripts can draw into: `face.js` calls `ctx.arc`, which
 * `Paint2D` lacks; the shim records it as the identical full-circle `ellipse` the port draws.
 */
export class LegacyRecordingPaint extends RecordingPaint {
  arc(x: number, y: number, r: number, start: number, end: number, anticlockwise = false): void {
    this.ellipse(x, y, r, r, 0, start, end, anticlockwise);
  }
}
