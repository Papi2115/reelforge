import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { StreamEvent } from './events.js';
import {
  auditToolUses,
  bashGuardHookPathFrom,
  bashGuardSettings,
  checkToolUse,
  defaultBashGuardHookPath,
  permissionArgs,
  permissionsForStage,
  resolveBashGuardHookPath,
} from './permissions.js';
import { SessionManager } from './session-manager.js';
import { STAGES } from './session-types.js';

const BASH_GUARD_HOOK_PATH = path.resolve(import.meta.dirname, '..', 'hooks', 'bash-guard.mjs');

const projectDir = path.resolve('rf-perm-test', 'my film');
const kitDir = path.resolve('rf-perm-test', 'kit docs');

describe('permissionsForStage: CLI flags', () => {
  it('scene-build: project-scoped edits, reelforge-only Bash, kit via --add-dir, no web', () => {
    expect(
      permissionArgs(permissionsForStage('scene-build', projectDir, { kitDocsDir: kitDir })),
    ).toEqual([
      '--tools',
      'Read,Glob,Grep,Edit,Write,Bash',
      '--allowedTools',
      'Read,Glob,Grep,Edit(./**),Write(./**),Bash(reelforge),Bash(reelforge *)',
      '--disallowedTools',
      'Edit(./.reelforge/**),Write(./.reelforge/**),Edit(./.git/**),Write(./.git/**),NotebookEdit,WebSearch,WebFetch,Read(~/.claude/**),Read(~/.claude.json)',
      '--permission-mode',
      'dontAsk',
      '--add-dir',
      kitDir,
      '--setting-sources',
      'project',
      '--strict-mcp-config',
    ]);
  });

  it('WebSearch/WebFetch exist and are allowed only in the research and script stages', () => {
    for (const stage of STAGES) {
      const permissions = permissionsForStage(stage, projectDir);
      const web = stage === 'script' || stage === 'research';
      expect(permissions.tools.includes('WebFetch'), stage).toBe(web);
      expect(permissions.allowedTools.includes('WebSearch'), stage).toBe(web);
      expect(permissions.disallowedTools.includes('WebFetch'), stage).toBe(!web);
      expect(permissions.permissionMode, stage).toBe('dontAsk');
      expect(permissions.policy.web, stage).toBe(web);
    }
  });

  it('critic is read-only: no edit tools at all, edits explicitly denied', () => {
    const critic = permissionsForStage('critic', projectDir);
    expect(critic.tools).toEqual(['Read', 'Glob', 'Grep', 'Bash']);
    expect(
      critic.allowedTools.some((rule) => rule.startsWith('Edit') || rule.startsWith('Write')),
    ).toBe(false);
    expect(critic.disallowedTools).toEqual(expect.arrayContaining(['Edit', 'Write']));
    expect(critic.policy.writable).toBe(false);
  });

  it('adds the PreToolUse bash guard via --settings only when a hook runtime is given', () => {
    expect(permissionsForStage('chat', projectDir).settings).toBeUndefined();
    const runtime = 'C:\\Program Files\\nodejs\\node.exe';
    const guarded = permissionsForStage('chat', projectDir, { hookRuntime: runtime });
    const settings: unknown = JSON.parse(guarded.settings ?? '');
    const command = `"C:/Program Files/nodejs/node.exe" "${BASH_GUARD_HOOK_PATH.replaceAll('\\', '/')}" "reelforge"`;
    expect(settings).toEqual({
      hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command }] }] },
    });
    expect(permissionArgs(guarded).slice(-3)).toEqual([
      '--settings',
      guarded.settings,
      '--strict-mcp-config',
    ]);
    expect(bashGuardSettings('node', 'g.mjs', ['reelforge', 'rf'])).toContain('\\"rf\\"');
  });
});

