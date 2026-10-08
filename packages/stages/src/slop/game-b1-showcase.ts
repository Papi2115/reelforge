/**
 * Game B1 guards against replaying the showcase (PLAN.md#13.15 phase 2, docs/worlds/DECISIONS.md
 * "PRINCIPLE: a world is a style GRAMMAR"; real run Game B1 1):
 * - an unrequested showcase object: a scene draws or writes one of the showcase's things (a
 *   cartridge sprite, a manual figure or shelf of cartridges, E.T., a Christmas tree or presents,
 *   the Atari / Alamogordo / landfill labels) while the narration, research notes and asset titles
 *   never mention it (⚠, per shot). The console swap itself (`screen.cartridge`), the progress
 *   slots and the level map's cursor are the world's own machinery and are not judged;
 * - number-only monotony: 4 or more shots in a row whose only element is a big number (Score Block
 *   digits, a counter or numeric big text in the TV, with no sprite, playfield, room or console
 *   screen) (⚠ at the final review, on every shot of the run from the 4th on).
 * Warnings only, like every slop guard.
 */
import type { AnyNode } from 'acorn';
import type { QaFinding } from '@reelforge/shared';
import { visit } from '../scenes/source-checks.js';
import { finding } from '../scenes/checks.js';
import { calleeName, literalString, propertyKey } from './source-text.js';
import { knownWord, type Vocabulary } from './vocabulary.js';
import type { ShotProgram } from './world-labels.js';

/** Shots in a row whose only element is a big number, from which the run is flagged. */
export const NUMBER_ONLY_RUN = 4;

interface ShowcaseObject {
  readonly name: string;
  /** Words of the sources that ask for it (any one). */
  readonly requestedBy: readonly string[];
}

const CARTRIDGE: ShowcaseObject = {
  name: 'a cartridge',
  requestedBy: ['cartridge', 'atari', 'console'],
};
const ET: ShowcaseObject = { name: 'E.T.', requestedBy: ['extraterrestrial', 'e.t'] };
const CHRISTMAS: ShowcaseObject = { name: 'Christmas', requestedBy: ['christmas', 'xmas'] };
const LABELS: readonly (readonly [RegExp, ShowcaseObject])[] = [
  [/cartridge/i, CARTRIDGE],
  [/\bE\.T\b|^et$/i, ET],
  [/christmas|xmas/i, CHRISTMAS],
  [/\batari\b/i, { name: 'Atari', requestedBy: ['atari'] }],
  [/alamogordo/i, { name: 'Alamogordo', requestedBy: ['alamogordo'] }],
  [/landfill/i, { name: 'a landfill', requestedBy: ['landfill'] }],
];
/** Room options of the showcase's living room (`room({ tree, presents, gift })`). */
const ROOM_OPTIONS: Readonly<Record<string, ShowcaseObject>> = {
  tree: CHRISTMAS,
  presents: CHRISTMAS,
  gift: CHRISTMAS,
};

function requested(object: ShowcaseObject, vocabulary: Vocabulary): boolean {
  return object.requestedBy.some((word) =>
    word === 'e.t'
      ? vocabulary.words.has('e') && vocabulary.words.has('t')
      : knownWord(vocabulary, word),
  );
}

/** A showcase label in a string literal or an object key (a sprite id, a shelf of cartridges). */
function labelOf(node: AnyNode): ShowcaseObject | undefined {
  const key = node.type === 'Property' ? propertyKey(node) : undefined;
  const text = key ?? literalString(node);
  return text === undefined ? undefined : LABELS.find(([pattern]) => pattern.test(text))?.[1];
}

