/**
 * Production queues on disk (PLAN.md#13.9): `<queuesDir>/<channelId>.json` per channel and
 * `<queuesDir>/line.json` for the whole line. zod-validated, atomic writes, read-modify-write
 * serialized per file in this process. Every change of a queue is emitted (`changed`), so the
 * running line notices topics added, approvals, holds and removals right away.
 */
import { randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { JsonFileStore, err, errorCode, ok, type Result } from '@reelforge/claude-bridge';
import {
  LINE_STATE_FILE,
  MAX_QUEUE_ITEMS,
  QUEUE_FILE_VERSION,
  emptyLineState,
  emptyProductionQueue,
  lineStateSchema,
  productionQueueSchema,
  queueFileName,
  queueTopicInputSchema,
  type LineState,
  type ProductionQueue,
  type QueueItem,
  type QueueTopicInput,
} from '@reelforge/shared';
import { holdItem, recoverItem, resumeItem, retryItem } from './state.js';

export interface QueueStoreError {
  readonly kind: 'io' | 'corrupt' | 'not-found' | 'invalid';
  readonly message: string;
}

export type QueueResult<T> = Result<T, QueueStoreError>;

export interface QueueStoreOptions {
  readonly now?: () => Date;
  /** New item ids (tests); default: time + random, kebab-case. */
  readonly newId?: () => string;
}

export interface QueueOptionsPatch {
  readonly autoApproveScript?: boolean;
  readonly paused?: boolean;
  readonly defaultTargetMinutes?: number;
}

function defaultId(): string {
  return `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
}

const CHANNEL_FILE = /^[a-z0-9]+(-[a-z0-9]+)*\.json$/;

/** Who changed a queue: the line itself, or the user (UI / IPC). */
export type QueueChangeOrigin = 'line' | 'user';

export class QueueStore extends EventEmitter<{ changed: [ProductionQueue, QueueChangeOrigin] }> {
  private readonly queues = new Map<string, JsonFileStore<ProductionQueue>>();
  private readonly line = new JsonFileStore(lineStateSchema, emptyLineState);
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(
    readonly queuesDir: string,
    options: QueueStoreOptions = {},
  ) {
    super();
    this.now = options.now ?? (() => new Date());
    this.newId = options.newId ?? defaultId;
  }

  file(channelId: string): string {
    return path.join(this.queuesDir, queueFileName(channelId));
  }

  /** Channels with a queue file, sorted by id. */
  async channelIds(): Promise<QueueResult<string[]>> {
    try {
      const names = await readdir(this.queuesDir);
      return ok(
        names
          .filter((name) => CHANNEL_FILE.test(name) && name !== LINE_STATE_FILE)
          .map((name) => name.slice(0, -'.json'.length))
          .sort(),
      );
    } catch (error) {
      if (errorCode(error) === 'ENOENT') return ok([]);
      return err({ kind: 'io', message: String(error) });
    }
  }

  async read(channelId: string): Promise<QueueResult<ProductionQueue>> {
    const read = await this.queueFile(channelId).read(this.file(channelId));
    return read.ok ? ok(read.value) : err(read.error);
  }

  /** Read-modify-write of one channel's queue (a missing file starts empty). */
  async update(
    channelId: string,
    mutate: (queue: ProductionQueue) => ProductionQueue,
    origin: QueueChangeOrigin = 'user',
  ): Promise<QueueResult<ProductionQueue>> {
    const written = await this.queueFile(channelId).update(this.file(channelId), mutate);
    if (!written.ok) return err(written.error);
    this.emit('changed', written.value, origin);
    return ok(written.value);
  }

  /** Changes one item; `not-found` when it is gone (removed by the user meanwhile). */
  async updateItem(
    channelId: string,
    itemId: string,
    mutate: (item: QueueItem) => QueueItem,
    origin: QueueChangeOrigin = 'user',
  ): Promise<QueueResult<QueueItem>> {
    let found: QueueItem | undefined;
    const written = await this.update(
      channelId,
      (queue) => ({
        ...queue,
        items: queue.items.map((item) => {
          if (item.id !== itemId) return item;
          found = mutate(item);
          return found;
        }),
      }),
      origin,
    );
    if (!written.ok) return written;
    return found === undefined
      ? err({ kind: 'not-found', message: `no item "${itemId}" in ${channelId}` })
      : ok(found);
  }

  /** Appends topics at the end of the channel's queue. */
  async addTopics(
    channelId: string,
    inputs: readonly QueueTopicInput[],
  ): Promise<QueueResult<QueueItem[]>> {
    const parsed: QueueTopicInput[] = [];
    for (const input of inputs) {
      const checked = queueTopicInputSchema.safeParse(input);
      if (!checked.success) return err({ kind: 'invalid', message: checked.error.message });
      parsed.push(checked.data);
    }
    const at = this.now().toISOString();
    const added = parsed.map((input): QueueItem => ({
      ...input,
      id: this.newId(),
      language: input.language ?? 'en',
      status: 'queued',
      stageProgress: {},
      warnings: [],
      createdAt: at,
      updatedAt: at,
      history: [{ at, status: 'queued' }],
    }));
    const check = { full: false };
    const written = await this.update(channelId, (queue) => {
      check.full = queue.items.length + added.length > MAX_QUEUE_ITEMS;
      return check.full
        ? queue
        : { ...queue, version: QUEUE_FILE_VERSION, items: [...queue.items, ...added] };
    });
    if (!written.ok) return written;
    return check.full
      ? err({ kind: 'invalid', message: `a queue holds at most ${String(MAX_QUEUE_ITEMS)} films` })
      : ok(added);
  }

  /** Removes an item from the queue (its project folder stays on disk). */
  async removeItem(channelId: string, itemId: string): Promise<QueueResult<ProductionQueue>> {
    return this.update(channelId, (queue) => ({
      ...queue,
      items: queue.items.filter((item) => item.id !== itemId),
    }));
  }

  /** Moves an item to `index` (clamped) in the user's order. */
  async moveItem(
    channelId: string,
    itemId: string,
    index: number,
  ): Promise<QueueResult<ProductionQueue>> {
    return this.update(channelId, (queue) => {
      const moving = queue.items.find((item) => item.id === itemId);
      if (moving === undefined) return queue;
      const rest = queue.items.filter((item) => item.id !== itemId);
      const at = Math.max(0, Math.min(rest.length, Math.trunc(index)));
      return { ...queue, items: [...rest.slice(0, at), moving, ...rest.slice(at)] };
    });
  }

  hold(channelId: string, itemId: string): Promise<QueueResult<QueueItem>> {
    return this.updateItem(channelId, itemId, (item) => holdItem(item, this.stamp()));
  }

  resume(channelId: string, itemId: string): Promise<QueueResult<QueueItem>> {
    return this.updateItem(channelId, itemId, (item) => resumeItem(item, this.stamp()));
  }

  retry(channelId: string, itemId: string): Promise<QueueResult<QueueItem>> {
    return this.updateItem(channelId, itemId, (item) => retryItem(item, this.stamp()));
  }

  /** The user looked at the finished film's ⚠ report. */
  markReviewed(channelId: string, itemId: string): Promise<QueueResult<QueueItem>> {
    return this.updateItem(channelId, itemId, (item) => ({ ...item, reviewedAt: this.stamp() }));
  }

  setOptions(channelId: string, patch: QueueOptionsPatch): Promise<QueueResult<ProductionQueue>> {
    return this.update(channelId, (queue) => ({ ...queue, ...patch }));
  }

  /** After a crash: steps left `running` become pending again (no write when there are none). */
  async recover(channelId: string): Promise<QueueResult<ProductionQueue>> {
    const current = await this.read(channelId);
    if (!current.ok) return current;
    const interrupted = current.value.items.some((item) =>
      Object.values(item.stageProgress).some((state) => state.state === 'running'),
    );
    if (!interrupted) return current;
    const at = this.stamp();
    return this.update(
      channelId,
      (queue) => ({ ...queue, items: queue.items.map((item) => recoverItem(item, at)) }),
      'line',
    );
  }

  async readLine(): Promise<QueueResult<LineState>> {
    const read = await this.line.read(path.join(this.queuesDir, LINE_STATE_FILE));
    return read.ok ? ok(read.value) : err(read.error);
  }

  async updateLine(mutate: (state: LineState) => LineState): Promise<QueueResult<LineState>> {
    const written = await this.line.update(path.join(this.queuesDir, LINE_STATE_FILE), mutate);
    return written.ok ? ok(written.value) : err(written.error);
  }

  private queueFile(channelId: string): JsonFileStore<ProductionQueue> {
    let store = this.queues.get(channelId);
    if (store === undefined) {
      store = new JsonFileStore(productionQueueSchema, () => emptyProductionQueue(channelId));
      this.queues.set(channelId, store);
    }
    return store;
  }

  private stamp(): string {
    return this.now().toISOString();
  }
}
