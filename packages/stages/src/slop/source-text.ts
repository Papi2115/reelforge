/**
 * What a scene's source puts on screen as text, read from its literals (no execution): the first
 * argument of text calls (`ctx.text.title/kinetic/lowerThird`, a world page's `write`, a sheet's
 * `print`, any local `write` helper) and the string values of text options (`text`, `label`,
 * `note`, `band`, `lines`, `caption`, `title`, `subtitle`, `labels`, a strip's `end`, a pop-up's
 * `items`, `marks`, `ends`, `prefix`, `suffix`), also
 * through a `const` holding a literal; a world adds its own lettering calls and options (Comic:
 * `caption`, `balloon`, `sfx`, `note`, `stamp`, `g.text`, a flashback's `when`; Game B2: the HUD's
 * `narrate`/`say`/`stinger`, option keys read only inside one call (a boss bar's `name`) and
 * numbers on screen (a tally row's `value`); `WorldText`).
 * Letters drawn from strokes: `stroke-text.ts`. The scene's
 * `meta` object is not on screen. Strings built at run time (`String(year)`, templates with
 * expressions) are not judged.
 */
import { parse, type AnyNode } from 'acorn';
import { visit } from '../scenes/source-checks.js';

export interface OnScreenText {
  readonly text: string;
  readonly line: number;
  /**
   * `timeline-end`: a strip's `end` word (judged against the timeline's era too); `sound`: an
   * onomatopoeia (the world's sound words are not invented there); `correction`: a word a red
   * pen strikes or writes (a label: any unknown word is invented).
   */
  readonly role?: 'timeline-end' | 'sound' | 'correction' | undefined;
}

/** A world's own lettering (`WorldSlopSpec`): more text calls and options, sound calls. */
export interface WorldText {
  readonly textMethods?: readonly string[] | undefined;
  readonly textKeys?: readonly string[] | undefined;
  readonly soundMethods?: readonly string[] | undefined;
  /** Option keys that are on-screen text only inside the named call (`boss: ['name']`). */
  readonly textCallKeys?: Readonly<Record<string, readonly string[]>> | undefined;
  /** Option keys whose number literals are on screen (a tally row's `value`). */
  readonly numberKeys?: readonly string[] | undefined;
  /** Call -> option of `[t, value]` keys whose values are on screen (Game B1 `counter: 'keys'`). */
  readonly keyedNumbers?: Readonly<Record<string, string>> | undefined;
  /** Text options that are a correction (Game B1 manual `strike` / `write`). */
  readonly correctionKeys?: readonly string[] | undefined;
}

const TEXT_METHODS = new Set(['write', 'print', 'title', 'kinetic', 'lowerThird', 'typewriter']);
const TEXT_KEYS = new Set([
  'text',
  'label',
  'labels',
  'note',
  'band',
  'lines',
  'caption',
  'title',
  'subtitle',
  'end',
  // Pop-up pieces (kit popup-schema.ts): window items, gauge marks, scale ends, counter affixes.
  'items',
  'marks',
  'ends',
  'prefix',
  'suffix',
]);

