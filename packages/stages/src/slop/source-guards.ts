/**
 * The source guards of docs/worlds/QUALITY.md §8: the human-trace count (the world's trace helpers
 * called at least three times) and stagger variance (≥ 4 sibling marks with identical start gaps
 * or identical durations, or a loop that staggers ≥ 4 items by exactly `i × step`). Timing is read
 * from literal `at`/`dur`/`until` options and from loop expressions; times given as narration
 * phrases or computed at run time are not judged (only what the source declares).
 */
import type { AnyNode } from 'acorn';
import { visit } from '../scenes/source-checks.js';
import { calleeName, literalString, propertyKey } from './source-text.js';
import type { WorldSlopSpec } from './world-labels.js';

/** Fewer traces than this in a world scene → ⚠. */
export const MIN_HUMAN_TRACES = 3;
/** Siblings with identical timing from this many on → ⚠. */
export const UNIFORM_SIBLINGS = 4;
/** Gaps/durations closer than this (s) count as identical. */
const SAME_TIME = 0.005;
/**
 * Steps shorter than this (s) read as one gesture (a run of hand-ticked marks, under two frames
 * at 30 fps apart), not as a stagger the eye can count.
 */
export const MIN_PERCEIVED_STAGGER = 0.05;
/** Option keys that start a mark (s) and that size it. */
const START_KEYS = new Set(['at', 'delay', 'start', 't0']);

export interface TraceCount {
  readonly total: number;
  /** Trace name -> occurrences, in order of first use. */
  readonly found: ReadonlyMap<string, number>;
}

function numberLiteral(node: AnyNode | undefined): number | undefined {
  if (node?.type === 'Literal' && typeof node.value === 'number') return node.value;
  if (node?.type === 'UnaryExpression' && node.operator === '-') {
    const inner = numberLiteral(node.argument);
    return inner === undefined ? undefined : -inner;
  }
  return undefined;
}

export function countTraces(program: AnyNode, spec: WorldSlopSpec): TraceCount {
  const found = new Map<string, number>();
  let total = 0;
  const add = (name: string, weight: number): void => {
    found.set(name, (found.get(name) ?? 0) + 1);
    total += weight;
  };
  visit(program, (node) => {
    const name = calleeName(node);
    const weight = name === undefined ? undefined : spec.traceMethods[name];
    if (name !== undefined && weight !== undefined && Object.hasOwn(spec.traceMethods, name)) {
      add(name, weight);
    }
    const key = propertyKey(node);
    if (node.type !== 'Property' || key === undefined) return;
    for (const option of spec.traceOptions) {
      if (option.key !== key) continue;
      const hit =
        option.value === undefined
          ? numberLiteral(node.value) !== 0
          : literalString(node.value) === option.value;
      if (hit) add(option.trace, 1);
    }
  });
  return { total, found };
}

interface TimedCall {
  readonly name: string;
  readonly line: number;
  readonly at: number;
  readonly duration: number | undefined;
}

/** A call with an options object whose start is a literal number. */
function timedCall(node: AnyNode): TimedCall | undefined {
  const name = calleeName(node);
  if (node.type !== 'CallExpression' || name === undefined) return undefined;
  const values = new Map<string, number>();
  for (const argument of node.arguments) {
    if (argument.type !== 'ObjectExpression') continue;
    for (const property of argument.properties) {
      const key = propertyKey(property);
      const value = property.type === 'Property' ? numberLiteral(property.value) : undefined;
      if (key !== undefined && value !== undefined) values.set(key, value);
    }
  }
  const startKey = [...START_KEYS].find((key) => values.has(key));
  const at = startKey === undefined ? undefined : values.get(startKey);
  if (at === undefined) return undefined;
  const until = values.get('until');
  const duration = values.get('dur') ?? (until === undefined ? undefined : until - at);
  return { name, line: node.loc?.start.line ?? 1, at, duration };
}

/** Statement lists (blocks, function bodies, the module): where siblings live. */
function statementLists(program: AnyNode): AnyNode[][] {
  const lists: AnyNode[][] = [];
  visit(program, (node) => {
    if (node.type === 'BlockStatement' || node.type === 'Program') lists.push([...node.body]);
  });
  return lists;
}

/** The timed calls a statement makes directly (`f(…)`, `const x = f(…)`, `x = f(…)`). */
function statementCall(statement: AnyNode): TimedCall | undefined {
  if (statement.type === 'ExpressionStatement') {
    const expression = statement.expression;
    if (expression.type === 'AssignmentExpression') return timedCall(expression.right);
    return timedCall(expression);
  }
  if (statement.type === 'VariableDeclaration' && statement.declarations.length === 1) {
    const init = statement.declarations[0]?.init;
    return init ? timedCall(init) : undefined;
  }
  return undefined;
}

