/**
 * Scenario 2 of PLAN.md#10.2: the `claude` process of a chat turn is killed from outside
 * (`taskkill /T /F` on Windows, group SIGKILL elsewhere) mid-turn. The turn fails as a recoverable
 * "Interrupted" error, keeps (and commits) what it already wrote, leaves no process behind, the
 * queue continues, and Resume re-runs it with `--resume` and the continuation prompt.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { killTree, ok, readSessionsFile, type TurnLifecycleEvent } from '@reelforge/claude-bridge';
import { fakeClaudeEnv, fakeClaudeLauncher, type FakeClaudeScript } from '@reelforge/fake-claude';
import { defaultAppSettings } from '@reelforge/shared';
import { afterEach, describe, expect, it } from 'vitest';
import type { ChatSendRequest } from '../../shared/chat-contract.js';
import { createLogger } from '../logger.js';
import { ClaudeService } from './claude-service.js';

const temps: string[] = [];
const services: ClaudeService[] = [];

afterEach(async () => {
  for (const service of services.splice(0)) await service.dispose();
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

function parentEnv(vars: Record<string, string>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.toUpperCase().startsWith('FAKE_CLAUDE_')) env[key] = value;
  }
  return { ...env, ...vars };
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false; // ESRCH: the process is gone
  }
}

async function until(check: () => boolean, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

const message = (text: string): ChatSendRequest => ({
  text,
  chip: null,
  scope: 'video',
  shotIds: [],
  selection: null,
  boost: false,
});

interface Harness {
  readonly service: ClaudeService;
  readonly project: string;
  readonly commits: string[];
  readonly events: TurnLifecycleEvent[];
  readonly grandchildPidFile: string;
}

/** A turn that writes a partial file, then streams slowly (time to kill it). */
async function harness(): Promise<Harness> {
  const project = tempDir('rf resume project ż ');
  const grandchildPidFile = path.join(tempDir('rf resume pid '), 'child.pid');
  const script: FakeClaudeScript = {
    version: 1,
    rules: [
      { promptIncludes: 'previous turn was interrupted', scenario: 'ok', reply: 'Finished.' },
      { promptIncludes: 'second message', scenario: 'ok', reply: 'Second.' },
    ],
    default: {
      scenario: 'tools-write',
      delayMs: 2_000,
      writes: [{ path: 'scenes/partial.js', content: 'half done\n' }],
    },
  };
  const scriptFile = path.join(tempDir('rf resume script '), 'script.json');
  writeFileSync(scriptFile, JSON.stringify(script), 'utf8');
  const vars = fakeClaudeEnv({ script: scriptFile, probe: true, childPidFile: grandchildPidFile });
  const commits: string[] = [];
  const service = new ClaudeService({
    setup: () =>
      Promise.resolve(
        ok({ launcher: fakeClaudeLauncher(), env: parentEnv(vars), permissions: {} }),
      ),
    settings: () => defaultAppSettings(),
    currentProject: () => project,
    renderEnv: () => undefined,
    commit: (_dir, subject) => {
      commits.push(subject);
      return Promise.resolve(ok({ status: 'committed', hash: `h${String(commits.length)}` }));
    },
    push: () => undefined,
    log: createLogger(() => undefined),
    pushDelayMs: 5,
    exitGraceMs: 2_000,
  });
  services.push(service);
  const manager = await service.sessionManager();
  if (!manager.ok) throw new Error(manager.error.message);
  const events: TurnLifecycleEvent[] = [];
  manager.value.on('turn', (event) => events.push(event));
  return { service, project, commits, events, grandchildPidFile };
}

const started = (events: readonly TurnLifecycleEvent[]) =>
  events.filter(
    (event): event is Extract<TurnLifecycleEvent, { type: 'started' }> => event.type === 'started',
  );

