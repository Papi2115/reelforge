/**
 * Forbidden-API rules: unresolved references to forbidden globals, `Math.random` (also through
 * aliases, destructuring and computed keys), access through global objects (`globalThis.Date`),
 * and the `.constructor.constructor` route to `Function`.
 */
import type { AnyNode, Identifier, MemberExpression, Pattern } from 'acorn';
import { memberKey, staticKey } from './ast.js';
import type { Report } from './diagnostics.js';
import {
  FORBIDDEN_GLOBALS,
  GLOBAL_OBJECTS,
  MATH_RANDOM,
  THREE_LOADER,
  THREE_LOADERS,
  type ForbiddenGlobal,
} from './forbidden.js';
import { lookup, type Scope } from './scope.js';

export interface RuleContext {
  readonly source: string;
  readonly report: Report;
}

const MAX_ALIAS_DEPTH = 8;

function reportForbidden(
  node: AnyNode,
  forbidden: ForbiddenGlobal,
  context: RuleContext,
  via?: string,
): void {
  const prefix = via === undefined ? '' : `${via}: `;
  context.report(node, {
    rule: forbidden.rule,
    message: prefix + forbidden.message,
    fix: forbidden.fix,
  });
}

/**
 * Name of the global an expression evaluates to, following `const alias = Math`,
 * `globalThis.Math` and `(0, Math)`; undefined for anything else.
 */
export function globalNameOf(node: AnyNode, scope: Scope, depth = 0): string | undefined {
  if (depth > MAX_ALIAS_DEPTH) return undefined;
  switch (node.type) {
    case 'Identifier': {
      const binding = lookup(scope, node.name);
      if (!binding) return node.name;
      return binding.init ? globalNameOf(binding.init, binding.scope, depth + 1) : undefined;
    }
    case 'MemberExpression': {
      const objectName = globalNameOf(node.object, scope, depth + 1);
      return objectName !== undefined && GLOBAL_OBJECTS.has(objectName)
        ? memberKey(node)
        : undefined;
    }
    case 'SequenceExpression': {
      const last = node.expressions.at(-1);
      return last ? globalNameOf(last, scope, depth + 1) : undefined;
    }
    case 'ChainExpression':
      return globalNameOf(node.expression, scope, depth + 1);
    default:
      return undefined;
  }
}

/** Identifier in a reading/writing position: reports it when it is a forbidden global. */
export function checkIdentifier(identifier: Identifier, scope: Scope, context: RuleContext): void {
  if (lookup(scope, identifier.name)) return;
  const forbidden = FORBIDDEN_GLOBALS.get(identifier.name);
  if (forbidden) reportForbidden(identifier, forbidden, context);
}

function reportDynamicMember(node: AnyNode, objectName: string, context: RuleContext): void {
  context.report(node, {
    rule: 'no-dynamic-global-member',
    severity: 'warning',
    message: `\`${objectName}[...]\` with a computed key cannot be checked for forbidden members (e.g. Math.random).`,
    fix: `Call the member by name, e.g. \`${objectName}.sin(x)\`.`,
  });
}

/**
 * Checks `object.property`. Returns true when the object expression was already reported
 * (e.g. `globalThis.Date` is reported once, as Date) and must not be visited again.
 */
export function checkMember(member: MemberExpression, scope: Scope, context: RuleContext): boolean {
  const key = memberKey(member);
  const objectName = globalNameOf(member.object, scope);
  if (objectName !== undefined && GLOBAL_OBJECTS.has(objectName)) {
    const forbidden = key === undefined ? undefined : FORBIDDEN_GLOBALS.get(key);
    if (forbidden && key !== undefined) {
      reportForbidden(member, forbidden, context, `${objectName}.${key}`);
      return true;
    }
  }
  if (objectName === 'Math') {
    if (key === 'random') reportForbidden(member, MATH_RANDOM, context);
    else if (key === undefined) reportDynamicMember(member, 'Math', context);
  }
  if (key !== undefined && THREE_LOADERS.has(key)) {
    reportForbidden(member, THREE_LOADER, context, `.${key}`);
  }
  if (
    key === 'constructor' &&
    member.object.type === 'MemberExpression' &&
    memberKey(member.object) === 'constructor'
  ) {
    context.report(member, {
      rule: 'no-eval',
      message:
        '`.constructor.constructor` reaches the Function constructor, which runs code from strings; it is blocked by the sandbox.',
      fix: 'Write the code directly as normal functions.',
    });
  }
  return false;
}

/** Checks destructuring from a global: `const { random } = Math`, `const { Date } = globalThis`. */
export function checkDestructure(
  pattern: Pattern,
  source: AnyNode,
  scope: Scope,
  context: RuleContext,
): void {
  const sourceName = globalNameOf(source, scope);
  if (sourceName !== undefined) checkPatternAgainstGlobal(pattern, sourceName, context);
  checkLoaderDestructure(pattern, context);
}

/** `const { TextureLoader } = ctx.three`: a Three.js loader taken out by destructuring. */
function checkLoaderDestructure(pattern: Pattern, context: RuleContext): void {
  if (pattern.type !== 'ObjectPattern') return;
  for (const property of pattern.properties) {
    if (property.type !== 'Property') continue;
    const key = staticKey(property.key, property.computed);
    if (key !== undefined && THREE_LOADERS.has(key)) {
      reportForbidden(property, THREE_LOADER, context, `destructuring \`${key}\``);
    }
  }
}

function checkPatternAgainstGlobal(
  pattern: Pattern,
  globalName: string,
  context: RuleContext,
): void {
  if (pattern.type === 'AssignmentPattern') {
    checkPatternAgainstGlobal(pattern.left, globalName, context);
    return;
  }
  if (pattern.type !== 'ObjectPattern') return;
  for (const property of pattern.properties) {
    if (property.type !== 'Property') continue;
    const key = staticKey(property.key, property.computed);
    if (globalName === 'Math') {
      if (key === 'random')
        reportForbidden(property, MATH_RANDOM, context, 'destructuring `random` from Math');
      else if (key === undefined) reportDynamicMember(property, 'Math', context);
      continue;
    }
    if (!GLOBAL_OBJECTS.has(globalName) || key === undefined) continue;
    const forbidden = FORBIDDEN_GLOBALS.get(key);
    if (forbidden)
      reportForbidden(property, forbidden, context, `destructuring \`${key}\` from ${globalName}`);
    else checkPatternAgainstGlobal(property.value, key, context);
  }
}
