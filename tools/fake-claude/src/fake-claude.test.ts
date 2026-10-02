import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  fakeClaudeEnv,
  fakeClaudeFixturesDir,
  fakeClaudeLauncher,
  FAKE_CLAUDE_SCENARIOS,
  type FakeClaudeOptions,
} from './index.js';

const STREAM_ARGS = ['-p', '--input-format', 'text', '--output-format', 'stream-json', '--verbose'];

interface FakeRun {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly events: Record<string, unknown>[];
}

function cleanEnv(options: FakeClaudeOptions): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!/^(FAKE_CLAUDE_|ANTHROPIC_API_KEY$)/i.test(key)) env[key] = value;
  }
  return { ...env, ...fakeClaudeEnv(options) };
}

function runFake(
  args: readonly string[],
  options: FakeClaudeOptions = {},
  extra: { stdin?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<FakeRun> {
  const launcher = fakeClaudeLauncher();
  const child = spawn(launcher.command, [...launcher.args, ...args], {
    env: { ...cleanEnv(options), ...extra.env },
    shell: false,
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
  child.stdin.end(extra.stdin ?? 'hello', 'utf8');
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      const events = stdout
        .split('\n')
        .filter((line) => line.startsWith('{'))
        .flatMap((line) => {
          try {
            return [JSON.parse(line) as Record<string, unknown>];
          } catch {
            return [];
          }
        });
      resolve({ code, stdout, stderr, events });
    });
  });
}

const typeOf = (event: Record<string, unknown> | undefined): string => {
  const type = event?.['type'];
  const subtype = event?.['subtype'];
  return `${typeof type === 'string' ? type : '?'}${typeof subtype === 'string' ? `:${subtype}` : ''}`;
};

const lastResult = (run: FakeRun): Record<string, unknown> | undefined =>
  run.events.findLast((event) => event['type'] === 'result');

const temps: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'rf fake '));
  temps.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('fake-claude CLI surface', () => {
  it('prints a version like the real CLI and honours FAKE_CLAUDE_VERSION', async () => {
    expect((await runFake(['--version'])).stdout).toBe('2.1.287 (Claude Code)\n');
    expect((await runFake(['--version'], { version: '1.0.0' })).stdout).toBe(
      '1.0.0 (Claude Code)\n',
    );
  });

  it('auth status: logged in (exit 0) vs logged out (exit 1), JSON by default', async () => {
    const inRun = await runFake(['auth', 'status']);
    expect(inRun.code).toBe(0);
    expect(JSON.parse(inRun.stdout)).toMatchObject({ loggedIn: true, authMethod: 'claude.ai' });
    const outRun = await runFake(['auth', 'status'], { auth: 'logged-out' });
    expect(outRun.code).toBe(1);
    expect(JSON.parse(outRun.stdout)).toMatchObject({ loggedIn: false, authMethod: 'none' });
    const text = await runFake(['auth', 'status', '--text'], { scenario: 'not-logged-in' });
    expect(text.stdout).toMatch(/^Not logged in/);
  });

  it('rejects stream-json without --verbose, unknown flags, --bare and bad permission modes', async () => {
    const noVerbose = await runFake(['-p', '--output-format', 'stream-json']);
    expect(noVerbose.code).toBe(1);
    expect(noVerbose.stderr).toContain('requires --verbose');
    const maxTurns = await runFake([...STREAM_ARGS, '--max-turns', '3']);
    expect(maxTurns.code).toBe(1);
    expect(maxTurns.stderr).toContain('--max-turns');
    expect((await runFake([...STREAM_ARGS, '--bare'])).code).toBe(2);
    const mode = await runFake([...STREAM_ARGS, '--permission-mode', 'yolo']);
    expect(mode.stderr).toContain('Allowed choices');
  });

  it('accepts every flag the bridge uses', async () => {
    const run = await runFake(
      [
        ...STREAM_ARGS,
        '--model',
        'opus',
        '--session-id',
        '11111111-2222-4333-8444-555555555555',
        '--tools',
        'Read,Edit',
        '--allowedTools',
        'Read,Bash(reelforge *)',
        '--permission-mode',
        'dontAsk',
        '--append-system-prompt',
        'a "b" & 50%\nc',
        '--add-dir',
        'C:\\kit dir',
        '--setting-sources',
        'project',
        '--strict-mcp-config',
      ],
      { probe: true },
    );
    expect(run.code).toBe(0);
    const [probe, init] = run.events;
    expect(probe?.['argv']).toContain('a "b" & 50%\nc');
    expect(probe?.['stdin']).toBe('hello');
    expect(init).toMatchObject({
      session_id: '11111111-2222-4333-8444-555555555555',
      model: 'claude-opus-5-5',
      tools: ['Read', 'Edit'],
      permissionMode: 'dontAsk',
      apiKeySource: 'none',
    });
  });
});

