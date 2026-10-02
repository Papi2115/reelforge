import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { sessionsFileSchema, usageFileSchema } from '@reelforge/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { DEBUG_DIR } from './debug-dump.js';
import { LimitGuard } from './limit-guard.js';
import { sessionsFilePath } from './session-store.js';
import { Harness, drain, flagValue, probeOf } from './testing/manager-harness.js';
import { ManualClock } from './testing/manual-clock.js';
import { ECONOMY_HINT } from './turn-request.js';
import { UsageLedger, usageFilePath } from './usage-ledger.js';

const harness = new Harness();
afterEach(async () => {
  await harness.dispose();
});

describe('SessionManager: resume fallback (5.4)', () => {
  it('a stored session the CLI no longer knows -> session-reset, same turn in a new session', async () => {
    const { manager, lifecycle } = harness.manager({
      FAKE_CLAUDE_SCENARIO: 'resume-not-found',
      FAKE_CLAUDE_PROBE: '1',
    });
    const projectDir = harness.project();
    const first = await drain(manager.enqueue({ projectDir, stage: 'chat', prompt: 'one' }));
    const oldId = first.outcome.sessionId;
    expect(oldId).toBeDefined();
    const second = await drain(manager.enqueue({ projectDir, stage: 'chat', prompt: 'two' }));
    expect(second.outcome.status).toBe('completed');
    expect(second.outcome.sessionId).not.toBe(oldId);
    // Both attempts stream into the same handle: probe of the failed resume, then of the retry.
    const probes = second.events.filter(
      (event) => event.kind === 'unknown' && event.type === 'fake_probe',
    );
    expect(probes.map((probe) => flagValue(probeOf([probe]).argv, '--resume'))).toEqual([
      oldId,
      undefined,
    ]);
    expect(probeOf(probes.slice(1)).stdin).toBe('two');
    const secondTurn = lifecycle.filter((event) => event.turnId !== lifecycle[0]?.turnId);
    expect(
      secondTurn.flatMap((event) =>
        event.type === 'started' ? [event.resumedSessionId ?? 'new'] : [],
      ),
    ).toEqual([oldId, 'new']);
    expect(secondTurn.find((event) => event.type === 'session-reset')).toMatchObject({
      missingSessionId: oldId,
    });
    const stored = sessionsFileSchema.parse(
      JSON.parse(readFileSync(sessionsFilePath(projectDir), 'utf8')),
    );
    expect(stored.sessions.main?.sessionId).toBe(second.outcome.sessionId);
    expect(stored.sessions.main?.pendingTurn).toBeUndefined();
  });
});

describe('SessionManager: Economy mode and stage permissions', () => {
  it('Economy runs every stage on Sonnet with a short-turn hint; explicit models still win', async () => {
    const { manager } = harness.manager({ FAKE_CLAUDE_PROBE: '1' }, { economy: true });
    const projectDir = harness.project();
    const build = await drain(manager.enqueue({ projectDir, stage: 'scene-build', prompt: 'a' }));
    const argv = probeOf(build.events).argv;
    expect(flagValue(argv, '--model')).toBe('sonnet');
    expect(flagValue(argv, '--append-system-prompt')).toBe(ECONOMY_HINT);
    const critic = await drain(
      manager.enqueue({
        projectDir,
        stage: 'critic',
        purpose: 'qa',
        prompt: 'b',
        model: 'haiku',
        appendSystemPrompt: 'Rate the frame.',
      }),
    );
    const criticArgv = probeOf(critic.events).argv;
    expect(flagValue(criticArgv, '--model')).toBe('haiku');
    expect(flagValue(criticArgv, '--append-system-prompt')).toBe(
      `Rate the frame.\n\n${ECONOMY_HINT}`,
    );
  });

  it('applies stage permissions by default; request fields override them', async () => {
    const kitDocsDir = harness.temps.make('rf kit docs ');
    const { manager } = harness.manager(
      { FAKE_CLAUDE_PROBE: '1' },
      { permissions: { kitDocsDir } },
    );
    const projectDir = harness.project();
    const script = await drain(
      manager.enqueue({ projectDir, stage: 'script', purpose: 'script', prompt: 'x' }),
    );
    const argv = probeOf(script.events).argv;
    expect(flagValue(argv, '--allowedTools')).toContain('WebSearch');
    expect(flagValue(argv, '--allowedTools')).toContain('Bash(reelforge *)');
    expect(flagValue(argv, '--permission-mode')).toBe('dontAsk');
    expect(flagValue(argv, '--add-dir')).toBe(kitDocsDir);
    const custom = await drain(
      manager.enqueue({ projectDir, stage: 'chat', prompt: 'y', allowedTools: ['Read'] }),
    );
    const customArgv = probeOf(custom.events).argv;
    expect(flagValue(customArgv, '--allowedTools')).toBe('Read');
    expect(flagValue(customArgv, '--disallowedTools')).toContain('WebFetch');
  });

  it('flags tool calls that broke the policy and were not blocked (tools-escape)', async () => {
    const { manager, lifecycle } = harness.manager({ FAKE_CLAUDE_SCENARIO: 'tools-escape' });
    const { outcome } = await drain(
      manager.enqueue({ projectDir: harness.project(), stage: 'scene-build', prompt: 'x' }),
    );
    expect(outcome.status).toBe('completed');
    const violation = lifecycle.find((event) => event.type === 'policy-violation');
    expect(violation?.type === 'policy-violation' && violation.violations).toMatchObject([
      { name: 'Bash', reason: 'command not allowed: echo pwned', blockedByCli: false },
    ]);
  });
});

