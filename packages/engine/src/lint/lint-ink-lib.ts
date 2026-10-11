/**
 * The contract of a Grim Ink library (`kit-ext/lib/<name>.js`, PLAN.md#14.19): one literal
 * `export const lib = { … }` whose every member is a plain synchronous function (the film's
 * shared helpers: a seated pose, a ballot slip, a crowd row). The determinism, state and grammar
 * rules of the people and places apply too (lint-ink-module.ts runs them).
 */
import type { AnyNode, Program } from 'acorn';
import { isFunctionNode, staticKey } from './ast.js';
import type { SceneExports } from './contract-rules.js';
import type { Report } from './diagnostics.js';

const LIB_EXAMPLE =
  'export const lib = { seat(D, over) { return { ...over }; }, slip(g, ink, x, y, seed) { ink.rough([x - 26, y - 18, x + 26, y - 20, x + 28, y + 18, x - 24, y + 20], ink.C.LINEN, { seed }); } };';

/** `object` = the `lib` binding's initializer (undefined: not exported). */
export function checkLibrary(
  program: Program,
  exports: SceneExports,
  object: AnyNode | undefined,
  report: Report,
): void {
  const fail = (at: AnyNode, message: string, severity?: 'warning'): void => {
    report(at, {
      rule: 'ink-module-contract',
      message,
      fix: LIB_EXAMPLE,
      ...(severity === undefined ? {} : { severity }),
    });
  };
  for (const [name, entry] of exports.named) {
    if (name === 'lib') continue;
    fail(entry.at, `The engine only reads \`lib\`; \`${name}\` is ignored.`, 'warning');
  }
  if (exports.defaultExport) {
    fail(
      exports.defaultExport,
      'The engine reads `export const lib = { ... }`, not a default export.',
    );
  }
  if (object === undefined) {
    fail(program, 'The module does not export `lib`.');
    return;
  }
  if (object.type !== 'ObjectExpression') {
    fail(object, '`lib` must be an object literal of functions.');
    return;
  }
  for (const property of object.properties) {
    const key =
      property.type === 'SpreadElement' ? undefined : staticKey(property.key, property.computed);
    if (property.type === 'SpreadElement' || key === undefined) {
      fail(property, '`lib` must list its functions literally (no spreads or computed keys).');
      continue;
    }
    const value = property.value;
    if (!isFunctionNode(value) || value.async || value.generator) {
      fail(
        value,
        `\`lib.${key}\` must be a plain synchronous function (a library holds functions only).`,
      );
    }
  }
}
