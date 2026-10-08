/**
 * Test support for the production line (not exported from the package index): a scripted step
 * executor that records every call and the number of steps running at once, a project factory
 * without files, a manual usage-limit signal and a runner wired to a temp queues folder.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ok, type Result } from '@reelforge/claude-bridge';
import type { QueueStep } from '@reelforge/shared';
import { QueueRunner, type QueueRunnerOptions } from '../queue/runner.js';
import { QueueStore } from '../queue/store.js';
import type {
  ExecutorStep,
  QueueNotification,
  QueueProjectFactory,
  QueueStepContext,
  QueueStepExecutor,
  QueueStepOutcome,
  UsageLimitSignal,
  UsageLimitState,
} from '../queue/types.js';
import { ManualClock } from './manual-clock.js';

export interface ExecutorCall {
  readonly itemId: string;
  readonly step: ExecutorStep;
}

export type StepBehaviour = (
  step: ExecutorStep,
  ctx: QueueStepContext,
) => Promise<QueueStepOutcome> | QueueStepOutcome | undefined;

export class FakeExecutor implements QueueStepExecutor {
  readonly calls: ExecutorCall[] = [];
  readonly approved = new Set<string>();
  /** Items (ids) whose voice-over is in; `voiceAll` = every channel has a voice provider. */
  readonly voiced = new Set<string>();
  voiceAll = true;
  behaviour: StepBehaviour | undefined;
  private active = 0;
  maxActive = 0;

  async run(step: ExecutorStep, ctx: QueueStepContext): Promise<QueueStepOutcome> {
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    this.calls.push({ itemId: ctx.item.id, step });
    try {
      await Promise.resolve();
      const custom = await this.behaviour?.(step, ctx);
      if (custom !== undefined) return custom;
      if (step === 'approval') {
        const approved = ctx.autoApproveScript || this.approved.has(ctx.projectDir);
        return approved ? { kind: 'done' } : { kind: 'waiting', message: 'approve it' };
      }
      if (step === 'voiceover' && !this.voiceAll && !this.voiced.has(ctx.item.id)) {
        return { kind: 'waiting', message: 'record it' };
      }
      return { kind: 'done', message: `${step} ok` };
    } finally {
      this.active -= 1;
    }
  }

  approveScript(projectDir: string): Promise<Result<void, string>> {
    this.approved.add(projectDir);
    return Promise.resolve(ok(undefined));
  }

  /** Work steps of `itemId` in call order, each once (gate re-checks dropped). */
  stepsOf(itemId: string): ExecutorStep[] {
    const steps = this.calls.filter((call) => call.itemId === itemId).map((call) => call.step);
    return steps.filter((step, index) => steps.indexOf(step) === index);
  }
}

export class ManualLimitSignal implements UsageLimitSignal {
  private state: UsageLimitState | undefined;
  private readonly listeners = new Set<(state: UsageLimitState | undefined) => void>();

  current(): UsageLimitState | undefined {
    return this.state;
  }

  subscribe(listener: (state: UsageLimitState | undefined) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  set(state: UsageLimitState | undefined): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}

export const FILM_STEPS: readonly QueueStep[] = [
  'brief',
  'script',
  'approval',
  'voiceover',
  'clean',
  'words',
  'storyboard',
  'assets',
  'scenes',
  'final-review',
  'sound-cues',
  'mix',
  'export',
  'publish',
];

export class LineHarness {
  readonly dir: string;
  readonly clock = new ManualClock(Date.parse('2026-10-07T20:00:00.000Z'));
  readonly store: QueueStore;
  readonly executor = new FakeExecutor();
  readonly notifications: QueueNotification[] = [];
  readonly created: string[] = [];
  private nextId = 0;
  readonly projects: QueueProjectFactory;

  constructor() {
    this.dir = mkdtempSync(path.join(os.tmpdir(), 'rf queue żółw '));
    this.store = this.newStore();
    this.projects = {
      create: ({ item }) => {
        this.created.push(item.id);
        return Promise.resolve(ok({ projectPath: path.join(this.dir, 'films', item.id) }));
      },
    };
  }

  newStore(): QueueStore {
    return new QueueStore(this.dir, {
      now: () => new Date(this.clock.now()),
      newId: () => {
        this.nextId += 1;
        return `i${String(this.nextId)}`;
      },
    });
  }

  runner(options: Partial<QueueRunnerOptions> = {}): QueueRunner {
    return new QueueRunner({
      store: this.store,
      projects: this.projects,
      executor: this.executor,
      clock: this.clock,
      notifier: { notify: (notification) => this.notifications.push(notification) },
      localMinute: () => 12 * 60,
      ...options,
    });
  }

  async add(channelId: string, ...topics: string[]): Promise<string[]> {
    const added = await this.store.addTopics(
      channelId,
      topics.map((topic) => ({ topic })),
    );
    if (!added.ok) throw new Error(added.error.message);
    return added.value.map((item) => item.id);
  }

  async item(channelId: string, itemId: string) {
    const queue = await this.store.read(channelId);
    if (!queue.ok) throw new Error(queue.error.message);
    const found = queue.value.items.find((item) => item.id === itemId);
    if (found === undefined) throw new Error(`no ${itemId}`);
    return found;
  }

  dispose(): void {
    rmSync(this.dir, { recursive: true, force: true });
  }
}

/** Resolves once `predicate` holds for an emitted line status. */
export function lineState(runner: QueueRunner, state: string): Promise<void> {
  return new Promise((resolve) => {
    const listener = (status: { readonly state: string }): void => {
      if (status.state !== state) return;
      runner.off('line', listener);
      resolve();
    };
    runner.on('line', listener);
  });
}
