// Spike tests (no real model calls). Run: node --test "spikes/01-cli-bridge/*.test.mjs"
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  BILLING_ENV_EXACT,
  buildArgs,
  exeFromCmdShim,
  parseLine,
  redact,
  runClaude,
  sanitizeEnv,
} from './demo.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, 'fixtures');
const fakeClaude = path.join(here, 'fake-claude.mjs');

/** @param {string} name */
const readFixture = (name) =>
  readFileSync(path.join(fixturesDir, name), 'utf8')
    .trim()
    .split('\n')
    .map((line) => /** @type {Record<string, unknown>} */ (JSON.parse(line)));

/** @param {AsyncIterable<Record<string, unknown>>} run */
async function collect(run) {
  /** @type {Record<string, unknown>[]} */
  const events = [];
  for await (const event of run) events.push(event);
  return events;
}

/** @param {Record<string, unknown>} event */
const contentOf = (event) => {
  const message = /** @type {{ content?: Array<Record<string, unknown>> }} */ (
    event['message'] ?? {}
  );
  return message.content ?? [];
};

describe('sanitizeEnv', () => {
  it('strips every billing/provider switch required by CLAUDE.md 3.1 (fake values only)', () => {
    /** @type {Record<string, string>} */
    const dirty = { PATH: 'C:\\bin', USERPROFILE: 'C:\\Users\\x' };
    for (const key of BILLING_ENV_EXACT) dirty[key] = 'fake-value';
    const clean = sanitizeEnv(dirty);
    for (const key of [
      'ANTHROPIC_API_KEY',
      'ANTHROPIC_AUTH_TOKEN',
      'ANTHROPIC_BASE_URL',
      'CLAUDE_CODE_USE_BEDROCK',
      'CLAUDE_CODE_USE_VERTEX',
    ]) {
      assert.equal(clean[key], undefined, key);
    }
    assert.deepEqual(clean, { PATH: 'C:\\bin', USERPROFILE: 'C:\\Users\\x' });
  });

  it('is case-insensitive, strips parent-session markers, keeps allowlisted settings', () => {
    const clean = sanitizeEnv({
      anthropic_api_key: 'fake',
      Anthropic_Model: 'fake',
      CLAUDECODE: '1',
      CLAUDE_CODE_ENTRYPOINT: 'sdk',
      CLAUDE_CODE_SESSION_ID: 'x',
      CLAUDE_AGENT_SDK_VERSION: '1',
      CLAUDE_CODE_GIT_BASH_PATH: 'C:\\Git\\bin\\bash.exe',
      CLAUDE_CONFIG_DIR: 'D:\\cfg',
      HOME: 'h',
    });
    assert.deepEqual(clean, {
      CLAUDE_CODE_GIT_BASH_PATH: 'C:\\Git\\bin\\bash.exe',
      CLAUDE_CONFIG_DIR: 'D:\\cfg',
      HOME: 'h',
    });
  });

  it('does not mutate its input', () => {
    const env = { ANTHROPIC_API_KEY: 'fake' };
    sanitizeEnv(env);
    assert.equal(env.ANTHROPIC_API_KEY, 'fake');
  });
});

describe('buildArgs', () => {
  it('always uses print mode, stdin text input, stream-json + verbose, strict MCP', () => {
    assert.deepEqual(buildArgs({ prompt: 'x' }), [
      '-p',
      '--input-format',
      'text',
      '--output-format',
      'stream-json',
      '--verbose',
      '--strict-mcp-config',
    ]);
  });

  it('maps options to verified flags and never puts the prompt in argv', () => {
    const args = buildArgs({
      prompt: 'secret prompt',
      model: 'haiku',
      resume: 'abc',
      tools: ['Read', 'Write'],
      allowedTools: ['Read', 'Bash(reelforge *)'],
      permissionMode: 'dontAsk',
      appendSystemPrompt: 'a "b"\nc',
      addDirs: ['C:\\kit dir'],
      settingSources: 'project',
      persistSession: false,
    });
    assert.ok(!args.includes('secret prompt'));
    assert.deepEqual(args.slice(6), [
      '--model',
      'haiku',
      '--resume',
      'abc',
      '--tools',
      'Read,Write',
      '--allowedTools',
      'Read,Bash(reelforge *)',
      '--permission-mode',
      'dontAsk',
      '--append-system-prompt',
      'a "b"\nc',
      '--add-dir',
      'C:\\kit dir',
      '--setting-sources',
      'project',
      '--strict-mcp-config',
      '--no-session-persistence',
    ]);
  });
});

