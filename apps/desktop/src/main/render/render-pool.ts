/**
 * Reuses render windows: an export's N workers and its thumbnail, or the render service's
 * successive requests, take a window from the idle list instead of opening a new one (~0.4 s and
 * a fresh WebGL context each). A window remembers the manifest it holds, so a source that opens
 * the same manifest again skips the load. Dead windows are dropped, never reused.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import type { LoadInfo } from '@reelforge/engine';
import type { RenderManifest } from '@reelforge/shared';
import type { OpenRenderTarget, RenderError, RenderTarget } from './render-target.js';

export interface PooledTarget {
  readonly target: RenderTarget;
  /** The manifest object this window has loaded (identity), with its load info. */
  loaded: { readonly manifest: RenderManifest; readonly info: LoadInfo } | null;
}

export class RenderPool {
  private readonly idle: PooledTarget[] = [];
  private readonly busy = new Set<PooledTarget>();
  private closed = false;

  constructor(private readonly open: OpenRenderTarget) {}

  /** Windows currently open (idle + in use). */
  get size(): number {
    return this.idle.length + this.busy.size;
  }

  async acquire(): Promise<Result<PooledTarget, RenderError>> {
    if (this.closed) return err({ kind: 'closed', message: 'the render pool is closed' });
    for (let entry = this.idle.pop(); entry !== undefined; entry = this.idle.pop()) {
      if (entry.target.alive) {
        this.busy.add(entry);
        return ok(entry);
      }
      await entry.target.close();
    }
    const opened = await this.open();
    if (!opened.ok) return opened;
    const entry: PooledTarget = { target: opened.value, loaded: null };
    // close() may have run while the window was opening.
    if (this.isClosed()) {
      await entry.target.close();
      return err({ kind: 'closed', message: 'the render pool is closed' });
    }
    this.busy.add(entry);
    return ok(entry);
  }

  private isClosed(): boolean {
    return this.closed;
  }

  /** Returns a window; dead windows and windows released after close() are closed. */
  async release(entry: PooledTarget): Promise<void> {
    if (!this.busy.delete(entry)) return;
    if (this.closed || !entry.target.alive) {
      await entry.target.close();
      return;
    }
    entry.target.takeConsoleErrors();
    this.idle.push(entry);
  }

  /** Closes idle windows; windows in use close when released. */
  async close(): Promise<void> {
    this.closed = true;
    const idle = this.idle.splice(0);
    await Promise.all(idle.map((entry) => entry.target.close()));
  }

  /** Closes idle windows but keeps the pool usable (frees GPU memory when nothing renders). */
  async trim(): Promise<void> {
    const idle = this.idle.splice(0);
    await Promise.all(idle.map((entry) => entry.target.close()));
  }

  /** Loads `manifest` unless the window already holds this exact manifest object. */
  static async ensureLoaded(
    entry: PooledTarget,
    manifest: RenderManifest,
  ): Promise<Result<LoadInfo, RenderError>> {
    if (entry.loaded?.manifest === manifest) return ok(entry.loaded.info);
    entry.loaded = null;
    const loaded = await entry.target.load(manifest);
    if (loaded.ok) entry.loaded = { manifest, info: loaded.value };
    return loaded;
  }
}
