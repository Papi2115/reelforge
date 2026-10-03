/**
 * The project template's CLAUDE.md is what the runtime Claude follows (PLAN.md#10.4 real run):
 * every `reelforge` command and `kit-docs` topic it names must exist, and it must state the
 * one-plain-command Bash rule the bash guard enforces.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMANDS } from './cli.js';
import { CTX_TOPICS } from './commands/ctx-docs.js';

const TEMPLATE = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'templates',
  'project',
  'CLAUDE.md',
);
const text = readFileSync(TEMPLATE, 'utf8');

describe('templates/project/CLAUDE.md', () => {
  it('names only reelforge commands that exist', () => {
    const named = [...text.matchAll(/`reelforge ([a-z-]+)/g)].map((match) => match[1]);
    expect(named.length).toBeGreaterThan(5);
    const known = new Set(COMMANDS.map((command) => command.name));
    expect(named.filter((name) => name !== undefined && !known.has(name))).toEqual([]);
  });

  it('points to the ctx reference and states the one-command Bash rule', () => {
    expect(text).toContain('`reelforge kit-docs ctx`');
    expect(CTX_TOPICS).toEqual(expect.arrayContaining(['ctx', 'camera', 'text', 'annotate']));
    expect(text).toContain('`reelforge kit-docs annotate`');
    expect(text).toContain('## Annotations: when to use what');
    expect(text).toMatch(/exactly ONE plain `reelforge …` command — no `cd`, no `&&`/);
  });
});
