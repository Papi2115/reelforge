/**
 * The production line in the app (PLAN.md#13.9, ADR-034), Electron-free: the one QueueRunner of
 * the app (made by `createRunner` with the app's executor, project factory and usage-limit signal;
 * remade when the quiet hours changed while it was stopped), the queue commands of the dialog,
 * the state pushed to the renderer (coalesced; live progress of the running step), system
 * notifications through `notify` when the preferences allow, crash recovery at start (`init`) and
 * a clean stop when the app closes (`dispose`: the running step is aborted and runs again next
 * time). "Run until idle" keeps the line wanted: when it ran out of work and you approve a script,
 * add topics, resume or retry a film, it starts again by itself; Stop, a planned end time and a
 * blocked Claude end that.
 */
import type { ProductionQueue } from '@reelforge/shared';
import {
  QueueRunner,
  systemLocalMinute,
  type LineEnd,
  type QueueNotification,
  type QueueNotifier,
  type QueueResult,
  type QueueStore,
  type QuietHours,
} from '@reelforge/stages';
import type { ProjectOpenResult } from '../../shared/project-contract.js';
import type {
  LinePrefs,
  LinePrefsPatch,
  LiveProgress,
  QueueCommandResult,
  QueueFolder,
  QueueItemRef,
  QueueOptionsPatchView,
  QueueState,
  QueueTopicRequest,
  RunUntilRequest,
  RunUntilView,
} from '../../shared/queue-contract.js';
import { describeError, type Logger } from '../logger.js';
import { CoalescedPush } from '../stages/coalesced-push.js';
import { projectKey } from '../stages/stage-service.js';
import { lineEndNotice, lineNotice, type LineNotice } from './line-notices.js';
import type { LinePrefsStore } from './line-prefs.js';
import { anyFilmWaitsIn, filmFolder, filmProject } from './line-films.js';
import { bindLive, OutsideChanges } from './line-live.js';
import { attentionViews, channelView, lineView, liveKey, runUntilView } from './queue-views.js';

/** What the service hands the runner factory. */
export interface RunnerHooks {
  readonly notifier: QueueNotifier;
  readonly quietHours: QuietHours | undefined;
  readonly channelIds: () => Promise<readonly string[]>;
}

export interface QueueServiceOptions {
  readonly store: QueueStore;
  readonly createRunner: (hooks: RunnerHooks) => QueueRunner;
  /** The channels of Settings → Channels, in their order. */
  readonly channelIds: () => Promise<readonly string[]>;
  /** The channel has a voice and a key (the line generates its voiceovers). */
  readonly voiceReady: (channelId: string) => Promise<boolean>;
  readonly prefs: LinePrefsStore;
  readonly push: (state: QueueState) => void;
  /** A system notification (only called when the preferences allow). */
  readonly notify: (notice: LineNotice) => void;
  readonly openProject: (dir: string) => Promise<ProjectOpenResult>;
  readonly openPath: (folder: string) => Promise<string>;
  /** Where the export of a film's project goes. */
  readonly videoFolder: (projectDir: string) => string;
  readonly log: Logger;
  readonly now?: () => number;
  readonly localMinute?: (epochMs: number) => number;
  readonly pushDelayMs?: number;
  /** An approval or import in the app: how long to wait before the line looks again. */
  readonly outsideDelayMs?: number;
}

const ok = (message: string | null = null): QueueCommandResult => ({ status: 'ok', message });
const failure = (message: string): QueueCommandResult => ({ status: 'error', message });

/** Kinds of "Needs you" that wait for the user (not failures, not ⚠ reports). */
const WAITING_KINDS = new Set(['approve-script', 'add-voice', 'review-assets']);

export class QueueService {
  private runner: QueueRunner | undefined;
  private runnerQuiet = '';
  private wanted = false;
  private runUntil: RunUntilView = { kind: 'idle' };
  private lastEnd: LineEnd | null = null;
  private problem: string | null = null;
  private didWork = false;
  private readonly live = new Map<string, LiveProgress>();
  private readonly pushes: CoalescedPush;
  private readonly outside: OutsideChanges;
  private disposed = false;
  private readonly onStoreChanged = (): void => {
    this.pushes.schedule(false);
  };

  constructor(private readonly options: QueueServiceOptions) {
    this.pushes = new CoalescedPush(options.pushDelayMs ?? 250, () => this.flush());
    options.store.on('changed', this.onStoreChanged);
    this.outside = new OutsideChanges(options.outsideDelayMs ?? 500, async (keys) => {
      const ids = await options.channelIds();
      if (keys === 'any' || (await anyFilmWaitsIn(options.store, ids, keys))) this.nudge();
    });
  }

  /** A run of the line is going on (quitting must stop it first). */
  get busy(): boolean {
    return this.runner?.isRunning === true;
  }

