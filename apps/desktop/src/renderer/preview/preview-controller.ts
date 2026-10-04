/**
 * Drives the sandboxed engine for the preview: loads a manifest and renders requested times.
 * Seeks are "latest wins": while one frame renders, newer requests replace older pending ones,
 * so neither scrubbing nor playback ever queues up stale frames (late frames are dropped).
 * Loads and hot reloads (PLAN.md#6.4) run one at a time; a hot reload rebuilds only the shots
 * whose scene source changed and keeps the video playing, a failed one keeps the previous shot.
 */
import type { LoadInfo, PickInfo, ReelforgeHarness } from '@reelforge/engine';
import type { RenderManifest, SceneSource, ShotDirection } from '@reelforge/shared';
import { planReload } from './reload-plan.js';

export interface FrameSink {
  /** `renderMs`: engine round trip of this frame (seek request -> pixels back). */
  draw(
    frame: Uint8Array<ArrayBuffer>,
    width: number,
    height: number,
    t: number,
    renderMs: number,
  ): void;
}

export type ApplyResult =
  | { readonly kind: 'unchanged'; readonly info: LoadInfo }
  | { readonly kind: 'loaded'; readonly info: LoadInfo }
  | { readonly kind: 'reloaded'; readonly info: LoadInfo; readonly shotIds: readonly string[] }
  /** Only live directions changed (PLAN.md#12.14): applied without rebuilding a shot. */
  | { readonly kind: 'directed'; readonly info: LoadInfo; readonly shotIds: readonly string[] };

/**
 * Whether the player has to take the duration and frame rate of an applied manifest: after every
 * full load, and whenever they differ from the player's. The second case matters when a newer file
 * change superseded the caller that made the full load (its result was dropped as stale): the next
 * apply of the same manifest is 'unchanged', and the player would keep the old duration forever.
 */
export function playerNeedsVideo(
  result: ApplyResult,
  player: { readonly duration: number; readonly fps: number },
): boolean {
  return (
    result.kind === 'loaded' ||
    player.duration !== result.info.duration ||
    player.fps !== result.info.fps
  );
}

interface FrameWaiter {
  /** Resolve on the first frame whose seek was issued after this serial. */
  readonly afterSerial: number;
  readonly resolve: () => void;
}

/** Resolves when `promise` settles; its own caller handles a rejection. */
function settled(promise: Promise<unknown>): Promise<void> {
  return promise.then(
    () => undefined,
    () => undefined,
  );
}

function withScene(manifest: RenderManifest, shotId: string, scene: SceneSource): RenderManifest {
  return {
    ...manifest,
    shots: manifest.shots.map((shot) => (shot.id === shotId ? { ...shot, scene } : shot)),
  };
}

function withDirection(
  manifest: RenderManifest,
  shotId: string,
  direction: ShotDirection | undefined,
): RenderManifest {
  return {
    ...manifest,
    shots: manifest.shots.map((shot) => {
      if (shot.id !== shotId) return shot;
      const next = { ...shot };
      delete next.direction;
      return direction === undefined ? next : { ...next, direction };
    }),
  };
}

export class PreviewController {
  private info: LoadInfo | undefined;
  /** What the engine currently runs (scene sources included), after a successful load. */
  private manifest: RenderManifest | undefined;
  private pending: number | undefined;
  private running = false;
  private draining: Promise<void> = Promise.resolve();
  private exclusive: Promise<unknown> = Promise.resolve();
  private seekSerial = 0;
  /** Advances with every full load: frames in flight across a load are stale. */
  private generation = 0;
  private waiters: FrameWaiter[] = [];

  constructor(
    private readonly harness: ReelforgeHarness,
    private readonly sink: FrameSink,
    private readonly onError: (error: unknown) => void,
    private readonly now: () => number = () => performance.now(),
  ) {}

  /** Loads a video from scratch. */
  load(manifest: RenderManifest): Promise<LoadInfo> {
    return this.runExclusive(() => this.loadNow(manifest));
  }

