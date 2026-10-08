/**
 * Kit cues of a scene (real runs Game B1 1 #10, Game B1 2 #7): a world toolkit returns its own
 * sound cues (`for (const c of r.cues) ctx.sfx.at(c.t, c.name)`: row ticks, blips, a swoosh) timed
 * by the kit's craft, not by a spoken word. The sync check judges only the cues the scene anchors
 * itself; a kit cue near a word but not on it is free (4 of 6 fix turns of one film moved or
 * deleted them). Read from the source: calls inside a loop or `forEach` over something named
 * `cues` are kit calls; the scene's other `sfx.at` calls with a literal name are its own. A name
 * the scene schedules once is checked once (its cue nearest an anchor); a name it schedules in a
 * loop or a helper, or any computed name, keeps every cue checked (as before).
 */
import type { AnyNode, CallExpression } from 'acorn';
import { literalString, parseScene } from '../slop/source-text.js';
import { ownerIs, visit } from './source-checks.js';

type Range = readonly [number, number];

interface SfxSchedule {
  /** Whether some `sfx.at` call is inside a loop over kit cues. */
  readonly kitLoops: boolean;
  /** The scene's own calls (literal name, run once) per name. */
  readonly once: ReadonlyMap<string, number>;
  /** Names the scene schedules from a loop or a helper. */
  readonly repeated: ReadonlySet<string>;
  /** A scene call with a computed name: no cue can be told apart. */
  readonly computed: boolean;
}

const LOOPS = new Set([
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
]);
const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const ITERATORS = new Set(['forEach', 'map']);

function mentionsCues(node: AnyNode): boolean {
  let found = false;
  visit(node, (inner) => {
    if (inner.type === 'Identifier' && /cues$/i.test(inner.name)) found = true;
  });
  return found;
}

function isSfxAt(node: AnyNode): node is CallExpression {
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') return false;
  const { callee } = node;
  return (
    !callee.computed &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'at' &&
    ownerIs(callee.object, 'sfx')
  );
}

/** Loop bodies and iterator callbacks over kit cues; every loop body; every function. */
function scheduleRanges(program: AnyNode): { kit: Range[]; loops: Range[]; functions: Range[] } {
  const ranges = { kit: [] as Range[], loops: [] as Range[], functions: [] as Range[] };
  visit(program, (node) => {
    if (FUNCTIONS.has(node.type)) ranges.functions.push([node.start, node.end]);
    if (node.type === 'ForOfStatement' && mentionsCues(node.right)) {
      ranges.kit.push([node.body.start, node.body.end]);
    } else if (LOOPS.has(node.type)) {
      ranges.loops.push([node.start, node.end]);
    }
    if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') return;
    const { callee } = node;
    const iterator = callee.property.type === 'Identifier' && ITERATORS.has(callee.property.name);
    const [callback] = node.arguments;
    if (iterator && callback !== undefined && mentionsCues(callee.object)) {
      ranges.kit.push([callback.start, callback.end]);
    }
  });
  return ranges;
}

function sfxSchedule(program: AnyNode): SfxSchedule {
  const ranges = scheduleRanges(program);
  const inside = (node: AnyNode, list: readonly Range[]): number =>
    list.filter(([start, end]) => node.start >= start && node.end <= end).length;
  const once = new Map<string, number>();
  const repeated = new Set<string>();
  let [kitLoops, computed] = [false, false];
  visit(program, (node) => {
    if (!isSfxAt(node)) return;
    if (inside(node, ranges.kit) > 0) {
      kitLoops = true;
      return;
    }
    const nameNode = node.arguments[1];
    const name = nameNode === undefined ? undefined : literalString(nameNode);
    if (name === undefined) computed = true;
    else if (inside(node, ranges.loops) > 0 || inside(node, ranges.functions) > 1) {
      repeated.add(name);
    } else once.set(name, (once.get(name) ?? 0) + 1);
  });
  return { kitLoops, once, repeated, computed };
}

/**
 * The cues of `cues` that come from the scene's kit loops (free unless on a word). Per name the
 * scene's own calls claim the cues nearest an anchor; the rest are the kit's.
 */
export function kitCues<Cue extends { readonly t: number; readonly name: string }>(
  source: string | undefined,
  cues: readonly Cue[],
  anchors: readonly { readonly t: number }[],
): Set<Cue> {
  const program = source === undefined ? undefined : parseScene(source);
  const kit = new Set<Cue>();
  if (program === undefined) return kit;
  const schedule = sfxSchedule(program);
  if (!schedule.kitLoops || schedule.computed) return kit;
  const distance = (cue: Cue): number =>
    Math.min(Infinity, ...anchors.map((anchor) => Math.abs(cue.t - anchor.t)));
  for (const name of new Set(cues.map((cue) => cue.name))) {
    if (schedule.repeated.has(name)) continue;
    const named = cues
      .filter((cue) => cue.name === name)
      .sort((first, second) => distance(first) - distance(second));
    for (const cue of named.slice(schedule.once.get(name) ?? 0)) kit.add(cue);
  }
  return kit;
}
