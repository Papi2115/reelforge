/**
 * AST traversal for the determinism lint. Tracks the current lexical scope and whether the code
 * is inside the exported update(), and only visits identifiers in reference positions (not
 * property names, labels or declarations).
 */
import type { AnyNode, Pattern } from 'acorn';
import { checkDestructure, checkIdentifier, checkMember, type RuleContext } from './api-rules.js';
import { childNodes, isFunctionNode } from './ast.js';
import { checkCameraMember } from './camera-rules.js';
import { checkKeyframes, checkStyleAssignment, checkStyleCall } from './css-rules.js';
import type { ScopeTree, Scope } from './scope.js';
import { checkUpdateCall, checkUpdateWrite, type UpdateContext } from './update-rules.js';

const IMPORT_FIX =
  'Remove the import. Three.js is ctx.three, voxel props/environments are ctx.kit, text is ctx.text, arrows/callouts/pins are ctx.annotate, colours are ctx.palette; helpers must be written inside the scene file.';

export interface CheckOptions extends RuleContext {
  readonly tree: ScopeTree;
  /** Function node of the exported update(), if statically known. */
  readonly updateFunction: AnyNode | undefined;
}

export function checkProgram(program: AnyNode, options: CheckOptions): void {
  const { tree, report } = options;

  const reportImport = (node: AnyNode, what: string): void => {
    report(node, {
      rule: 'no-import',
      message: `${what}: scene modules cannot import anything (each runs as a standalone module in the sandbox, so imports fail to load).`,
      fix: IMPORT_FIX,
    });
  };

  const walkPattern = (
    pattern: Pattern,
    scope: Scope,
    mode: 'declare' | 'assign',
    update: UpdateContext | undefined,
  ): void => {
    switch (pattern.type) {
      case 'Identifier':
        if (mode === 'assign') {
          checkIdentifier(pattern, scope, options);
          if (update) checkUpdateWrite(pattern, '=', pattern, scope, update);
        }
        return;
      case 'MemberExpression':
        walk(pattern, scope, update);
        return;
      case 'ObjectPattern':
        for (const property of pattern.properties) {
          if (property.type === 'RestElement') {
            walkPattern(property.argument, scope, mode, update);
            continue;
          }
          if (property.computed) walk(property.key, scope, update);
          walkPattern(property.value, scope, mode, update);
        }
        return;
      case 'ArrayPattern':
        for (const element of pattern.elements) {
          if (element) walkPattern(element, scope, mode, update);
        }
        return;
      case 'AssignmentPattern':
        walkPattern(pattern.left, scope, mode, update);
        walk(pattern.right, scope, update);
        checkDestructure(pattern.left, pattern.right, scope, options);
        return;
      case 'RestElement':
        walkPattern(pattern.argument, scope, mode, update);
        return;
    }
  };

  const walkChildren = (node: AnyNode, scope: Scope, update: UpdateContext | undefined): void => {
    for (const child of childNodes(node)) walk(child, scope, update);
  };

  const walk = (node: AnyNode, outerScope: Scope, outerUpdate: UpdateContext | undefined): void => {
    const scope = tree.scopeOf(node) ?? outerScope;
    const update: UpdateContext | undefined =
      node === options.updateFunction
        ? { ...options, moduleScope: tree.module, updateScope: scope }
        : outerUpdate;

    if (isFunctionNode(node)) {
      for (const param of node.params) walkPattern(param, scope, 'declare', update);
      walk(node.body, scope, update);
      return;
    }
    switch (node.type) {
      case 'Identifier':
        checkIdentifier(node, scope, options);
        return;
      case 'MemberExpression':
        checkCameraMember(node, scope, options);
        if (!checkMember(node, scope, options)) walk(node.object, scope, update);
        if (node.computed) walk(node.property, scope, update);
        return;
      case 'Property':
      case 'MethodDefinition':
      case 'PropertyDefinition':
        if (node.computed) walk(node.key, scope, update);
        if (node.value) walk(node.value, scope, update);
        return;
      case 'LabeledStatement':
        walk(node.body, scope, update);
        return;
      case 'BreakStatement':
      case 'ContinueStatement':
      case 'PrivateIdentifier':
        return;
      case 'ClassDeclaration':
      case 'ClassExpression':
        if (node.superClass) walk(node.superClass, scope, update);
        walk(node.body, scope, update);
        return;
      case 'VariableDeclarator':
        walkPattern(node.id, scope, 'declare', update);
        if (node.init) {
          walk(node.init, scope, update);
          checkDestructure(node.id, node.init, scope, options);
        }
        return;
      case 'AssignmentExpression':
        if (node.left.type === 'Identifier' || node.left.type === 'MemberExpression') {
          walk(node.left, scope, update);
          if (update) checkUpdateWrite(node.left, node.operator, node, scope, update);
        } else {
          walkPattern(node.left, scope, 'assign', update);
          checkDestructure(node.left, node.right, scope, options);
        }
        walk(node.right, scope, update);
        checkStyleAssignment(node, options);
        return;
      case 'UpdateExpression':
        walk(node.argument, scope, update);
        if (update) checkUpdateWrite(node.argument, '++', node, scope, update);
        return;
      case 'ForInStatement':
      case 'ForOfStatement':
        if (node.left.type === 'VariableDeclaration') walk(node.left, scope, update);
        else walkPattern(node.left, scope, 'assign', update);
        walk(node.right, scope, update);
        walk(node.body, scope, update);
        return;
      case 'CatchClause':
        if (node.param) walkPattern(node.param, scope, 'declare', update);
        walk(node.body, scope, update);
        return;
      case 'CallExpression':
      case 'NewExpression':
        walkChildren(node, scope, update);
        if (node.type === 'CallExpression') {
          checkStyleCall(node, options);
          if (update) checkUpdateCall(node, scope, update);
        }
        return;
      case 'Literal':
      case 'TemplateElement':
        checkKeyframes(node, options);
        return;
      case 'ImportDeclaration':
        reportImport(node, `\`import ... from '${String(node.source.value)}'\``);
        return;
      case 'ImportExpression':
        reportImport(node, 'dynamic `import()`');
        walk(node.source, scope, update);
        return;
      case 'ExportAllDeclaration':
        reportImport(node, `\`export * from '${String(node.source.value)}'\``);
        return;
      case 'ExportNamedDeclaration':
        if (node.source) {
          reportImport(node, `\`export { ... } from '${String(node.source.value)}'\``);
          return;
        }
        if (node.declaration) walk(node.declaration, scope, update);
        for (const specifier of node.specifiers) walk(specifier.local, scope, update);
        return;
      case 'MetaProperty':
        if (node.meta.name === 'import') reportImport(node, '`import.meta`');
        return;
      default:
        walkChildren(node, scope, update);
    }
  };

  walk(program, tree.module, undefined);
}
