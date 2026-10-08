import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_RUN_STEPS, StageRun } from './stage-run.js';

const DIR = path.join('C:', 'Filmy', 'Mój film');

function text(messageId: string, value: string) {
  return {
    type: 'claude' as const,
    stage: 'script' as const,
    event: { kind: 'text' as const, messageId, text: value, parentToolUseId: null },
  };
}

describe('StageRun', () => {
  it('tracks the step, percent, pause and Claude steps across turns', () => {
    const run = new StageRun('script', DIR, 1_000);
    expect(run.apply({ type: 'started', stage: 'script' })).toBe(false);
    run.apply({ type: 'step', stage: 'script', label: 'Research', percent: 5 });
    run.apply({ type: 'step', stage: 'script', label: 'Claude: research', percent: undefined });
    run.apply(text('m1', 'Looking up sources.'));
    run.apply({ type: 'step', stage: 'script', label: 'Claude: script', percent: undefined });
    run.apply(text('m1', 'Writing the script.'));
    run.apply({
      type: 'paused',
      stage: 'script',
      until: '2026-10-02T15:00:00.000Z',
      message: 'limit',
    });
    run.apply({
      type: 'warning',
      stage: 'script',
      message: 'research.md: 1 claim without a source',
    });
    const view = run.snapshot();
    expect(view).toMatchObject({
      stage: 'script',
      label: 'Claude: script',
      percent: 5,
      startedAt: 1_000,
      paused: { until: Date.parse('2026-10-02T15:00:00.000Z'), message: 'limit' },
    });
    expect(view.steps.map((step) => (step.type === 'text' ? step.text : step.type))).toEqual([
      'Looking up sources.',
      'Writing the script.',
    ]);
    expect(new Set(view.steps.map((step) => step.id)).size).toBe(2);
    expect(run.warnings).toEqual(['research.md: 1 claim without a source']);
    run.apply({ type: 'resumed', stage: 'script' });
    expect(run.snapshot().paused).toBeNull();
  });

  it('lists the shots in progress (started or requeued, not finished)', () => {
    const run = new StageRun('scenes', DIR, 0);
    const shot = (shotId: string, state: 'started' | 'finished' | 'requeued') =>
      run.apply({ type: 'shot', stage: 'scenes', shotId, state, status: undefined });
    expect(run.shotsInProgress()).toEqual([]);
    shot('s01', 'started');
    shot('s02', 'started');
    shot('s03', 'started');
    shot('s02', 'finished');
    shot('s03', 'requeued');
    expect(run.shotsInProgress()).toEqual(['s01', 's03']);
  });

  it('keeps only the newest steps', () => {
    const run = new StageRun('storyboard', DIR, 0);
    for (let turn = 0; turn < MAX_RUN_STEPS + 20; turn += 1) {
      run.apply({ type: 'step', stage: 'storyboard', label: 'Claude: x', percent: 200 });
      run.apply({ ...text(`m${String(turn)}`, `turn ${String(turn)}`), stage: 'storyboard' });
    }
    const view = run.snapshot();
    expect(view.steps).toHaveLength(MAX_RUN_STEPS);
    expect(view.percent).toBe(100);
    const lastStep = view.steps.at(-1);
    expect(lastStep?.type === 'text' && lastStep.text).toBe(`turn ${String(MAX_RUN_STEPS + 19)}`);
  });
});
