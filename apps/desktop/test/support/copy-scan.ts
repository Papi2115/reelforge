/**
 * Finds the user-facing strings of the renderer (docs/ui-copy.md "Dictionary", docs/ux/redesign-2.4.md
 * U12) without running it: JSX text, the text attributes of JSX elements (title, aria-label,
 * placeholder, …), string literals shown as JSX children, and prose-like string literals anywhere
 * else (view models build most copy). Log calls, thrown errors, comparisons, `case` labels, object
 * keys and imports are code, not copy. Pure apart from reading the files.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export interface CopyString {
  /** Path relative to the scanned root, with forward slashes. */
  readonly file: string;
  readonly line: number;
  readonly text: string;
  /**
   * Certainly shown: JSX text, a text attribute, a JSX child or a prose-like literal. Other
   * literals that are not code (short fragments like "no surprise moments") may be shown too.
   */
  readonly shown: boolean;
}

/** JSX attributes whose value is read or heard by the user. */
const TEXT_ATTRIBUTES = new Set([
  'title',
  'aria-label',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'placeholder',
  'alt',
  'label',
  'note',
  'hint',
  'menuLabel',
]);

/** Calls whose string arguments are never shown: logs and test ids. */
const CODE_CALLS = new Set(['log', 'console', 'rendererLog', 'report', 'Error', 'TypeError']);

const EQUALITY = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

/** A sentence or a label: two words or more, starting with a capital or ending like a sentence. */
export function looksLikeProse(text: string): boolean {
  const trimmed = text.trim();
  if (!/\s/.test(trimmed) || (trimmed.match(/[a-z]{2,}/gi) ?? []).length < 2) return false;
  return /^[A-Z“"(…↑✓⚠✗]/.test(trimmed) || /[.?!:…]$/.test(trimmed);
}

function calleeRoot(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return calleeRoot(expression.expression);
  if (ts.isCallExpression(expression)) return calleeRoot(expression.expression);
  return undefined;
}

type Placement = 'copy' | 'code' | 'prose';

/** Whether a string literal is shown (copy), never shown (code) or shown only if it reads as prose. */
function placementOf(node: ts.Node): Placement {
  let child: ts.Node = node;
  while (!ts.isSourceFile(child)) {
    const parent = child.parent;
    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return 'code';
    if (ts.isBinaryExpression(parent) && EQUALITY.has(parent.operatorToken.kind)) return 'code';
    if (ts.isCaseClause(parent) && parent.expression === child) return 'code';
    if (ts.isElementAccessExpression(parent) && parent.argumentExpression === child) return 'code';
    if (ts.isPropertyAssignment(parent) && parent.name === child) return 'code';
    if (ts.isLiteralTypeNode(parent)) return 'code';
    if (ts.isCallExpression(parent) || ts.isNewExpression(parent)) {
      const root = calleeRoot(parent.expression);
      if (root !== undefined && CODE_CALLS.has(root)) return 'code';
    }
    if (ts.isJsxAttribute(parent)) {
      return TEXT_ATTRIBUTES.has(parent.name.getText()) ? 'copy' : 'code';
    }
    if (
      ts.isJsxExpression(parent) &&
      (ts.isJsxElement(parent.parent) || ts.isJsxFragment(parent.parent))
    ) {
      return 'copy';
    }
    child = parent;
  }
  return 'prose';
}

function literalText(node: ts.Node): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  // A template reads as one string; `{}` stands for each substitution.
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join('{}');
  }
  return undefined;
}

/** The copy of one source file (every literal that is not code; `shown` tells how sure). */
export function collectCopy(file: string, source: string): CopyString[] {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const found: CopyString[] = [];
  const add = (node: ts.Node, text: string, shown: boolean): void => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    found.push({ file, line: line + 1, text, shown });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      const text = node.text.replace(/\s+/g, ' ').trim();
      if (text !== '') add(node, text, true);
    } else {
      const text = literalText(node);
      if (text !== undefined && text.replaceAll('{}', '').trim() !== '') {
        const placement = placementOf(node);
        if (placement !== 'code') {
          add(node, text, placement === 'copy' || looksLikeProse(text));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/** Source files under `root` (tests and `skip`ped folders left out), relative, sorted. */
export function sourceFiles(root: string, skip: readonly string[]): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const relative = path.relative(root, full).split(path.sep).join('/');
      if (skip.includes(relative)) continue;
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        files.push(relative);
      }
    }
  };
  walk(root);
  return files.sort();
}

/** Every copy string of `files` (relative to `root`). */
export function collectCopyOf(root: string, files: readonly string[]): CopyString[] {
  return files.flatMap((file) => collectCopy(file, readFileSync(path.join(root, file), 'utf8')));
}
