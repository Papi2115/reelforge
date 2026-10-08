/**
 * Does a Sketchbook pop-up do what its `intent` says (real run Sketchbook 4, s05: the intent said
 * the ribbon opened the flap "on the pig and the salt barrel", but the flap revealed a word and the
 * pig was drawn on the card's base)? Two source checks, warnings only:
 * - motion: the intent's motion words (rises, spins, slides, tips, counts…) need a pull that moves
 *   a piece able to make that motion (`kind.prop` from the pull's motions: a flap only opens);
 * - subject: a film thing the scene draws by id (`use`, `like`, `defineProp`/`defineFigure`) and the
 *   intent names must be ON the card: a piece's `asset` or its words, not drawn beside it.
 * A pull driven by `drive(p, t)` is not judged (what it moves is computed).
 */
import type { AnyNode } from 'acorn';
import type { QaFinding } from '@reelforge/shared';
import { finding } from '../scenes/checks.js';
import { visit } from '../scenes/source-checks.js';
import { popupSpecs, type PopupSpec } from '../slop/popup-intent.js';
import {
  calleeName,
  constantStrings,
  literalString,
  propertyKey,
  strings,
} from '../slop/source-text.js';
import { stem, tokenize } from '../slop/vocabulary.js';

interface Motion {
  readonly label: string;
  readonly words: RegExp;
  /** `kind.prop` pull motions that show it. */
  readonly shows: readonly string[];
}

/** Motion words of an intent and the pull motions that can show them. */
export const POPUP_MOTIONS: readonly Motion[] = [
  {
    label: 'rise / fill / grow',
    words: /\b(ris(e|es|ing)|rose|climb\w*|fill(s|ing)?|grow(s|ing)?|swell\w*|lift(s|ing)?)\b/,
    shows: ['gauge.level', 'block.rise', 'cutout.rise', 'counter.value', 'card.y', 'scale.value'],
  },
  {
    label: 'spin / turn',
    words: /\b(spin\w*|spun|turn(s|ing)?|rotat\w*|crank\w*)\b/,
    shows: ['wheel.angle', 'arm.angle', 'card.rotate'],
  },
  {
    label: 'slide',
    words: /\b(slid(e|es|ing)|shift(s|ing)?|slip(s|ping)?)\b/,
    shows: ['window.index', 'block.slide', 'cutout.slide', 'card.x', 'card.y', 'arm.angle'],
  },
  {
    label: 'swing / tip',
    words: /\b(swing\w*|swung|tip(s|ping)?|tilt\w*)\b/,
    shows: ['arm.angle', 'scale.value', 'card.rotate', 'flap.open'],
  },
  {
    label: 'count',
    words: /\b(count(s|ing)?|doubl\w*|tripl\w*|multipl\w*)\b/,
    shows: ['counter.value', 'gauge.level', 'window.index'],
  },
];

/** Element options whose strings are written on a piece. */
const PIECE_TEXT = new Set(['text', 'label', 'labels', 'items', 'ends', 'band', 'lines', 'marks']);

const slop = (message: string): QaFinding => finding('slop', 'warning', message);

function option(node: AnyNode | undefined, key: string): AnyNode | undefined {
  if (node?.type !== 'ObjectExpression') return undefined;
  for (const entry of node.properties) {
    if (entry.type === 'Property' && propertyKey(entry) === key) return entry.value;
  }
  return undefined;
}

/** Stemmed content words of a text or an id (`salt-barrel` -> salt, barrel). */
function wordsOf(text: string): string[] {
  return tokenize(text.replace(/-/g, ' '))
    .filter((token) => token.number === undefined && token.text.length >= 2)
    .map((token) => stem(token.text));
}

