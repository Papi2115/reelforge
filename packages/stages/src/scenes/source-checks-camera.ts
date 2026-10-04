/**
 * Static check of camera-based pattern interrupts (PLAN.md#12.25, real run v2.3: a dolly zoom
 * that ended as an unreadable close-up, an orbit over unlabelled floating cubes). In a shot with a
 * planned interrupt, a cinematic camera move (`dollyZoom`, `orbit` with t0/t1, `rackFocus`,
 * `parallax`) must keep the subject readable: some text names what the viewer sees, a dolly zoom
 * stays within MAX_DOLLY_ZOOM_RATIO and an orbit within MAX_INTERRUPT_ORBIT_DEGREES. Literal
 * values only; computed ones are not judged. Warnings (reported, no fix turn).
 */
import { parse, type AnyNode, type CallExpression, type ObjectExpression } from 'acorn';
import type { QaFinding, StoryboardShot } from '@reelforge/shared';
import { finding } from './checks.js';
import { optionValue, ownerIs, visit } from './source-checks.js';

/** Largest distance ratio of a dolly zoom in an interrupt (e.g. 6 -> 3). */
export const MAX_DOLLY_ZOOM_RATIO = 2;
/** Largest orbit of an interrupt, in degrees. */
export const MAX_INTERRUPT_ORBIT_DEGREES = 45;

const CAMERA_MOVES = new Set(['dollyZoom', 'orbit', 'rackFocus', 'parallax']);
const TEXT_CALLS = new Set(['title', 'kinetic', 'lowerThird']);
/** Annotation options that carry words (a badge's number alone names nothing). */
const LABEL_OPTIONS = ['text', 'title', 'label'] as const;

interface CameraMove {
  readonly name: string;
  readonly line: number;
  readonly options: ObjectExpression | undefined;
}

function methodOf(call: CallExpression): { owner: AnyNode; name: string } | undefined {
  const callee = call.callee;
  if (callee.type !== 'MemberExpression' || callee.computed) return undefined;
  if (callee.property.type !== 'Identifier') return undefined;
  return { owner: callee.object, name: callee.property.name };
}

const objectArgument = (call: CallExpression): ObjectExpression | undefined =>
  call.arguments.find(
    (argument): argument is ObjectExpression => argument.type === 'ObjectExpression',
  );

function literalNumber(node: AnyNode | undefined): number | undefined {
  if (node?.type === 'Literal' && typeof node.value === 'number') return node.value;
  if (node?.type === 'UnaryExpression' && node.operator === '-') {
    const inner = literalNumber(node.argument);
    return inner === undefined ? undefined : -inner;
  }
  return undefined;
}

/** A labelled text: `ctx.text.title/kinetic/lowerThird`, or an annotation with words. */
function isLabel(call: CallExpression): boolean {
  const method = methodOf(call);
  if (method === undefined) return false;
  if (TEXT_CALLS.has(method.name) && ownerIs(method.owner, 'text')) return true;
  if (!ownerIs(method.owner, 'annotate')) return false;
  const options = objectArgument(call);
  return LABEL_OPTIONS.some((key) => {
    const value = optionValue(options, key);
    return value !== undefined && !(value.type === 'Literal' && value.value === '');
  });
}

function scan(source: string): { moves: CameraMove[]; labelled: boolean } | undefined {
  let program: AnyNode;
  try {
    program = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
  const moves: CameraMove[] = [];
  let labelled = false;
  visit(program, (node) => {
    if (node.type !== 'CallExpression') return;
    if (isLabel(node)) labelled = true;
    const method = methodOf(node);
    if (method === undefined || !CAMERA_MOVES.has(method.name)) return;
    if (!ownerIs(method.owner, 'camera')) return;
    const options = objectArgument(node);
    // `orbit({ radius, degrees: [a, b] })(t)` is the rig, not the interrupt move.
    if (method.name === 'orbit' && optionValue(options, 't0') === undefined) return;
    moves.push({ name: method.name, line: node.loc?.start.line ?? 1, options });
  });
  return { moves, labelled };
}

function moveProblem(move: CameraMove): string | undefined {
  if (move.name === 'dollyZoom') {
    const from = literalNumber(optionValue(move.options, 'from'));
    const to = literalNumber(optionValue(move.options, 'to'));
    if (from === undefined || to === undefined || from <= 0 || to <= 0) return undefined;
    const ratio = Math.max(from, to) / Math.min(from, to);
    if (ratio <= MAX_DOLLY_ZOOM_RATIO) return undefined;
    return `a dolly zoom from ${String(from)} to ${String(to)} (${ratio.toFixed(1)}x) warps the frame until the subject is unreadable; keep from/to within ${String(MAX_DOLLY_ZOOM_RATIO)}x (e.g. 6 -> 3.5) with the subject framed whole`;
  }
  if (move.name === 'orbit') {
    const degrees = literalNumber(optionValue(move.options, 'degrees'));
    if (degrees === undefined || Math.abs(degrees) <= MAX_INTERRUPT_ORBIT_DEGREES) return undefined;
    return `an orbit of ${String(degrees)} degrees loses the subject; keep it within ${String(MAX_INTERRUPT_ORBIT_DEGREES)} degrees around a labelled subject`;
  }
  return undefined;
}

/**
 * Warnings for the camera moves of a shot with a planned pattern interrupt; [] for other shots,
 * shots without cinematic moves and sources that do not parse (lint reports those).
 */
export function cameraInterruptFindings(
  source: string,
  file: string,
  interrupt: StoryboardShot['interrupt'],
): QaFinding[] {
  if (interrupt === undefined) return [];
  const scanned = scan(source);
  if (scanned === undefined || scanned.moves.length === 0) return [];
  const findings: QaFinding[] = [];
  for (const move of scanned.moves) {
    const problem = moveProblem(move);
    if (problem === undefined) continue;
    const where = `${file}:${String(move.line)} ctx.camera.${move.name}`;
    findings.push(
      finding('legibility', 'warning', `${where} (${interrupt.kind} interrupt): ${problem}.`),
    );
  }
  if (!scanned.labelled) {
    const names = [...new Set(scanned.moves.map((move) => `ctx.camera.${move.name}`))].join(', ');
    findings.push(
      finding(
        'legibility',
        'warning',
        `${file}: the ${interrupt.kind} interrupt moves the camera (${names}) but nothing on screen says what the viewer looks at; label the subject (ctx.annotate.callout/pin/label with text, or a ctx.text card) so the surprise reads.`,
      ),
    );
  }
  return findings;
}
