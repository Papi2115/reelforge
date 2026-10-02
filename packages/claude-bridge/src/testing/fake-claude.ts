/**
 * Test support: points the bridge at tools/fake-claude (never the real CLI, never a model call).
 * Not exported from the package index.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseStreamLine, type StreamEvent } from '../events.js';
import type { ClaudeLauncher } from '../process.js';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

export const fakeClaudeBin = path.join(repoRoot, 'tools', 'fake-claude', 'bin', 'fake-claude.mjs');
export const fakeFixturesDir = path.join(repoRoot, 'tools', 'fake-claude', 'fixtures');

/** `node fake-claude.mjs`: shell-free launcher, same code path as the real exe. */
export const fakeLauncher: ClaudeLauncher = { command: process.execPath, args: [fakeClaudeBin] };

/** Parent env without stray FAKE_CLAUDE_* settings, plus `vars`. */
export function fakeEnv(vars: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.toUpperCase().startsWith('FAKE_CLAUDE_')) env[key] = value;
  }
  return { ...env, ...vars };
}

/** Parses a recorded fixture through the production parser. */
export function fixtureEvents(name: string): StreamEvent[] {
  return readFileSync(path.join(fakeFixturesDir, `${name}.jsonl`), 'utf8')
    .split('\n')
    .flatMap((line) => parseStreamLine(line));
}

/** Temp dirs with a space in the name (Windows path handling), removed by `cleanup()`. */
export class TempDirs {
  private readonly dirs: string[] = [];

  make(prefix = 'rf bridge '): string {
    const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
    this.dirs.push(dir);
    return dir;
  }

  cleanup(): void {
    for (const dir of this.dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  }
}

/** Polls `check` until it returns true or `timeoutMs` passes. */
export async function waitFor(check: () => boolean, timeoutMs = 5_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return check();
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false; // ESRCH: gone
  }
}
