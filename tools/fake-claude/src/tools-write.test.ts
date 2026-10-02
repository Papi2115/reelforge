import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fakeClaudeLauncher, type FakeClaudeScript } from './index.js';

const STREAM_ARGS = ['-p', '--input-format', 'text', '--output-format', 'stream-json', '--verbose'];

interface Run {
  readonly code: number | null;
  readonly stderr: string;
  readonly events: Record<string, unknown>[];
}

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rf fake write '));
  temps.push(dir);
  return dir;
}

function runWithScript(cwd: string, script: FakeClaudeScript): Promise<Run> {
  const scriptPath = path.join(tempDir(), 'script.json');
  writeFileSync(scriptPath, JSON.stringify(script), 'utf8');
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.toUpperCase().startsWith('FAKE_CLAUDE_')) env[key] = value;
  }
  const launcher = fakeClaudeLauncher();
  const child = spawn(launcher.command, [...launcher.args, ...STREAM_ARGS], {
    cwd,
    env: { ...env, FAKE_CLAUDE_SCRIPT: scriptPath },
    shell: false,
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
  child.stdin.end('write things', 'utf8');
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      const events = stdout
        .split('\n')
        .filter((line) => line.startsWith('{'))
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      resolve({ code, stderr, events });
    });
  });
}

function toolUses(run: Run): Record<string, unknown>[] {
  return run.events.flatMap((event) => {
    const message = event['message'] as { content?: Record<string, unknown>[] } | undefined;
    return (message?.content ?? []).filter((block) => block['type'] === 'tool_use');
  });
}

describe('fake-claude tools-write', () => {
  it('writes the sidecar files inside the cwd and announces each as a Write tool_use', async () => {
    const cwd = tempDir();
    const run = await runWithScript(cwd, {
      version: 1,
      default: {
        scenario: 'tools-write',
        reply: 'Saved 2 files.',
        writes: [
          { path: 'storyboard.json', content: '{"version":1}\n' },
          { path: 'scenes/s01_hook.js', content: 'export const meta = {};\n' },
        ],
      },
    });
    expect(run.code).toBe(0);
    expect(readFileSync(path.join(cwd, 'storyboard.json'), 'utf8')).toBe('{"version":1}\n');
    expect(existsSync(path.join(cwd, 'scenes', 's01_hook.js'))).toBe(true);
    const uses = toolUses(run);
    expect(uses.map((use) => use['name'])).toEqual(['Write', 'Write']);
    const input = uses[1]?.['input'] as { file_path: string };
    expect(input.file_path).toBe(path.join(cwd, 'scenes', 's01_hook.js'));
    expect(run.events.findLast((event) => event['type'] === 'result')?.['result']).toBe(
      'Saved 2 files.',
    );
  });

  it('replays toolCalls (with {cwd} filled in) before the writes', async () => {
    const cwd = tempDir();
    const run = await runWithScript(cwd, {
      version: 1,
      default: {
        scenario: 'tools-write',
        toolCalls: [
          {
            name: 'Bash',
            input: { command: 'reelforge frames --shot s02' },
            output: 'frames:\n  {cwd}/.reelforge/frames/s02/a.png',
          },
          { name: 'Read', input: { file_path: '{cwd}/x.png' }, output: 'no', isError: true },
        ],
        writes: [{ path: 'a.txt', content: 'a' }],
      },
    });
    expect(run.code).toBe(0);
    const uses = toolUses(run);
    expect(uses.map((use) => use['name'])).toEqual(['Bash', 'Read', 'Write']);
    expect((uses[1]?.['input'] as { file_path: string }).file_path).toBe(`${cwd}/x.png`);
    const results = run.events.flatMap((event) => {
      const message = event['message'] as { content?: Record<string, unknown>[] } | undefined;
      return (message?.content ?? []).filter((block) => block['type'] === 'tool_result');
    });
    expect(results[0]?.['content']).toBe(`frames:\n  ${cwd}/.reelforge/frames/s02/a.png`);
    expect(results[1]?.['is_error']).toBe(true);
  });

  it('paces its lines with delayMs (files are written before the first line)', async () => {
    const cwd = tempDir();
    const started = performance.now();
    const run = await runWithScript(cwd, {
      version: 1,
      default: { scenario: 'tools-write', delayMs: 60, writes: [{ path: 'a.txt', content: 'a' }] },
    });
    expect(run.code).toBe(0);
    // init, Write, result line, rate limit, text, result: >= 5 pauses.
    expect(performance.now() - started).toBeGreaterThanOrEqual(5 * 60);
  });

  it('refuses a write that leaves the cwd (exit 1, nothing written)', async () => {
    const cwd = tempDir();
    const run = await runWithScript(cwd, {
      version: 1,
      default: { scenario: 'tools-write', writes: [{ path: '../escape.txt', content: 'x' }] },
    });
    expect(run.code).toBe(1);
    expect(run.stderr).toContain('escapes the cwd');
    expect(existsSync(path.join(path.dirname(cwd), 'escape.txt'))).toBe(false);
  });
});
