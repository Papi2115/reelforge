/**
 * Letters drawn from strokes (real film 2, s09): a scene-local glyph table (`{ D: [[…]], A: […],
 * Y: […] }`) and a helper that walks a string and draws each character's strokes. Such text never
 * goes through `page.write`, so it is read here instead: the string arguments of the scene's own
 * functions are treated as on-screen text, and the table itself is reported (stroke lettering
 * cannot be checked reliably; the scene should use `page.write`).
 */
import type { AnyNode } from 'acorn';
import { visit } from '../scenes/source-checks.js';
import { constantStrings, strings, type OnScreenText } from './source-text.js';

/** Single-character keys with array values from which an object is a glyph table. */
const MIN_GLYPHS = 3;
const GLYPH_KEY = /^[A-Z0-9]$/;

export interface GlyphTable {
  /** The variable holding the table (`GLYPHS`), or `glyph table` when it is anonymous. */
  readonly name: string;
  readonly line: number;
}

export interface StrokeLettering {
  /** The first glyph table of the scene; undefined when it has none. */
  readonly table: GlyphTable | undefined;
  /** String arguments of calls to the scene's own functions (only when it has a glyph table). */
  readonly texts: readonly OnScreenText[];
}

function singleCharKey(node: AnyNode): string | undefined {
  if (node.type !== 'Property' || node.computed) return undefined;
  const key =
    node.key.type === 'Identifier'
      ? node.key.name
      : node.key.type === 'Literal' && typeof node.key.value === 'string'
        ? node.key.value
        : undefined;
  return key !== undefined && key.length === 1 ? key : undefined;
}

function isGlyphTable(node: AnyNode): boolean {
  if (node.type !== 'ObjectExpression') return false;
  const glyphs = node.properties.filter((property) => {
    const key = singleCharKey(property);
    return (
      key !== undefined &&
      GLYPH_KEY.test(key) &&
      property.type === 'Property' &&
      property.value.type === 'ArrayExpression'
    );
  });
  return glyphs.length >= MIN_GLYPHS;
}

function findTable(program: AnyNode): GlyphTable | undefined {
  let table: GlyphTable | undefined;
  visit(program, (node) => {
    if (table !== undefined) return;
    if (node.type === 'VariableDeclarator' && node.init && isGlyphTable(node.init)) {
      const name = node.id.type === 'Identifier' ? node.id.name : 'glyph table';
      table = { name, line: node.loc?.start.line ?? 1 };
    } else if (node.type === 'ObjectExpression' && isGlyphTable(node)) {
      table = { name: 'glyph table', line: node.loc?.start.line ?? 1 };
    }
  });
  return table;
}

/** Names of the functions the scene declares itself (`function f`, `const f = () => …`). */
function localFunctions(program: AnyNode): Set<string> {
  const names = new Set<string>();
  visit(program, (node) => {
    if (node.type === 'FunctionDeclaration' && node.id) names.add(node.id.name);
    if (
      node.type === 'VariableDeclarator' &&
      node.id.type === 'Identifier' &&
      (node.init?.type === 'ArrowFunctionExpression' || node.init?.type === 'FunctionExpression')
    ) {
      names.add(node.id.name);
    }
  });
  return names;
}

export function strokeLettering(program: AnyNode): StrokeLettering {
  const table = findTable(program);
  if (table === undefined) return { table, texts: [] };
  const helpers = localFunctions(program);
  const constants = constantStrings(program);
  const texts: OnScreenText[] = [];
  visit(program, (node) => {
    if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') return;
    if (!helpers.has(node.callee.name)) return;
    for (const argument of node.arguments) {
      if (argument.type === 'SpreadElement' || argument.type === 'ArrayExpression') continue;
      for (const text of strings(argument, constants)) {
        if (text.trim().length > 0) texts.push({ text, line: node.loc?.start.line ?? 1 });
      }
    }
  });
  return { table, texts };
}
