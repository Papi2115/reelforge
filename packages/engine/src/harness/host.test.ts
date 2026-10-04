/**
 * Host side of the engine sandbox with a fake DOM: bounded calls (a lost reply rejects with
 * HarnessTimeoutError and does not block later calls) and restart() (a fresh frame, calls in
 * flight rejected). No timeouts = wait for every reply, as before.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSandboxedHarness, HarnessTimeoutError } from './host.js';
import { RPC_CHANNEL } from './protocol.js';

interface FakeFrame {
  readonly contentWindow: { postMessage(message: unknown): void };
  readonly sent: { id: number; method: string }[];
  removed: boolean;
  src: string;
  setAttribute(): void;
  readonly style: { cssText: string };
  remove(): void;
}

let frames: FakeFrame[];
let listener: ((event: { source: unknown; data: unknown }) => void) | undefined;

function fakeFrame(): FakeFrame {
  const sent: { id: number; method: string }[] = [];
  const frame: FakeFrame = {
    sent,
    removed: false,
    src: '',
    style: { cssText: '' },
    setAttribute: () => undefined,
    remove: () => {
      frame.removed = true;
    },
    contentWindow: {
      postMessage: (message) => {
        sent.push(message as { id: number; method: string });
      },
    },
  };
  return frame;
}

function post(frame: FakeFrame, data: unknown): void {
  listener?.({ source: frame.contentWindow, data });
}

const ready = (frame: FakeFrame): void => {
  post(frame, { channel: RPC_CHANNEL, type: 'ready' });
};

function seekReply(id: number): unknown {
  return {
    channel: RPC_CHANNEL,
    id,
    ok: true,
    method: 'seek',
    result: { frame: new ArrayBuffer(4) },
  };
}

/** Lets the harness's awaits run (ready, then the post). */
const flush = async (): Promise<void> => {
  for (let step = 0; step < 5; step += 1) await Promise.resolve();
};

beforeEach(() => {
  frames = [];
  listener = undefined;
  vi.stubGlobal('document', {
    createElement: () => {
      const frame = fakeFrame();
      frames.push(frame);
      return frame;
    },
  });
  vi.stubGlobal('window', {
    addEventListener: (_type: string, handler: typeof listener) => {
      listener = handler;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const container = (): HTMLElement => ({ appendChild: () => undefined }) as unknown as HTMLElement;

describe('createSandboxedHarness', () => {
  it('waits for every reply without timeouts', async () => {
    const harness = createSandboxedHarness({
      frameUrl: 'engine-frame.html',
      container: container(),
    });
    const frame = frames[0];
    if (frame === undefined) throw new Error('no frame');
    ready(frame);
    const seek = harness.seek(1);
    await flush();
    expect(frame.sent.map((message) => message.method)).toEqual(['seek']);
    post(frame, seekReply(frame.sent[0]?.id ?? 0));
    await seek;
    expect(harness.frame()).toHaveLength(4);
  });

  it('rejects a call the frame does not answer in time; later calls still work', async () => {
    vi.useFakeTimers();
    const harness = createSandboxedHarness({
      frameUrl: 'engine-frame.html',
      container: container(),
      timeouts: { loadMs: 1000, callMs: 50 },
    });
    const frame = frames[0];
    if (frame === undefined) throw new Error('no frame');
    ready(frame);
    const lost = harness.seek(1);
    const caught = lost.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(60);
    const error = await caught;
    expect(error).toBeInstanceOf(HarnessTimeoutError);
    expect((error as HarnessTimeoutError).message).toContain('seek() within 50 ms');
    // The late reply is dropped; the next call gets its own reply.
    post(frame, seekReply(frame.sent[0]?.id ?? 0));
    const next = harness.seek(2);
    await flush();
    post(frame, seekReply(frame.sent[1]?.id ?? 0));
    await expect(next).resolves.toBeUndefined();
  });

  it('bounds the wait for a frame that never becomes ready', async () => {
    vi.useFakeTimers();
    const harness = createSandboxedHarness({
      frameUrl: 'engine-frame.html',
      container: container(),
      timeouts: { loadMs: 100, callMs: 50 },
    });
    const pick = harness.pick(0.5, 0.5, 1).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(60);
    expect(await pick).toBeInstanceOf(HarnessTimeoutError);
  });

  it('restart() replaces the frame and rejects the calls in flight', async () => {
    const harness = createSandboxedHarness({
      frameUrl: 'engine-frame.html',
      container: container(),
    });
    const first = frames[0];
    if (first === undefined) throw new Error('no frame');
    ready(first);
    const stuck = harness.seek(1).catch((error: unknown) => error);
    await flush();
    harness.restart();
    expect(String(await stuck)).toContain('restarted');
    expect(first.removed).toBe(true);
    const second = frames[1];
    if (second === undefined) throw new Error('no new frame');
    expect(second.src).toBe('engine-frame.html');
    const seek = harness.seek(3);
    await flush();
    // Nothing is sent before the new frame is ready.
    expect(second.sent).toEqual([]);
    ready(second);
    await flush();
    expect(second.sent.map((message) => message.method)).toEqual(['seek']);
    post(second, seekReply(second.sent[0]?.id ?? 0));
    await expect(seek).resolves.toBeUndefined();
    // Replies from the old frame are ignored.
    post(first, seekReply(1));
  });
});