describe('SessionManager: limit guard, usage, debug dumps', () => {
  // The guard runs on a fixed clock: reset times are relative to it, never to the real date/zone.
  const T0 = Date.UTC(2026, 0, 15, 12, 0);
  const fixedGuard = (): LimitGuard => new LimitGuard({ clock: new ManualClock(T0) });

  it('books usage per stage/model and dumps the raw stream of a limit turn', async () => {
    const guard = fixedGuard();
    const usage = new UsageLedger();
    const resetsAt = T0 / 1000 + 2 * 3600;
    const { manager, lifecycle } = harness.manager(
      { FAKE_CLAUDE_SCENARIO: 'rate-limit', FAKE_CLAUDE_RESETS_AT: String(resetsAt) },
      { guard, usage },
    );
    const projectDir = harness.project();
    const { outcome } = await drain(
      manager.enqueue({ projectDir, stage: 'storyboard', prompt: 'x' }),
    );
    guard.dispose();
    expect(outcome).toMatchObject({ status: 'failed', failure: 'limit' });
    expect(guard.pause).toMatchObject({
      reason: 'limit',
      until: resetsAt * 1000 + 60_000,
      untilSource: 'reset-time',
    });
    const file = usageFileSchema.parse(JSON.parse(readFileSync(usageFilePath(projectDir), 'utf8')));
    expect(file.stages['storyboard']?.['sonnet']).toMatchObject({
      turns: 1,
      failedTurns: 1,
      limitHits: 1,
    });
    const dump = lifecycle.find((event) => event.type === 'debug-dump');
    if (dump?.type !== 'debug-dump') throw new Error('no debug-dump event');
    expect(path.dirname(dump.path)).toBe(path.join(projectDir, DEBUG_DIR));
    const lines = readFileSync(dump.path, 'utf8').trim().split('\n');
    expect(lines.map((line) => (JSON.parse(line) as { type: string }).type)).toEqual([
      'system',
      'rate_limit_event',
      'assistant',
      'result',
    ]);
    const meta = JSON.parse(readFileSync(dump.path.replace(/\.jsonl$/, '.meta.json'), 'utf8')) as {
      failure: string;
    };
    expect(meta.failure).toBe('limit');
    expect(readFileSync(path.join(projectDir, DEBUG_DIR, '.gitignore'), 'utf8')).toBe('*\n');
  });

  it('a stale CLI resetsAt falls back to the reset time in the message (zone from the text)', async () => {
    const guard = fixedGuard();
    const { manager } = harness.manager(
      { FAKE_CLAUDE_SCENARIO: 'rate-limit', FAKE_CLAUDE_RESETS_AT: String(T0 / 1000 - 600) },
      { guard },
    );
    await drain(manager.enqueue({ projectDir: harness.project(), stage: 'chat', prompt: 'x' }));
    guard.dispose();
    // Fake text: "resets 5am (UTC)" -> next 05:00 UTC after T0 (12:00 UTC) = the next day.
    expect(guard.pause).toMatchObject({
      until: Date.UTC(2026, 0, 16, 5, 1),
      untilSource: 'reset-text',
    });
  });

  it('no turn starts while the guard is paused; resume() releases the queue', async () => {
    const guard = new LimitGuard();
    const { manager, lifecycle } = harness.manager({}, { guard });
    guard.pauseManually();
    const handle = manager.enqueue({ projectDir: harness.project(), stage: 'chat', prompt: 'x' });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(lifecycle.map((event) => event.type)).toEqual(['queued']);
    guard.resume();
    expect((await drain(handle)).outcome.status).toBe('completed');
  });

  it('successful turns are not dumped; debugDumps:false disables dumps', async () => {
    const projectDir = harness.project();
    const ok = harness.manager();
    await drain(ok.manager.enqueue({ projectDir, stage: 'chat', prompt: 'x' }));
    const off = harness.manager({ FAKE_CLAUDE_SCENARIO: 'crash' }, { debugDumps: false });
    await drain(off.manager.enqueue({ projectDir, stage: 'chat', prompt: 'x', newSession: true }));
    expect(readdirSync(path.join(projectDir, '.reelforge'))).not.toContain('debug');
  });
});