describe('exeFromCmdShim', () => {
  it('resolves the native exe behind an npm cmd-shim (path with spaces)', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'rf shim '));
    try {
      const exeDir = path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'bin');
      const shim = path.join(dir, 'claude.cmd');
      writeFileSync(
        shim,
        '@ECHO off\r\n"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"   %*\r\n',
      );
      assert.equal(exeFromCmdShim(shim), undefined, 'missing exe -> undefined');
      mkdirSync(exeDir, { recursive: true });
      writeFileSync(path.join(exeDir, 'claude.exe'), '');
      assert.equal(exeFromCmdShim(shim), path.join(exeDir, 'claude.exe'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('parseLine / redact', () => {
  it('turns non-JSON and non-object lines into bridge_parse_error', () => {
    assert.equal(parseLine('not json')['type'], 'bridge_parse_error');
    assert.equal(parseLine('[1]')['type'], 'bridge_parse_error');
    assert.deepEqual(parseLine('{"type":"x"}'), { type: 'x' });
  });

  it('redacts e-mails, home dir and user name deeply', () => {
    const out = redact(
      { a: ['mail me@example.com', 'C:\\Users\\papi\\proj', 'C--Users-papi-proj'] },
      { home: 'C:\\Users\\papi', user: 'papi' },
    );
    assert.deepEqual(out, { a: ['mail <redacted-email>', '<HOME>\\proj', 'C--Users-<USER>-proj'] });
  });
});

describe('recorded fixtures (real CLI 2.1.287 streams)', () => {
  const files = readdirSync(fixturesDir).filter((name) => name.endsWith('.jsonl'));

  it('every stream starts with system:init and ends with a result', () => {
    assert.ok(files.length >= 3);
    for (const file of files) {
      const events = readFixture(file).filter((event) => event['type'] !== 'bridge_exit');
      const first = events[0] ?? {};
      const last = events.at(-1) ?? {};
      assert.equal(first['type'], 'system', file);
      assert.equal(first['subtype'], 'init', file);
      assert.equal(typeof first['session_id'], 'string', file);
      assert.equal(typeof first['model'], 'string', file);
      assert.equal(last['type'], 'result', file);
      assert.equal(last['session_id'], first['session_id'], file);
    }
  });

  it('contain no e-mail address or OS user name', () => {
    const user = path.basename(os.homedir());
    for (const file of files) {
      const text = readFileSync(path.join(fixturesDir, file), 'utf8');
      assert.doesNotMatch(text, /[\w.+-]+@[\w-]+\.[a-z]{2,}/i, file);
      if (user.length >= 3) assert.ok(!text.includes(user), file);
    }
  });

  it('not-logged-in: synthetic assistant error + is_error result, exit code 1', () => {
    const events = readFixture('not-logged-in.jsonl');
    const assistant = events.find((event) => event['type'] === 'assistant') ?? {};
    assert.equal(assistant['error'], 'authentication_failed');
    const result = events.find((event) => event['type'] === 'result') ?? {};
    assert.equal(result['is_error'], true);
    assert.equal(result['subtype'], 'success');
    assert.equal(events.at(-1)?.['code'], 1);
  });

  it('resume keeps the session id and recalls the remembered word', () => {
    const first = readFixture('resume-1-remember.jsonl');
    const second = readFixture('resume-2-recall.jsonl');
    assert.equal(second[0]?.['session_id'], first[0]?.['session_id']);
    assert.match(String(second.at(-1)?.['result']), /PELICAN-42/);
  });

  it('tools stream: Read tool_use on the PNG, Write denied in dontAsk mode', () => {
    const events = readFixture('tools-read-png.jsonl');
    const toolUses = events.flatMap(contentOf).filter((block) => block['type'] === 'tool_use');
    assert.deepEqual(
      toolUses.map((block) => block['name']),
      ['Read', 'Write'],
    );
    assert.ok(events.some((event) => event['subtype'] === 'permission_denied'));
    const result = events.at(-1) ?? {};
    assert.equal(/** @type {unknown[]} */ (result['permission_denials']).length, 1);
    assert.match(String(result['result']), /blue/i);
    assert.match(String(result['result']), /yellow/i);
  });
});

describe('runClaude against fake-claude (no model calls)', () => {
  it('sends the prompt on stdin, passes tricky args intact, sanitizes env', async () => {
    const appendSystemPrompt = 'SIG "quoted words" & 50% <ok>\nline 2 \\ end\\';
    const events = await collect(
      runClaude({
        prompt: 'héllo "world"\nsecond line',
        appendSystemPrompt,
        claudePath: process.execPath,
        executableArgs: [fakeClaude],
        env: { ...process.env, ANTHROPIC_API_KEY: 'fake', CLAUDE_CODE_USE_BEDROCK: '1' },
      }),
    );
    const probe = events[0] ?? {};
    assert.equal(probe['type'], 'fake_probe');
    assert.equal(probe['stdin'], 'héllo "world"\nsecond line');
    const argv = /** @type {string[]} */ (probe['argv']);
    assert.equal(argv[argv.indexOf('--append-system-prompt') + 1], appendSystemPrompt);
    assert.deepEqual(probe['leakedEnv'], []);
    assert.equal(events[1]?.['type'], 'bridge_parse_error');
    assert.equal(events.length, 2);
  });

  it('replays a recorded stream and reports a non-zero exit as bridge_exit', async () => {
    const fixture = path.join(fixturesDir, 'haiku-ok.jsonl');
    const ok = await collect(
      runClaude({
        prompt: 'x',
        claudePath: process.execPath,
        executableArgs: [fakeClaude],
        env: { ...process.env, FAKE_CLAUDE_FIXTURE: fixture },
      }),
    );
    assert.deepEqual(ok, readFixture('haiku-ok.jsonl'));
    const failed = await collect(
      runClaude({
        prompt: 'x',
        claudePath: process.execPath,
        executableArgs: [fakeClaude],
        env: { ...process.env, FAKE_CLAUDE_FIXTURE: fixture, FAKE_CLAUDE_EXIT_CODE: '3' },
      }),
    );
    assert.deepEqual(failed.at(-1), { type: 'bridge_exit', code: 3, signal: null, stderr: '' });
  });
});