describe('bash guard hook script location', () => {
  const launcher = { command: 'claude', args: [] };

  it('defaults to the package copy, resolved on call (src/ or dist/ layout)', () => {
    expect(defaultBashGuardHookPath()).toBe(BASH_GUARD_HOOK_PATH);
    expect(existsSync(BASH_GUARD_HOOK_PATH)).toBe(true);
    expect(bashGuardHookPathFrom(path.join(import.meta.dirname, '..', 'dist'))).toBe(
      BASH_GUARD_HOOK_PATH,
    );
  });

  it('a bundled module dir (no hooks/ next to it) or a missing dirname has no default', () => {
    expect(bashGuardHookPathFrom(path.resolve('rf-bundle', 'out', 'main'))).toBeUndefined();
    expect(bashGuardHookPathFrom(undefined)).toBeUndefined();
    expect(bashGuardHookPathFrom('')).toBeUndefined();
  });

  it('an explicit hookScriptPath (app resources) wins and is used verbatim', () => {
    const resources = 'C:\\Program Files\\ReelForge\\resources\\hooks\\bash-guard.mjs';
    const guarded = permissionsForStage('chat', projectDir, {
      hookRuntime: 'node',
      hookScriptPath: resources,
    });
    expect(JSON.parse(guarded.settings ?? '')).toMatchObject({
      hooks: {
        PreToolUse: [
          {
            hooks: [
              {
                command:
                  '"node" "C:/Program Files/ReelForge/resources/hooks/bash-guard.mjs" "reelforge"',
              },
            ],
          },
        ],
      },
    });
    expect(resolveBashGuardHookPath({ hookScriptPath: resources })).toBeUndefined();
  });

  it('a runtime with a missing script fails fast (SessionManager constructor)', () => {
    const missing = path.resolve('rf-missing', 'bash-guard.mjs');
    const permissions = { hookRuntime: 'node', hookScriptPath: missing };
    expect(() => resolveBashGuardHookPath(permissions)).toThrow(/hook script not found/);
    expect(() => new SessionManager({ launcher, permissions })).toThrow(/hookScriptPath/);
    expect(
      () => new SessionManager({ launcher, permissions: { hookRuntime: 'node' } }),
    ).not.toThrow();
  });
});

describe('checkToolUse (bridge-side policy)', () => {
  const policy = permissionsForStage('scene-build', projectDir, { kitDocsDir: kitDir }).policy;
  const decide = (name: string, input: Record<string, unknown>): boolean =>
    checkToolUse(policy, name, input).allow;

  it('edits: only inside the project, never in the kit or protected folders', () => {
    expect(decide('Edit', { file_path: path.join(projectDir, 'scenes', 's01.js') })).toBe(true);
    expect(decide('Write', { file_path: path.join('scenes', 'new.js') })).toBe(true);
    // Project props (PLAN.md#7.4): kit-ext is project content, editable like scenes.
    expect(
      decide('Write', { file_path: path.join(projectDir, 'kit-ext', 'props', 'fridge.js') }),
    ).toBe(true);
    expect(decide('Write', { file_path: path.join(projectDir, '..', 'x.txt') })).toBe(false);
    expect(decide('Write', { file_path: path.join(kitDir, 'x.md') })).toBe(false);
    expect(
      decide('Edit', { file_path: path.join(projectDir, '.reelforge', 'sessions.json') }),
    ).toBe(false);
    expect(decide('Edit', { file_path: path.join(projectDir, '.git', 'config') })).toBe(false);
    expect(decide('Edit', {})).toBe(false);
  });

  it('reads: project and kit only (including absolute glob bases)', () => {
    expect(decide('Read', { file_path: path.join(kitDir, 'props.md') })).toBe(true);
    expect(decide('Grep', { pattern: 'anchor', path: 'scenes' })).toBe(true);
    expect(decide('Glob', { pattern: 'scenes/**/*.js' })).toBe(true);
    expect(decide('Read', { file_path: path.resolve('elsewhere', 'secret.txt') })).toBe(false);
    expect(decide('Glob', { pattern: `${path.resolve('elsewhere')}${path.sep}**` })).toBe(false);
  });

  it('bash: one plain reelforge command, no chaining/redirects/substitution', () => {
    expect(decide('Bash', { command: 'reelforge frames --at 0,2.5' })).toBe(true);
    expect(decide('Bash', { command: 'reelforge' })).toBe(true);
    for (const command of [
      'echo pwned',
      'reelforge status && rm -rf .',
      'reelforge status; ls',
      'reelforge status | tee x',
      'reelforge status > out.txt',
      'reelforge $(whoami)',
      'reelforge `id`',
      'reelforge status\nls',
      'reelforgex status',
    ]) {
      expect(decide('Bash', { command }), command).toBe(false);
    }
  });

  it('web only in script; unknown tools denied; read-only stages cannot edit', () => {
    expect(decide('WebFetch', { url: 'https://example.com' })).toBe(false);
    const script = permissionsForStage('script', projectDir).policy;
    expect(checkToolUse(script, 'WebSearch', { query: 'x' }).allow).toBe(true);
    expect(decide('Task', { prompt: 'x' })).toBe(false);
    const critic = permissionsForStage('critic', projectDir).policy;
    expect(checkToolUse(critic, 'Write', { file_path: 'x.txt' })).toEqual({
      allow: false,
      reason: 'this stage may not edit files',
    });
  });
});

