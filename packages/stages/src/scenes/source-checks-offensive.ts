/**
 * Offensive words in a scene (real run Comic 1: a slur as an onomatopoeia, on screen for 4 s).
 * Every string literal of the source is read (on-screen text of any world or built-in style,
 * sound words, labels, a scene's own lettering helpers; comments are not), so nothing reaches the
 * screen through a path the text extraction does not know. A hit is an error for every project
 * (anti-slop guards on or off): the fix turn replaces the word.
 */
import type { AnyNode } from 'acorn';
import { findOffensiveWords, offensiveWordMessage, type QaFinding } from '@reelforge/shared';
import { literalString, parseScene } from '../slop/source-text.js';
import { finding } from './checks.js';
import { visit } from './source-checks.js';

/** Hits named per scene (one finding each). */
const MAX_REPORTED = 4;

interface SourceString {
  readonly text: string;
  readonly line: number;
}

/** String literals and the literal parts of template strings, with their lines. */
function sourceStrings(program: AnyNode): SourceString[] {
  const found: SourceString[] = [];
  visit(program, (node) => {
    const line = node.loc?.start.line ?? 1;
    const text = literalString(node);
    if (text !== undefined) {
      found.push({ text, line });
      return;
    }
    if (node.type === 'TemplateLiteral') {
      for (const quasi of node.quasis) found.push({ text: quasi.value.cooked ?? '', line });
    }
  });
  return found;
}

export function offensiveSourceFindings(source: string, file: string): QaFinding[] {
  const program = parseScene(source);
  if (program === undefined) return [];
  const seen = new Set<string>();
  const findings: QaFinding[] = [];
  for (const entry of sourceStrings(program)) {
    for (const hit of findOffensiveWords(entry.text)) {
      const key = `${String(entry.line)}:${hit.word}`;
      if (seen.has(key) || findings.length >= MAX_REPORTED) continue;
      seen.add(key);
      findings.push(
        finding(
          'scene',
          'error',
          `${file}:${String(entry.line)}: ${offensiveWordMessage(hit.word)}`,
        ),
      );
    }
  }
  return findings;
}
