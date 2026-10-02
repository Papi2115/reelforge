import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildTurnArgs } from './args.js';
import { compareVersions, parseVersion } from './detect.js';
import { BILLING_ENV_EXACT, sanitizeEnv } from './env.js';
import type { StreamEvent } from './events.js';
import { exeFromCmdShim, resolveClaudeExecutable } from './executable.js';
import { classifyFailure, limitSignalOf } from './limits.js';
import { validateLauncher } from './process.js';
import { TempDirs, fixtureEvents } from './testing/fake-claude.js';

const temps = new TempDirs();
afterEach(() => {
  temps.cleanup();
});

describe('sanitizeEnv', () => {
  it('strips every billing/provider switch of CLAUDE.md §3.1 (fake values only)', () => {
    const dirty: Record<string, string> = { PATH: 'C:\\bin', USERPROFILE: 'C:\\Users\\x' };
    for (const key of BILLING_ENV_EXACT) dirty[key] = 'fake-value';
    expect(sanitizeEnv(dirty)).toEqual({ PATH: 'C:\\bin', USERPROFILE: 'C:\\Users\\x' });
  });

  it('is case-insensitive, strips parent-session markers, keeps allowlisted settings', () => {
    const env = {
      anthropic_api_key: 'fake',
      Anthropic_Model: 'fake',
      CLAUDECODE: '1',
      CLAUDE_CODE_ENTRYPOINT: 'sdk',
      CLAUDE_CODE_SESSION_ID: 'x',
      CLAUDE_AGENT_SDK_VERSION: '1',
      CLAUDE_CODE_GIT_BASH_PATH: 'C:\\Git\\bin\\bash.exe',
      CLAUDE_CONFIG_DIR: 'D:\\cfg',
      HOME: 'h',
    };
    expect(sanitizeEnv(env)).toEqual({
      CLAUDE_CODE_GIT_BASH_PATH: 'C:\\Git\\bin\\bash.exe',
      CLAUDE_CONFIG_DIR: 'D:\\cfg',
      HOME: 'h',
    });
    expect(env.anthropic_api_key).toBe('fake');
  });
});

describe('buildTurnArgs', () => {
  it('defaults: print mode, stdin text, stream-json + verbose, dontAsk, project settings, strict MCP', () => {
    expect(buildTurnArgs({ model: 'sonnet' })).toEqual([
      '-p',
      '--input-format',
      'text',
      '--output-format',
      'stream-json',
      '--verbose',
      '--model',
      'sonnet',
      '--permission-mode',
      'dontAsk',
      '--setting-sources',
      'project',
      '--strict-mcp-config',
    ]);
  });

  it('maps every option to a verified flag; never --bare or --max-turns', () => {
    const args = buildTurnArgs({
      model: 'opus',
      resume: 'abc',
      tools: ['Read', 'Write'],
      allowedTools: ['Read', 'Bash(reelforge *)'],
      disallowedTools: ['WebFetch'],
      permissionMode: 'acceptEdits',
      appendSystemPrompt: 'a "b"\nc',
      addDirs: ['C:\\kit dir', 'D:\\x'],
    });
    expect(args.slice(6)).toEqual([
      '--model',
      'opus',
      '--resume',
      'abc',
      '--tools',
      'Read,Write',
      '--allowedTools',
      'Read,Bash(reelforge *)',
      '--disallowedTools',
      'WebFetch',
      '--permission-mode',
      'acceptEdits',
      '--append-system-prompt',
      'a "b"\nc',
      '--add-dir',
      'C:\\kit dir',
      '--add-dir',
      'D:\\x',
      '--setting-sources',
      'project',
      '--strict-mcp-config',
    ]);
    expect(args).not.toContain('--bare');
    expect(args).not.toContain('--max-turns');
  });
});