describe('fake-claude scenarios', () => {
  it('every documented scenario except hang terminates', async () => {
    for (const scenario of FAKE_CLAUDE_SCENARIOS.filter((name) => name !== 'hang')) {
      const run = await runFake(STREAM_ARGS, { scenario, delayMs: 0 });
      expect(run.events.length, scenario).toBeGreaterThan(0);
      expect(typeOf(run.events[0]), scenario).toBe('system:init');
    }
  });

  it('ok: init, text, rate_limit_event, result; session id is consistent', async () => {
    const run = await runFake([...STREAM_ARGS, '--model', 'haiku'], { reply: 'pong' });
    expect(run.code).toBe(0);
    const sessionIds = new Set(run.events.map((event) => event['session_id']).filter(Boolean));
    expect(sessionIds.size).toBe(1);
    expect(run.events.map(typeOf)).toEqual([
      'system:init',
      'assistant',
      'assistant',
      'rate_limit_event',
      'result:success',
    ]);
    expect(lastResult(run)?.['result']).toBe('pong');
  });

  it('tools-edit: Read, Edit, Write tool_use each followed by a tool_result', async () => {
    const run = await runFake(STREAM_ARGS, { scenario: 'tools-edit' });
    const names = run.events.flatMap((event) => {
      const message = event['message'] as
        { content?: { type: string; name?: string }[] } | undefined;
      const content = message?.content;
      return (content ?? []).filter((block) => block.type === 'tool_use').map((b) => b.name);
    });
    expect(names).toEqual(['Read', 'Edit', 'Write']);
    expect(run.events.filter((event) => event['type'] === 'user')).toHaveLength(3);
  });

  it('resume: recall stream reuses the --resume id; unknown ids fail with a state dir', async () => {
    const stateDir = tempDir();
    const first = await runFake(STREAM_ARGS, { scenario: 'resume', stateDir });
    const sessionId = String(first.events[0]?.['session_id']);
    const second = await runFake([...STREAM_ARGS, '--resume', sessionId], {
      scenario: 'resume',
      stateDir,
    });
    expect(second.events[0]?.['session_id']).toBe(sessionId);
    expect(lastResult(second)?.['result']).toMatch(/PELICAN-42/);
    const unknown = await runFake([...STREAM_ARGS, '--resume', 'nope'], { stateDir });
    expect(unknown.code).toBe(1);
    expect(unknown.stderr).toContain('No conversation found with session ID: nope');
    expect(unknown.events.map(typeOf)).toEqual(['result:error_during_execution']);
    expect(lastResult(unknown)).toMatchObject({
      is_error: true,
      num_turns: 0,
      session_id: 'nope',
      errors: ['No conversation found with session ID: nope'],
    });
  });

  it('resume-not-found: any --resume fails like the real CLI; a fresh call works', async () => {
    const missing = await runFake([...STREAM_ARGS, '--resume', 'expired-id'], {
      scenario: 'resume-not-found',
    });
    expect(missing.code).toBe(1);
    expect(lastResult(missing)?.['errors']).toEqual([
      'No conversation found with session ID: expired-id',
    ]);
    const fresh = await runFake(STREAM_ARGS, { scenario: 'resume-not-found' });
    expect(fresh.code).toBe(0);
    expect(lastResult(fresh)?.['is_error']).toBe(false);
  });

  it('tools-escape: denied Write outside cwd, unguarded echo runs (as the real CLI)', async () => {
    const run = await runFake(STREAM_ARGS, { scenario: 'tools-escape' });
    expect(run.code).toBe(0);
    expect(run.events.filter((event) => event['subtype'] === 'permission_denied')).toHaveLength(1);
    expect(lastResult(run)?.['permission_denials']).toMatchObject([{ tool_name: 'Write' }]);
    expect(run.stdout).toContain('"command":"echo pwned"');
  });

  it('accepts --settings (PreToolUse hook JSON) without acting on it', async () => {
    const run = await runFake([...STREAM_ARGS, '--settings', '{"hooks":{}}']);
    expect(run.code).toBe(0);
  });

  it('crash: no result, truncated last line, non-zero exit, stderr', async () => {
    const run = await runFake(STREAM_ARGS, { scenario: 'crash' });
    expect(run.code).toBe(1);
    expect(lastResult(run)).toBeUndefined();
    expect(run.stdout.endsWith('\n')).toBe(false);
    expect(run.stderr).toContain('simulated crash');
  });

  it('not-logged-in: synthetic authentication_failed and is_error result, exit 1', async () => {
    const run = await runFake(STREAM_ARGS, { scenario: 'not-logged-in' });
    expect(run.code).toBe(1);
    expect(run.events.find((event) => event['type'] === 'assistant')?.['error']).toBe(
      'authentication_failed',
    );
    expect(lastResult(run)).toMatchObject({ is_error: true, subtype: 'success' });
  });

  it('rate-limit: every assumed shape ends in an is_error result', async () => {
    const full = await runFake(STREAM_ARGS, { scenario: 'rate-limit', resetsAt: 1234 });
    expect(full.events.map(typeOf)).toEqual([
      'system:init',
      'rate_limit_event',
      'assistant',
      'result:success',
    ]);
    expect(full.events[1]?.['rate_limit_info']).toMatchObject({
      status: 'rejected',
      resetsAt: 1234,
    });
    for (const limitShape of ['event-only', 'error-only', 'text-only'] as const) {
      const run = await runFake(STREAM_ARGS, { scenario: 'rate-limit', limitShape });
      expect(run.code, limitShape).toBe(1);
      expect(lastResult(run)?.['is_error'], limitShape).toBe(true);
    }
  });

  it('api-key: init reports an API key source (also when ANTHROPIC_API_KEY leaks in)', async () => {
    const scripted = await runFake(STREAM_ARGS, { scenario: 'api-key', delayMs: 0 });
    expect(scripted.events[0]?.['apiKeySource']).toBe('ANTHROPIC_API_KEY');
    const leaked = await runFake(STREAM_ARGS, {}, { env: { ANTHROPIC_API_KEY: 'fake-key' } });
    expect(leaked.events[0]?.['apiKeySource']).toBe('ANTHROPIC_API_KEY');
  });

  it('garbage: non-JSON lines in the middle of a valid stream', async () => {
    const run = await runFake(STREAM_ARGS, { scenario: 'garbage' });
    expect(run.stdout).toContain('this is not json\n');
    expect(lastResult(run)?.['is_error']).toBe(false);
  });
});

