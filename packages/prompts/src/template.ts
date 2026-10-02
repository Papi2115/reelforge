/**
 * Tiny, safe template engine for stage prompts: `{{name}}` inserts a value, `{{#name}}…{{/name}}`
 * renders its body only when `name` is set (not undefined/null/false/''/[]). Templates are parsed
 * once into nodes and values are inserted afterwards, so braces inside values are never
 * re-interpreted. Strings go in verbatim, numbers/booleans via String(), objects/arrays as JSON.
 * Variables outside any section are required; a missing one is a typed error, never "undefined".
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';

export type TemplateNode =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'var'; readonly name: string }
  | { readonly kind: 'section'; readonly name: string; readonly children: readonly TemplateNode[] };

export interface ParsedTemplate {
  readonly nodes: readonly TemplateNode[];
  /** Variables used outside any section (must be provided). */
  readonly required: readonly string[];
  /** Section keys and variables used only inside sections. */
  readonly optional: readonly string[];
}

export type TemplateError =
  | { readonly kind: 'template-syntax'; readonly message: string; readonly line: number }
  | { readonly kind: 'missing-vars'; readonly names: readonly string[] };

export type TemplateVars = Readonly<Record<string, unknown>>;

const TAG = /^([#/]?)\s*([A-Za-z_][A-Za-z0-9_]*)\s*$/;

function lineAt(template: string, index: number): number {
  return template.slice(0, index).split('\n').length;
}

interface OpenSection {
  readonly name: string;
  readonly line: number;
  readonly children: TemplateNode[];
}

export function parseTemplate(template: string): Result<ParsedTemplate, TemplateError> {
  const root: TemplateNode[] = [];
  const stack: OpenSection[] = [];
  const current = (): TemplateNode[] => stack.at(-1)?.children ?? root;
  let cursor = 0;
  while (cursor < template.length) {
    const open = template.indexOf('{{', cursor);
    if (open === -1) break;
    if (open > cursor) current().push({ kind: 'text', text: template.slice(cursor, open) });
    const close = template.indexOf('}}', open + 2);
    const line = lineAt(template, open);
    if (close === -1) return err({ kind: 'template-syntax', message: 'unclosed {{', line });
    const tag = TAG.exec(template.slice(open + 2, close));
    if (tag === null) {
      const inner = template.slice(open, close + 2);
      return err({ kind: 'template-syntax', message: `invalid tag ${inner}`, line });
    }
    const [, sigil, name = ''] = tag;
    if (sigil === '#') {
      stack.push({ name, line, children: [] });
    } else if (sigil === '/') {
      const section = stack.pop();
      if (section?.name !== name) {
        const expected = section === undefined ? 'no open section' : `{{/${section.name}}}`;
        return err({
          kind: 'template-syntax',
          message: `{{/${name}}} does not close anything (expected ${expected})`,
          line,
        });
      }
      current().push({ kind: 'section', name, children: section.children });
    } else {
      current().push({ kind: 'var', name });
    }
    cursor = close + 2;
  }
  const unclosed = stack.at(-1);
  if (unclosed !== undefined) {
    return err({
      kind: 'template-syntax',
      message: `{{#${unclosed.name}}} is never closed`,
      line: unclosed.line,
    });
  }
  if (cursor < template.length) root.push({ kind: 'text', text: template.slice(cursor) });
  return ok({ nodes: root, ...collectVariables(root) });
}

function collectVariables(nodes: readonly TemplateNode[]): {
  required: string[];
  optional: string[];
} {
  const required = new Set<string>();
  const optional = new Set<string>();
  const visit = (list: readonly TemplateNode[], inSection: boolean): void => {
    for (const node of list) {
      if (node.kind === 'var') (inSection ? optional : required).add(node.name);
      if (node.kind === 'section') {
        optional.add(node.name);
        visit(node.children, true);
      }
    }
  };
  visit(nodes, false);
  return { required: [...required], optional: [...optional].filter((name) => !required.has(name)) };
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function isTruthy(value: unknown): boolean {
  if (!isPresent(value) || value === false || value === '') return false;
  return !(Array.isArray(value) && value.length === 0);
}

/** How a value is inserted: strings verbatim, scalars via String(), everything else as JSON. */
export function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  // JSON.stringify returns undefined for these despite its declared `string` return type.
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return '';
  return JSON.stringify(value);
}

export function renderTemplate(
  parsed: ParsedTemplate,
  vars: TemplateVars,
): Result<string, TemplateError> {
  const missing = new Set<string>();
  const lookup = (name: string): unknown => (Object.hasOwn(vars, name) ? vars[name] : undefined);
  const render = (nodes: readonly TemplateNode[]): string =>
    nodes
      .map((node) => {
        if (node.kind === 'text') return node.text;
        if (node.kind === 'section')
          return isTruthy(lookup(node.name)) ? render(node.children) : '';
        const value = lookup(node.name);
        if (!isPresent(value)) {
          missing.add(node.name);
          return '';
        }
        return formatValue(value);
      })
      .join('');
  const text = render(parsed.nodes);
  return missing.size === 0 ? ok(text) : err({ kind: 'missing-vars', names: [...missing] });
}