  /**
   * Shows `manifest`, doing as little as possible: nothing when the engine already runs it, a
   * per-shot rebuild when only scene sources changed, else a full load. Rejects with the engine
   * error (lint, import, build); after a failed shot rebuild the previous shot keeps rendering.
   */
  apply(manifest: RenderManifest): Promise<ApplyResult> {
    return this.runExclusive(async () => {
      const plan = planReload(this.manifest, manifest);
      if (plan.kind === 'full') return { kind: 'loaded', info: await this.loadNow(manifest) };
      const loaded = this.manifest;
      let info = this.info;
      if (!loaded || !info) return { kind: 'loaded', info: await this.loadNow(manifest) };
      if (plan.kind === 'unchanged') return { kind: 'unchanged', info };
      for (const shotId of plan.shotIds) {
        const scene = manifest.shots.find((shot) => shot.id === shotId)?.scene;
        if (!scene) continue;
        info = await this.harness.reloadShot(shotId, scene);
        this.manifest = withScene(this.manifest ?? loaded, shotId, scene);
        this.info = info;
      }
      for (const shotId of plan.directionShotIds) {
        const direction = manifest.shots.find((shot) => shot.id === shotId)?.direction;
        await this.harness.setShotDirection(shotId, direction ?? null);
        this.manifest = withDirection(this.manifest ?? loaded, shotId, direction);
      }
      if (plan.shotIds.length === 0) {
        return { kind: 'directed', info, shotIds: plan.directionShotIds };
      }
      return { kind: 'reloaded', info, shotIds: plan.shotIds };
    });
  }

  /** Renders global time `t` (clamped to the video) as soon as the engine is free. */
  requestSeek(t: number): void {
    if (!this.info) return;
    this.pending = Math.min(Math.max(t, 0), this.info.duration);
    if (!this.running) this.draining = this.drain();
  }

  /** Renders `t` again and resolves once a frame requested from now on is drawn. */
  refresh(t: number): Promise<void> {
    if (!this.info) return Promise.resolve();
    const drawn = new Promise<void>((resolve) => {
      this.waiters.push({ afterSerial: this.seekSerial, resolve });
    });
    this.requestSeek(t);
    return drawn;
  }

  /**
   * Object under normalized frame point (x, y) at global time t (PLAN.md#6.6); null when no video
   * is loaded or nothing is there. Waits for a running load / hot reload.
   */
  pick(x: number, y: number, t: number): Promise<PickInfo | null> {
    return this.runExclusive(async () => {
      const info = this.info;
      if (!info) return null;
      return this.harness.pick(x, y, Math.min(Math.max(t, 0), info.duration));
    });
  }

  /** Id of the shot shown at global time t, if a video is loaded. */
  shotAt(t: number): string | undefined {
    const shots = this.manifest?.shots ?? [];
    return shots.findLast((shot) => shot.t0 <= t)?.id ?? shots[0]?.id;
  }

  private runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const previous = this.exclusive;
    const next = settled(previous).then(task);
    this.exclusive = next;
    return next;
  }

  private async loadNow(manifest: RenderManifest): Promise<LoadInfo> {
    this.generation += 1;
    this.info = undefined;
    this.manifest = undefined;
    this.pending = undefined;
    await this.draining;
    const info = await this.harness.load(manifest);
    this.info = info;
    this.manifest = manifest;
    return info;
  }

  private async drain(): Promise<void> {
    this.running = true;
    try {
      while (this.pending !== undefined && this.info) {
        const t = this.pending;
        const info = this.info;
        const generation = this.generation;
        this.pending = undefined;
        this.seekSerial += 1;
        const serial = this.seekSerial;
        const started = this.now();
        await this.harness.seek(t);
        // A load started meanwhile: this frame belongs to the previous video.
        if (this.generation !== generation) break;
        this.sink.draw(this.harness.frame(), info.width, info.height, t, this.now() - started);
        this.resolveWaiters(serial);
      }
    } catch (error) {
      this.pending = undefined;
      this.onError(error);
    } finally {
      this.running = false;
      if (this.pending === undefined) this.resolveWaiters(Number.POSITIVE_INFINITY);
    }
  }

  private resolveWaiters(serial: number): void {
    const ready = this.waiters.filter((waiter) => serial > waiter.afterSerial);
    this.waiters = this.waiters.filter((waiter) => serial <= waiter.afterSerial);
    for (const waiter of ready) waiter.resolve();
  }
}
