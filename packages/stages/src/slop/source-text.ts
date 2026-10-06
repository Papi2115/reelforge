/**
 * What a scene's source puts on screen as text, read from its literals (no execution): the first
 * argument of text calls (`ctx.text.title/kinetic/lowerThird`, a world page's `write`, a sheet's
 * `print`, any local `write` helper) and the string values of text options (`text`, `label`,
 * `note`, `band`, `lines`, `caption`, `title`, `subtitle`, `labels`, a strip's `end`, a pop-up's
 * `items`, `marks`, `ends`, `prefix`, `suffix`), also
 * through a `const` holding a literal. Letters drawn from strokes: `stroke-text.ts`. The scene's
 * `meta` object is not on screen. Strings built at run time (`String(year)`, templates with
 * expressions) are not judged.
 */
import { parse, type AnyNode } from 'acorn';
import { visit } from '../scenes/source-checks.js';

export interface OnScreenText {
  readonly text: string;
  readonly line: number;
  /** `timeline-end`: a strip's `end` word (judged against the timeline's era too). */
  readonly role?: 'timeline-end' | undefined;
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

export function onScreenTexts(program: AnyNode): OnScreenText[] {
  const meta = metaRanges(program);
  const constants = constantStrings(program);
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
    if (node.type === 'CallExpression' && name !== undefined && TEXT_METHODS.has(name)) {
      const [first] = node.arguments;
      if (first !== undefined && first.type !== 'SpreadElement')
        add(node, strings(first, constants));
      const second = node.arguments[1];
      if (name === 'lowerThird' && second !== undefined && second.type !== 'SpreadElement') {
        add(node, strings(second, constants));
      }
    }
    const key = propertyKey(node);
    if (node.type === 'Property' && key !== undefined && TEXT_KEYS.has(key)) {
      // An array option is one label written on several lines: judged as one string.
      const lines = strings(node.value, constants);
      const role = key === 'end' ? 'timeline-end' : undefined;
      add(node, node.value.type === 'ArrayExpression' ? [lines.join(' ')] : lines, role);
    }
  });
  return found;
}
