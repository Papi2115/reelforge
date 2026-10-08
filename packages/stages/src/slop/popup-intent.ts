/**
 * Pop-up originality (Papi's rule after real run Sketchbook 2): every `page.popup` names the claim
 * its pulled motion shows (`intent`, required by the kit), never a generic "reveal", and no two
 * pop-ups of a film share their intent or mechanism. Read from the scene source (no execution):
 * the literal `intent`, and the mechanism = what the pull moves (`pull.motions`: the kind of each
 * target piece and the properties it moves, e.g. `flap.open + counter.value`; a `drive` callback
 * counts as its own mechanism). Warnings only, like every anti-slop guard.
 */
import type { AnyNode } from 'acorn';
import type { QaFinding } from '@reelforge/shared';
import { visit } from '../scenes/source-checks.js';
import { finding } from '../scenes/checks.js';
import { calleeName, constantStrings, literalString, propertyKey, strings } from './source-text.js';
import { isFunctionWord, stem } from './vocabulary.js';

export interface PopupSpec {
  /** The literal `intent`; undefined when missing or built at run time. */
  readonly intent: string | undefined;
  /** What the pull moves (`flap.open + counter.value`); undefined without a readable pull. */
  readonly mechanism: string | undefined;
  readonly line: number;
}

/** Content words below this make an intent generic ("the reveal", "pop-up"). */
const MIN_INTENT_WORDS = 2;
/** Words that say nothing about the claim. */
const VAGUE_WORDS = new Set(
  'reveal reveals revealed pop popup pop-up up card show shows answer fact claim motion pull pulled thing things stuff something moment wow tbd todo intent'.split(
    ' ',
  ),
);
/** Word overlap (Jaccard) from which two intents count as the same. */
export const SAME_INTENT = 0.6;

const slop = (message: string): QaFinding => finding('slop', 'warning', message);

function words(text: string): string[] {
  return (text.toLowerCase().match(/\p{L}[\p{L}'’-]*/gu) ?? [])
    .filter((word) => word.length >= 2 && !isFunctionWord(word))
    .map(stem);
}

/** The value of a non-computed property of an object literal. */
function property(node: AnyNode | undefined, key: string): AnyNode | undefined {
  if (node?.type !== 'ObjectExpression') return undefined;
  for (const entry of node.properties) {
    if (entry.type === 'Property' && propertyKey(entry) === key) return entry.value;
  }
  return undefined;
}

function objects(node: AnyNode | undefined): AnyNode[] {
  if (node?.type !== 'ArrayExpression') return [];
  return node.elements.flatMap((element) =>
    element?.type === 'ObjectExpression' ? [element] : [],
  );
}

function keys(node: AnyNode | undefined): string[] {
  if (node?.type !== 'ObjectExpression') return [];
  return node.properties.flatMap((entry) => propertyKey(entry) ?? []);
}

/** `kind.prop` of every motion of the pull (the target's kind from its element's `id`). */
function mechanismOf(options: AnyNode | undefined): string | undefined {
  const kinds = new Map<string, string>();
  for (const element of objects(property(options, 'elements'))) {
    const id = literalString(property(element, 'id'));
    const kind = literalString(property(element, 'kind'));
    if (id !== undefined && kind !== undefined) kinds.set(id, kind);
  }
  const pull = property(options, 'pull');
  const moved = new Set<string>();
  for (const motion of objects(property(pull, 'motions'))) {
    const target = literalString(property(motion, 'target')) ?? '?';
    const kind = kinds.get(target) ?? target;
    for (const prop of keys(property(motion, 'to'))) moved.add(`${kind}.${prop}`);
  }
  if (property(pull, 'drive') !== undefined) moved.add('drive');
  return moved.size === 0 ? undefined : [...moved].sort().join(' + ');
}

/** The pop-ups of a scene source. */
export function popupSpecs(program: AnyNode): PopupSpec[] {
  const constants = constantStrings(program);
  const specs: PopupSpec[] = [];
  visit(program, (node) => {
    if (node.type !== 'CallExpression' || calleeName(node) !== 'popup') return;
    const [first] = node.arguments;
    const options = first?.type === 'SpreadElement' ? undefined : first;
    const intent = property(options, 'intent');
    specs.push({
      intent: intent === undefined ? undefined : strings(intent, constants)[0],
      mechanism: mechanismOf(options),
      line: node.loc?.start.line ?? 1,
    });
  });
  return specs;
}

/** True when an intent names no claim (too few words, or only vague ones). */
export function genericIntent(intent: string): boolean {
  const meaningful = words(intent).filter((word) => !VAGUE_WORDS.has(word));
  return meaningful.length < MIN_INTENT_WORDS;
}

/** Missing or generic intents of one scene's pop-ups. */
export function popupIntentFindings(program: AnyNode, file: string): QaFinding[] {
  return popupSpecs(program).flatMap((spec): QaFinding[] => {
    const at = `${file}:${String(spec.line)}`;
    if (spec.intent === undefined) {
      return [
        slop(
          `pop-up without an intent (${at}): set \`intent\` to the claim the pulled motion shows and build a mechanism that shows it.`,
        ),
      ];
    }
    if (!genericIntent(spec.intent)) return [];
    return [
      slop(
        `generic pop-up intent "${spec.intent}" (${at}): name the claim of the narration the pulled motion shows (what moves and what it means).`,
      ),
    ];
  });
}

/** Content-word overlap (Jaccard, stemmed) of two intents. */
export function overlap(first: string, second: string): number {
  const a = new Set(words(first));
  const b = new Set(words(second));
  if (a.size === 0 || b.size === 0) return 0;
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared / new Set([...a, ...b]).size;
}

function same(first: PopupSpec, second: PopupSpec): string | undefined {
  if (first.mechanism !== undefined && first.mechanism === second.mechanism) {
    return `mechanism "${second.mechanism}"`;
  }
  if (first.intent === undefined || second.intent === undefined) return undefined;
  return overlap(first.intent, second.intent) >= SAME_INTENT
    ? `intent "${second.intent}"`
    : undefined;
}

export interface ShotPopups {
  readonly shotId: string;
  readonly popups: readonly PopupSpec[];
}

/** Pop-ups that repeat an earlier pop-up of the film: one finding on the later shot. */
export function repeatedPopupFindings(shots: readonly ShotPopups[]): Map<string, QaFinding[]> {
  const found = new Map<string, QaFinding[]>();
  const earlier: { shotId: string; spec: PopupSpec }[] = [];
  for (const { shotId, popups } of shots) {
    for (const spec of popups) {
      const match = earlier.find((entry) => same(entry.spec, spec) !== undefined);
      if (match !== undefined) {
        const what = same(match.spec, spec) ?? '';
        found.set(shotId, [
          ...(found.get(shotId) ?? []),
          slop(
            `pop-up repeats ${match.shotId} (same ${what}): every pop-up of a film is original; invent another mechanism for this claim.`,
          ),
        ]);
      }
      earlier.push({ shotId, spec });
    }
  }
  return found;
}
