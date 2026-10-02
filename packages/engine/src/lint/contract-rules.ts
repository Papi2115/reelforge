/**
 * Static scene-contract checks (PLAN.md §3.2): `export const meta = { id, title, treatment }`,
 * `export function build(ctx)` and `export function update(t, state, ctx)`.
 */
import { treatmentSchema } from '@reelforge/shared';
import type { AnyNode, Program } from 'acorn';
import { isFunctionNode, staticKey, staticString, type FunctionLike } from './ast.js';
import type { Report } from './diagnostics.js';
import { lookup, type ScopeTree } from './scope.js';

interface ExportedValue {
  /** Where to report problems with this export. */
  readonly at: AnyNode;
  /** Function node, initializer or class; undefined when it cannot be determined statically. */
  readonly value: AnyNode | undefined;
}

export interface SceneExports {
  readonly named: ReadonlyMap<string, ExportedValue>;
  readonly defaultExport: AnyNode | undefined;
}

const META_EXAMPLE = `export const meta = { id: 's01', title: 'Short title', treatment: 'title-card' };`;
const BUILD_EXAMPLE =
  'export function build(ctx) { /* create objects once, add them to ctx.scene */ return { /* state */ }; }';
const UPDATE_EXAMPLE =
  'export function update(t, state, ctx) { /* set every property absolutely from t */ }';
const MAX_ALIAS_DEPTH = 8;

function exportName(node: AnyNode): string | undefined {
  return node.type === 'Identifier' ? node.name : staticString(node);
}

function localValue(name: string, tree: ScopeTree): AnyNode | undefined {
  const binding = lookup(tree.module, name);
  return binding?.init ?? binding?.declaration;
}

export function collectExports(program: Program, tree: ScopeTree): SceneExports {
  const named = new Map<string, ExportedValue>();
  let defaultExport: AnyNode | undefined;
  for (const statement of program.body) {
    if (statement.type === 'ExportDefaultDeclaration') {
      defaultExport = statement;
      continue;
    }
    if (statement.type !== 'ExportNamedDeclaration' || statement.source) continue;
    const declaration = statement.declaration;
    if (declaration?.type === 'FunctionDeclaration' || declaration?.type === 'ClassDeclaration') {
      named.set(declaration.id.name, { at: declaration, value: declaration });
    } else if (declaration?.type === 'VariableDeclaration') {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type !== 'Identifier') continue;
        named.set(declarator.id.name, { at: declarator, value: declarator.init ?? undefined });
      }
    }
    for (const specifier of statement.specifiers) {
      const exported = exportName(specifier.exported);
      const local = exportName(specifier.local);
      if (exported === undefined || local === undefined) continue;
      named.set(exported, { at: specifier, value: localValue(local, tree) });
    }
  }
  return { named, defaultExport };
}

/** Follows `export { fn as build }` / `const build = fn` to the function node, if static. */
export function resolveFunction(
  value: AnyNode | undefined,
  tree: ScopeTree,
  depth = 0,
): FunctionLike | undefined {
  if (isFunctionNode(value)) return value;
  if (value?.type === 'Identifier' && depth < MAX_ALIAS_DEPTH) {
    return resolveFunction(localValue(value.name, tree), tree, depth + 1);
  }
  return undefined;
}

function isStaticallyNotFunction(value: AnyNode | undefined): boolean {
  if (value === undefined) return false;
  return [
    'Literal',
    'ObjectExpression',
    'ArrayExpression',
    'TemplateLiteral',
    'ClassDeclaration',
    'ClassExpression',
  ].includes(value.type);
}

