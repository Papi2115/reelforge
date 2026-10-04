/** Bounded closing of render windows with fake windows (no Electron). */
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { closeRenderWindow, type ClosableWindow } from './render-window-close.js';

interface FakeOptions {
  /** close() emits 'closed' (a healthy renderer). */
  readonly closes: boolean;
  /** destroy() emits 'closed' (Electron guarantees it; false = a broken window). */
  readonly destroys?: boolean;
}

class FakeWindow extends EventEmitter implements ClosableWindow {
  readonly calls: string[] = [];
  private destroyed = false;
  readonly webContents = {
    isDestroyed: (): boolean => this.destroyed,
    forcefullyCrashRenderer: (): void => {
      this.calls.push('crash');
    },
  };

  constructor(private readonly options: FakeOptions) {
    super();
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }

  close(): void {
    this.calls.push('close');
    if (this.options.closes) this.finish();
  }

  destroy(): void {
    this.calls.push('destroy');
    if (this.options.destroys ?? true) this.finish();
  }

  private finish(): void {
    setTimeout(() => {
      this.destroyed = true;
      this.emit('closed');
    }, 1);
  }
}

function logger(): { warn(message: string): void; warnings: string[] } {
  const warnings: string[] = [];
  return {
    warnings,
    warn(message) {
      warnings.push(message);
    },
  };
}

describe('closeRenderWindow', () => {
  it('closes a healthy window gracefully, without killing or destroying it', async () => {
    const window = new FakeWindow({ closes: true });
    const log = logger();
    expect(await closeRenderWindow(window, { hung: false, log })).toBe('closed');
    expect(window.calls).toEqual(['close']);
    expect(log.warnings).toEqual([]);
  });

  it('kills a hung renderer before closing', async () => {
    const window = new FakeWindow({ closes: true });
    expect(await closeRenderWindow(window, { hung: true, log: logger() })).toBe('closed');
    expect(window.calls).toEqual(['crash', 'close']);
  });

  it('destroys a window that never reports closed after close() (bounded)', async () => {
    const window = new FakeWindow({ closes: false });
    const log = logger();
    const outcome = await closeRenderWindow(window, { hung: false, log, graceMs: 20 });
    expect(outcome).toBe('destroyed');
    expect(window.calls).toEqual(['close', 'crash', 'destroy']);
    expect(log.warnings[0]).toContain('did not close within 20 ms');
  });

  it('gives up on a window that never reports closed at all', async () => {
    const window = new FakeWindow({ closes: false, destroys: false });
    const log = logger();
    const started = Date.now();
    const outcome = await closeRenderWindow(window, {
      hung: true,
      log,
      graceMs: 20,
      forceMs: 20,
    });
    expect(outcome).toBe('abandoned');
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(window.calls).toEqual(['crash', 'close', 'destroy']);
    expect(log.warnings).toHaveLength(2);
  });

  it('does nothing for a window already destroyed', async () => {
    const window = new FakeWindow({ closes: true });
    window.destroy();
    await new Promise((resolve) => setTimeout(resolve, 5));
    window.calls.length = 0;
    expect(await closeRenderWindow(window, { hung: false, log: logger() })).toBe('closed');
    expect(window.calls).toEqual([]);
  });

  it('logs and goes on when killing the renderer throws', async () => {
    const window = new FakeWindow({ closes: true });
    window.webContents.forcefullyCrashRenderer = () => {
      throw new Error('no process');
    };
    const log = logger();
    expect(await closeRenderWindow(window, { hung: true, log })).toBe('closed');
    expect(log.warnings[0]).toContain('cannot kill the renderer');
  });
});
