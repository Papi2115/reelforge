/** Small helpers over acorn's ESTree nodes, shared by the scope analysis and the lint rules. */
import type { AnyNode, Expression, Function as FunctionNode, MemberExpression } from 'acorn';

export type FunctionLike = Extract<AnyNode, FunctionNode>;

export function isNode(value: unknown): value is AnyNode {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { type?: unknown; start?: unknown };
  return typeof candidate.type === 'string' && typeof candidate.start === 'number';
}

/** Direct child nodes, in source order of the node's fields. */
export function childNodes(node: AnyNode): AnyNode[] {
  const children: AnyNode[] = [];
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) if (isNode(item)) children.push(item);
    } else if (isNode(value)) {
      children.push(value);
    }
  }
  return children;
}

export function isFunctionNode(node: AnyNode | null | undefined): node is FunctionLike {
  return (
    node?.type === 'FunctionDeclaration' ||
    node?.type === 'FunctionExpression' ||
    node?.type === 'ArrowFunctionExpression'
  );
}

/** Static string value of a literal / quasi-only template, if any. */
export function staticString(node: AnyNode | null | undefined): string | undefined {
  if (node?.type === 'Literal') {
    return typeof node.value === 'string' || typeof node.value === 'number'
      ? String(node.value)
      : undefined;
  }
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined;
  }
  return undefined;
}

/** Name of a non-computed key (`a.b`, `{ b: 1 }`) or the static value of a computed one. */
export function staticKey(key: AnyNode, computed: boolean): string | undefined {
  if (!computed) {
    if (key.type === 'Identifier') return key.name;
    return staticString(key);
  }
  return staticString(key);
}

export function memberKey(member: MemberExpression): string | undefined {
  return staticKey(member.property, member.computed);
}

/** Innermost object of a member chain: `a.b[c].d` -> `a`. */
export function memberRoot(node: Expression | AnyNode): AnyNode {
  let current: AnyNode = node;
  while (current.type === 'MemberExpression') current = current.object;
  return current;
}