describe('auditToolUses', () => {
  const policy = permissionsForStage('scene-build', projectDir).policy;
  const use = (toolUseId: string, name: string, input: Record<string, unknown>): StreamEvent => ({
    kind: 'tool-use',
    messageId: 'm',
    toolUseId,
    name,
    input,
    parentToolUseId: null,
  });

  it('separates calls the CLI or the hook blocked from calls that actually ran', () => {
    const events: StreamEvent[] = [
      use('t1', 'Write', { file_path: path.join(projectDir, '..', 'a.txt') }),
      { kind: 'permission-denied', toolName: 'Write', toolUseId: 't1', message: 'denied' },
      use('t2', 'Write', { file_path: path.join(projectDir, '.reelforge', 'x') }),
      use('t3', 'Bash', { command: 'echo hi' }),
      {
        kind: 'tool-result',
        toolUseId: 't3',
        isError: true,
        text: 'PreToolUse:Bash hook error: ReelForge bash guard: no',
        images: [],
      },
      use('t4', 'Bash', { command: 'cat x' }),
      { kind: 'tool-result', toolUseId: 't4', isError: false, text: 'secret', images: [] },
      use('t5', 'Edit', { file_path: path.join(projectDir, 'scenes', 'ok.js') }),
      {
        kind: 'result',
        subtype: 'success',
        isError: false,
        text: 'done',
        numTurns: 1,
        durationMs: 1,
        costUsd: 0,
        terminalReason: undefined,
        sessionId: 's',
        permissionDenials: [{ toolName: 'Write', toolUseId: 't2' }],
        errors: [],
      },
    ];
    expect(
      auditToolUses(policy, events).map((violation) => [
        violation.toolUseId,
        violation.blockedByCli,
      ]),
    ).toEqual([
      ['t1', true],
      ['t2', true],
      ['t3', true],
      ['t4', false],
    ]);
  });
});

describe('hooks/bash-guard.mjs (PreToolUse protocol)', () => {
  const runHook = (payload: unknown): { status: number | null; stderr: string } => {
    const run = spawnSync(process.execPath, [BASH_GUARD_HOOK_PATH, 'reelforge'], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      windowsHide: true,
    });
    return { status: run.status, stderr: run.stderr };
  };

  it('exit 0 for allowed commands and non-Bash tools; exit 2 + reason otherwise', () => {
    expect(runHook({ tool_name: 'Bash', tool_input: { command: 'reelforge lint' } }).status).toBe(
      0,
    );
    expect(runHook({ tool_name: 'Read', tool_input: { file_path: 'x' } }).status).toBe(0);
    const echo = runHook({ tool_name: 'Bash', tool_input: { command: 'echo pwned' } });
    expect(echo.status).toBe(2);
    expect(echo.stderr).toContain('ReelForge bash guard:');
    expect(runHook({ tool_name: 'Bash', tool_input: { command: 'reelforge a && b' } }).status).toBe(
      2,
    );
    expect(runHook({ tool_name: 'Bash', tool_input: {} }).status).toBe(2);
  });

  it('fails closed on unreadable input', () => {
    const run = spawnSync(process.execPath, [BASH_GUARD_HOOK_PATH, 'reelforge'], {
      input: 'not json',
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(run.status).toBe(2);
  });
});