/** The scene's AST; undefined when it does not parse (the determinism lint reports that). */
export function parseScene(source: string): AnyNode | undefined {
  try {
    return parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

/** A literal string (or a template without expressions); undefined otherwise. */
export function literalString(node: AnyNode | undefined): string | undefined {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
}

/** Name of a call's callee: `write` for `write(…)`, `page.write(…)`, `book.page(0).write(…)`. */
export function calleeName(node: AnyNode): string | undefined {
  if (node.type !== 'CallExpression') return undefined;
  const callee = node.callee;
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression' && !callee.computed) {
    return callee.property.type === 'Identifier' ? callee.property.name : undefined;
  }
  return undefined;
}

/** Property key of a non-computed object property. */
export function propertyKey(node: AnyNode): string | undefined {
  if (node.type !== 'Property' || node.computed) return undefined;
  if (node.key.type === 'Identifier') return node.key.name;
  return node.key.type === 'Literal' && typeof node.key.value === 'string'
    ? node.key.value
    : undefined;
}

/** Nodes inside `const meta = {…}` (the scene's id and title are not on screen). */
function metaRanges(program: AnyNode): (readonly [number, number])[] {
  const ranges: (readonly [number, number])[] = [];
  visit(program, (node) => {
    if (node.type !== 'VariableDeclarator' || node.id.type !== 'Identifier') return;
    if (node.id.name === 'meta' && node.init) ranges.push([node.init.start, node.init.end]);
  });
  return ranges;
}

/** `const name = 'literal'` declarations (a text written through a variable). */
export function constantStrings(program: AnyNode): Map<string, string> {
  const constants = new Map<string, string>();
  visit(program, (node) => {
    if (node.type !== 'VariableDeclaration' || node.kind !== 'const') return;
    for (const declarator of node.declarations) {
      const value = literalString(declarator.init ?? undefined);
      if (declarator.id.type === 'Identifier' && value !== undefined) {
        constants.set(declarator.id.name, value);
      }
    }
  });
  return constants;
}

export function strings(node: AnyNode, constants: ReadonlyMap<string, string>): string[] {
  const single = literalString(node);
  if (single !== undefined) return [single];
  const constant = node.type === 'Identifier' ? constants.get(node.name) : undefined;
  if (constant !== undefined) return [constant];
  if (node.type !== 'ArrayExpression') return [];
  return node.elements.flatMap((element) =>
    element === null || element.type === 'SpreadElement' ? [] : strings(element, constants),
  );
}

/** A number literal (with a sign) as it is shown; undefined for anything else. */
function shownNumber(node: AnyNode): string | undefined {
  if (node.type === 'Literal' && typeof node.value === 'number') return String(node.value);
  if (node.type === 'UnaryExpression' && node.operator === '-') {
    const inner = shownNumber(node.argument);
    return inner === undefined ? undefined : `-${inner}`;
  }
  return undefined;
}

/**
 * The shown values of a call's literal `[[t, value], …]` option (a counter's keys): its first and
 * last value and any key outside them; the keys in between are the steps of a count running from
 * one to the other (a day counter 1 → 9 → 17 → 40), not claims of their own.
 */
function keyedValues(call: AnyNode, key: string): { node: AnyNode; texts: string[] }[] {
  if (call.type !== 'CallExpression') return [];
  const keys: { node: AnyNode; value: number; shown: string }[] = [];
  for (const argument of call.arguments) {
    if (argument.type !== 'ObjectExpression') continue;
    for (const property of argument.properties) {
      if (propertyKey(property) !== key || property.type !== 'Property') continue;
      if (property.value.type !== 'ArrayExpression') continue;
      for (const pair of property.value.elements) {
        const value = pair?.type === 'ArrayExpression' ? pair.elements[1] : undefined;
        const shown = value === null || value === undefined ? undefined : shownNumber(value);
        if (pair && shown !== undefined) keys.push({ node: pair, value: Number(shown), shown });
      }
    }
  }
  const [first, last] = [keys[0], keys.at(-1)];
  if (first === undefined || last === undefined) return [];
  const [low, high] = [Math.min(first.value, last.value), Math.max(first.value, last.value)];
  return keys
    .filter((entry, index) => {
      const end = index === 0 || index === keys.length - 1;
      return end || entry.value < low || entry.value > high;
    })
    .map((entry) => ({ node: entry.node, texts: [entry.shown] }));
}

/** String values of `keys` anywhere in a call's arguments (the call's own text options). */
function callOptionTexts(
  call: AnyNode,
  keys: ReadonlySet<string>,
  constants: ReadonlyMap<string, string>,
): { node: AnyNode; texts: string[] }[] {
  if (call.type !== 'CallExpression') return [];
  const found: { node: AnyNode; texts: string[] }[] = [];
  for (const argument of call.arguments) {
    visit(argument, (node) => {
      const key = propertyKey(node);
      if (node.type === 'Property' && key !== undefined && keys.has(key)) {
        found.push({ node, texts: strings(node.value, constants) });
      }
    });
  }
  return found;
}

export function onScreenTexts(program: AnyNode, world: WorldText = {}): OnScreenText[] {
  const meta = metaRanges(program);
  const constants = constantStrings(program);
  const methods = new Set([...TEXT_METHODS, ...(world.textMethods ?? [])]);
  const keys = new Set([...TEXT_KEYS, ...(world.textKeys ?? [])]);
  const sounds = new Set(world.soundMethods ?? []);
  const numberKeys = new Set(world.numberKeys ?? []);
  const callKeys = world.textCallKeys ?? {};
  const keyed = world.keyedNumbers ?? {};
  const corrections = new Set(world.correctionKeys ?? []);
  const inMeta = (node: AnyNode): boolean =>
    meta.some(([start, end]) => node.start >= start && node.end <= end);
  const found: OnScreenText[] = [];
  const add = (node: AnyNode, texts: readonly string[], role?: OnScreenText['role']): void => {
    for (const text of texts) {
      const line = node.loc?.start.line ?? 1;
      if (text.trim().length > 0)
        found.push(role === undefined ? { text, line } : { text, line, role });
    }
  };
  visit(program, (node) => {
    if (inMeta(node)) return;
    const name = calleeName(node);
    if (node.type === 'CallExpression' && name !== undefined && methods.has(name)) {
      const [first] = node.arguments;
      if (first !== undefined && first.type !== 'SpreadElement')
        add(node, strings(first, constants), sounds.has(name) ? 'sound' : undefined);
      const second = node.arguments[1];
      if (name === 'lowerThird' && second !== undefined && second.type !== 'SpreadElement') {
        add(node, strings(second, constants));
      }
    }
    const ownKeys =
      name !== undefined && Object.hasOwn(callKeys, name) ? callKeys[name] : undefined;
    if (ownKeys !== undefined) {
      for (const entry of callOptionTexts(node, new Set(ownKeys), constants)) {
        add(entry.node, entry.texts);
      }
    }
    const keyedOption = name !== undefined && Object.hasOwn(keyed, name) ? keyed[name] : undefined;
    if (keyedOption !== undefined) {
      for (const entry of keyedValues(node, keyedOption)) add(entry.node, entry.texts);
    }
    const key = propertyKey(node);
    if (node.type === 'Property' && key !== undefined && keys.has(key)) {
      // An array option is one label written on several lines: judged as one string.
      const lines = strings(node.value, constants);
      const role = key === 'end' ? 'timeline-end' : corrections.has(key) ? 'correction' : undefined;
      add(node, node.value.type === 'ArrayExpression' ? [lines.join(' ')] : lines, role);
    }
    if (node.type === 'Property' && key !== undefined && numberKeys.has(key)) {
      const shown = shownNumber(node.value);
      if (shown !== undefined) add(node, [shown]);
    }
  });
  return found;
}
