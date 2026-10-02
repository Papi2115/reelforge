/**
 * Contract checks of a project prop module (`kit-ext/props/<name>.js`, PLAN.md#7.4):
 * `export const prop = { name, description, params, anchors, methods, build(ctx, params) }` with
 * literal metadata valid for the kit, a name matching the file and not shadowing a kit prop, and
 * no module-level state written by any function (one module instance serves every shot, so state
 * carried between calls would make a shot look different when rendered alone).
 */
import { parsePropMeta, PROP_DEFINITIONS } from '@reelforge/kit';
import type { AnyNode, Program } from 'acorn';
import { childNodes, isFunctionNode, memberRoot, staticKey } from './ast.js';
import type { SceneExports } from './contract-rules.js';
import type { Report } from './diagnostics.js';
import { findPropObject, PROP_META_KEYS, staticValue } from './prop-meta.js';
import { lookup, type Scope, type ScopeTree } from './scope.js';

export const PROP_EXAMPLE = `export const prop = { name: 'fridge', description: 'Kitchen fridge (~0.9 x 1.8 units)...', params: { body: { type: 'color', default: 'heroTrim', description: 'Body colour' } }, anchors: { handle: 'door handle' }, methods: {}, build(ctx, params) { const { voxel } = ctx.kit; /* ... */ return group; } };`;
const PROP_FILE = /(?:^|\/)kit-ext\/props\/([^/]+)\.js$/;
const BUILT_IN: ReadonlySet<string> = new Set(
  PROP_DEFINITIONS.map((definition) => definition.name),
);

/** True for a project prop module path (`kit-ext/props/<name>.js`, any separator). */
export function isPropModulePath(file: string): boolean {
  return PROP_FILE.test(file.replaceAll('\\', '/'));
}

function fileName(filename: string): string | undefined {
  return PROP_FILE.exec(filename.replaceAll('\\', '/'))?.[1];
}

function checkBuild(value: AnyNode, report: Report): void {
  const fail = (at: AnyNode, message: string): void => {
    report(at, { rule: 'prop-contract', message, fix: PROP_EXAMPLE });
  };
  if (!isFunctionNode(value)) {
    fail(value, '`prop.build` must be a function build(ctx, params).');
    return;
  }
  if (value.async || value.generator) {
    fail(value, '`prop.build` must be a plain synchronous function returning a kit object.');
  }
  if (value.params.length > 2 || value.params.some((param) => param.type === 'RestElement')) {
    fail(value, '`prop.build` takes (ctx, params): ctx = { kit: { voxel }, palette, rng }.');
  }
}

function checkName(name: unknown, at: AnyNode, filename: string, report: Report): void {
  if (typeof name !== 'string') return;
  const expected = fileName(filename);
  if (expected !== undefined && expected !== name) {
    report(at, {
      rule: 'prop-contract',
      message: `\`prop.name\` is "${name}" but the file is ${expected}.js; the engine registers the prop under its file name.`,
      fix: `Set name: '${expected}' or rename the file to kit-ext/props/${name}.js.`,
    });
  }
  if (BUILT_IN.has(name)) {
    report(at, {
      rule: 'prop-contract',
      message: `The kit already has kit.props.${name}; a project prop cannot replace it.`,
      fix: `Use kit.props.${name} in the scene, or give this prop another name (e.g. ${name}Alt).`,
    });
  }
}

