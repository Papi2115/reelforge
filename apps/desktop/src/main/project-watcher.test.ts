import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectChangedEvent } from '../shared/snapshot-contract.js';
import { createLogger } from './logger.js';
import {
  isIgnoredChange,
  normalizeChangedPath,
  ProjectWatchFollower,
  watchProject,
  type Timers,
  type WatchFunction,
} from './project-watcher.js';

class FakeTimers implements Timers {
  private next = 1;
  readonly pending = new Map<number, () => void>();
  set(callback: () => void): unknown {
    const id = this.next;
    this.next += 1;
    this.pending.set(id, callback);
    return id;
  }
  clear(handle: unknown): void {
    if (typeof handle === 'number') this.pending.delete(handle);
  }
  fire(): void {
    const callbacks = [...this.pending.values()];
    this.pending.clear();
    for (const callback of callbacks) callback();
  }
}

interface FakeWatch {
  readonly watchFunction: WatchFunction;
  emit(relative: string | null): void;
  fail(error: unknown): void;
  readonly closed: () => boolean;
}

function fakeWatch(): FakeWatch {
  let change: (relative: string | null) => void = () => undefined;
  let failure: (error: unknown) => void = () => undefined;
  let closed = false;
  return {
    watchFunction: (_dir, onChange, onError) => {
      change = onChange;
      failure = onError;
      return {
        close: () => {
          closed = true;
        },
      };
    },
    emit: (relative) => {
      change(relative);
    },
    fail: (error) => {
      failure(error);
    },
    closed: () => closed,
  };
}

function setup(): {
  watch: FakeWatch;
  timers: FakeTimers;
  events: ProjectChangedEvent[];
  lines: string[];
  handle: { close(): void };
} {
  const watch = fakeWatch();
  const timers = new FakeTimers();
  const events: ProjectChangedEvent[] = [];
  const lines: string[] = [];
  const handle = watchProject({
    dir: 'C:\\Filmy\\Mój film',
    onChange: (event) => events.push(event),
    log: createLogger((line) => lines.push(line)),
    watchFunction: watch.watchFunction,
    timers,
  });
  return { watch, timers, events, lines, handle };
}

describe('watchProject', () => {
  it('batches changes into one event with normalized, de-duplicated paths', () => {
    const { watch, timers, events } = setup();
    watch.emit('scenes\\s01_title.js');
    watch.emit('storyboard.json');
    watch.emit('scenes\\s01_title.js');
    watch.emit('.git\\index');
    watch.emit('storyboard.json.1a2b.tmp');
    expect(events).toEqual([]);
    expect(timers.pending.size).toBe(1);
    timers.fire();
    expect(events).toEqual([
      {
        dir: 'C:\\Filmy\\Mój film',
        paths: ['scenes/s01_title.js', 'storyboard.json'],
        truncated: false,
      },
    ]);
    watch.emit(null);
    timers.fire();
    expect(events[1]).toEqual({ dir: 'C:\\Filmy\\Mój film', paths: [], truncated: true });
  });

  it('ignores git-only batches and caps the path list', () => {
    const { watch, timers, events } = setup();
    watch.emit('.git/objects/ab/cdef');
    expect(timers.pending.size).toBe(0);
    for (let index = 0; index < 60; index += 1) watch.emit(`out/frame${String(index)}.png`);
    timers.fire();
    expect(events[0]?.paths).toHaveLength(50);
    expect(events[0]?.truncated).toBe(true);
  });

  it('stops on close and on watcher errors', () => {
    const closing = setup();
    closing.watch.emit('script.txt');
    closing.handle.close();
    expect(closing.timers.pending.size).toBe(0);
    expect(closing.watch.closed()).toBe(true);
    closing.watch.emit('script.txt');
    expect(closing.events).toEqual([]);

    const failing = setup();
    failing.watch.fail(new Error('EPERM: operation not permitted, watch'));
    expect(failing.watch.closed()).toBe(true);
    expect(failing.lines.join('')).toContain('watching C:\\Filmy\\Mój film stopped');
  });

  it('logs instead of throwing when the folder cannot be watched', () => {
    const lines: string[] = [];
    const handle = watchProject({
      dir: 'missing',
      onChange: () => undefined,
      log: createLogger((line) => lines.push(line)),
      watchFunction: () => {
        throw new Error('ENOENT');
      },
    });
    handle.close();
    expect(lines.join('')).toContain('cannot watch missing');
  });
});

describe('path helpers', () => {
  it('normalizes separators and ignores git, frames and temp files', () => {
    expect(normalizeChangedPath('.\\timing\\words.json')).toBe('timing/words.json');
    expect(isIgnoredChange('.git')).toBe(true);
    expect(isIgnoredChange('.GIT/index')).toBe(true);
    expect(isIgnoredChange('.reelforge/frames/s01/0001.png')).toBe(true);
    expect(isIgnoredChange('cues.json.123.tmp')).toBe(true);
    expect(isIgnoredChange('.gitignore')).toBe(false);
    expect(isIgnoredChange('.reelforge/pipeline.json')).toBe(false);
  });
});

describe('ProjectWatchFollower', () => {
  it('keeps one watcher on the current folder', () => {
    const started: string[] = [];
    const closed: string[] = [];
    const follower = new ProjectWatchFollower((dir) => {
      started.push(dir);
      return { close: () => closed.push(dir) };
    });
    follower.follow('a');
    follower.follow('a');
    follower.follow('b');
    follower.follow(undefined);
    follower.close();
    expect(started).toEqual(['a', 'b']);
    expect(closed).toEqual(['a', 'b']);
  });
});

describe('watchProject on the real file system', () => {
  let root: string | undefined;
  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true, maxRetries: 5 });
    root = undefined;
  });

  it('reports a file written in a subfolder', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'reelforge watch ż-'));
    await mkdir(path.join(root, 'scenes'));
    const events: ProjectChangedEvent[] = [];
    const handle = watchProject({
      dir: root,
      batchMs: 50,
      onChange: (event) => events.push(event),
      log: createLogger(() => undefined),
    });
    try {
      await writeFile(path.join(root, 'scenes', 's01_intro.js'), '// scene\n');
      await vi.waitFor(
        () => {
          expect(events.flatMap((event) => event.paths)).toContain('scenes/s01_intro.js');
        },
        { timeout: 5_000, interval: 50 },
      );
    } finally {
      handle.close();
    }
  });
});