  /** App start: the preferences, and steps a crash left `running` become pending again. */
  async init(): Promise<void> {
    await this.options.prefs.load();
    for (const channelId of await this.options.channelIds()) {
      const recovered = await this.options.store.recover(channelId);
      if (!recovered.ok) this.options.log.warn(`queue ${channelId}: ${recovered.error.message}`);
    }
    this.pushes.schedule(false);
  }

  async state(): Promise<QueueState> {
    const queues: ProductionQueue[] = [];
    const channels = [];
    for (const channelId of await this.options.channelIds()) {
      const read = await this.options.store.read(channelId);
      if (read.ok) queues.push(read.value);
      const queue = read.ok ? read.value : { error: read.error.message };
      channels.push(channelView(channelId, queue, await this.voiceReady(channelId), this.live));
    }
    return {
      line: lineView({
        status: this.runner?.lineStatus ?? { state: 'stopped' },
        wanted: this.wanted,
        runUntil: this.runUntil,
        lastEnd: this.lastEnd,
        problem: this.problem,
      }),
      channels,
      attention: attentionViews(queues),
      prefs: this.options.prefs.current,
    };
  }

  async addTopics(
    channelId: string,
    topics: readonly QueueTopicRequest[],
  ): Promise<QueueCommandResult> {
    if (!(await this.options.channelIds()).includes(channelId)) {
      return failure('This channel does not exist any more.');
    }
    const added = await this.options.store.addTopics(
      channelId,
      topics.map((topic) => ({
        topic: topic.topic,
        // Films of the line are English only (PLAN.md#13.9 desktop packet).
        language: 'en' as const,
        ...(topic.targetMinutes === undefined ? {} : { targetMinutes: topic.targetMinutes }),
      })),
    );
    if (!added.ok) return failure(added.error.message);
    this.nudge();
    const count = added.value.length;
    return ok(`${String(count)} topic${count === 1 ? '' : 's'} added.`);
  }

  remove(ref: QueueItemRef): Promise<QueueCommandResult> {
    this.live.delete(liveKey(ref.channelId, ref.itemId));
    const removed = this.options.store.removeItem(ref.channelId, ref.itemId);
    return this.apply(removed, false, 'Removed from the queue. Its project folder stays.');
  }

  move(ref: QueueItemRef, index: number): Promise<QueueCommandResult> {
    return this.apply(this.options.store.moveItem(ref.channelId, ref.itemId, index), false);
  }

  hold(ref: QueueItemRef): Promise<QueueCommandResult> {
    return this.apply(this.options.store.hold(ref.channelId, ref.itemId), false);
  }

  resume(ref: QueueItemRef): Promise<QueueCommandResult> {
    return this.apply(this.options.store.resume(ref.channelId, ref.itemId), true);
  }

  retry(ref: QueueItemRef): Promise<QueueCommandResult> {
    return this.apply(this.options.store.retry(ref.channelId, ref.itemId), true);
  }

  markReviewed(ref: QueueItemRef): Promise<QueueCommandResult> {
    return this.apply(this.options.store.markReviewed(ref.channelId, ref.itemId), false);
  }

  setOptions(channelId: string, patch: QueueOptionsPatchView): Promise<QueueCommandResult> {
    const set = this.options.store.setOptions(channelId, {
      ...(patch.autoApproveScript === undefined
        ? {}
        : { autoApproveScript: patch.autoApproveScript }),
      ...(patch.paused === undefined ? {} : { paused: patch.paused }),
      ...(patch.defaultTargetMinutes === undefined
        ? {}
        : { defaultTargetMinutes: patch.defaultTargetMinutes }),
    });
    return this.apply(set, true);
  }

  start(request: RunUntilRequest): QueueCommandResult {
    if (this.disposed) return failure('The app is closing.');
    if (this.busy) return failure('The line is already running.');
    this.wanted = true;
    this.runUntil = runUntilView(
      request,
      this.now(),
      this.options.localMinute ?? systemLocalMinute,
    );
    this.launch();
    return ok();
  }

  async stop(): Promise<QueueCommandResult> {
    this.wanted = false;
    await this.runner?.stop();
    this.pushes.schedule(false);
    return ok();
  }

  async approveScript(ref: QueueItemRef): Promise<QueueCommandResult> {
    const approved = await this.ensureRunner().approveScript(ref.channelId, ref.itemId);
    if (!approved.ok) return failure(approved.error);
    this.nudge();
    return ok('Script approved.');
  }

  async openProject(ref: QueueItemRef): Promise<ProjectOpenResult> {
    const dir = await filmProject(this.options.store, ref);
    if (dir === undefined) {
      return {
        status: 'error',
        error: { kind: 'not-found', message: 'This film has no project yet.' },
      };
    }
    return this.options.openProject(dir);
  }

  async openFolder(ref: QueueItemRef, folder: QueueFolder): Promise<QueueCommandResult> {
    const dir = await filmProject(this.options.store, ref);
    if (dir === undefined) return failure('This film has no project yet.');
    const problem = await this.options.openPath(filmFolder(dir, folder, this.options.videoFolder));
    return problem === '' ? ok() : failure(problem);
  }

