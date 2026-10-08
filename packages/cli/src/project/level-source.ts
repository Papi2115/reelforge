/**
 * The Game B2 levels a scene source writes, read without running it (`reelforge validate level`):
 * every object literal with a `grid` and a `legend` (the level format, kit `checkLevel`) and every
 * built-in level a `level: 'office'` option names. A level is read through literals, `const`
 * names and spreads of them; one built at run time (a `.map`, a call) cannot be read here and is
 * reported with its line (the kit still checks it when the scene builds).
 */
import { parse, type AnyNode } from 'acorn';

export type SourceLevel =
  | { readonly kind: 'object'; readonly line: number; readonly value: unknown }
  | { readonly kind: 'built-in'; readonly line: number; readonly name: string }
  | { readonly kind: 'unreadable'; readonly line: number; readonly reason: string };

export type SceneLevels =
  | { readonly ok: true; readonly levels: readonly SourceLevel[] }
  | { readonly ok: false; readonly error: string };

/** How deep `const` names may refer to each other (a cycle stops here). */
const MAX_DEPTH = 12;

class Unreadable extends Error {
  constructor(
    readonly reason: string,
    readonly line: number,
  ) {
    super(reason);
  }
}

const lineOf = (node: AnyNode): number => node.loc?.start.line ?? 1;

function isNode(value: unknown): value is AnyNode {
  return typeof value === 'object' && value !== null && 'type' in value && 'start' in value;
}

/** Every node of the tree, depth first. */
function walk(node: AnyNode, visit: (node: AnyNode) => void): void {
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) walk(item, visit);
    } else if (isNode(value)) walk(value, visit);
  }
}

function keyOf(node: AnyNode): string | undefined {
  if (node.type !== 'Property' || node.computed) return undefined;
  if (node.key.type === 'Identifier') return node.key.name;
  return node.key.type === 'Literal' ? String(node.key.value) : undefined;
}

function constants(program: AnyNode): Map<string, AnyNode> {
  const found = new Map<string, AnyNode>();
  walk(program, (node) => {
    if (node.type !== 'VariableDeclaration' || node.kind !== 'const') return;
    for (const declarator of node.declarations) {
      if (declarator.id.type === 'Identifier' && declarator.init) {
        found.set(declarator.id.name, declarator.init);
      }
    }
  });
  return found;
}

/** The value of a literal expression (objects, arrays, strings, numbers, consts, spreads). */
function literal(node: AnyNode, consts: ReadonlyMap<string, AnyNode>, depth = 0): unknown {
  if (depth > MAX_DEPTH)
    throw new Unreadable('its names refer to each other too deeply', lineOf(node));
  const next = (child: AnyNode): unknown => literal(child, consts, depth + 1);
  switch (node.type) {
    case 'Literal':
      if (node.value instanceof RegExp || typeof node.value === 'bigint') break;
      return node.value;
    case 'TemplateLiteral':
      if (node.expressions.length > 0) break;
      return node.quasis[0]?.value.cooked ?? '';
    case 'UnaryExpression': {
      const value = next(node.argument);
      if (typeof value === 'number' && (node.operator === '-' || node.operator === '+')) {
        return node.operator === '-' ? -value : value;
      }
      break;
    }
    case 'Identifier': {
      if (node.name === 'undefined') return undefined;
      const init = consts.get(node.name);
      if (init === undefined)
        throw new Unreadable(`"${node.name}" is not a const here`, lineOf(node));
      return next(init);
    }
    case 'ArrayExpression':
      return node.elements.flatMap((element) => {
        if (element === null) throw new Unreadable('an array has a hole', lineOf(node));
        if (element.type !== 'SpreadElement') return [next(element)];
        const spread = next(element.argument);
        if (!Array.isArray(spread))
          throw new Unreadable('a spread is not an array', lineOf(element));
        return spread as unknown[];
      });
    case 'ObjectExpression': {
      const value: Record<string, unknown> = {};
      for (const entry of node.properties) {
        if (entry.type === 'SpreadElement') {
          const spread = next(entry.argument);
          if (typeof spread !== 'object' || spread === null) {
            throw new Unreadable('a spread is not an object', lineOf(entry));
          }
          Object.assign(value, spread);
          continue;
        }
        const key = keyOf(entry);
        if (key === undefined) throw new Unreadable('a computed key', lineOf(entry));
        value[key] = next(entry.value);
      }
      return value;
    }
    default:
      break;
  }
  throw new Unreadable(`a ${node.type} is computed when the scene runs`, lineOf(node));
}

function isLevelObject(node: AnyNode): boolean {
  if (node.type !== 'ObjectExpression') return false;
  const keys = new Set(node.properties.map((entry) => keyOf(entry)));
  return keys.has('grid') && keys.has('legend');
}

/** The levels a scene source writes or names, in source order. */
export function levelsInScene(source: string): SceneLevels {
  let program: AnyNode;
  try {
    program = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  } catch (error) {
    if (error instanceof SyntaxError) return { ok: false, error: error.message };
    throw error;
  }
  const consts = constants(program);
  const levels: SourceLevel[] = [];
  walk(program, (node) => {
    if (isLevelObject(node)) {
      try {
        levels.push({ kind: 'object', line: lineOf(node), value: literal(node, consts) });
      } catch (error) {
        if (!(error instanceof Unreadable)) throw error;
        levels.push({ kind: 'unreadable', line: error.line, reason: error.reason });
      }
      return;
    }
    if (keyOf(node) !== 'level' || node.type !== 'Property') return;
    const value = node.value;
    if (value.type === 'Literal' && typeof value.value === 'string') {
      levels.push({ kind: 'built-in', line: lineOf(node), name: value.value });
    }
  });
  return { ok: true, levels };
}
