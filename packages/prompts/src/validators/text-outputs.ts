/**
 * Smaller stage outputs: the `MISSING:` line of scene-build replies, reply length limits,
 * `research.md` structure (a source on every claim) and a coarse shape check of scene modules
 * (the real determinism lint is the engine's `lintScene` / `reelforge lint`).
 */
import { issue, report, type ValidationIssue, type ValidationReport } from './issues.js';

/** Props/environments named on the last `MISSING: a, b` line of a reply ([] when absent/none). */
export function parseMissing(reply: string): string[] {
  const lines = [...reply.matchAll(/^\s*\**MISSING\**\s*:\s*(.*)$/gim)];
  const value = lines.at(-1)?.[1] ?? '';
  return value
    .split(/[,;]/)
    .map((name) => name.replaceAll(/[`*"'.]/g, '').trim())
    .filter((name) => name !== '' && !/^(?:none|nothing|n\/a|-)$/i.test(name));
}

/** Warns when a reply has more non-empty lines than the prompt allows. */
export function replyLengthIssues(reply: string, maxLines: number): ValidationIssue[] {
  const lines = reply.split('\n').filter((line) => line.trim() !== '').length;
  if (lines === 0) return [issue('error', 'empty-reply', 'the reply is empty')];
  return lines > maxLines
    ? [issue('warning', 'long-reply', `reply has ${String(lines)} lines (max ${String(maxLines)})`)]
    : [];
}

export const RESEARCH_SECTIONS = [
  'Key facts',
  'Timeline',
  'People & entities',
  'Numbers worth showing on screen',
  'Open questions',
] as const;

/** Sections whose bullets may go without a source (uncertain material). */
const UNSOURCED_SECTIONS = new Set(['Open questions']);

export interface ResearchStats {
  readonly claims: number;
  readonly sources: number;
}

export function validateResearch(text: string): ValidationReport<ResearchStats> {
  const issues: ValidationIssue[] = [];
  const headings = [...text.matchAll(/^##\s+(.+)$/gm)].map((match) => (match[1] ?? '').trim());
  for (const section of RESEARCH_SECTIONS) {
    if (!headings.some((heading) => heading.toLowerCase().startsWith(section.toLowerCase()))) {
      issues.push(issue('error', 'missing-section', `missing "## ${section}"`));
    }
  }
  let section = '';
  let claims = 0;
  const sources = new Set<string>();
  text.split('\n').forEach((line, index) => {
    const heading = /^##\s+(.+)$/.exec(line);
    if (heading !== null) {
      section =
        RESEARCH_SECTIONS.find((name) =>
          (heading[1] ?? '').trim().toLowerCase().startsWith(name.toLowerCase()),
        ) ?? '';
      return;
    }
    if (!/^\s*[-*]\s+\S/.test(line)) return;
    claims += 1;
    const urls = line.match(/https?:\/\/[^\s)>\]]+/g) ?? [];
    for (const url of urls) sources.add(url);
    if (urls.length === 0 && !UNSOURCED_SECTIONS.has(section)) {
      issues.push(
        issue('error', 'unsourced-claim', `line ${String(index + 1)} has no source link`),
      );
    }
  });
  if (claims === 0) issues.push(issue('error', 'no-claims', 'no bullet-point claims'));
  return report({ claims, sources: sources.size }, issues);
}

const SCENE_EXPORTS: readonly [string, RegExp][] = [
  ['meta', /^export\s+const\s+meta\s*=/m],
  ['build', /^export\s+function\s+build\s*\(/m],
  ['update', /^export\s+function\s+update\s*\(/m],
];

const SCENE_FORBIDDEN: readonly [string, RegExp][] = [
  ['Date', /\bDate\b/],
  ['Math.random', /Math\s*\.\s*random/],
  ['performance.now', /\bperformance\s*\./],
  ['requestAnimationFrame', /\brequestAnimationFrame\b/],
  ['timers', /\bset(?:Timeout|Interval)\b/],
  ['fetch', /\bfetch\s*\(/],
  ['import/require', /^\s*import\s|\brequire\s*\(/m],
];

/** Coarse scene contract check (exports present, no obvious non-determinism). */
export function validateSceneModule(source: string): ValidationReport<{ readonly lines: number }> {
  const issues: ValidationIssue[] = [];
  for (const [name, regex] of SCENE_EXPORTS) {
    if (!regex.test(source)) issues.push(issue('error', 'scene-export', `missing export ${name}`));
  }
  for (const [name, regex] of SCENE_FORBIDDEN) {
    if (regex.test(source)) issues.push(issue('error', 'scene-forbidden', `uses ${name}`));
  }
  return report({ lines: source.split('\n').length }, issues);
}