/** Metadata (literal values) and build of the `prop` object; reports what is not allowed. */
function checkPropObject(
  prop: AnyNode,
  filename: string,
  report: Report,
): Record<string, unknown> | undefined {
  if (prop.type !== 'ObjectExpression') {
    report(prop, {
      rule: 'prop-contract',
      message: '`prop` must be an object literal.',
      fix: PROP_EXAMPLE,
    });
    return undefined;
  }
  const meta: Record<string, unknown> = {};
  let build = false;
  let literal = true;
  for (const property of prop.properties) {
    const key =
      property.type === 'SpreadElement' ? undefined : staticKey(property.key, property.computed);
    if (property.type === 'SpreadElement' || key === undefined) {
      report(property, {
        rule: 'prop-contract',
        message: '`prop` must list its fields literally (no spreads or computed keys).',
        fix: PROP_EXAMPLE,
      });
      continue;
    }
    if (key === 'build') {
      build = true;
      checkBuild(property.value, report);
      continue;
    }
    if (!PROP_META_KEYS.includes(key)) {
      report(property, {
        rule: 'prop-contract',
        message: `\`prop.${key}\` is not part of the prop contract.`,
        fix: `Use only ${[...PROP_META_KEYS, 'build'].join(', ')}; helpers go in module-level functions.`,
      });
      continue;
    }
    const value = staticValue(property.value);
    if (!value.ok) {
      report(value.node, {
        rule: 'prop-contract',
        message: `\`prop.${key}\` must be a literal value (strings, numbers, booleans, arrays, objects): the docs read it without running the code.`,
        fix: 'Write the value out literally; compute things inside build(ctx, params) instead.',
      });
      literal = false;
      continue;
    }
    meta[key] = value.value;
    if (key === 'name') checkName(value.value, property.value, filename, report);
  }
  if (!build) {
    report(prop, {
      rule: 'prop-contract',
      message: '`prop.build(ctx, params)` is missing.',
      fix: PROP_EXAMPLE,
    });
  }
  // The schema check only makes sense once every field could be read.
  return literal ? meta : undefined;
}

function checkMetaSchema(meta: Record<string, unknown>, at: AnyNode, report: Report): void {
  try {
    parsePropMeta(meta, 'prop');
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    report(at, {
      rule: 'prop-contract',
      message: text.replace(/^prop: /, ''),
      fix: "Params are { type: 'number' | 'enum' | 'boolean' | 'string' | 'color', description, default, ... } (enum: values; number: min, max, integer). See reelforge kit-docs prop-module.",
    });
  }
}

function checkExports(program: Program, exports: SceneExports, report: Report): void {
  for (const [name, entry] of exports.named) {
    if (name === 'prop') continue;
    report(entry.at, {
      rule: 'prop-contract',
      severity: 'warning',
      message: `The engine only reads \`prop\`; \`${name}\` is ignored.`,
      fix: 'Keep helpers as module-level functions without `export`.',
    });
  }
  if (exports.defaultExport) {
    report(exports.defaultExport, {
      rule: 'prop-contract',
      severity: 'warning',
      message: 'The engine ignores the default export of a prop module.',
      fix: 'Use `export const prop = { ... }`.',
    });
  }
  if (!exports.named.has('prop')) {
    report(program, {
      rule: 'prop-contract',
      message: 'The prop module does not export `prop`.',
      fix: PROP_EXAMPLE,
    });
  }
}

export function checkPropContract(
  program: Program,
  exports: SceneExports,
  filename: string,
  report: Report,
): void {
  checkExports(program, exports, report);
  const prop = findPropObject(program);
  if (prop === undefined) return;
  const meta = checkPropObject(prop, filename, report);
  if (meta !== undefined) checkMetaSchema(meta, prop, report);
}

function writtenRoot(node: AnyNode): AnyNode | undefined {
  if (node.type === 'AssignmentExpression') return memberRoot(node.left);
  if (node.type === 'UpdateExpression') return memberRoot(node.argument);
  return undefined;
}

/** Writes to module-level variables (or their members) from inside any function. */
export function checkModuleStateWrites(program: Program, tree: ScopeTree, report: Report): void {
  const visit = (node: AnyNode, outer: Scope, inFunction: boolean): void => {
    const scope = tree.scopeOf(node) ?? outer;
    const root = inFunction ? writtenRoot(node) : undefined;
    if (root?.type === 'Identifier') {
      const binding = lookup(scope, root.name);
      if (binding?.scope === tree.module) {
        report(node, {
          rule: 'no-module-state-in-prop',
          message: `A function writes the module-level \`${root.name}\`. One module instance serves every shot, so state carried between calls makes a shot look different when it is rendered alone.`,
          fix: 'Keep everything a call needs in local variables of build(ctx, params) or on the object it returns.',
        });
      }
    }
    for (const child of childNodes(node)) visit(child, scope, inFunction || isFunctionNode(node));
  };
  visit(program, tree.module, false);
}
