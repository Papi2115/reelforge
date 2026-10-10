/**
 * Test support: loads the ORIGINAL classic scripts (core.js + brushes.js of film 3, kept in
 * docs/concepts/c-cam-style) into a `node:vm` context so ported code can be compared with them
 * output for output. Never imported by production code.
 */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

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

export function loadOriginal(): OriginalST {
  const sandbox: { window: { ST?: OriginalST } } = { window: {} };
  for (const file of ['core.js', 'brushes.js']) {
    runInNewContext(readFileSync(`${JS_DIR}${file}`, 'utf8'), sandbox);
  }
  const st = sandbox.window.ST;
  if (!st) throw new Error('original core.js did not define window.ST');
  return st;
}