  /** Check the waiting films again (a key was saved, a voiceover was imported…). */
  wake(): QueueCommandResult {
    this.nudge();
    return ok();
  }

  async updatePrefs(patch: LinePrefsPatch): Promise<LinePrefs> {
    const prefs = await this.options.prefs.update(patch);
    this.pushes.schedule(false);
    return prefs;
  }

  /**
   * An approval, a voiceover or an asset review in the app: the line looks again soon. With
   * `dir` (the open project's pipeline changed) only when a film of that folder waits for you.
   */
  outsideChange(dir?: string): void {
    if (!this.disposed) this.outside.note(dir === undefined ? undefined : projectKey(dir));
  }

  /** App quit: the running step is aborted (it runs again next time), the state stays on disk. */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.wanted = false;
    this.outside.dispose();
    await this.runner?.stop();
    this.runner?.dispose();
    this.options.store.off('changed', this.onStoreChanged);
    this.pushes.dispose();
  }

  /** A queue change; `wake`: the line may have something new to do. */
  private async apply(
    change: Promise<QueueResult<unknown>>,
    wake: boolean,
    message: string | null = null,
  ): Promise<QueueCommandResult> {
    const done = await change;
    if (!done.ok) return failure(done.error.message);
    if (wake) this.nudge();
    return ok(message);
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private async voiceReady(channelId: string): Promise<boolean> {
    try {
      return await this.options.voiceReady(channelId);
    } catch (error) {
      this.options.log.warn(`voice of channel ${channelId} unknown: ${describeError(error)}`);
      return false;
    }
  }

  /** Wakes a running line, or starts a wanted one that ran out of work. */
  private nudge(): void {
    if (this.disposed) return;
    if (this.runner?.isRunning === true) this.runner.poke();
    else if (this.wanted && this.lastEnd === 'idle') this.launch();
    this.pushes.schedule(false);
  }

  private launch(): void {
    const runner = this.ensureRunner();
    this.didWork = false;
    this.problem = null;
    this.lastEnd = null;
    const runUntil =
      this.runUntil.kind === 'idle'
        ? { kind: 'idle' as const }
        : { kind: 'time' as const, at: this.runUntil.at };
    this.options.log.info(`production line started (${this.runUntil.kind})`);
    void runner.start({ runUntil }).then(
      (result) => this.ended(result),
      (error: unknown) => this.ended({ ok: false, error: describeError(error) }),
    );
    this.pushes.schedule(false);
  }

  private async ended(
    result: { ok: true; value: LineEnd } | { ok: false; error: string },
  ): Promise<void> {
    if (!result.ok) {
      this.wanted = false;
      this.problem = result.error;
      this.options.log.warn(`production line did not run: ${result.error}`);
      this.pushes.schedule(false);
      return;
    }
    const end = result.value;
    this.lastEnd = end;
    if (end !== 'idle') this.wanted = false;
    this.options.log.info(`production line ended: ${end}`);
    const waiting = (await this.state()).attention.filter((entry) =>
      WAITING_KINDS.has(entry.kind),
    ).length;
    const notice = lineEndNotice({
      end,
      didWork: this.didWork,
      waiting,
      until: this.runUntil.kind === 'time' ? this.runUntil.text : undefined,
    });
    if (notice !== undefined) this.show(notice);
    this.pushes.schedule(false);
  }

  private ensureRunner(): QueueRunner {
    const quiet = this.options.prefs.current.quietHours ?? undefined;
    const quietKey = JSON.stringify(quiet ?? null);
    if (this.runner !== undefined && (this.runner.isRunning || quietKey === this.runnerQuiet)) {
      return this.runner;
    }
    this.runner?.dispose();
    const runner = this.options.createRunner({
      notifier: {
        notify: (notification) => {
          this.onNotification(notification);
        },
      },
      quietHours: quiet,
      channelIds: this.options.channelIds,
    });
    bindLive(runner, this.live, {
      changed: () => {
        this.pushes.schedule(false);
      },
      worked: () => {
        this.didWork = true;
      },
    });
    this.runner = runner;
    this.runnerQuiet = quietKey;
    return runner;
  }

  private onNotification(notification: QueueNotification): void {
    this.options.log.info(`line: ${notification.kind}: ${notification.message}`);
    if (notification.kind === 'line-blocked') this.problem = notification.message;
    const notice = lineNotice(notification);
    if (notice !== undefined) this.show(notice);
  }

  private show(notice: LineNotice): void {
    if (this.options.prefs.current.notifications) this.options.notify(notice);
  }

  private async flush(): Promise<void> {
    try {
      const state = await this.state();
      if (!this.disposed) this.options.push(state);
    } catch (error) {
      this.options.log.warn(`production line state not read: ${describeError(error)}`);
    }
  }
}
