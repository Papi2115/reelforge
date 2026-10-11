/**
 * QA sample times of a Grim Ink shot (PLAN.md#14.19): the critic reviews at least three times per
 * framing of the shot's cut table, not five points spread over the shot (a 0.6 s extreme close-up
 * between them was never seen). The cut table is read from the scene source as the prompts teach
 * it (`s.cuts = [{ at: 0, … }, { at: s.knock, … }]` with `knock: ctx.anchor('knocked twice').t`,
 * `ctx.anchor('…').t + 0.3`, numbers); anchors resolve through the words like the sync checks
 * (the occurrence spoken in the shot). A cut whose time cannot be read is skipped, a table that
 * cannot be read at all leaves the standard smoke times (the CI-safe fallback).
 */
import type { AnyNode } from 'acorn';
import { visit } from '../scenes/source-checks.js';
import { literalString, parseScene, propertyKey } from '../slop/source-text.js';

/** Samples per framing (start, middle, end of the framing). */
export const TIMES_PER_FRAMING = 3;
/** Where in a framing the samples sit (shares of its length, clear of the cuts). */
const FRAMING_SHARES = [0.2, 0.5, 0.8] as const;
/** Sample times per shot at most (5 framings x 3 + the smoke times, deduplicated). */
export const MAX_QA_TIMES = 20;

/** Local seconds of the nth (1-based) occurrence of a phrase in the shot; undefined = unknown. */
export type LocalAnchor = (phrase: string, nth: number) => number | undefined;

type Value = number | { readonly t: number; readonly tEnd: number } | undefined;

const isAnchorCall = (node: AnyNode): node is Extract<AnyNode, { type: 'CallExpression' }> =>
  node.type === 'CallExpression' &&
  ((node.callee.type === 'Identifier' && node.callee.name === 'anchor') ||
    (node.callee.type === 'MemberExpression' &&
      !node.callee.computed &&
      node.callee.property.type === 'Identifier' &&
      node.callee.property.name === 'anchor'));

/** Reads numbers and anchor hits of the scene's own expressions. */
class Evaluator {
  private readonly names = new Map<string, AnyNode>();
  private readonly seen = new Set<AnyNode>();

  constructor(
    program: AnyNode,
    private readonly anchor: LocalAnchor,
  ) {
    // Every `name: expr` and `const name = expr` (later ones win: the build's own).
    visit(program, (node) => {
      if (node.type === 'Property') {
        const key = propertyKey(node);
        if (key !== undefined) this.names.set(key, node.value);
      } else if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init) {
        this.names.set(node.id.name, node.init);
      }
    });
  }

  number(node: AnyNode): number | undefined {
    const value = this.value(node);
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private named(name: string): Value {
    const node = this.names.get(name);
    if (node === undefined || this.seen.has(node)) return undefined;
    this.seen.add(node);
    const value = this.value(node);
    this.seen.delete(node);
    return value;
  }

  private value(node: AnyNode): Value {
    switch (node.type) {
      case 'Literal':
        return typeof node.value === 'number' ? node.value : undefined;
      case 'UnaryExpression': {
        const inner = this.number(node.argument);
        return node.operator === '-' && inner !== undefined ? -inner : undefined;
      }
      case 'BinaryExpression':
        return this.binary(node.operator, node.left, node.right);
      case 'Identifier':
        return this.named(node.name);
      case 'CallExpression':
        return isAnchorCall(node) ? this.anchorHit(node.arguments) : undefined;
      case 'MemberExpression': {
        if (node.computed || node.property.type !== 'Identifier') return undefined;
        const key = node.property.name;
        if (key === 't' || key === 'tEnd') {
          const hit = this.value(node.object);
          return typeof hit === 'object' ? hit[key] : undefined;
        }
        return this.named(key);
      }
      default:
        return undefined;
    }
  }

  private binary(operator: string, left: AnyNode, right: AnyNode): number | undefined {
    if (left.type === 'PrivateIdentifier') return undefined;
    const [a, b] = [this.number(left), this.number(right)];
    if (a === undefined || b === undefined) return undefined;
    if (operator === '+') return a + b;
    if (operator === '-') return a - b;
    if (operator === '*') return a * b;
    return operator === '/' && b !== 0 ? a / b : undefined;
  }

  private anchorHit(args: readonly AnyNode[]): Value {
    const [phraseNode, nthNode] = args;
    const phrase = literalString(phraseNode);
    const nth = nthNode === undefined ? 1 : this.number(nthNode);
    if (phrase === undefined || nth === undefined) return undefined;
    const t = this.anchor(phrase, nth);
    return t === undefined ? undefined : { t, tEnd: t };
  }
}

