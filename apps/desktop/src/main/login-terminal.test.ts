import { ok, type LoginAction } from '@reelforge/claude-bridge';
import { describe, expect, it } from 'vitest';
import { loginTerminalCommand, openLoginTerminal, type TerminalCommand } from './login-terminal.js';

const action = (command: string): LoginAction => ({
  kind: 'open-terminal',
  command,
  args: ['auth', 'login'],
  display: 'claude auth login',
});
const env = { SystemRoot: 'C:\\Windows' };

describe('loginTerminalCommand', () => {
  it('opens a new console that keeps running after the login (Windows)', () => {
    const exe = 'C:\\Users\\Jan Kowalski\\AppData\\Roaming\\npm\\node_modules\\x (1)\\claude.exe';
    const command = loginTerminalCommand(action(exe), 'win32', env);
    expect(command).toEqual({
      ok: true,
      value: {
        command: 'C:\\Windows\\System32\\cmd.exe',
        args: [
          '/d',
          '/s',
          '/c',
          `"start "ReelForge - Claude login" "C:\\Windows\\System32\\cmd.exe" /d /s /k ""${exe}" auth login""`,
        ],
        verbatim: true,
      },
    });
  });

  it('refuses paths cmd.exe would interpret', () => {
    for (const exe of [
      'C:\\a&b\\claude.exe',
      'C:\\%TEMP%\\claude.exe',
      'C:\\a"b\\claude.exe',
      '',
    ]) {
      expect(loginTerminalCommand(action(exe), 'win32', env).ok, exe).toBe(false);
    }
  });

  it('asks for a manual login on other platforms', () => {
    expect(loginTerminalCommand(action('/usr/bin/claude'), 'linux', {})).toEqual({
      ok: false,
      error: 'open a terminal and run: claude auth login',
    });
  });
});

describe('openLoginTerminal', () => {
  it('spawns with a sanitized env (no API key reaches the login)', async () => {
    const calls: { command: TerminalCommand; env: Record<string, string> }[] = [];
    const result = await openLoginTerminal(action('C:\\claude\\claude.exe'), {
      platform: 'win32',
      env: { ...env, ANTHROPIC_API_KEY: 'sk-test', ANTHROPIC_BASE_URL: 'https://x', KEEP: '1' },
      spawn: (command, childEnv) => {
        calls.push({ command, env: childEnv });
        return Promise.resolve(ok(undefined));
      },
    });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.env).toEqual({ SystemRoot: 'C:\\Windows', KEEP: '1' });
  });
});