describe('sidecar script', () => {
  it('sequence advances per call and sticks on the last step', async () => {
    const script = path.join(tempDir(), 'script.json');
    writeFileSync(
      script,
      JSON.stringify({ version: 1, sequence: ['crash', { scenario: 'ok', reply: 'second' }] }),
    );
    const runs = [];
    for (let index = 0; index < 3; index += 1) runs.push(await runFake(STREAM_ARGS, { script }));
    expect(runs.map((run) => run.code)).toEqual([1, 0, 0]);
    expect(lastResult(runs[2] as FakeRun)?.['result']).toBe('second');
  });

  it('rules match on the prompt, falling back to default', async () => {
    const script = path.join(tempDir(), 'rules.json');
    writeFileSync(
      script,
      JSON.stringify({
        version: 1,
        rules: [{ promptIncludes: 'LIMIT', scenario: 'rate-limit' }],
        default: { scenario: 'ok', reply: 'fallback' },
      }),
    );
    const limited = await runFake(STREAM_ARGS, { script }, { stdin: 'please LIMIT me' });
    expect(limited.code).toBe(1);
    const fallback = await runFake(STREAM_ARGS, { script }, { stdin: 'hi' });
    expect(lastResult(fallback)?.['result']).toBe('fallback');
  });
});

describe('fixtures and catalogue', () => {
  it('recorded fixtures contain no e-mail address or OS user name', () => {
    const user = path.basename(os.homedir());
    const files = readdirSync(fakeClaudeFixturesDir).filter((name) => name.endsWith('.jsonl'));
    expect(files.length).toBeGreaterThanOrEqual(8);
    for (const file of files) {
      const text = readFileSync(path.join(fakeClaudeFixturesDir, file), 'utf8');
      expect(text, file).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      if (user.length >= 3) expect(text.includes(user), file).toBe(false);
    }
  });

  it('the typed scenario list matches the CLI catalogue', async () => {
    const run = await runFake(STREAM_ARGS, {}, { env: { FAKE_CLAUDE_SCENARIO: 'nope' } });
    expect(run.code).toBe(2);
    const known = /known: (.*)\)/.exec(run.stderr)?.[1]?.split(', ');
    expect(known).toEqual([...FAKE_CLAUDE_SCENARIOS]);
  });
});