/** The showcase living room's options inside a `room(…)` call (`tree`, `presents`, `gift`). */
function roomOptions(call: AnyNode, add: (object: ShowcaseObject, node: AnyNode) => void): void {
  if (call.type !== 'CallExpression') return;
  for (const argument of call.arguments) {
    if (argument.type !== 'ObjectExpression') continue;
    for (const property of argument.properties) {
      const key = propertyKey(property);
      if (property.type !== 'Property' || key === undefined) continue;
      const option = Object.hasOwn(ROOM_OPTIONS, key) ? ROOM_OPTIONS[key] : undefined;
      const off = property.value.type === 'Literal' && property.value.value === false;
      if (option !== undefined && !off) add(option, property);
    }
  }
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
export function b1ShowcaseFindings(
  program: AnyNode,
  file: string,
  vocabulary: Vocabulary,
): QaFinding[] {
  const skipped = offScreen(program);
  const found = new Map<string, number>();
  const add = (object: ShowcaseObject, node: AnyNode): void => {
    if (found.has(object.name) || requested(object, vocabulary)) return;
    found.set(object.name, node.loc?.start.line ?? 1);
  };
  visit(program, (node) => {
    if (skipped.has(node)) return;
    const name = calleeName(node);
    if (name === 'cart') add(CARTRIDGE, node);
    if (name === 'room') roomOptions(node, add);
    const label = labelOf(node);
    if (label !== undefined) add(label, node);
  });
  if (found.size === 0) return [];
  const named = [...found].map(([name, line]) => `${name} (${file}:${String(line)})`).join(', ');
  return [
    finding(
      'slop',
      'warning',
      `unrequested showcase object: ${named} - the narration never mentions it. Draw this film's own things (its assets, screen.defineSprite / screen.generate, a room that fits the film).`,
    ),
  ];
}

/** Calls that give a shot something to look at besides a number. */
const SUBJECT_CALLS = new Set([
  'draw',
  'sprite',
  'field',
  'playfield',
  'box',
  'cart',
  'interior',
  'room',
  'scoreTable',
  'manual',
  'levelSelect',
  'boss',
  'gameOver',
  'calendarZoom',
  'cartridge',
  'say',
]);
const NUMERIC = /^[\d\s.,:%+-]+$/;

/** A big number in the TV: Score Block digits, a counter, numeric text of size 2+. */
function bigNumber(node: AnyNode): boolean {
  if (node.type !== 'CallExpression') return false;
  const name = calleeName(node);
  const [first, , , options] = node.arguments;
  if (name === 'counter') return true;
  if (name === 'score') return first !== undefined && first.type !== 'ObjectExpression';
  if (name !== 'text' || first === undefined || first.type === 'SpreadElement') return false;
  const text = literalString(first);
  if (text === undefined || !NUMERIC.test(text)) return false;
  if (options?.type !== 'ObjectExpression') return false;
  return options.properties.some((property) => {
    if (property.type !== 'Property' || propertyKey(property) !== 'size') return false;
    return property.value.type === 'Literal' && Number(property.value.value) >= 2;
  });
}

/** A shot whose only element is a big number. */
export function numberOnly(program: AnyNode): boolean {
  let [number, subject] = [false, false];
  visit(program, (node) => {
    const name = calleeName(node);
    if (name !== undefined && SUBJECT_CALLS.has(name)) subject = true;
    if (bigNumber(node)) number = true;
  });
  return number && !subject;
}

/** Runs of `NUMBER_ONLY_RUN`+ number-only shots: ⚠ on each shot from the 4th of the run on. */
export function b1NumberOnlyFindings(shots: readonly ShotProgram[]): Map<string, QaFinding[]> {
  const found = new Map<string, QaFinding[]>();
  let run: string[] = [];
  for (const shot of shots) {
    run = numberOnly(shot.program) ? [...run, shot.shotId] : [];
    if (run.length < NUMBER_ONLY_RUN) continue;
    found.set(shot.shotId, [
      finding(
        'slop',
        'warning',
        `number-only monotony: ${String(run.length)} shots in a row (${run.join(', ')}) show only a big number. Give this one a place and a hero (a sprite on a playfield, the room, a console screen) and let the number sit on it.`,
      ),
    ]);
  }
  return found;
}
