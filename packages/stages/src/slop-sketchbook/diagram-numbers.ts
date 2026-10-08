/**
 * Numbers a Sketchbook diagram writes from its data (real run Sketchbook 3 #6: small invented
 * values passed the text guard): a bar chart with `values: true` letters every bar's `value` above
 * it, so those literals are on-screen text like a `page.write`, judged by the text provenance
 * (from the narration or research, or derived from numbers on screen). Data that is only drawn
 * (bar heights without values, line points, pie slices) is not text.
 */
import type { AnyNode } from 'acorn';
import { visit } from '../scenes/source-checks.js';
import {
  calleeName,
  literalString,
  propertyKey,
  shownNumber,
  type OnScreenText,
} from '../slop/source-text.js';

function option(node: AnyNode | undefined, key: string): AnyNode | undefined {
  if (node?.type !== 'ObjectExpression') return undefined;
  for (const entry of node.properties) {
    if (entry.type === 'Property' && propertyKey(entry) === key) return entry.value;
  }
  return undefined;
}

/** The bar values a `page.diagram('bars', { values: true, bars })` writes on the page. */
export function diagramNumberTexts(program: AnyNode): OnScreenText[] {
  const found: OnScreenText[] = [];
  visit(program, (node) => {
    if (node.type !== 'CallExpression' || calleeName(node) !== 'diagram') return;
    const [kind, options] = node.arguments;
    if (kind?.type === 'SpreadElement' || literalString(kind) !== 'bars') return;
    if (options?.type === 'SpreadElement') return;
    const values = option(options, 'values');
    if (values?.type !== 'Literal' || values.value !== true) return;
    const bars = option(options, 'bars');
    if (bars?.type !== 'ArrayExpression') return;
    for (const bar of bars.elements) {
      if (bar === null || bar.type === 'SpreadElement') continue;
      const value = option(bar, 'value');
      const text = value === undefined ? undefined : shownNumber(value);
      if (text !== undefined) found.push({ text, line: bar.loc?.start.line ?? 1 });
    }
  });
  return found;
}
