/**
 * Sketchbook source guards from real run Sketchbook 4 (warnings, the anti-slop layer): pop-up
 * intents that describe a motion or a subject the card does not have, and the red pen used for
 * labels, too often, or to strike an invented word. `sketchbookSourceChecks` has the shape of
 * `WorldSlopSpec.sourceChecks` (slop/world-labels.ts), where the Sketchbook spec wires it.
 */
import type { AnyNode } from 'acorn';
import type { QaFinding } from '@reelforge/shared';
import type { Vocabulary } from '../slop/vocabulary.js';
import { popupClaimFindings } from './popup-claim.js';
import { redInkFindings } from './red-ink.js';

export { POPUP_MOTIONS, popupClaimFindings } from './popup-claim.js';
export { MAX_RED_MARKS, redInkFindings } from './red-ink.js';

/** Every Sketchbook-only source check of one scene. */
export function sketchbookSourceChecks(
  program: AnyNode,
  file: string,
  vocabulary: Vocabulary,
): QaFinding[] {
  return [...popupClaimFindings(program, file), ...redInkFindings(program, file, vocabulary)];
}
