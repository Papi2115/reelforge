import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RenderLoadGate, startCallDeadline } from './render-load-gate.js';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('RenderLoadGate', () => {
  it('runs loads one at a time, in order, also after a failed load', async () => {
    const gate = new RenderLoadGate(() => 0);
    const order: string[] = [];
    const first = deferred();
    const a = gate.run(async () => {
      order.push('a start');
      await first.promise;
      order.push('a end');
      throw new Error('load failed');
    });
    const b = gate.run(() => {
      order.push('b');
      return Promise.resolve('b done');
    });
    await Promise.resolve();
    expect(order).toEqual(['a start']);
    first.resolve();
    await expect(a).rejects.toThrow('load failed');
    await expect(b).resolves.toBe('b done');
    expect(order).toEqual(['a start', 'a end', 'b']);
  });

  it('tells whether a load ran since a moment', async () => {
    let now = 0;
    const gate = new RenderLoadGate(() => now);
    expect(gate.loadedSince(0)).toBe(false);
    const load = deferred();
    const running = gate.run(() => load.promise);
    await Promise.resolve();
    expect(gate.loadedSince(100)).toBe(true);
    now = 50;
    load.resolve();
    await running;
    expect(gate.loadedSince(10)).toBe(true);
    expect(gate.loadedSince(60)).toBe(false);
  });
});

describe('startCallDeadline', () => {
  let now = 0;
  beforeEach(() => {
    vi.useFakeTimers();
    now = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function advance(ms: number): void {
    now += ms;
    vi.advanceTimersByTime(ms);
  }

  it('expires after the timeout without a gate', () => {
    const onExpire = vi.fn();
    startCallDeadline({ timeoutMs: 30_000, maxWaitMs: 300_000, onExpire });
    advance(29_999);
    expect(onExpire).not.toHaveBeenCalled();
    advance(1);
    expect(onExpire).toHaveBeenCalledOnce();
  });

  it('waits out loads of other windows, then expires after a quiet timeout', async () => {
    const gate = new RenderLoadGate(() => now);
    const onExpire = vi.fn();
    startCallDeadline({ timeoutMs: 30_000, gate, maxWaitMs: 300_000, onExpire });
    // Five windows load 10 s each, one after another (the 2026-10-08 export).
    for (let window = 0; window < 5; window += 1) {
      const load = deferred();
      const running = gate.run(() => load.promise);
      await Promise.resolve();
      advance(10_000);
      load.resolve();
      await running;
    }
    expect(onExpire).not.toHaveBeenCalled();
    advance(60_000);
    expect(onExpire).toHaveBeenCalledOnce();
  });

  it('gives up after the maximum wait even while loads keep running', async () => {
    const gate = new RenderLoadGate(() => now);
    const onExpire = vi.fn();
    const load = deferred();
    void gate.run(() => load.promise);
    await Promise.resolve();
    startCallDeadline({ timeoutMs: 30_000, gate, maxWaitMs: 100_000, onExpire });
    advance(99_999);
    expect(onExpire).not.toHaveBeenCalled();
    advance(1);
    expect(onExpire).toHaveBeenCalledOnce();
    load.resolve();
  });

  it('cancelling stops the deadline', () => {
    const onExpire = vi.fn();
    const cancel = startCallDeadline({ timeoutMs: 1_000, maxWaitMs: 10_000, onExpire });
    cancel();
    advance(5_000);
    expect(onExpire).not.toHaveBeenCalled();
  });
});
