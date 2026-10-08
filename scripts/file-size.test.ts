/**
 * File size guard (CLAUDE.md §6: a file stays under ~400 lines). Every TypeScript source of the
 * packages and the desktop app must stay within SOURCE_LIMIT lines (tests: TEST_LIMIT); the files
 * still over it are listed in OVERSIZED with a ceiling of their size when the guard was added plus
 * ~10%, so they cannot grow silently. A file in OVERSIZED that is gone fails too (keep the table
 * honest). Generated files and fixture data are skipped.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SOURCE_LIMIT = 400;
const TEST_LIMIT = 600;

/** Folders scanned, relative to the repo root (`*` = every package). */
const SCAN_ROOTS = [
  'packages/*/src',
  'apps/desktop/src/main',
  'apps/desktop/src/renderer',
  'apps/desktop/src/shared',
  'apps/desktop/src/preload',
];

/**
 * Files over their limit, with their ceiling (lines). Split one and lower or drop its entry; never
 * raise a ceiling to make a change fit.
 */
const OVERSIZED: Readonly<Record<string, number>> = {
  // Package barrel: one export line per public symbol.
  'packages/pipeline/src/index.ts': 486,
  'packages/shared/src/transitions.ts': 454,
  'packages/pipeline/src/mix/sfx/impact.ts': 451,
  'packages/stages/src/runner.ts': 451,
  'apps/desktop/src/main/queue/queue-service.ts': 449,
  'packages/stages/src/stages/storyboard.ts': 446,
  'apps/desktop/src/main/project-service.ts': 445,
  'packages/stages/src/queue/runner.ts': 444,
};

const isTypeScript = (file: string): boolean => /\.tsx?$/.test(file) && !file.endsWith('.d.ts');
const isTest = (file: string): boolean => /\.test\.tsx?$/.test(file);
/** Generated code and fixture data (not hand-written logic). */
const isSkipped = (relative: string): boolean =>
  /(^|\/)(generated|fixtures|goldens?)\//.test(relative) ||
  /fixture/i.test(path.posix.basename(relative));

function expandRoot(pattern: string): string[] {
  if (!pattern.includes('/*/')) return [pattern];
  const [base = '', rest = ''] = pattern.split('/*/');
  return readdirSync(path.join(ROOT, base))
    .map((name) => `${base}/${name}/${rest}`)
    .filter((candidate) => isDirectory(path.join(ROOT, candidate)));
}

function isDirectory(absolute: string): boolean {
  try {
    return statSync(absolute).isDirectory();
  } catch {
    return false;
  }
}

function listFiles(relativeDir: string): string[] {
  return readdirSync(path.join(ROOT, relativeDir), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : listFiles(relative);
    return entry.isFile() && isTypeScript(entry.name) ? [relative] : [];
  });
}

/** Lines as `wc -l` counts them. */
function lineCount(relative: string): number {
  const text = readFileSync(path.join(ROOT, relative), 'utf8');
  return text.split('\n').length - 1;
}

function scannedFiles(): string[] {
  return SCAN_ROOTS.flatMap(expandRoot)
    .filter((dir) => isDirectory(path.join(ROOT, dir)))
    .flatMap(listFiles)
    .filter((file) => !isSkipped(file))
    .sort();
}

describe('file size guard', () => {
  it('keeps every source and test file within its line limit', () => {
    const over = scannedFiles().flatMap((file) => {
      const limit = OVERSIZED[file] ?? (isTest(file) ? TEST_LIMIT : SOURCE_LIMIT);
      const lines = lineCount(file);
      return lines > limit ? [`${file}: ${String(lines)} lines (limit ${String(limit)})`] : [];
    });
    expect(over, 'split these files into cohesive sibling modules').toEqual([]);
  });

  it('lists only files that exist', () => {
    const scanned = new Set(scannedFiles());
    expect(Object.keys(OVERSIZED).filter((file) => !scanned.has(file))).toEqual([]);
  });
});
