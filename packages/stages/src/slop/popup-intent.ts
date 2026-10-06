/**
 * Pop-up originality (Papi's rule after real run Sketchbook 2): every `page.popup` names the claim
 * its pulled motion shows (`intent`, required by the kit), never a generic "reveal", and no two
 * pop-ups of a film share their intent or mechanism. Read from the scene source (no execution):
 * the `intent` of the call's options and an optional `mechanism`/`motion` word on them or on
 * their `pull`. Warnings only, like every anti-slop guard.
 */
import type { AnyNode } from 'acorn';
import type { QaFinding } from '@reelforge/shared';
import { visit } from '../scenes/source-checks.js';
import { finding } from '../scenes/checks.js';
import { calleeName, constantStrings, propertyKey, strings } from './source-text.js';
import { isFunctionWord, stem } from './vocabulary.js';

export interface PopupSpec {
  /** The literal `intent`; undefined when missing or built at run time. */
  readonly intent: string | undefined;
  /** A literal `mechanism` / `motion` of the options or of their `pull`. */
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
const SAME_INTENT = 0.6;
const MECHANISM_KEYS = new Set(['mechanism', 'motion']);

const slop = (message: string): QaFinding => finding('slop', 'warning', message);

function words(text: string): string[] {
  return (text.toLowerCase().match(/\p{L}[\p{L}'’-]*/gu) ?? [])
    .filter((word) => word.length >= 2 && !isFunctionWord(word))
    .map(stem);
}

function objectStrings(
  node: AnyNode | undefined,
  keys: ReadonlySet<string>,
  constants: ReadonlyMap<string, string>,
): Map<string, string> {
  const found = new Map<string, string>();
  if (node?.type !== 'ObjectExpression') return found;
  for (const property of node.properties) {
    const key = propertyKey(property);
    if (key === undefined || property.type !== 'Property') continue;
    if (key === 'pull') {
      for (const [inner, value] of objectStrings(property.value, keys, constants)) {
        if (!found.has(inner)) found.set(inner, value);
      }
    }
    const [value] = strings(property.value, constants);
    if (keys.has(key) && value !== undefined) found.set(key, value);
  }
  return found;
}

/** The pop-ups of a scene source. */
export function popupSpecs(program: AnyNode): PopupSpec[] {
  const constants = constantStrings(program);
  const specs: PopupSpec[] = [];
  visit(program, (node) => {
    if (node.type !== 'CallExpression' || calleeName(node) !== 'popup') return;
    const [options] = node.arguments;
    const own = options?.type === 'SpreadElement' ? undefined : options;
    const values = objectStrings(own, new Set(['intent', ...MECHANISM_KEYS]), constants);
    specs.push({
      intent: values.get('intent'),
      mechanism: values.get('mechanism') ?? values.get('motion'),
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

function overlap(first: string, second: string): number {
  const a = new Set(words(first));
  const b = new Set(words(second));
  if (a.size === 0 || b.size === 0) return 0;
  const shared = [...a].filter((word) => b.has(word)).length;
  return shared / new Set([...a, ...b]).size;
}

function same(first: PopupSpec, second: PopupSpec): string | undefined {
  if (first.mechanism !== undefined && second.mechanism !== undefined) {
    if (first.mechanism.trim().toLowerCase() === second.mechanism.trim().toLowerCase()) {
      return `mechanism "${second.mechanism}"`;
    }
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
