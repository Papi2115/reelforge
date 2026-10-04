import { describe, expect, it } from 'vitest';
import type { RenderManifest } from '@reelforge/shared';
import type { HarnessPage } from './harness-session.js';
import {
  closeWithin,
  DEFAULT_COLD_REQUEST_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  guardHarnessPage,
  HarnessTimeoutError,
  isHarnessTimeout,
  resolveHarnessTimeouts,
  retryOnHarnessTimeout,
  withTimeout,
} from './harness-timeouts.js';

const never = <T>(): Promise<T> =>
  new Promise<T>(() => {
    // never settles: a renderer that does not answer
  });

const LOAD_INFO = {
  duration: 1,
  style: 'test',
  width: 4,
  height: 4,
  fps: 30,
  cues: [],
  anchors: [],
  gpu: { vendor: 'fake', renderer: 'fake' },
};

/** A fake page: `hang` makes every request never answer; `fail` makes requests reject. */
function fakePage(behaviour: { hang?: boolean; fail?: Error }): HarnessPage & { closed: number } {
  const answer = <T>(value: T): Promise<T> => {
    if (behaviour.hang === true) return never<T>();
    if (behaviour.fail !== undefined) return Promise.reject(behaviour.fail);
    return Promise.resolve(value);
  };
  const page = {
    closed: 0,
    load: () => answer(LOAD_INFO as unknown as Awaited<ReturnType<HarnessPage['load']>>),
    frameAt: () => answer(Buffer.alloc(64)),
    hashAt: () => answer('hash'),
    checkCards: () => answer([]),
    reloadShot: () => answer(LOAD_INFO as unknown as Awaited<ReturnType<HarnessPage['load']>>),
    pick: () => answer(null),
    setShotDirection: () => answer(undefined),
    errors: ['console error'],
    close: () => {
      page.closed += 1;
      return Promise.resolve();
    },
  };
  return page;
}

const MANIFEST = {} as RenderManifest;
const FAST = { requestTimeoutMs: 20, coldRequestTimeoutMs: 40 };

describe('withTimeout / closeWithin', () => {
  it('passes values and errors through when the work answers in time', async () => {
    await expect(withTimeout(Promise.resolve(3), 50, 'x', () => undefined)).resolves.toBe(3);
    await expect(
      withTimeout(Promise.reject(new Error('boom')), 50, 'x', () => undefined),
    ).rejects.toThrow('boom');
  });

  it('rejects with a typed timeout error and calls onTimeout when the work never answers', async () => {
    let timedOut: HarnessTimeoutError | undefined;
    const result = withTimeout(never<number>(), 20, 'frame t=1.000', (error) => {
      timedOut = error;
    });
    await expect(result).rejects.toBeInstanceOf(HarnessTimeoutError);
    await expect(result).rejects.toThrow(
      'the frame renderer did not answer (frame t=1.000) within 20 ms',
    );
    expect(timedOut?.reason).toBe('timeout');
  });

  it('bounds a close that never finishes', async () => {
    await expect(closeWithin(() => never<undefined>(), 20)).resolves.toBe(false);
    await expect(closeWithin(() => Promise.resolve(), 20)).resolves.toBe(true);
    await expect(closeWithin(() => Promise.reject(new Error('gone')), 20)).resolves.toBe(false);
  });

  it('defaults to 60 s warm and 180 s cold requests', () => {
    expect(resolveHarnessTimeouts()).toEqual({
      requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
      coldRequestTimeoutMs: DEFAULT_COLD_REQUEST_TIMEOUT_MS,
    });
    expect(DEFAULT_REQUEST_TIMEOUT_MS).toBe(60_000);
    expect(resolveHarnessTimeouts({ requestTimeoutMs: 5 }).requestTimeoutMs).toBe(5);
  });
});

describe('guardHarnessPage', () => {
  it('times out a page that never answers, recycles the browser once and stays dead', async () => {
    let recycled = 0;
    const raw = fakePage({ hang: true });
    const page = guardHarnessPage(raw, {
      timeouts: FAST,
      onTimeout: () => {
        recycled += 1;
      },
      isStale: () => recycled > 0,
    });
    const started = Date.now();
    await expect(page.load(MANIFEST)).rejects.toSatisfy(isHarnessTimeout);
    expect(Date.now() - started).toBeGreaterThanOrEqual(35); // cold timeout for load
    await expect(page.frameAt(1)).rejects.toThrow(/did not answer \(load\)/);
    expect(recycled).toBe(1);
    expect(page.errors).toEqual(['console error']);
    await page.close();
    expect(raw.closed).toBe(1);
  });

  it('turns failures of a page whose browser was killed into browser-restarted timeouts', async () => {
    const page = guardHarnessPage(fakePage({ fail: new Error('Target page has been closed') }), {
      timeouts: FAST,
      onTimeout: () => undefined,
      isStale: () => true,
    });
    const error: unknown = await page.frameAt(0).catch((caught: unknown) => caught);
    expect(isHarnessTimeout(error) && error.reason).toBe('browser-restarted');
  });

  it('keeps engine errors of a live page as they are', async () => {
    const page = guardHarnessPage(fakePage({ fail: new Error('[shot s01] scene threw') }), {
      timeouts: FAST,
      onTimeout: () => undefined,
      isStale: () => false,
    });
    await expect(page.load(MANIFEST)).rejects.toThrow('[shot s01] scene threw');
  });

  it('answers normally within the timeouts', async () => {
    const page = guardHarnessPage(fakePage({}), {
      timeouts: FAST,
      onTimeout: () => undefined,
      isStale: () => false,
    });
    await expect(page.load(MANIFEST)).resolves.toMatchObject({ duration: 1 });
    await expect(page.frameAt(0)).resolves.toHaveLength(64);
    await expect(page.hashAt(0)).resolves.toBe('hash');
  });
});

describe('retryOnHarnessTimeout', () => {
  it('retries once after a timeout', async () => {
    let calls = 0;
    const result = await retryOnHarnessTimeout(() => {
      calls += 1;
      return calls === 1
        ? Promise.reject(new HarnessTimeoutError('load', 10))
        : Promise.resolve('frame');
    });
    expect(result).toEqual({ ok: true, value: 'frame' });
    expect(calls).toBe(2);
  });

  it('gives up after the second timeout with the typed error', async () => {
    let calls = 0;
    const result = await retryOnHarnessTimeout(() => {
      calls += 1;
      return Promise.reject(new HarnessTimeoutError('load', 10));
    });
    expect(calls).toBe(2);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.operation).toBe('load');
  });

  it('does not retry other errors', async () => {
    let calls = 0;
    await expect(
      retryOnHarnessTimeout(() => {
        calls += 1;
        return Promise.reject(new Error('scene broke'));
      }),
    ).rejects.toThrow('scene broke');
    expect(calls).toBe(1);
  });
});
