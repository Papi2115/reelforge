/**
 * The stage canvas behind a frame's drawing surface (PLAN.md#14.18): the stage registers its raw
 * 2D context for the `Paint2D` surface it hands the painter, so `ink.text` (scenes and project
 * modules alike) can letter with the role's system font on the same canvas, under the same
 * transform, without the context ever reaching scene or module code. A surface without a
 * registered context (Node, tests, a recording) always uses the CC0 lettering fallback.
 */
import type { Paint2D } from '../draw/paint.js';
import type { TextTarget } from './ink-text.js';

const TARGETS = new WeakMap<Paint2D, TextTarget>();

/** Registers the canvas context that `surface` draws on. */
export function bindTextTarget(surface: Paint2D, target: TextTarget): void {
  TARGETS.set(surface, target);
}

/** The canvas context behind `surface`, if the stage registered one. */
export function textTargetOf(surface: Paint2D): TextTarget | undefined {
  return TARGETS.get(surface);
}
