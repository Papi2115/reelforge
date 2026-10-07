/**
 * The Sketchbook page and its shot's entry (real run Sketchbook 3 #3, #4), warnings only:
 * - `ctx.camera.*` in a page scene: the page is a full-frame quad, a camera move does nothing on it
 *   (turns were spent adding and removing pushes that never showed); `page.push(...)` is the
 *   page's camera;
 * - a pop-up whose cover lifts while the shot's page transition still covers the frame: the
 *   opening, the best beat of the card, plays hidden under the page turn.
 */
import type { AnyNode } from 'acorn';
import type { QaFinding, Transition } from '@reelforge/shared';
import { finding } from '../scenes/checks.js';
import { visit } from '../scenes/source-checks.js';
import { calleeName, propertyKey } from '../slop/source-text.js';

/** Kit pop-up timing (popup-geometry.ts popupTimes): default `at`, the cover lifts 0.5 s later. */
const POPUP_DEFAULT_AT_S = 0.36;
const COVER_LIFT_S = 0.5;
/** The lift should start this long after the transition has cleared the frame. */
const LIFT_MARGIN_S = 0.1;

const slop = (message: string): QaFinding => finding('slop', 'warning', message);

/** `ctx.camera` accessed (a move, a pose, a shake): line of the first use, else undefined. */
function cameraLine(program: AnyNode): number | undefined {
  let line: number | undefined;
  visit(program, (node) => {
    if (line !== undefined || node.type !== 'MemberExpression' || node.computed) return;
    if (node.object.type !== 'Identifier' || node.object.name !== 'ctx') return;
    if (node.property.type === 'Identifier' && node.property.name === 'camera') {
      line = node.loc?.start.line ?? 1;
    }
  });
  return line;
}

export function pageCameraFindings(program: AnyNode, file: string): QaFinding[] {
  const line = cameraLine(program);
  if (line === undefined) return [];
  return [
    slop(
      `ctx.camera on a Sketchbook page (${file}:${String(line)}): the page is full frame, a camera move does nothing. Push toward the focal drawing with page.push({ focus: [x, y], at, until, scale }), or hold the frame.`,
    ),
  ];
}

/** The literal `at` of a pop-up call (seconds), the kit default without one, else undefined. */
function popupAt(call: AnyNode): number | undefined {
  if (call.type !== 'CallExpression') return undefined;
  const [options] = call.arguments;
  if (options?.type !== 'ObjectExpression') return undefined;
  for (const entry of options.properties) {
    if (entry.type !== 'Property' || propertyKey(entry) !== 'at') continue;
    const value = entry.value;
    if (value.type === 'Literal' && typeof value.value === 'number') return value.value;
    if (
      value.type === 'UnaryExpression' &&
      value.operator === '-' &&
      value.argument.type === 'Literal' &&
      typeof value.argument.value === 'number'
    ) {
      return -value.argument.value;
    }
    // A spoken phrase or an expression: its time is not known from the source.
    return undefined;
  }
  return POPUP_DEFAULT_AT_S;
}

/** Pop-ups that open under the shot's page transition (`transitionIn`, not a cut). */
export function popupEntryFindings(
  program: AnyNode,
  file: string,
  transitionIn: Transition | undefined,
): QaFinding[] {
  if (transitionIn === undefined || transitionIn.type === 'cut') return [];
  const clear = transitionIn.duration;
  const findings: QaFinding[] = [];
  visit(program, (node) => {
    if (node.type !== 'CallExpression' || calleeName(node) !== 'popup') return;
    const at = popupAt(node);
    if (at === undefined || at + COVER_LIFT_S >= clear + LIFT_MARGIN_S) return;
    const line = node.loc?.start.line ?? 1;
    findings.push(
      slop(
        `pop-up opens under the page transition (${file}:${String(line)}): its cover lifts at ${(at + COVER_LIFT_S).toFixed(2)} s while the ${transitionIn.style ?? transitionIn.type} covers the frame until ${clear.toFixed(2)} s. Set the pop-up's at >= ${clear.toFixed(2)} so the opening is seen.`,
      ),
    );
  });
  return findings;
}
