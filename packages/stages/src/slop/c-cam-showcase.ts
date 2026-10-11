/**
 * Grim Ink guard against replaying the concept films (PLAN.md#14.19, docs/worlds/DECISIONS.md "a
 * world is a style GRAMMAR"): the technique topics (`reelforge kit-docs shots`) quote trimmed shots
 * of the samurai, papal-conclave and Apollo films, so their CONTENT must not leak into another
 * film. A scene that names one of their objects (in an identifier, an object key or a string:
 * `toyBear`, `'conclave'`, `drawLander`) while the narration, research notes and asset titles
 * never mention it gets an "unrequested showcase object" ⚠ (one per scene). Comments are not
 * read; the kit's own gag props (gum bubble, helmet, sandwich, checklist) are the world's
 * vocabulary and are never judged. Warnings only, like every slop guard.
 */
import type { AnyNode } from 'acorn';
import type { QaFinding } from '@reelforge/shared';
import { finding } from '../scenes/checks.js';
import { visit } from '../scenes/source-checks.js';
import { literalString, propertyKey } from './source-text.js';
import { knownWord, type Vocabulary } from './vocabulary.js';

interface ShowcaseObject {
  readonly name: string;
  /** Words of the sources that ask for it (any one). */
  readonly requestedBy: readonly string[];
}

const SAMURAI: ShowcaseObject = {
  name: 'the samurai film (samurai, katana, shogun...)',
  requestedBy: ['samurai', 'katana', 'shogun', 'ronin', 'daimyo', 'edo', 'japan', 'kimono'],
};
const CONCLAVE: ShowcaseObject = {
  name: 'the papal-conclave film (pope, cardinals, conclave...)',
  requestedBy: ['pope', 'papal', 'cardinal', 'conclave', 'vatican', 'viterbo', 'mitre', 'tiara'],
};
const APOLLO: ShowcaseObject = {
  name: 'the Apollo film (lander, astronaut, lunar module...)',
  requestedBy: ['apollo', 'lunar', 'lander', 'astronaut', 'spacesuit', 'nasa', 'moon'],
};
const TOY_BEAR: ShowcaseObject = { name: 'the toy bear', requestedBy: ['bear', 'teddy', 'toy'] };

/** Lower-case words of the concept films' own objects -> the film they come from. */
const WORDS: ReadonlyMap<string, ShowcaseObject> = new Map([
  ...['samurai', 'katana', 'shogun', 'ronin', 'daimyo', 'kimono', 'topknot'].map(
    (word): [string, ShowcaseObject] => [word, SAMURAI],
  ),
  ...['pope', 'papal', 'cardinal', 'cardinals', 'conclave', 'mitre', 'tiara', 'viterbo'].map(
    (word): [string, ShowcaseObject] => [word, CONCLAVE],
  ),
  ...['apollo', 'lunar', 'lander', 'astronaut', 'spacesuit'].map(
    (word): [string, ShowcaseObject] => [word, APOLLO],
  ),
  ['toybear', TOY_BEAR],
]);

/** `drawToyBear` -> draw, toy, bear, toybear (the camelCase parts and the joined pairs). */
export function nameWords(text: string): string[] {
  const parts = text
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part !== '');
  const pairs = parts.slice(1).map((part, index) => `${parts[index] ?? ''}${part}`);
  return [...parts, ...pairs];
}

function requested(object: ShowcaseObject, vocabulary: Vocabulary): boolean {
  return object.requestedBy.some((word) => knownWord(vocabulary, word));
}

/** The text a node names: an identifier, an object key or a string literal. */
function namedText(node: AnyNode): string | undefined {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'Property') return propertyKey(node);
  return literalString(node);
}

/** A concept film's object the scene names while the sources never ask for it (⚠). */
export function cCamShowcaseFindings(
  program: AnyNode,
  file: string,
  vocabulary: Vocabulary,
): QaFinding[] {
  const found = new Map<string, number>();
  visit(program, (node) => {
    const text = namedText(node);
    if (text === undefined) return;
    for (const word of nameWords(text)) {
      const object = WORDS.get(word);
      if (object === undefined || found.has(object.name) || requested(object, vocabulary)) continue;
      found.set(object.name, node.loc?.start.line ?? 1);
    }
  });
  if (found.size === 0) return [];
  const named = [...found].map(([name, line]) => `${name} (${file}:${String(line)})`).join(', ');
  return [
    finding(
      'slop',
      'warning',
      `unrequested showcase object: ${named} - the narration never mentions it. The technique topics teach how a shot is built, never what it shows: draw this film's own people, places and things.`,
    ),
  ];
}