function checkMeta(meta: ExportedValue | undefined, program: Program, report: Report): void {
  const missing = (at: AnyNode, message: string, severity: 'error' | 'warning'): void => {
    report(at, { rule: 'scene-contract', message, fix: META_EXAMPLE, severity });
  };
  if (!meta) {
    missing(program, 'The scene does not export `meta`.', 'error');
    return;
  }
  if (meta.value?.type !== 'ObjectExpression') {
    if (isStaticallyNotFunction(meta.value)) {
      missing(meta.at, '`meta` must be an object literal.', 'error');
    }
    return;
  }
  const properties = new Map<string, AnyNode>();
  let hasSpread = false;
  for (const property of meta.value.properties) {
    if (property.type === 'SpreadElement') {
      hasSpread = true;
      continue;
    }
    const key = staticKey(property.key, property.computed);
    if (key !== undefined) properties.set(key, property.value);
  }
  const id = properties.get('id');
  if (id === undefined) {
    if (!hasSpread) missing(meta.at, '`meta.id` is missing (the shot id, e.g. "s01").', 'error');
  } else if (id.type === 'Literal' && (typeof id.value !== 'string' || id.value === '')) {
    missing(id, '`meta.id` must be a non-empty string.', 'error');
  }
  for (const key of ['title', 'treatment']) {
    if (!properties.has(key) && !hasSpread) {
      missing(meta.at, `\`meta.${key}\` is missing; the editor and QA use it.`, 'warning');
    }
  }
  const treatment = properties.get('treatment');
  const treatmentValue = staticString(treatment);
  if (
    treatment &&
    treatmentValue !== undefined &&
    !treatmentSchema.safeParse(treatmentValue).success
  ) {
    report(treatment, {
      rule: 'scene-contract',
      message: `\`meta.treatment\` "${treatmentValue}" is not a known treatment.`,
      fix: `Use one of: ${treatmentSchema.options.join(', ')}.`,
    });
  }
}

interface FunctionSpec {
  readonly name: 'build' | 'update';
  readonly maxParams: number;
  readonly signature: string;
  readonly example: string;
}

const FUNCTION_SPECS: readonly FunctionSpec[] = [
  { name: 'build', maxParams: 1, signature: 'build(ctx)', example: BUILD_EXAMPLE },
  { name: 'update', maxParams: 3, signature: 'update(t, state, ctx)', example: UPDATE_EXAMPLE },
];

function checkFunction(
  spec: FunctionSpec,
  exported: ExportedValue | undefined,
  context: { readonly program: Program; readonly tree: ScopeTree; readonly report: Report },
): void {
  const { program, tree, report } = context;
  const fail = (at: AnyNode, message: string): void => {
    report(at, { rule: 'scene-contract', message, fix: spec.example });
  };
  if (!exported) {
    fail(program, `The scene does not export \`${spec.signature}\`.`);
    return;
  }
  const fn = resolveFunction(exported.value, tree);
  if (!fn) {
    if (isStaticallyNotFunction(exported.value)) {
      fail(exported.at, `\`${spec.name}\` must be a function: ${spec.signature}.`);
    }
    return;
  }
  if (fn.async || fn.generator) {
    fail(
      fn,
      `\`${spec.name}\` must be a plain synchronous function; async/generator functions return before the frame is ready.`,
    );
  }
  if (fn.params.some((param) => param.type === 'RestElement')) {
    fail(fn, `\`${spec.name}\` must not use rest parameters; the engine calls ${spec.signature}.`);
  } else if (fn.params.length > spec.maxParams) {
    fail(
      fn,
      `\`${spec.name}\` declares ${String(fn.params.length)} parameters but the engine calls ${spec.signature}; the extra ones are always undefined.`,
    );
  }
}

export function checkContract(
  program: Program,
  exports: SceneExports,
  tree: ScopeTree,
  report: Report,
): void {
  checkMeta(exports.named.get('meta'), program, report);
  for (const spec of FUNCTION_SPECS) {
    checkFunction(spec, exports.named.get(spec.name), { program, tree, report });
  }
  if (exports.defaultExport) {
    report(exports.defaultExport, {
      rule: 'scene-contract',
      severity: 'warning',
      message: 'The engine ignores the default export; it only reads `meta`, `build` and `update`.',
      fix: 'Use named exports: `export const meta`, `export function build`, `export function update`.',
    });
  }
}
