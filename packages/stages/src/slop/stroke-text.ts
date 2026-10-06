/**
 * Letters drawn from strokes (real film 2, s09): the kit's Sketchbook lint
 * (`strokeLetteringFindings`: a scene-local glyph table or a loop that strokes each character)
 * finds the home-made lettering; its text never goes through `page.write`, so it is read here: the
 * string arguments of the scene's own functions (the helper that walks a string) are treated as
 * on-screen text, and the guard reports the lettering itself.
 */
import type { AnyNode } from 'acorn';
import { strokeLetteringFindings, type StrokeLetteringFinding } from '@reelforge/kit';
import { visit } from '../scenes/source-checks.js';
import { constantStrings, strings, type OnScreenText } from './source-text.js';

export interface StrokeLettering {
  /** The kit lint's findings (empty: the scene letters with `page.write` only). */
  readonly findings: readonly StrokeLetteringFinding[];
  /** String arguments of calls to the scene's own functions (only with findings). */
  readonly texts: readonly OnScreenText[];
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

/** String arguments of the scene's calls to its own functions. */
function helperTexts(program: AnyNode): OnScreenText[] {
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
  return texts;
}

export function strokeLettering(source: string, program: AnyNode): StrokeLettering {
  const findings = strokeLetteringFindings(source);
  return { findings, texts: findings.length === 0 ? [] : helperTexts(program) };
}
