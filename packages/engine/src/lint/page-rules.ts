/**
 * Kit pages that never reach the scene (real run Sketchbook 4: two scenes created a
 * `kit.fx.sketchPage(...)`, drew on it and never called `scene.add(page)`, so every frame was
 * blank and the builder blamed the engine). The page factories are full-frame kit objects that
 * draw nothing until they are in the scene graph.
 *
 * Conservative by design (an error blocks the scene): a page counts as added when its name (or an
 * alias: `const p = page`, `state.page = page`) appears anywhere in the arguments of an `.add(...)`
 * call, and it is left alone when it escapes to code that may add it (a local function that calls
 * `.add(`, or a `return` outside `build`).
 */
import type { AnyNode, CallExpression } from 'acorn';
import { childNodes, isFunctionNode, memberKey, type FunctionLike } from './ast.js';
import type { Report } from './diagnostics.js';

/** Kit factories whose result must be added to the scene to render. */
const PAGE_FACTORIES: ReadonlySet<string> = new Set(['sketchPage']);

function walk(
  node: AnyNode,
  visit: (node: AnyNode, owner: FunctionLike | undefined) => void,
): void {
  const stack: [AnyNode, FunctionLike | undefined][] = [[node, undefined]];
  for (let entry = stack.pop(); entry !== undefined; entry = stack.pop()) {
    const [current, owner] = entry;
    visit(current, owner);
    const next = isFunctionNode(current) ? current : owner;
    for (const child of childNodes(current)) stack.push([child, next]);
  }
}

function calleeMethod(call: CallExpression): string | undefined {
  return call.callee.type === 'MemberExpression' ? memberKey(call.callee) : undefined;
}

function isPageFactory(node: AnyNode | null | undefined): node is CallExpression {
  if (node?.type !== 'CallExpression') return false;
  const method = calleeMethod(node);
  return method !== undefined && PAGE_FACTORIES.has(method);
}

function isAddCall(node: AnyNode): node is CallExpression {
  return node.type === 'CallExpression' && calleeMethod(node) === 'add';
}

/** The name a value is stored under: `x` for `x = …`, `page` for `state.page = …`. */
function targetName(node: AnyNode): string | undefined {
  if (node.type === 'Identifier') return node.name;
  return node.type === 'MemberExpression' ? memberKey(node) : undefined;
}

/** Every identifier and member key mentioned in a subtree. */
function mentionedNames(node: AnyNode, into: Set<string>): void {
  walk(node, (current) => {
    const name = targetName(current);
    if (name !== undefined) into.add(name);
  });
}

function functionName(node: AnyNode): string | undefined {
  if (node.type === 'FunctionDeclaration') return node.id?.name;
  if (
    node.type === 'VariableDeclarator' &&
    node.id.type === 'Identifier' &&
    isFunctionNode(node.init)
  ) {
    return node.id.name;
  }
  return undefined;
}

function hasAddCall(node: AnyNode): boolean {
  let found = false;
  walk(node, (current) => {
    found ||= isAddCall(current);
  });
  return found;
}

interface PageFacts {
  /** Page variables and the factory call that created each. */
  readonly pages: Map<string, CallExpression>;
  /** Names mentioned in the arguments of `.add(...)` calls. */
  readonly added: Set<string>;
  /** Value-to-name copies (`const p = page`, `state.page = page`). */
  readonly aliases: [from: string, to: string][];
  /** Names passed to local helpers that add, or returned outside `build`. */
  readonly escaped: Set<string>;
}

function collectFacts(program: AnyNode): PageFacts {
  const facts: PageFacts = { pages: new Map(), added: new Set(), aliases: [], escaped: new Set() };
  const adders = new Set<string>();
  const functions = new Map<FunctionLike, string>();
  walk(program, (node) => {
    const name = functionName(node);
    const body = node.type === 'VariableDeclarator' ? node.init : node;
    if (name !== undefined && body && isFunctionNode(body)) {
      functions.set(body, name);
      if (hasAddCall(body)) adders.add(name);
    }
  });
  walk(program, (node, owner) => {
    const store = (target: AnyNode, value: AnyNode | null | undefined): void => {
      const name = targetName(target);
      if (name === undefined || !value) return;
      if (isPageFactory(value)) facts.pages.set(name, value);
      if (value.type === 'Identifier') facts.aliases.push([value.name, name]);
    };
    if (node.type === 'VariableDeclarator') store(node.id, node.init);
    if (node.type === 'AssignmentExpression' && node.operator === '=') store(node.left, node.right);
    if (isAddCall(node)) {
      for (const argument of node.arguments) mentionedNames(argument, facts.added);
    }
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
      if (adders.has(node.callee.name)) {
        for (const argument of node.arguments) mentionedNames(argument, facts.escaped);
      }
    }
    if (node.type === 'ReturnStatement' && node.argument && owner !== undefined) {
      if (functions.get(owner) !== 'build') mentionedNames(node.argument, facts.escaped);
    }
  });
  return facts;
}

/** A page's name and every name it was copied to. */
function namesOf(name: string, aliases: readonly [string, string][]): Set<string> {
  const names = new Set([name]);
  for (let grew = true; grew;) {
    grew = false;
    for (const [from, to] of aliases) {
      if (names.has(from) && !names.has(to)) {
        names.add(to);
        grew = true;
      }
    }
  }
  return names;
}

/** Reports kit pages that are created but never added to the scene. */
export function checkPagesAdded(program: AnyNode, report: Report): void {
  const facts = collectFacts(program);
  for (const [name, call] of facts.pages) {
    const names = [...namesOf(name, facts.aliases)];
    if (names.some((alias) => facts.added.has(alias) || facts.escaped.has(alias))) continue;
    const factory = calleeMethod(call) ?? 'page';
    report(call, {
      rule: 'kit-page-not-added',
      message: `\`${name}\` (kit.fx.${factory}) is never added to the scene, so every frame renders blank.`,
      fix: `Call ctx.scene.add(${name}) in build(), right after creating it.`,
    });
  }
}
