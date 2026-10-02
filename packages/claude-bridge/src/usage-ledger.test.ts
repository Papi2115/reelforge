import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { usageFileSchema } from '@reelforge/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { TempDirs } from './testing/fake-claude.js';
import { fakeOutcome, outcomeWithUsage } from './testing/outcomes.js';
import { UsageLedger, usageFilePath, usageOfOutcome, type BudgetWarning } from './usage-ledger.js';

const temps = new TempDirs();
afterEach(() => {
  temps.cleanup();
});

const now = (): Date => new Date('2026-10-02T03:00:00.000Z');
const tokens = {
  inputTokens: 10,
  outputTokens: 20,
  cacheReadInputTokens: 300,
  cacheCreationInputTokens: 40,
};

describe('usageOfOutcome', () => {
  it('sums per-model usage (subagents included), cost and API duration', () => {
    const outcome = outcomeWithUsage({
      costUsd: 0.3,
      durationMs: 1200,
      usage: tokens,
      models: {
        'claude-opus-5-5': { ...tokens, costUsd: 0.25, contextWindow: 1 },
        'claude-haiku-4-5-20251001': { ...tokens, costUsd: 0.05, contextWindow: 1 },
      },
    });
    expect(usageOfOutcome(outcome)).toEqual({
      turns: 1,
      failedTurns: 0,
      limitHits: 0,
      inputTokens: 20,
      outputTokens: 40,
      cacheReadInputTokens: 600,
      cacheCreationInputTokens: 80,
      costUsd: 0.3,
      durationMs: 1200,
    });
  });

  it('falls back to result.usage; failures and limit hits are counted', () => {
    const limited = outcomeWithUsage({ usage: tokens }, { status: 'failed', failure: 'limit' });
    expect(usageOfOutcome(limited)).toMatchObject({
      failedTurns: 1,
      limitHits: 1,
      inputTokens: 10,
    });
    expect(usageOfOutcome(fakeOutcome({ status: 'crashed' }))).toMatchObject({
      turns: 1,
      failedTurns: 1,
      inputTokens: 0,
    });
  });
});

describe('UsageLedger', () => {
  it('books per stage and model into an atomic, schema-valid usage.json', async () => {
    const projectDir = temps.make();
    const ledger = new UsageLedger({ now });
    const turn = outcomeWithUsage({ costUsd: 0.5, durationMs: 100, usage: tokens });
    await ledger.record(projectDir, { stage: 'scene-build', model: 'opus', outcome: turn });
    await ledger.record(projectDir, { stage: 'scene-build', model: 'opus', outcome: turn });
    const recorded = await ledger.record(projectDir, {
      stage: 'critic',
      model: 'haiku',
      outcome: turn,
    });
    expect(recorded.ok).toBe(true);
    const file = usageFileSchema.parse(JSON.parse(readFileSync(usageFilePath(projectDir), 'utf8')));
    expect(file.totals).toMatchObject({ turns: 3, costUsd: 1.5, inputTokens: 30 });
    expect(file.stages['scene-build']?.['opus']).toMatchObject({ turns: 2, durationMs: 200 });
    expect(file.stages['critic']?.['haiku']?.turns).toBe(1);
    expect(file.budgetWarnings).toEqual([]);
  });

  it('soft budget: warns once per threshold (persisted across instances), never blocks', async () => {
    const projectDir = temps.make();
    const budgetFor = (): { costUsd: number } => ({ costUsd: 1 });
    const first = new UsageLedger({ now, budgetFor });
    const events: BudgetWarning[] = [];
    first.on('budget', (warning) => events.push(warning));
    const turn = outcomeWithUsage({ costUsd: 0.45 });
    const one = await first.record(projectDir, { stage: 'chat', model: 'sonnet', outcome: turn });
    const two = await first.record(projectDir, { stage: 'chat', model: 'sonnet', outcome: turn });
    expect(one.ok && one.value.warnings).toEqual([]);
    expect(two.ok && two.value.warnings.map((warning) => warning.percent)).toEqual([50, 80]);
    const second = new UsageLedger({ now, budgetFor });
    const three = await second.record(projectDir, {
      stage: 'chat',
      model: 'sonnet',
      outcome: turn,
    });
    expect(three.ok && three.value.warnings.map((warning) => warning.percent)).toEqual([100]);
    const four = await second.record(projectDir, { stage: 'chat', model: 'sonnet', outcome: turn });
    expect(four.ok && four.value.warnings).toEqual([]);
    expect(four.ok && four.value.file.totals.turns).toBe(4);
    expect(events.map((warning) => [warning.percent, warning.projectDir])).toEqual([
      [50, projectDir],
      [80, projectDir],
    ]);
  });

  it('a corrupt usage.json is reported, not overwritten', async () => {
    const projectDir = temps.make();
    mkdirSync(path.dirname(usageFilePath(projectDir)), { recursive: true });
    writeFileSync(usageFilePath(projectDir), '{"version":1');
    const recorded = await new UsageLedger({ now }).record(projectDir, {
      stage: 'chat',
      model: 'sonnet',
      outcome: fakeOutcome(),
    });
    expect(!recorded.ok && recorded.error.kind).toBe('corrupt');
    expect(readFileSync(usageFilePath(projectDir), 'utf8')).toBe('{"version":1');
  });
});
