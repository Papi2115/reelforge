/**
 * Static reading of a prop module's `export const prop = { ... }` (PLAN.md#7.4): the metadata
 * (name, description, params, anchors, methods) must be literal JSON values, so kit-docs can list
 * a project prop without running its code; `build` is the only function.
 */
import { parsePropMeta, type PropMeta } from '@reelforge/kit';
import { parse, type AnyNode, type ObjectExpression, type Program } from 'acorn';
import { staticKey } from './ast.js';

/** Keys of `prop` besides `build`. */
export const PROP_META_KEYS: readonly string[] = [
  'name',
  'description',
  'params',
  'anchors',
  'methods',
];

export type StaticValue =
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly node: AnyNode };

/** JSON value of a literal expression (numbers, strings, booleans, null, arrays, objects). */
export function staticValue(node: AnyNode): StaticValue {
  switch (node.type) {
    case 'Literal':
      if (node.value instanceof RegExp || typeof node.value === 'bigint')
        return { ok: false, node };
      return { ok: true, value: node.value };
    case 'TemplateLiteral':
      return node.expressions.length === 0
        ? { ok: true, value: node.quasis[0]?.value.cooked ?? '' }
        : { ok: false, node };
    case 'UnaryExpression': {
      if (node.operator !== '-' || node.argument.type !== 'Literal') return { ok: false, node };
      const value = node.argument.value;
      return typeof value === 'number' ? { ok: true, value: -value } : { ok: false, node };
    }
    case 'ArrayExpression': {
      const items: unknown[] = [];
      for (const element of node.elements) {
        if (element === null || element.type === 'SpreadElement') {
          return { ok: false, node: element ?? node };
        }
        const item = staticValue(element);
        if (!item.ok) return item;
        items.push(item.value);
      }
      return { ok: true, value: items };
    }
    case 'ObjectExpression':
      return staticObject(node);
    default:
      return { ok: false, node };
  }
}

function staticObject(node: ObjectExpression): StaticValue {
  const value: Record<string, unknown> = {};
  for (const property of node.properties) {
    if (property.type === 'SpreadElement' || property.kind !== 'init' || property.method) {
      return { ok: false, node: property };
    }
    const key = staticKey(property.key, property.computed);
    if (key === undefined) return { ok: false, node: property.key };
    const item = staticValue(property.value);
    if (!item.ok) return item;
    value[key] = item.value;
  }
  return { ok: true, value };
}

/** The `prop` object literal of a module (`export const prop = {...}`), if any. */
export function findPropObject(program: Program): ObjectExpression | AnyNode | undefined {
  for (const statement of program.body) {
    if (statement.type !== 'ExportNamedDeclaration') continue;
    const declaration = statement.declaration;
    if (declaration?.type !== 'VariableDeclaration') continue;
    for (const declarator of declaration.declarations) {
      if (declarator.id.type === 'Identifier' && declarator.id.name === 'prop') {
        return declarator.init ?? declarator;
      }
    }
  }
  return undefined;
}

export type PropMetaResult =
  { readonly ok: true; readonly meta: PropMeta } | { readonly ok: false; readonly error: string };

/**
 * The checked metadata of a prop module source, read without running it (for kit-docs). The
 * error explains what is wrong; `reelforge lint` gives the located diagnostics.
 */
export function extractPropMeta(source: string, filename: string): PropMetaResult {
  let program: Program;
  try {
    program = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return { ok: false, error: `${filename} is not valid JavaScript: ${error.message}` };
  }
  const prop = findPropObject(program);
  if (prop?.type !== 'ObjectExpression') {
    return { ok: false, error: `${filename} does not export \`const prop = { ... }\`` };
  }
  const meta: Record<string, unknown> = {};
  for (const property of prop.properties) {
    if (property.type === 'SpreadElement') continue;
    const key = staticKey(property.key, property.computed);
    if (key === undefined || !PROP_META_KEYS.includes(key)) continue;
    const value = staticValue(property.value);
    if (!value.ok) return { ok: false, error: `${filename}: prop.${key} is not a literal value` };
    meta[key] = value.value;
  }
  try {
    return { ok: true, meta: parsePropMeta(meta, filename) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