function sameRun(values: readonly (number | undefined)[]): number {
  let [best, run] = [1, 1];
  for (let index = 1; index < values.length; index += 1) {
    const [previous, current] = [values[index - 1], values[index]];
    const same =
      previous !== undefined && current !== undefined && Math.abs(previous - current) <= SAME_TIME;
    run = same ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

export interface UniformTiming {
  readonly line: number;
  readonly what: string;
}

/** Sibling calls of one method with identical start gaps or identical durations. */
function uniformSiblings(program: AnyNode): UniformTiming[] {
  const found: UniformTiming[] = [];
  for (const list of statementLists(program)) {
    const byName = new Map<string, TimedCall[]>();
    for (const statement of list) {
      const call = statementCall(statement);
      if (call !== undefined) byName.set(call.name, [...(byName.get(call.name) ?? []), call]);
    }
    for (const [name, calls] of byName) {
      if (calls.length < UNIFORM_SIBLINGS) continue;
      const gaps = calls.slice(1).map((call, index) => call.at - (calls[index]?.at ?? 0));
      const line = calls[0]?.line ?? 1;
      const perceived = gaps.some((gap) => gap >= MIN_PERCEIVED_STAGGER);
      if (perceived && sameRun(gaps) >= UNIFORM_SIBLINGS - 1) {
        found.push({ line, what: `${name}() calls start at the same gap (${String(gaps[0])} s)` });
      } else if (sameRun(calls.map((call) => call.duration)) >= UNIFORM_SIBLINGS) {
        found.push({ line, what: `${name}() calls all last ${String(calls[0]?.duration)} s` });
      }
    }
  }
  return found;
}

/** Iterations of `for (let i = A; i < B; i += 1)` with literal bounds; undefined otherwise. */
function loopCount(node: AnyNode): { variable: string; count: number } | undefined {
  if (node.type !== 'ForStatement' || node.init?.type !== 'VariableDeclaration') return undefined;
  const declarator = node.init.declarations[0];
  const start = numberLiteral(declarator?.init ?? undefined);
  if (declarator?.id.type !== 'Identifier' || start === undefined) return undefined;
  const test = node.test;
  if (test?.type !== 'BinaryExpression' || !['<', '<='].includes(test.operator)) return undefined;
  const end = numberLiteral(test.right);
  if (end === undefined) return undefined;
  return { variable: declarator.id.name, count: end - start + (test.operator === '<=' ? 1 : 0) };
}

/** `variable * literal` (either order) with no call anywhere in the expression (no jitter). */
function linearStagger(expression: AnyNode, variable: string): number | undefined {
  const steps: (number | undefined)[] = [];
  const calls: AnyNode[] = [];
  visit(expression, (node) => {
    if (node.type === 'CallExpression') calls.push(node);
    if (node.type !== 'BinaryExpression' || node.operator !== '*') return;
    const [left, right] = [node.left, node.right];
    if (left.type === 'Identifier' && left.name === variable) steps.push(numberLiteral(right));
    if (right.type === 'Identifier' && right.name === variable) steps.push(numberLiteral(left));
  });
  return calls.length > 0 ? undefined : steps[0];
}

/** Loops of ≥ 4 iterations whose items start at exactly `i × step` apart. */
function uniformLoops(program: AnyNode): UniformTiming[] {
  const found: UniformTiming[] = [];
  visit(program, (node) => {
    const loop = loopCount(node);
    if (node.type !== 'ForStatement' || loop === undefined || loop.count < UNIFORM_SIBLINGS) return;
    visit(node.body, (inner) => {
      const key = propertyKey(inner);
      if (inner.type !== 'Property' || key === undefined || !START_KEYS.has(key)) return;
      const step = linearStagger(inner.value, loop.variable);
      if (step === undefined || Math.abs(step) < MIN_PERCEIVED_STAGGER) return;
      found.push({
        line: inner.loc?.start.line ?? 1,
        what: `${String(loop.count)} items start exactly ${String(step)} s apart (${key}: … ${loop.variable} × ${String(step)})`,
      });
    });
  });
  return found;
}

export function uniformTimings(program: AnyNode): UniformTiming[] {
  return [...uniformSiblings(program), ...uniformLoops(program)];
}
