import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { sessionsFileSchema, type SessionsFile } from '@reelforge/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { sessionsFilePath } from './session-store.js';
import { Harness, drain, flagValue, probeOf } from './testing/manager-harness.js';

const harness = new Harness();
afterEach(async () => {
  await harness.dispose();
});

const readSessions = (projectDir: string): SessionsFile =>
  sessionsFileSchema.parse(JSON.parse(readFileSync(sessionsFilePath(projectDir), 'utf8')));

describe('crash recovery', () => {
  it('a crashed turn stays resumable and resumes in the same session', async () => {
    const dir = harness.temps.make();
    const script = path.join(dir, 'script.json');
    writeFileSync(script, JSON.stringify({ version: 1, sequence: ['crash', 'ok'] }));
    const { manager } = harness.manager({
      FAKE_CLAUDE_SCRIPT: script,
      FAKE_CLAUDE_PROBE: '1',
      FAKE_CLAUDE_STATE_DIR: path.join(dir, 'state'),
    });
    const projectDir = harness.project();
    const crashed = await drain(
      manager.enqueue({ projectDir, stage: 'scene-build', prompt: 'Build scene 3' }),
    );
    expect(crashed.outcome.status).toBe('crashed');
    expect(crashed.outcome.exitCode).toBe(1);
    expect(crashed.outcome.stderrTail).toContain('simulated crash');
    expect(crashed.events.at(-1)?.kind).toBe('parse-error');
    const pending = readSessions(projectDir).sessions.main?.pendingTurn;
    expect(pending).toMatchObject({
      state: 'interrupted',
      reason: 'crashed',
      stage: 'scene-build',
      model: 'opus',
    });

    const interrupted = await manager.listInterrupted(projectDir);
    expect(interrupted.ok && interrupted.value.map((turn) => turn.sessionId)).toEqual([
      crashed.outcome.sessionId,
    ]);
    const resumed = await manager.resumeInterrupted(projectDir, 'main');
    if (!resumed.ok) throw new Error(resumed.error.kind);
    const second = await drain(resumed.value);
    expect(second.outcome.status).toBe('completed');
    const probe = probeOf(second.events);
    expect(flagValue(probe.argv, '--resume')).toBe(crashed.outcome.sessionId);
    expect(flagValue(probe.argv, '--model')).toBe('opus');
    expect(probe.stdin).toContain('Build scene 3');
    expect(readSessions(projectDir).sessions.main?.pendingTurn).toBeUndefined();
    const nothing = await manager.resumeInterrupted(projectDir, 'main');
    expect(!nothing.ok && nothing.error.kind).toBe('nothing-to-resume');
  });

  it('finds turns left "running" by an app crash', async () => {
    const projectDir = harness.project();
    const file: SessionsFile = {
      version: 1,
      sessions: {
        qa: {
          sessionId: 'abc',
          model: 'haiku',
          updatedAt: '2026-10-02T00:00:00.000Z',
          pendingTurn: {
            turnId: 't-1',
            stage: 'critic',
            model: 'haiku',
            prompt: 'Rate frame 3',
            startedAt: '2026-10-02T00:00:00.000Z',
            state: 'running',
          },
        },
      },
    };
    mkdirSync(path.dirname(sessionsFilePath(projectDir)), { recursive: true });
    writeFileSync(sessionsFilePath(projectDir), JSON.stringify(file));
    const { manager } = harness.manager();
    const interrupted = await manager.listInterrupted(projectDir);
    expect(interrupted.ok && interrupted.value).toEqual([
      { projectDir, purpose: 'qa', sessionId: 'abc', pending: file.sessions.qa?.pendingTurn },
    ]);
  });

  it('a corrupt sessions.json produces a warning, not a failed turn', async () => {
    const projectDir = harness.project();
    mkdirSync(path.dirname(sessionsFilePath(projectDir)), { recursive: true });
    writeFileSync(sessionsFilePath(projectDir), '{ not json');
    const { manager, lifecycle } = harness.manager();
    const { outcome } = await drain(manager.enqueue({ projectDir, stage: 'chat', prompt: 'x' }));
    expect(outcome.status).toBe('completed');
    expect(lifecycle.some((event) => event.type === 'warning')).toBe(true);
    expect(readFileSync(sessionsFilePath(projectDir), 'utf8')).toBe('{ not json');
  });
});

describe('error turns', () => {
  it('not logged in -> failed/auth (is_error with subtype success)', async () => {
    const { manager } = harness.manager({ FAKE_CLAUDE_SCENARIO: 'not-logged-in' });
    const projectDir = harness.project();
    const { outcome } = await drain(manager.enqueue({ projectDir, stage: 'chat', prompt: 'x' }));
    expect(outcome).toMatchObject({ status: 'failed', failure: 'auth' });
    expect(outcome.result?.subtype).toBe('success');
    expect(readSessions(projectDir).sessions.main?.pendingTurn?.reason).toBe('failed:auth');
  });

  it.each(['full', 'event-only', 'error-only', 'text-only'])(
    'usage limit (assumed shape %s) -> failed/limit',
    async (shape) => {
      const { manager } = harness.manager({
        FAKE_CLAUDE_SCENARIO: 'rate-limit',
        FAKE_CLAUDE_LIMIT_SHAPE: shape,
        FAKE_CLAUDE_RESETS_AT: '1790910000',
      });
      const { outcome } = await drain(
        manager.enqueue({ projectDir: harness.project(), stage: 'chat', prompt: 'x' }),
      );
      expect(outcome).toMatchObject({ status: 'failed', failure: 'limit' });
      const withEvent = shape === 'full' || shape === 'event-only';
      expect(outcome.limit?.resetsAt).toBe(withEvent ? 1790910000 : undefined);
    },
  );

  it('limit warning does not fail the turn but is visible in the view', async () => {
    const { manager } = harness.manager({ FAKE_CLAUDE_SCENARIO: 'limit-warning' });
    const { outcome } = await drain(
      manager.enqueue({ projectDir: harness.project(), stage: 'chat', prompt: 'x' }),
    );
    expect(outcome.status).toBe('completed');
    expect(outcome.view.rateLimit?.status).toBe('allowed_warning');
    expect(outcome.limit).toBeUndefined();
  });

  it('a missing executable -> spawn-failed', async () => {
    const { manager } = harness.manager(
      {},
      { launcher: { command: path.join(harness.temps.make(), 'claude.exe'), args: [] } },
    );
    const { outcome } = await drain(
      manager.enqueue({ projectDir: harness.project(), stage: 'chat', prompt: 'x' }),
    );
    expect(outcome.status).toBe('spawn-failed');
  });

  it('tools-edit: Read/Edit/Write steps complete with results', async () => {
    const { manager } = harness.manager({ FAKE_CLAUDE_SCENARIO: 'tools-edit' });
    const projectDir = harness.project();
    const { outcome } = await drain(
      manager.enqueue({ projectDir, stage: 'scene-fix', prompt: 'x' }),
    );
    const tools = outcome.view.steps.filter((step) => step.type === 'tool');
    expect(tools.map((step) => [step.name, step.status, step.summary])).toEqual([
      ['Read', 'done', path.join('scenes', 's01.js')],
      ['Edit', 'done', path.join('scenes', 's01.js')],
      ['Write', 'done', 'notes.txt'],
    ]);
    expect(outcome.view.final?.numTurns).toBe(4);
  });
});