/** What the pop-up's pieces carry: their asset ids and the words written on them. */
function carried(call: AnyNode, constants: ReadonlyMap<string, string>): Set<string> {
  const out = new Set<string>();
  if (call.type !== 'CallExpression') return out;
  const elements = option(call.arguments[0], 'elements');
  if (elements?.type !== 'ArrayExpression') return out;
  for (const element of elements.elements) {
    if (element?.type !== 'ObjectExpression') continue;
    const asset = literalString(option(element, 'asset'));
    if (asset !== undefined) out.add(`asset:${asset}`);
    for (const entry of element.properties) {
      const key = entry.type === 'Property' ? propertyKey(entry) : undefined;
      if (entry.type !== 'Property' || key === undefined || !PIECE_TEXT.has(key)) continue;
      for (const text of strings(entry.value, constants)) wordsOf(text).forEach((w) => out.add(w));
    }
  }
  return out;
}

/** Film things the scene draws by id: `use('pig')`, `like: 'farmer'`, `defineProp('hut', …)`. */
function filmThings(program: AnyNode): Set<string> {
  const ids = new Set<string>();
  visit(program, (node) => {
    const name = calleeName(node);
    if (
      node.type === 'CallExpression' &&
      ['use', 'defineProp', 'defineFigure'].includes(name ?? '')
    ) {
      const id = literalString(node.arguments[0]);
      if (id !== undefined) ids.add(id);
    }
    if (node.type === 'Property' && propertyKey(node) === 'like') {
      const id = literalString(node.value);
      if (id !== undefined) ids.add(id);
    }
  });
  return ids;
}

function motionFindings(spec: PopupSpec, at: string): QaFinding[] {
  const mechanism = spec.mechanism;
  if (spec.intent === undefined || mechanism === undefined) return [];
  const moved = mechanism.split(' + ');
  if (moved.includes('drive')) return [];
  const intent = spec.intent.toLowerCase();
  return POPUP_MOTIONS.flatMap((motion): QaFinding[] => {
    const said = motion.words.exec(intent)?.[0];
    if (said === undefined || motion.shows.some((prop) => moved.includes(prop))) return [];
    return [
      slop(
        `pop-up intent says "${said}" but the pull only moves ${mechanism} (${at}): bind the pull to a piece that ${motion.label}s (${motion.shows.join(', ')}) or say in the intent what really moves.`,
      ),
    ];
  });
}

function subjectFindings(
  spec: PopupSpec,
  call: AnyNode,
  things: ReadonlySet<string>,
  constants: ReadonlyMap<string, string>,
  at: string,
): QaFinding[] {
  if (spec.intent === undefined) return [];
  const intent = new Set(wordsOf(spec.intent));
  const onCard = carried(call, constants);
  const missing = [...things].filter((id) => {
    const words = wordsOf(id);
    if (words.length === 0 || !words.every((word) => intent.has(word))) return false;
    return !onCard.has(`asset:${id}`) && !words.every((word) => onCard.has(word));
  });
  if (missing.length === 0) return [];
  const first = missing[0] ?? '';
  return [
    slop(
      `pop-up intent names ${missing.join(', ')} but no piece of the card carries ${missing.length > 1 ? 'them' : 'it'} (${at}): put the subject on a moving piece ({ kind: 'cutout', id, asset: '${first}' }) so the pull moves what the intent says, or rewrite the intent.`,
    ),
  ];
}

/** Pop-ups whose intent describes a motion or a subject the card does not have. */
export function popupClaimFindings(program: AnyNode, file: string): QaFinding[] {
  const specs = popupSpecs(program);
  if (specs.length === 0) return [];
  const constants = constantStrings(program);
  const things = filmThings(program);
  const calls: AnyNode[] = [];
  visit(program, (node) => {
    if (node.type === 'CallExpression' && calleeName(node) === 'popup') calls.push(node);
  });
  return specs.flatMap((spec, index) => {
    const at = `${file}:${String(spec.line)}`;
    const call = calls[index];
    return [
      ...motionFindings(spec, at),
      ...(call === undefined ? [] : subjectFindings(spec, call, things, constants, at)),
    ];
  });
}