describe('executable resolution', () => {
  function writeShim(dir: string): string {
    const shim = path.join(dir, 'claude.cmd');
    writeFileSync(
      shim,
      '@ECHO off\r\n"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"   %*\r\n',
    );
    return shim;
  }

  it('resolves the native exe behind an npm cmd-shim (path with spaces)', () => {
    const dir = temps.make('rf shim ');
    const shim = writeShim(dir);
    expect(exeFromCmdShim(shim)).toBeUndefined();
    const exeDir = path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'bin');
    mkdirSync(exeDir, { recursive: true });
    writeFileSync(path.join(exeDir, 'claude.exe'), '');
    expect(exeFromCmdShim(shim)).toBe(path.join(exeDir, 'claude.exe'));
  });

  it.runIf(process.platform === 'win32')(
    'win32: PATH exe first, then shim, then %APPDATA%\\npm',
    () => {
      const [empty, withExe, appData] = [temps.make(), temps.make(), temps.make()];
      writeFileSync(path.join(withExe, 'claude.exe'), '');
      const env = { Path: `${empty};${withExe}`, USERPROFILE: empty, APPDATA: appData };
      expect(resolveClaudeExecutable({ env, platform: 'win32' }).executable).toBe(
        path.join(withExe, 'claude.exe'),
      );
      const npmDir = path.join(appData, 'npm');
      mkdirSync(path.join(npmDir, 'node_modules', '@anthropic-ai', 'claude-code', 'bin'), {
        recursive: true,
      });
      writeShim(npmDir);
      writeFileSync(
        path.join(npmDir, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'),
        '',
      );
      const viaShim = resolveClaudeExecutable({ env: { ...env, Path: empty }, platform: 'win32' });
      expect(viaShim.executable).toMatch(/claude\.exe$/);
      expect(viaShim.searched).toEqual([empty, npmDir, path.join(empty, '.local', 'bin')]);
    },
  );

  it('reports every searched directory when nothing is found', () => {
    const dir = temps.make();
    const result = resolveClaudeExecutable({
      env: { PATH: dir, HOME: dir, USERPROFILE: dir },
      platform: process.platform,
    });
    expect(result.executable).toBeUndefined();
    expect(result.searched[0]).toBe(dir);
  });

  it('refuses .cmd/.bat launchers', () => {
    expect(validateLauncher({ command: 'C:\\npm\\claude.cmd', args: [] }).ok).toBe(false);
    expect(validateLauncher({ command: 'x.BAT', args: [] }).ok).toBe(false);
    expect(validateLauncher({ command: 'C:\\claude.exe', args: [] }).ok).toBe(true);
  });
});

describe('versions', () => {
  it('parses `claude --version` and compares numerically', () => {
    expect(parseVersion('2.1.287 (Claude Code)\n')).toBe('2.1.287');
    expect(parseVersion('garbage')).toBeUndefined();
    expect(compareVersions('2.1.287', '2.1.287')).toBe(0);
    expect(compareVersions('2.1.300', '2.1.287')).toBeGreaterThan(0);
    expect(compareVersions('2.0.999', '2.1.0')).toBeLessThan(0);
  });
});

describe('limit heuristics (assumed shapes, ADR-001)', () => {
  const rejected: StreamEvent = {
    kind: 'rate-limit',
    status: 'rejected',
    rateLimitType: 'five_hour',
    resetsAt: 1790902800,
    windows: {},
  };

  it('detects rejected rate_limit_event, rate_limit api errors and limit wording in errors', () => {
    expect(limitSignalOf(rejected)).toMatchObject({
      source: 'rate-limit-event',
      resetsAt: 1790902800,
    });
    expect(limitSignalOf({ ...rejected, status: 'allowed' })).toBeUndefined();
    expect(
      limitSignalOf({ kind: 'api-error', messageId: 'm', error: 'rate_limit', text: 'API Error' }),
    ).toMatchObject({ source: 'api-error' });
    const result = fixtureEvents('not-logged-in').find((event) => event.kind === 'result');
    if (result?.kind !== 'result') throw new Error('fixture without result');
    expect(
      limitSignalOf({ ...result, text: "You've hit your usage limit · resets 5am" }),
    ).toMatchObject({
      source: 'text',
    });
  });

  it('ignores limit wording in normal assistant prose', () => {
    expect(
      limitSignalOf({
        kind: 'text',
        messageId: 'm',
        text: 'rate limit reached',
        parentToolUseId: null,
      }),
    ).toBeUndefined();
  });

  it('classifies auth, limit, api and unknown failures', () => {
    expect(classifyFailure(fixtureEvents('not-logged-in'), undefined)).toBe('auth');
    expect(classifyFailure([rejected], limitSignalOf(rejected))).toBe('limit');
    expect(
      classifyFailure(
        [{ kind: 'api-error', messageId: 'm', error: 'overloaded', text: '' }],
        undefined,
      ),
    ).toBe('api');
    expect(classifyFailure([], undefined)).toBe('unknown');
  });
});
