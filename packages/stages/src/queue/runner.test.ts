/**
 * The production line with fake dependencies (no Claude, no stages): three films end to end, the
 * approval gate, a film waiting for its voice-over while the next one builds, failure isolation,
 * one film building at a time, independent channel queues and the per-film ✓/⚠ report.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { queueAttention } from './attention.js';
import { isBuildStep } from './state.js';
import { FILM_STEPS, LineHarness } from '../testing/queue.js';

const harnesses: LineHarness[] = [];
function harness(): LineHarness {
  const created = new LineHarness();
  harnesses.push(created);
  return created;
}
afterEach(() => {
  for (const created of harnesses.splice(0)) created.dispose();
});

describe('production line', () => {
  it('drives three films through every step, scripts first, then one build after another', async () => {
    const line = harness();
    await line.store.setOptions('voxplain', { autoApproveScript: true });
    const ids = await line.add('voxplain', 'Why the sky is blue', 'Doom on a calculator', 'Apollo');
    const runner = line.runner({ lock: false });
    const ended = await runner.start();
    expect(ended).toEqual({ ok: true, value: 'idle' });
    for (const id of ids) {
      expect(line.executor.stepsOf(id)).toEqual(FILM_STEPS);
      const item = await line.item('voxplain', id);
      expect(item.status).toBe('done');
      expect(item.projectPath).toContain(id);
    }
    // Every script is written before the first film starts building.
    const firstBuild = line.executor.calls.findIndex((call) => isBuildStep(call.step));
    const lastApproval = line.executor.calls.map((call) => call.step).lastIndexOf('approval');
    expect(lastApproval).toBeLessThan(firstBuild);
    expect(line.executor.maxActive).toBe(1);
    expect(line.notifications.filter((note) => note.kind === 'done')).toHaveLength(3);
    expect(line.notifications.at(-1)?.kind).toBe('line-idle');
  });

  it('stops at the approval gate until the user approves, then finishes', async () => {
    const line = harness();
    const [id = ''] = await line.add('voxplain', 'Why cats purr');
    const runner = line.runner({ lock: false });
    await runner.start();
    let item = await line.item('voxplain', id);
    expect(item.status).toBe('needs-approval');
    expect(line.executor.stepsOf(id)).toEqual(['brief', 'script', 'approval']);
    const queue = await line.store.read('voxplain');
    expect(queue.ok && queueAttention(queue.value).map((entry) => entry.kind)).toEqual([
      'approve-script',
    ]);
    expect(line.notifications.map((note) => note.kind)).toContain('needs-approval');
    // Nothing changes on another pass while the gate is closed (no history noise).
    const history = item.history.length;
    await runner.start();
    expect((await line.item('voxplain', id)).history).toHaveLength(history);
    expect(await runner.approveScript('voxplain', id)).toEqual({ ok: true, value: undefined });
    await runner.start();
    item = await line.item('voxplain', id);
    expect(item.status).toBe('done');
    expect(item.history.map((entry) => entry.status)).toEqual([
      'queued',
      'brief',
      'scripting',
      'needs-approval',
      'building',
      'exporting',
      'done',
    ]);
  });

  it('a film waiting for its voice-over does not hold up the next one', async () => {
    const line = harness();
    await line.store.setOptions('voxplain', { autoApproveScript: true });
    line.executor.voiceAll = false;
    const [waiting = '', next = ''] = await line.add('voxplain', 'First', 'Second');
    line.executor.voiced.add(next);
    const runner = line.runner({ lock: false });
    await runner.start();
    expect((await line.item('voxplain', waiting)).status).toBe('needs-voice');
    expect((await line.item('voxplain', next)).status).toBe('done');
    expect(line.notifications.find((note) => note.kind === 'needs-voice')?.itemId).toBe(waiting);
    line.executor.voiced.add(waiting); // the user imported a recording
    runner.poke();
    await runner.start();
    expect((await line.item('voxplain', waiting)).status).toBe('done');
  });

  it('a failed film keeps its reason and the line goes on with the next', async () => {
    const line = harness();
    await line.store.setOptions('voxplain', { autoApproveScript: true });
    const [bad = '', good = ''] = await line.add('voxplain', 'Bad', 'Good');
    line.executor.behaviour = (step, ctx) =>
      step === 'storyboard' && ctx.item.id === bad
        ? { kind: 'failed', message: 'storyboard.json invalid' }
        : undefined;
    await line.runner({ lock: false }).start();
    const failed = await line.item('voxplain', bad);
    expect(failed.status).toBe('failed');
    expect(failed.error).toEqual({ step: 'storyboard', message: 'storyboard.json invalid' });
    expect(line.executor.stepsOf(bad)).not.toContain('assets');
    expect((await line.item('voxplain', good)).status).toBe('done');
    expect(line.notifications.find((note) => note.kind === 'failed')?.itemId).toBe(bad);
    // Try again: the failed step runs again and the film finishes.
    line.executor.behaviour = undefined;
    await line.store.retry('voxplain', bad);
    await line.runner({ lock: false }).start();
    expect((await line.item('voxplain', bad)).status).toBe('done');
  });

  it('never builds two films at once: a started build finishes before the next starts', async () => {
    const line = harness();
    await line.store.setOptions('a', { autoApproveScript: true });
    await line.store.setOptions('b', { autoApproveScript: true });
    await line.add('a', 'A1', 'A2');
    await line.add('b', 'B1');
    await line.runner({ lock: false }).start();
    const builds = line.executor.calls.filter((call) => isBuildStep(call.step));
    const blocks = builds
      .map((call) => call.itemId)
      .filter((id, index, all) => all[index - 1] !== id);
    expect(blocks).toHaveLength(3); // each film's build steps form one uninterrupted block
    expect(line.executor.maxActive).toBe(1);
  });

  it('channel queues are independent: a paused channel waits, another channel finishes', async () => {
    const line = harness();
    await line.store.setOptions('a', { autoApproveScript: true, paused: true });
    await line.store.setOptions('b', { autoApproveScript: true });
    const [held = ''] = await line.add('a', 'Held');
    const [film = ''] = await line.add('b', 'Film');
    await line.runner({ lock: false }).start();
    expect((await line.item('a', held)).status).toBe('queued');
    expect((await line.item('b', film)).status).toBe('done');
    expect(line.created).toEqual([film]);
    await line.store.setOptions('a', { paused: false });
    await line.runner({ lock: false }).start();
    expect((await line.item('a', held)).status).toBe('done');
  });

  it('collects the ⚠ report of a finished film until the user has looked at it', async () => {
    const line = harness();
    await line.store.setOptions('voxplain', { autoApproveScript: true });
    const [id = ''] = await line.add('voxplain', 'Warnings');
    line.executor.behaviour = (step) =>
      step === 'final-review' ? { kind: 'done', warnings: ['s03: blank frame'] } : undefined;
    await line.runner({ lock: false }).start();
    expect((await line.item('voxplain', id)).warnings).toEqual(['s03: blank frame']);
    expect(line.notifications.find((note) => note.kind === 'done')?.message).toContain('⚠ 1');
    let queue = await line.store.read('voxplain');
    expect(queue.ok && queueAttention(queue.value).map((entry) => entry.kind)).toEqual([
      'check-warnings',
    ]);
    await line.store.markReviewed('voxplain', id);
    queue = await line.store.read('voxplain');
    expect(queue.ok && queueAttention(queue.value)).toEqual([]);
  });
});
