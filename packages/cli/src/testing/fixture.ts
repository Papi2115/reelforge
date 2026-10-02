/**
 * Test support (not exported): copies the fixture project (2 shots, words, storyboard, cues) into
 * a temp folder whose path has spaces and Polish letters, so every test also checks that paths
 * survive Windows quirks.
 */
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { CliIo } from '../command.js';
import { runReelforgeCli } from '../cli.js';

export const FIXTURE_PROJECT = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  'test',
  'fixtures',
  'project',
);

export interface TempProject {
  readonly root: string;
  /** Replaces `search` in a project file (fails when it is not there). */
  edit(file: string, search: string, replacement: string): Promise<void>;
  write(file: string, content: string): Promise<void>;
  remove(): Promise<void>;
}

export async function copyFixtureProject(): Promise<TempProject> {
  const base = await mkdtemp(path.join(tmpdir(), 'reelforge cli '));
  const root = path.join(base, 'Zażółć gęślą', 'my project');
  await cp(FIXTURE_PROJECT, root, {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}.reelforge`),
  });
  return {
    root,
    async edit(file, search, replacement) {
      const target = path.join(root, file);
      const text = await readFile(target, 'utf8');
      if (!text.includes(search)) throw new Error(`fixture edit: "${search}" not in ${file}`);
      await writeFile(target, text.replace(search, replacement));
    },
    write: (file, content) => writeFile(path.join(root, file), content),
    remove: () => rm(base, { recursive: true, force: true }),
  };
}

export interface CliRun {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs the CLI in-process with captured output. */
export async function runCli(root: string, ...argv: string[]): Promise<CliRun> {
  let stdout = '';
  let stderr = '';
  const io: CliIo = {
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  };
  const code = await runReelforgeCli(argv, io, root);
  return { code, stdout, stderr };
}