/** Waits for the first turn to be mid-stream (file written, session stored), then kills it. */
async function killFirstTurn(h: Harness): Promise<{ pid: number; grandchild: number }> {
  await until(
    () =>
      started(h.events)[0]?.pid !== undefined &&
      existsSync(h.grandchildPidFile) &&
      existsSync(path.join(h.project, 'scenes', 'partial.js')) &&
      h.events.some((event) => event.type === 'stream' && event.event.kind === 'init'),
  );
  // The session id is persisted when `init` arrives.
  await until(() =>
    readFileSync(path.join(h.project, '.reelforge', 'sessions.json'), 'utf8').includes('sessionId'),
  );
  const pid = started(h.events)[0]?.pid ?? 0;
  const grandchild = Number(readFileSync(h.grandchildPidFile, 'utf8'));
  const killed = await killTree(pid);
  expect(killed.ok).toBe(true);
  return { pid, grandchild };
}

describe('claude killed mid-turn', () => {
  it('fails recoverably, keeps the partial work, leaves no orphans and resumes with --resume', async () => {
    const h = await harness();
    await h.service.send(message('rewrite the intro'));
    const { pid, grandchild } = await killFirstTurn(h);

    await until(() => h.service.state().turns[0]?.status === 'failed' && h.commits.length === 1);
    const [interrupted] = h.service.state().turns;
    expect(interrupted).toMatchObject({ resumable: true, error: { kind: 'crashed' } });
    // Partial edits are kept and committed as their own commit (revertable in History).
    expect(readFileSync(path.join(h.project, 'scenes', 'partial.js'), 'utf8')).toBe('half done\n');
    expect(h.commits).toEqual(['Claude turn (failed): rewrite the intro']);
    await until(() => !alive(pid) && !alive(grandchild), 5_000);
    const sessions = await readSessionsFile(h.project);
    expect(sessions.ok && sessions.value.sessions.main?.pendingTurn).toMatchObject({
      state: 'interrupted',
      reason: 'crashed',
    });
    const sessionId = sessions.ok ? sessions.value.sessions.main?.sessionId : undefined;
    expect(sessionId).toBeDefined();

    const resumed = h.service.resumeTurn(interrupted?.id ?? '');
    expect(resumed.status).toBe('queued');
    await until(() => h.service.state().turns[1]?.status === 'done');
    const [after, continued] = h.service.state().turns;
    expect(after?.resumable).toBe(false);
    expect(continued).toMatchObject({ resumeOf: interrupted?.id, resumable: false });
    const second = started(h.events)[1];
    expect(second?.resumedSessionId).toBe(sessionId);
    const probe = h.events.find(
      (event) =>
        event.turnId === second?.turnId &&
        event.type === 'stream' &&
        event.event.kind === 'unknown' &&
        event.event.type === 'fake_probe',
    );
    const raw = probe?.type === 'stream' && probe.event.kind === 'unknown' ? probe.event.raw : {};
    expect(raw['argv']).toEqual(expect.arrayContaining(['--resume', sessionId]));
    expect(String(raw['stdin'])).toContain('The previous turn was interrupted (crashed)');
    expect(String(raw['stdin'])).toContain('rewrite the intro');
    // Nothing is left to resume.
    const again = await readSessionsFile(h.project);
    expect(again.ok && again.value.sessions.main?.pendingTurn).toBeUndefined();
    expect(h.service.resumeTurn(interrupted?.id ?? '').status).toBe('error');
  });

  it('the queue continues after the kill; a newer turn replaces the resumable one', async () => {
    const h = await harness();
    await h.service.send(message('rewrite the intro'));
    await h.service.send(message('second message'));
    await killFirstTurn(h);
    await until(() => h.service.state().turns[1]?.status === 'done');
    const [killed, next] = h.service.state().turns;
    expect(killed).toMatchObject({ status: 'failed', resumable: false });
    expect(next?.steps.some((step) => step.type === 'text' && step.text === 'Second.')).toBe(true);
    expect(h.service.resumeTurn(killed?.id ?? '')).toMatchObject({
      status: 'error',
      error: { kind: 'invalid-request' },
    });
  });
});
