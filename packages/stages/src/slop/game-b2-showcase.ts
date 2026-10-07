/**
 * Game B2 guard against replaying the showcase (PLAN.md#13.15 phase 2, docs/worlds/DECISIONS.md
 * "PRINCIPLE: a world is a style GRAMMAR"; real run Game B2 1: a literal cartridge in a film about
 * the Great Stink, a ledger drawn as a cartridge, every person the returns clerk): an unrequested
 * showcase object is a thing of the showcase film the scene draws or writes while the narration,
 * research notes and asset titles never mention it (⚠, per shot):
 * - a cartridge: the built-in `item` and `sand-pile` sprites, the `cartridge` icon or item kind, a
 *   taken / held / thrown item with neither an `icon` nor a `kind` (the kit draws the default
 *   cartridge), the built-in `office` level (a cartridge in the sand), any id or label naming one;
 * - the returns clerk: the built-in `clerk` sprite, a `clerk` id or speaker;
 * - the showcase's own names: E.T., Atari, Alamogordo, the landfill, the built-in `warehouse`.
 * The film's own sprites, icons and asset ids (a generated person, an icon of a ledger) are never
 * judged. The scene's `meta` and every `intent` (the plan of a toolkit call) are off screen.
 * Warnings only, like every slop guard.
 */
import type { AnyNode } from 'acorn';
import type { QaFinding } from '@reelforge/shared';
import { finding } from '../scenes/checks.js';
import { visit } from '../scenes/source-checks.js';
import { calleeName, literalString, propertyKey } from './source-text.js';
import { knownWord, type Vocabulary } from './vocabulary.js';

interface ShowcaseObject {
  readonly name: string;
  /** Words of the sources that ask for it (any one). */
  readonly requestedBy: readonly string[];
}

const CARTRIDGE: ShowcaseObject = {
  name: 'a game cartridge',
  requestedBy: ['cartridge', 'atari', 'console'],
};
const CLERK: ShowcaseObject = {
  name: 'the returns clerk',
  requestedBy: ['clerk', 'cashier', 'shopkeeper'],
};
const WAREHOUSE: ShowcaseObject = { name: 'the showcase warehouse', requestedBy: ['warehouse'] };

/** Labels, ids and option values that name a showcase thing. */
const LABELS: readonly (readonly [RegExp, ShowcaseObject])[] = [
  [/cartridge/i, CARTRIDGE],
  [/\bclerks?\b/i, CLERK],
  [/\bE\.T\b|^et$/i, { name: 'E.T.', requestedBy: ['extraterrestrial', 'e.t'] }],
  [/\batari\b/i, { name: 'Atari', requestedBy: ['atari'] }],
  [/alamogordo/i, { name: 'Alamogordo', requestedBy: ['alamogordo'] }],
  [/landfill/i, { name: 'a landfill', requestedBy: ['landfill'] }],
];
/** Built-in sprites, levels and icons that ARE the showcase's things. */
const BUILT_IN: Readonly<Record<string, Readonly<Record<string, ShowcaseObject>>>> = {
  sprite: { item: CARTRIDGE, 'sand-pile': CARTRIDGE, clerk: CLERK },
  level: { office: CARTRIDGE, warehouse: WAREHOUSE },
};
/** View calls whose first argument is an item of the hand. */
const ITEM_CALLS = new Set(['take', 'hold', 'throw']);

function requested(object: ShowcaseObject, vocabulary: Vocabulary): boolean {
  return object.requestedBy.some((word) =>
    word === 'e.t'
      ? vocabulary.words.has('e') && vocabulary.words.has('t')
      : knownWord(vocabulary, word),
  );
}

/** A showcase label in a string literal or an object key (a sprite id, a speaker). */
function labelOf(node: AnyNode): ShowcaseObject | undefined {
  const key = node.type === 'Property' ? propertyKey(node) : undefined;
  const text = key ?? literalString(node);
  return text === undefined ? undefined : LABELS.find(([pattern]) => pattern.test(text))?.[1];
}

/** `sprite: 'clerk'`, `level: 'office'`: a built-in that is a showcase thing. */
function builtInOf(node: AnyNode): ShowcaseObject | undefined {
  const key = node.type === 'Property' ? propertyKey(node) : undefined;
  if (node.type !== 'Property' || key === undefined || !Object.hasOwn(BUILT_IN, key)) {
    return undefined;
  }
  const value = literalString(node.value);
  const objects = BUILT_IN[key] ?? {};
  return value !== undefined && Object.hasOwn(objects, value) ? objects[value] : undefined;
}

/** A take / hold / throw item with neither `icon` nor `kind`: the kit's default cartridge. */
function defaultItem(node: AnyNode): boolean {
  const name = calleeName(node);
  if (node.type !== 'CallExpression' || name === undefined || !ITEM_CALLS.has(name)) return false;
  const [item] = node.arguments;
  if (item?.type !== 'ObjectExpression') return false;
  return !item.properties.some((property) => {
    const key = propertyKey(property);
    return key === 'icon' || key === 'kind';
  });
}

/** Nodes never on screen: the scene's `meta` and every `intent` (the plan of a toolkit call). */
function offScreen(program: AnyNode): Set<AnyNode> {
  const skipped = new Set<AnyNode>();
  visit(program, (node) => {
    const meta =
      node.type === 'VariableDeclarator' &&
      node.id.type === 'Identifier' &&
      node.id.name === 'meta';
    const target = meta
      ? node.init
      : node.type === 'Property' && propertyKey(node) === 'intent'
        ? node.value
        : undefined;
    if (target) visit(target, (inner) => skipped.add(inner));
  });
  return skipped;
}

/** A showcase object the scene draws or writes that the sources never ask for (⚠). */
export function b2ShowcaseFindings(
  program: AnyNode,
  file: string,
  vocabulary: Vocabulary,
): QaFinding[] {
  const skipped = offScreen(program);
  const found = new Map<string, string>();
  const add = (object: ShowcaseObject | undefined, node: AnyNode, why: string): void => {
    if (object === undefined || found.has(object.name) || requested(object, vocabulary)) return;
    found.set(object.name, `${file}:${String(node.loc?.start.line ?? 1)}${why}`);
  };
  visit(program, (node) => {
    if (skipped.has(node)) return;
    if (defaultItem(node)) add(CARTRIDGE, node, ': an item without an icon');
    add(builtInOf(node), node, '');
    add(labelOf(node), node, '');
  });
  if (found.size === 0) return [];
  const named = [...found].map(([name, where]) => `${name} (${where})`).join(', ');
  return [
    finding(
      'slop',
      'warning',
      `unrequested showcase object: ${named} - the narration never mentions it. Draw this film's own things (its assets, view.defineSprite / view.defineIcon, a person of the film; every held item with its icon).`,
    ),
  ];
}
