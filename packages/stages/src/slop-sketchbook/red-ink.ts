/**
 * The Sketchbook red pen (real run Sketchbook 4): red is the correction pen, one correction on the
 * point of a page (a struck word and its fix, the one key number or result, a loop or tick on it).
 * Source checks, warnings only:
 * - too many red marks on one page (s05: a loop and three red ticks);
 * - a second red word on one page: labels in red next to the red point;
 * - a struck-out word the sources never say (s11 pencils "fact" and strikes it: an invented
 *   correction the text-provenance guard lets through as one paraphrased word).
 * The struck write is the one whose position shares the crossOut's coordinates (literal boxes that
 * overlap, or the same variables), else the write just before the crossOut.
 */
import type { AnyNode, CallExpression } from 'acorn';
import type { QaFinding } from '@reelforge/shared';
import { finding } from '../scenes/checks.js';
import { visit } from '../scenes/source-checks.js';
import {
  calleeName,
  constantStrings,
  literalString,
  propertyKey,
  strings,
} from '../slop/source-text.js';
import { isFunctionWord, knownWord, tokenize, type Vocabulary } from '../slop/vocabulary.js';

/** Red marks one page may have (a struck word, its red fix and a loop). */
export const MAX_RED_MARKS = 3;
/** Margin around a literal crossOut box that still strikes a word (page px). */
const STRIKE_MARGIN = 14;

const slop = (message: string): QaFinding => finding('slop', 'warning', message);

function option(node: AnyNode | undefined, key: string): AnyNode | undefined {
  if (node?.type !== 'ObjectExpression') return undefined;
  for (const entry of node.properties) {
    if (entry.type === 'Property' && propertyKey(entry) === key) return entry.value;
  }
  return undefined;
}

function number(node: AnyNode | undefined): number | undefined {
  if (node?.type === 'Literal' && typeof node.value === 'number') return node.value;
  if (node?.type === 'UnaryExpression' && node.operator === '-') {
    const inner = number(node.argument);
    return inner === undefined ? undefined : -inner;
  }
  return undefined;
}

/** `a`, `s.label` (a trailing `.x`/`.y`/`.size` dropped) for every variable an expression reads. */
function pathsOf(node: AnyNode | undefined, into: Set<string>): void {
  if (node === undefined) return;
  const roots = new Set<AnyNode>();
  visit(node, (current) => {
    if (current.type === 'MemberExpression') roots.add(current.object);
  });
  visit(node, (current) => {
    if (current.type === 'Identifier' && !roots.has(current)) into.add(current.name);
    if (current.type === 'MemberExpression' && !current.computed) {
      const parts: string[] = [];
      let at: AnyNode = current;
      while (at.type === 'MemberExpression' && !at.computed && at.property.type === 'Identifier') {
        parts.unshift(at.property.name);
        at = at.object;
      }
      if (at.type === 'Identifier') {
        const path = [at.name, ...parts];
        if (['x', 'y', 'size'].includes(path.at(-1) ?? '')) path.pop();
        into.add(path.join('.'));
      }
    }
  });
}

interface Write {
  readonly text: string;
  readonly line: number;
  readonly order: number;
  readonly red: boolean;
  readonly options: AnyNode | undefined;
}

interface PageCalls {
  readonly writes: Write[];
  readonly strikes: { readonly call: CallExpression; readonly order: number }[];
  /** Lines of every call drawn with `tool: 'red'`. */
  readonly red: number[];
}

function isRed(call: CallExpression): boolean {
  return call.arguments.some((argument) => literalString(option(argument, 'tool')) === 'red');
}

function collect(program: AnyNode): PageCalls {
  const constants = constantStrings(program);
  const calls: PageCalls = { writes: [], strikes: [], red: [] };
  let order = 0;
  visit(program, (node) => {
    if (node.type !== 'CallExpression') return;
    order += 1;
    const name = calleeName(node);
    const line = node.loc?.start.line ?? 1;
    if (isRed(node)) calls.red.push(line);
    if (name === 'crossOut') calls.strikes.push({ call: node, order });
    const first = node.arguments[0];
    if (name !== 'write' || first === undefined || first.type === 'SpreadElement') return;
    const options = node.arguments[1]?.type === 'SpreadElement' ? undefined : node.arguments[1];
    for (const text of strings(first, constants)) {
      calls.writes.push({ text, line, order, red: isRed(node), options });
    }
  });
  return calls;
}

