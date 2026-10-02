/**
 * Minimal lexical scope analysis for scene modules: which identifiers are declared where, so the
 * rules can tell a forbidden global (`Date`) from a local that happens to share its name, and
 * follow simple aliases (`const M = Math`).
 */
import type { AnyNode, Expression, Pattern } from 'acorn';
import { childNodes, isFunctionNode, type FunctionLike } from './ast.js';

export type BindingKind =
  | 'var'
  | 'let'
  | 'const'
  | 'using'
  | 'await using'
  | 'function'
  | 'class'
  | 'param'
  | 'catch'
  | 'import';

export interface Binding {
  readonly name: string;
  readonly kind: BindingKind;
  readonly scope: Scope;
  /** Initializer of a plain `name = init` declarator (not destructuring). */
  readonly init: Expression | undefined;
  /** Function/class declaration node for `function name() {}` / `class name {}`. */
  readonly declaration: AnyNode | undefined;
}

export interface Scope {
  readonly parent: Scope | undefined;
  /** Function (or module) scopes receive `var` declarations. */
  readonly isFunction: boolean;
  /** The function node when this is a function scope. */
  readonly functionNode: FunctionLike | undefined;
  readonly bindings: Map<string, Binding>;
}

export interface ScopeTree {
  readonly module: Scope;
  /** Scope created by `node`, if it creates one (functions, blocks, loops, catch, switch, class). */
  scopeOf(node: AnyNode): Scope | undefined;
}

export function lookup(scope: Scope, name: string): Binding | undefined {
  for (let current: Scope | undefined = scope; current; current = current.parent) {
    const binding = current.bindings.get(name);
    if (binding) return binding;
  }
  return undefined;
}

/** True when `scope` is `ancestor` or nested inside it. */
export function isWithin(scope: Scope, ancestor: Scope): boolean {
  for (let current: Scope | undefined = scope; current; current = current.parent) {
    if (current === ancestor) return true;
  }
  return false;
}

function newScope(parent: Scope | undefined, functionNode?: FunctionLike): Scope {
  return {
    parent,
    isFunction: parent === undefined || functionNode !== undefined,
    functionNode,
    bindings: new Map(),
  };
}

function functionScopeOf(scope: Scope): Scope {
  let current = scope;
  while (!current.isFunction && current.parent) current = current.parent;
  return current;
}

interface Declaration {
  readonly kind: BindingKind;
  readonly init?: Expression | undefined;
  readonly declaration?: AnyNode | undefined;
}

function declare(scope: Scope, name: string, details: Declaration): void {
  scope.bindings.set(name, {
    name,
    kind: details.kind,
    scope,
    init: details.init,
    declaration: details.declaration,
  });
}

/** Declares every identifier bound by a (possibly destructuring) pattern. */
function declarePattern(pattern: Pattern, scope: Scope, details: Declaration): void {
  switch (pattern.type) {
    case 'Identifier':
      declare(scope, pattern.name, details);
      return;
    case 'ObjectPattern':
      for (const property of pattern.properties) {
        const target = property.type === 'Property' ? property.value : property.argument;
        declarePattern(target, scope, { kind: details.kind });
      }
      return;
    case 'ArrayPattern':
      for (const element of pattern.elements) {
        if (element) declarePattern(element, scope, { kind: details.kind });
      }
      return;
    case 'AssignmentPattern':
      declarePattern(pattern.left, scope, { kind: details.kind });
      return;
    case 'RestElement':
      declarePattern(pattern.argument, scope, { kind: details.kind });
      return;
    case 'MemberExpression':
      return;
  }
}

export function analyzeScopes(program: AnyNode): ScopeTree {
  const scopes = new Map<AnyNode, Scope>();
  const moduleScope = newScope(undefined);
  scopes.set(program, moduleScope);

  const visitChildren = (node: AnyNode, scope: Scope): void => {
    for (const child of childNodes(node)) visit(child, scope);
  };

  const visitFunction = (node: FunctionLike, scope: Scope): void => {
    const inner = newScope(scope, node);
    scopes.set(node, inner);
    if (node.type === 'FunctionExpression' && node.id) {
      declare(inner, node.id.name, { kind: 'function', declaration: node });
    }
    for (const param of node.params) {
      declarePattern(param, inner, { kind: 'param' });
      visitChildren(param, inner);
    }
    // The body block shares the function scope (parameters and body declarations collide).
    if (node.body.type === 'BlockStatement') visitChildren(node.body, inner);
    else visit(node.body, inner);
  };

  const visit = (node: AnyNode, scope: Scope): void => {
    if (isFunctionNode(node)) {
      if (node.type === 'FunctionDeclaration' && node.id) {
        declare(scope, node.id.name, { kind: 'function', declaration: node });
      }
      visitFunction(node, scope);
      return;
    }
    switch (node.type) {
      case 'VariableDeclaration': {
        const target = node.kind === 'var' ? functionScopeOf(scope) : scope;
        for (const declarator of node.declarations) {
          const init =
            declarator.id.type === 'Identifier' ? (declarator.init ?? undefined) : undefined;
          declarePattern(declarator.id, target, { kind: node.kind, init });
          visitChildren(declarator, scope);
        }
        return;
      }
      case 'ClassDeclaration':
        if (node.id) declare(scope, node.id.name, { kind: 'class', declaration: node });
        visitChildren(node, scope);
        return;
      case 'ImportDeclaration':
        for (const specifier of node.specifiers) {
          declare(moduleScope, specifier.local.name, { kind: 'import' });
        }
        return;
      case 'CatchClause': {
        const inner = newScope(scope);
        scopes.set(node, inner);
        if (node.param) declarePattern(node.param, inner, { kind: 'catch' });
        visitChildren(node.body, inner);
        return;
      }
      case 'ClassExpression': {
        const inner = newScope(scope);
        scopes.set(node, inner);
        if (node.id) declare(inner, node.id.name, { kind: 'class', declaration: node });
        visitChildren(node, inner);
        return;
      }
      case 'BlockStatement':
      case 'StaticBlock':
      case 'ForStatement':
      case 'ForInStatement':
      case 'ForOfStatement':
      case 'SwitchStatement': {
        const inner = newScope(scope);
        scopes.set(node, inner);
        visitChildren(node, inner);
        return;
      }
      default:
        visitChildren(node, scope);
    }
  };

  visitChildren(program, moduleScope);
  return { module: moduleScope, scopeOf: (node) => scopes.get(node) };
}
