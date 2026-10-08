/**
 * Options of world lettering calls (real run Comic 1: `page.sfx('SLAM', { rise: 4 })` passed the
 * lint and crashed the scene at render, the kit wants one `rise` per letter). The option keys and
 * value kinds mirror the kit's schema (`packages/kit/src/worlds/comic/page/schemas.ts`
 * `sfxSchema`, kept in step by lettering-rules.test.ts). Only literal values are judged: a value
 * computed at run time is left to the kit's own check. The ctx `sfx` API (`ctx.sfx.at(t, name)`)
 * takes no options and is a different call.
 */
import type { AnyNode, CallExpression, Property } from 'acorn';
import { childNodes, staticKey } from './ast.js';
import type { Report } from './diagnostics.js';

/** What an option takes. */
export type OptionKind =
  | 'number'
  /** One number per letter: `[0, 4, -2, 3]`. */
  | 'numbers'
  /** `[x, y]`. */
  | 'point'
  /** Local seconds or a spoken phrase. */
  | 'when'
  /** An ink name or an ink index. */
  | 'paint'
  | 'any';

/** Comic `page.sfx(word, options)` (kit `sfxSchema`). */
export const COMIC_SFX_OPTIONS: Readonly<Record<string, OptionKind>> = {
  x: 'number',
  y: 'number',
  at: 'when',
  until: 'when',
  size: 'number',
  pitch: 'number',
  beats: 'numbers',
  angles: 'numbers',
  rise: 'numbers',
  fill: 'paint',
  shade: 'paint',
  shadeTone: 'number',
  outline: 'number',
  extrude: 'point',
  mis: 'point',
  on: 'any',
};

/** Lettering methods (`<receiver>.<method>(text, { … })`) and their options. */
const LETTERING_CALLS: Readonly<Record<string, Readonly<Record<string, OptionKind>>>> = {
  sfx: COMIC_SFX_OPTIONS,
};

const EXAMPLES: Readonly<Record<OptionKind, string>> = {
  number: 'a number',
  numbers: 'an array with one number per letter, e.g. [0, 4, -2, 3]',
  point: 'an [x, y] pair, e.g. [3, 3]',
  when: 'local seconds or a spoken phrase',
  paint: 'an ink name or index',
  any: 'any value',
};

type Shape = 'number' | 'string' | 'boolean' | 'array' | 'object' | 'null' | undefined;

/** The literal shape of a value; undefined for anything computed at run time. */
function shapeOf(node: AnyNode): Shape {
  switch (node.type) {
    case 'Literal':
      if (node.value === null) return 'null';
      if (typeof node.value === 'number') return 'number';
      if (typeof node.value === 'string') return 'string';
      return typeof node.value === 'boolean' ? 'boolean' : undefined;
    case 'TemplateLiteral':
      return 'string';
    case 'UnaryExpression':
      return node.operator === '-' && shapeOf(node.argument) === 'number' ? 'number' : undefined;
    case 'ArrayExpression':
      return 'array';
    case 'ObjectExpression':
      return 'object';
    default:
      return undefined;
  }
}

const ACCEPTS: Readonly<Record<OptionKind, readonly Shape[]>> = {
  number: ['number'],
  numbers: ['array'],
  point: ['array'],
  when: ['number', 'string'],
  paint: ['string', 'number'],
  any: ['number', 'string', 'boolean', 'array', 'object', 'null'],
};

/** Array elements that must be numbers ("numbers" and "point" options). */
function badElement(node: AnyNode): boolean {
  if (node.type !== 'ArrayExpression') return false;
  return node.elements.some((element) => {
    if (element === null || element.type === 'SpreadElement') return false;
    const shape = shapeOf(element);
    return shape !== undefined && shape !== 'number';
  });
}

function checkOption(
  call: string,
  property: Property,
  kinds: Readonly<Record<string, OptionKind>>,
  report: Report,
): void {
  const key = staticKey(property.key, property.computed);
  if (key === undefined) return;
  const kind = Object.hasOwn(kinds, key) ? kinds[key] : undefined;
  const valid = Object.keys(kinds).join(', ');
  if (kind === undefined) {
    report(property, {
      rule: 'lettering-options',
      message: `${call}() has no option \`${key}\`.`,
      fix: `Use only the options of ${call}(): ${valid}.`,
    });
    return;
  }
  const shape = shapeOf(property.value);
  const wrongShape = shape !== undefined && !ACCEPTS[kind].includes(shape);
  if (!wrongShape && !((kind === 'numbers' || kind === 'point') && badElement(property.value))) {
    return;
  }
  report(property, {
    rule: 'lettering-options',
    message: `${call}() option \`${key}\` takes ${EXAMPLES[kind]}${wrongShape ? `, not a ${shape}` : ''}; the scene would fail at render.`,
    fix: `Give \`${key}\` ${EXAMPLES[kind]} (options of ${call}(): ${valid}).`,
  });
}

function checkCall(node: CallExpression, report: Report): void {
  const callee = node.callee;
  if (callee.type !== 'MemberExpression' || callee.computed) return;
  if (callee.property.type !== 'Identifier') return;
  const method = callee.property.name;
  const kinds = Object.hasOwn(LETTERING_CALLS, method) ? LETTERING_CALLS[method] : undefined;
  const options = node.arguments[1];
  if (kinds === undefined || options?.type !== 'ObjectExpression') return;
  const first = node.arguments[0];
  if (first === undefined || first.type === 'ObjectExpression') return;
  for (const property of options.properties) {
    if (property.type === 'Property') checkOption(`page.${method}`, property, kinds, report);
  }
}

/** Reports wrong options of lettering calls anywhere in the scene. */
export function checkLetteringOptions(program: AnyNode, report: Report): void {
  const stack: AnyNode[] = [program];
  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    if (node.type === 'CallExpression') checkCall(node, report);
    stack.push(...childNodes(node));
  }
}