/** The literal crossOut box hits the literal write point. */
function literalHit(strike: CallExpression, write: Write): boolean {
  const [x, y, w, h] = strike.arguments.slice(0, 4).map((node) => number(node));
  const [wx, wy] = [number(option(write.options, 'x')), number(option(write.options, 'y'))];
  if ([x, y, w, h, wx, wy].some((value) => value === undefined)) return false;
  const size = number(option(write.options, 'size')) ?? 24;
  const [px, py] = [(wx ?? 0) + size * 0.3, (wy ?? 0) - size * 0.4];
  return (
    px >= (x ?? 0) - STRIKE_MARGIN &&
    px <= (x ?? 0) + (w ?? 0) + STRIKE_MARGIN &&
    py >= (y ?? 0) - STRIKE_MARGIN &&
    py <= (y ?? 0) + (h ?? 0) + STRIKE_MARGIN
  );
}

function sharesPlace(strike: CallExpression, write: Write): boolean {
  const struck = new Set<string>();
  for (const node of strike.arguments.slice(0, 2)) pathsOf(node, struck);
  const placed = new Set<string>();
  pathsOf(option(write.options, 'x'), placed);
  pathsOf(option(write.options, 'y'), placed);
  if (write.options?.type === 'ObjectExpression') {
    for (const entry of write.options.properties) {
      if (entry.type === 'SpreadElement') pathsOf(entry.argument, placed);
    }
  }
  return [...struck].some((path) => placed.has(path));
}

/** The write a crossOut strikes (see the module comment). */
function struckWrite(
  strike: { call: CallExpression; order: number },
  writes: readonly Write[],
): Write | undefined {
  const plain = writes.filter((write) => !write.red);
  const before = (list: readonly Write[]) =>
    list.filter((write) => write.order < strike.order).at(-1) ?? list[0];
  const literal = plain.filter((write) => literalHit(strike.call, write));
  if (literal.length > 0) return before(literal);
  const shared = plain.filter((write) => sharesPlace(strike.call, write));
  if (shared.length > 0) return before(shared);
  return plain.filter((write) => write.order < strike.order).at(-1);
}

/** A shortening that drops letters ("yrs" of "years", "mths" of "months"): same first letter, letters in order. */
function isShortening(vocabulary: Vocabulary, word: string): boolean {
  if (word.length < 3) return false;
  for (const known of vocabulary.words) {
    if (known.length <= word.length || known[0] !== word[0]) continue;
    let at = 0;
    for (const letter of known) if (letter === word[at]) at += 1;
    if (at === word.length) return true;
  }
  return false;
}

function unknownWords(text: string, vocabulary: Vocabulary): string[] {
  return tokenize(text).flatMap((token) => {
    if (token.number !== undefined) {
      return token.number <= 1 || vocabulary.numbers.includes(token.number) ? [] : [token.text];
    }
    if (token.text.length < 2 || isFunctionWord(token.text)) return [];
    return knownWord(vocabulary, token.text) || isShortening(vocabulary, token.text)
      ? []
      : [token.text];
  });
}

/** Red-pen findings of one Sketchbook scene (see the module comment). */
export function redInkFindings(
  program: AnyNode,
  file: string,
  vocabulary: Vocabulary,
): QaFinding[] {
  const page = collect(program);
  const out: QaFinding[] = [];
  if (page.red.length > MAX_RED_MARKS) {
    out.push(
      slop(
        `${String(page.red.length)} red marks on one page (${file}:${page.red.join(', ')}): red is the correction pen, one correction on the point per page; draw the rest in felt-tip, ballpoint or pencil.`,
      ),
    );
  }
  const redWrites = page.writes.filter((entry) => entry.red);
  for (const write of redWrites.filter((entry) => entry.order !== redWrites[0]?.order)) {
    out.push(
      slop(
        `second red word "${write.text}" on one page (${file}:${String(write.line)}): red marks only the one point of the page (the correction or the key number); write labels in felt-tip or marker.`,
      ),
    );
  }
  for (const strike of page.strikes) {
    const write = struckWrite(strike, page.writes);
    const unknown = write === undefined ? [] : unknownWords(write.text, vocabulary);
    if (write === undefined || unknown.length === 0) continue;
    out.push(
      slop(
        `struck-out "${write.text}" (${file}:${String(write.line)}) is not in the narration or research (${unknown.join(', ')}): a correction strikes a wrong idea the film really names; strike that, or drop the correction.`,
      ),
    );
  }
  return out;
}
