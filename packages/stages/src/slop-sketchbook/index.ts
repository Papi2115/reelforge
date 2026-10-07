/**
 * Sketchbook source guards from real runs Sketchbook 3 and 4 (warnings, the anti-slop layer):
 * pop-up intents that describe a motion or a subject the card does not have, the red pen used for
 * labels, too often, or to strike an invented word, camera moves that do nothing on a page, and a
 * pop-up opening under the shot's page transition. `sketchbookSourceChecks` and
 * `sketchbookShotChecks` have the shapes of `WorldSlopSpec.sourceChecks` / `shotChecks`
 * (slop/world-labels.ts), where the Sketchbook spec wires them.
 */
import type { AnyNode } from 'acorn';
import type { QaFinding, Transition } from '@reelforge/shared';
import type { Vocabulary } from '../slop/vocabulary.js';
import { pageCameraFindings, popupEntryFindings } from './page-camera.js';
import { popupClaimFindings } from './popup-claim.js';
import { redInkFindings } from './red-ink.js';

export { POPUP_MOTIONS, popupClaimFindings } from './popup-claim.js';
export { MAX_RED_MARKS, redInkFindings } from './red-ink.js';
export { pageCameraFindings, popupEntryFindings } from './page-camera.js';
export { diagramNumberTexts } from './diagram-numbers.js';

/** Every Sketchbook-only source check of one scene. */
export function sketchbookSourceChecks(
  program: AnyNode,
  file: string,
  vocabulary: Vocabulary,
): QaFinding[] {
  return [
    ...popupClaimFindings(program, file),
    ...redInkFindings(program, file, vocabulary),
    ...pageCameraFindings(program, file),
  ];
}

/** Sketchbook checks of one scene against its storyboard shot (how the shot enters). */
export function sketchbookShotChecks(
  program: AnyNode,
  file: string,
  shot: { readonly transitionIn?: Transition | undefined },
): QaFinding[] {
  return popupEntryFindings(program, file, shot.transitionIn);
}
