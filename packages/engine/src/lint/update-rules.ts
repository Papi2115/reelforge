/**
 * Heuristics for `update(t, state, ctx)` being a pure function of t: it is called for arbitrary
 * times in any order (seeking, export), so it must not carry values from one call to the next —
 * neither in module-level variables nor by changing persistent objects relative to their
 * previous value (`state.angle += 0.1`, `mesh.rotateY(0.01)`).
 */
import type { AnyNode, CallExpression, Expression } from 'acorn';
import { memberKey, memberRoot } from './ast.js';
import type { RuleContext } from './api-rules.js';
import { isWithin, lookup, type Binding, type Scope } from './scope.js';

export interface UpdateContext extends RuleContext {
  readonly moduleScope: Scope;
  /** Scope of the exported update function. */
  readonly updateScope: Scope;
}

const RELATIVE_METHODS: ReadonlySet<string> = new Set([
  'rotateX',
  'rotateY',
  'rotateZ',
  'rotateOnAxis',
  'rotateOnWorldAxis',
  'translateX',
  'translateY',
  'translateZ',
  'translateOnAxis',
]);
const COPYING_METHODS: ReadonlySet<string> = new Set([
  'clone',
  'slice',
  'map',
  'filter',
  'concat',
  'from',
  'of',
]);
const MAX_SNIPPET = 48;

const ABSOLUTE_FIX =
  'Assign the value absolutely from t, e.g. `obj.rotation.y = speed * t;` or `obj.position.x = x0 + speed * t;` (precompute constants in build() and keep them in state).';

function snippet(node: AnyNode, context: RuleContext): string {
  const text = context.source.slice(node.start, node.end).replace(/\s+/g, ' ');
  return text.length > MAX_SNIPPET ? `${text.slice(0, MAX_SNIPPET - 1)}…` : text;
}

/** A value created fresh on every call: object/array literal, `new X()`, `x.clone()` and friends. */
function isFreshValue(node: Expression): boolean {
  if (
    node.type === 'ObjectExpression' ||
    node.type === 'ArrayExpression' ||
    node.type === 'NewExpression'
  ) {
    return true;
  }
  if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
    const method = memberKey(node.callee);
    return method !== undefined && COPYING_METHODS.has(method);
  }
  return false;
}

function isFreshLocal(binding: Binding | undefined, context: UpdateContext): boolean {
  if (!binding || binding.kind === 'param' || !isWithin(binding.scope, context.updateScope)) {
    return false;
  }
  return binding.init !== undefined && isFreshValue(binding.init);
}

function reportModuleState(node: AnyNode, name: string, context: UpdateContext): void {
  context.report(node, {
    rule: 'no-module-state-in-update',
    message: `update() writes the module-level variable \`${name}\` (\`${snippet(node, context)}\`). Values carried from one frame to the next make the image depend on which frames were rendered before.`,
    fix: 'Compute the value from t inside update() (`const x = ...`), or create it once in build(ctx) and keep it in the returned state object.',
  });
}

function reportIncremental(node: AnyNode, context: UpdateContext): void {
  context.report(node, {
    rule: 'no-incremental-update',
    message: `\`${snippet(node, context)}\` changes a value relative to the previous frame. update() is called for arbitrary t in any order (seeking, export), so the result drifts and preview and export disagree.`,
    fix: ABSOLUTE_FIX,
  });
}

/**
 * A write inside update: `target = …` (`operator` "="), a compound assignment (`+=`, `??=`, …)
 * or `++`/`--` (pass "++"). `node` is the whole expression, used for the location and snippet.
 */
export function checkUpdateWrite(
  target: AnyNode,
  operator: string,
  node: AnyNode,
  scope: Scope,
  context: UpdateContext,
): void {
  const compound = operator !== '=';
  if (target.type === 'Identifier') {
    const binding = lookup(scope, target.name);
    if (binding?.scope === context.moduleScope) reportModuleState(node, target.name, context);
    return;
  }
  if (target.type !== 'MemberExpression' || !compound) return;
  const root = memberRoot(target);
  if (root.type === 'Identifier') {
    const binding = lookup(scope, root.name);
    if (binding?.scope === context.moduleScope) {
      reportModuleState(node, root.name, context);
      return;
    }
    if (isFreshLocal(binding, context)) return;
  }
  reportIncremental(node, context);
}

/** `obj.rotateY(0.01)` and other relative Object3D transforms inside update. */
export function checkUpdateCall(call: CallExpression, scope: Scope, context: UpdateContext): void {
  if (call.callee.type !== 'MemberExpression') return;
  const method = memberKey(call.callee);
  if (method === undefined || !RELATIVE_METHODS.has(method)) return;
  const root = memberRoot(call.callee.object);
  if (root.type === 'Identifier' && isFreshLocal(lookup(scope, root.name), context)) return;
  context.report(call, {
    rule: 'no-incremental-update',
    message: `\`${method}()\` (\`${snippet(call, context)}\`) transforms relative to the previous frame. update() is called for arbitrary t in any order, so the object ends up in a different pose depending on which frames were rendered.`,
    fix: ABSOLUTE_FIX,
  });
}
