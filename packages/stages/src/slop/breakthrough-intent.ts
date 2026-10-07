/**
 * Breakthrough originality of a world whose showpieces are toolkits with a required `intent`
 * (Comic: `page.flashback`, `page.spread`; Papi's rule after real run Sketchbook 2, generalised):
 * every call names the claim it shows, in words the narration or research uses (an intent the
 * sources never mention is decoration), and no two of a film share their mechanism (the options
 * that make it, e.g. `cover page + arrange rows`, with the kit's defaults) or their intent. Read
 * from the scene source (no execution). Warnings only, like every anti-slop guard.
 */
import type { AnyNode } from 'acorn';
import type { QaFinding } from '@reelforge/shared';
import { finding } from '../scenes/checks.js';
import { visit } from '../scenes/source-checks.js';
import { genericIntent, overlap, SAME_INTENT } from './popup-intent.js';
import { calleeName, constantStrings, literalString, propertyKey, strings } from './source-text.js';
import { isFunctionWord, knownWord, tokenize, type Vocabulary } from './vocabulary.js';

/** Breakthrough method -> its mechanism options and the kit's defaults (`WorldSlopSpec`). */
export type BreakthroughKinds = Readonly<Record<string, Readonly<Record<string, string>>>>;

export interface BreakthroughSpec {
  /** The method: `flashback`, `spread`. */
  readonly kind: string;
  /** The literal `intent`; undefined when missing or built at run time. */
  readonly intent: string | undefined;
  /** `cover page + arrange stair`; undefined when an option is computed at run time. */
  readonly mechanism: string | undefined;
  readonly line: number;
}

/** Content words of an intent that the sources must know (at least this many). */
const MIN_GROUNDED = 2;
/** Words that say nothing about a flashback's or spread's claim. */
const VAGUE = new Set(
  'flashback flashbacks spread spreads past big picture look back page'.split(' '),
);

const slop = (message: string): QaFinding => finding('slop', 'warning', message);

function property(node: AnyNode | undefined, key: string): AnyNode | undefined {
  if (node?.type !== 'ObjectExpression') return undefined;
  for (const entry of node.properties) {
    if (entry.type === 'Property' && propertyKey(entry) === key) return entry.value;
  }
  return undefined;
}

function mechanismOf(
  options: AnyNode | undefined,
  defaults: Readonly<Record<string, string>>,
): string | undefined {
  const parts: string[] = [];
  for (const [key, fallback] of Object.entries(defaults)) {
    const node = property(options, key);
    const value = node === undefined ? fallback : literalString(node);
    if (value === undefined) return undefined;
    parts.push(`${key} ${value}`);
  }
  return parts.join(' + ');
}

/** The breakthrough calls of a scene source. */
export function breakthroughSpecs(program: AnyNode, kinds: BreakthroughKinds): BreakthroughSpec[] {
  const constants = constantStrings(program);
  const specs: BreakthroughSpec[] = [];
  visit(program, (node) => {
    const kind = calleeName(node);
    if (node.type !== 'CallExpression' || kind === undefined || !Object.hasOwn(kinds, kind)) {
      return;
    }
    const [first] = node.arguments;
    const options = first?.type === 'SpreadElement' ? undefined : first;
    const intent = property(options, 'intent');
    specs.push({
      kind,
      intent: intent === undefined ? undefined : strings(intent, constants)[0],
      mechanism: mechanismOf(options, kinds[kind] ?? {}),
      line: node.loc?.start.line ?? 1,
    });
  });
  return specs;
}

/** Content words of an intent the narration, research or asset titles use (numbers included). */
export function groundedWords(intent: string, vocabulary: Vocabulary): string[] {
  return tokenize(intent).flatMap((token) => {
    if (token.number !== undefined) {
      return vocabulary.numbers.includes(token.number) ? [token.text] : [];
    }
    const meaningful = token.text.length >= 2 && !isFunctionWord(token.text);
    return meaningful && !VAGUE.has(token.text) && knownWord(vocabulary, token.text)
      ? [token.text]
      : [];
  });
}

/** Missing, generic or ungrounded intents of one scene's breakthroughs. */
export function breakthroughIntentFindings(
  program: AnyNode,
  file: string,
  kinds: BreakthroughKinds,
  vocabulary: Vocabulary,
): QaFinding[] {
  return breakthroughSpecs(program, kinds).flatMap((spec): QaFinding[] => {
    const at = `${file}:${String(spec.line)}`;
    if (spec.intent === undefined) {
      return [
        slop(
          `${spec.kind} without an intent (${at}): set \`intent\` to the claim of the narration it shows.`,
        ),
      ];
    }
    if (genericIntent(spec.intent)) {
      return [
        slop(
          `generic ${spec.kind} intent "${spec.intent}" (${at}): name the claim of the narration it shows.`,
        ),
      ];
    }
    if (groundedWords(spec.intent, vocabulary).length >= MIN_GROUNDED) return [];
    return [
      slop(
        `${spec.kind} intent "${spec.intent}" (${at}) is not in the narration or research notes: show a claim the film makes, in its words.`,
      ),
    ];
  });
}

function same(first: BreakthroughSpec, second: BreakthroughSpec): string | undefined {
  if (first.kind !== second.kind) return undefined;
  if (first.mechanism !== undefined && first.mechanism === second.mechanism) {
    return `mechanism "${second.mechanism}"`;
  }
  if (first.intent === undefined || second.intent === undefined) return undefined;
  return overlap(first.intent, second.intent) >= SAME_INTENT
    ? `intent "${second.intent}"`
    : undefined;
}

export interface ShotBreakthroughs {
  readonly shotId: string;
  readonly specs: readonly BreakthroughSpec[];
}

/** Breakthroughs that repeat an earlier one of the film: one finding on the later shot. */
export function repeatedBreakthroughFindings(
  shots: readonly ShotBreakthroughs[],
): Map<string, QaFinding[]> {
  const found = new Map<string, QaFinding[]>();
  const earlier: { shotId: string; spec: BreakthroughSpec }[] = [];
  for (const { shotId, specs } of shots) {
    for (const spec of specs) {
      const match = earlier.find((entry) => same(entry.spec, spec) !== undefined);
      if (match !== undefined) {
        const what = same(match.spec, spec) ?? '';
        found.set(shotId, [
          ...(found.get(shotId) ?? []),
          slop(
            `${spec.kind} repeats ${match.shotId} (same ${what}): every ${spec.kind} of a film is original; pick another way to show this claim.`,
          ),
        ]);
      }
      earlier.push({ shotId, spec });
    }
  }
  return found;
}