/** The first `cuts` array of objects with an `at` (a property, `s.cuts = […]`, `const cuts`). */
function cutTable(program: AnyNode): AnyNode[] | undefined {
  let found: AnyNode[] | undefined;
  const consider = (node: AnyNode | null | undefined): void => {
    if (found !== undefined || node?.type !== 'ArrayExpression') return;
    const objects = node.elements.filter(
      (element): element is Extract<AnyNode, { type: 'ObjectExpression' }> =>
        element?.type === 'ObjectExpression',
    );
    if (objects.length > 0 && objects.every((entry) => atOf(entry) !== undefined)) found = objects;
  };
  visit(program, (node) => {
    if (node.type === 'Property' && propertyKey(node) === 'cuts') consider(node.value);
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
      if (node.id.name === 'cuts') consider(node.init);
    }
    if (
      node.type === 'AssignmentExpression' &&
      node.left.type === 'MemberExpression' &&
      node.left.property.type === 'Identifier' &&
      node.left.property.name === 'cuts'
    ) {
      consider(node.right);
    }
  });
  return found;
}

function atOf(entry: AnyNode): AnyNode | undefined {
  if (entry.type !== 'ObjectExpression') return undefined;
  for (const property of entry.properties) {
    if (property.type === 'Property' && propertyKey(property) === 'at') return property.value;
  }
  return undefined;
}

/** Start times (local s, ascending, inside the shot) of the cut table's framings. */
export function framingStarts(
  source: string,
  duration: number,
  anchor: LocalAnchor,
): number[] | undefined {
  const program = parseScene(source);
  if (program === undefined) return undefined;
  const table = cutTable(program);
  if (table === undefined) return undefined;
  const evaluator = new Evaluator(program, anchor);
  const starts = table
    .map((entry) => {
      const at = atOf(entry);
      return at === undefined ? undefined : evaluator.number(at);
    })
    .filter((at): at is number => at !== undefined)
    .map((at) => Math.min(Math.max(at, 0), duration))
    .sort((a, b) => a - b);
  const unique = [...new Set(starts)].filter((at) => at < duration);
  if (unique.length === 0) return undefined;
  return unique[0] === 0 ? unique : [0, ...unique];
}

const round = (t: number): number => Math.round(t * 1000) / 1000;

/**
 * At least TIMES_PER_FRAMING sample times per framing of the cut table, merged with `smoke`
 * (the standard points); just `smoke` when the table cannot be read.
 */
export function framingQaTimes(
  source: string,
  duration: number,
  anchor: LocalAnchor,
  smoke: readonly number[],
): number[] {
  const starts = framingStarts(source, duration, anchor);
  if (starts === undefined) return [...smoke];
  const framed = starts.flatMap((start, index) => {
    const end = starts[index + 1] ?? duration;
    return FRAMING_SHARES.map((share) => round(start + (end - start) * share));
  });
  const all = [...new Set([...framed, ...smoke])].sort((a, b) => a - b);
  if (all.length <= MAX_QA_TIMES) return all;
  // Keep every framing's samples, drop smoke points that crowd them.
  const kept = new Set(framed);
  return all.filter((t) => kept.has(t)).slice(0, MAX_QA_TIMES);
}
