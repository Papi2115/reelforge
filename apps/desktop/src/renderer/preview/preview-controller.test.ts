import type { LoadInfo, PickInfo, ReelforgeHarness } from '@reelforge/engine';
import type { RenderManifest, SceneSource, ShotDirection } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { playerNeedsVideo, PreviewController } from './preview-controller.js';

const INFO: LoadInfo = {
  duration: 5,
  style: 'voxel-pixel-crisp-640',
  width: 2,
  height: 1,
  fps: 30,
  cues: [],
  anchors: [],
  gpu: { vendor: 'test', renderer: 'test', version: 'test' },
};

const MANIFEST: RenderManifest = {
  version: 1,
  fps: 30,
  seed: 1,
  shots: [{ id: 's00', t0: 0, t1: 5, scene: { file: 'scenes/s00.js', source: 'x' } }],
};

/** Harness whose seeks resolve only when the test releases them. */
class ManualHarness implements ReelforgeHarness {
  readonly seeks: number[] = [];
  /** First shot id of every loaded manifest. */
  readonly loads: string[] = [];
  private release: (() => void)[] = [];
  private last = 0;
  failNext = false;

  get duration(): number {
    return INFO.duration;
  }
  load(manifest: RenderManifest): Promise<LoadInfo> {
    this.loads.push(manifest.shots[0]?.id ?? '');
    return Promise.resolve(INFO);
  }
  seek(t: number): Promise<void> {
    this.seeks.push(t);
    return new Promise((resolve, reject) => {
      this.release.push(() => {
        this.last = t;
        if (this.failNext) reject(new Error('scene threw'));
        else resolve();
      });
    });
  }
  frame(): Uint8Array<ArrayBuffer> {
    return new Uint8Array([this.last, 0, 0, 255, 0, 0, 0, 255]);
  }
  checkCards(): Promise<never[]> {
    return Promise.resolve([]);
  }
  /** `shotId:source` of every reloadShot call. */
  readonly reloads: string[] = [];
  failReload: string | undefined;
  reloadShot(shotId: string, scene: SceneSource): Promise<LoadInfo> {
    this.reloads.push(`${shotId}:${scene.source}`);
    if (this.failReload !== undefined) return Promise.reject(new Error(this.failReload));
    return Promise.resolve(INFO);
  }
  /** `x,y,t` of every pick call. */
  readonly picks: string[] = [];
  pick(x: number, y: number, t: number): Promise<PickInfo | null> {
    this.picks.push(`${String(x)},${String(y)},${String(t)}`);
    return Promise.resolve({
      kind: 'kit',
      shotId: 's00',
      t,
      localTime: t,
      name: 'calculator',
      id: 'props.calculator#0',
      description: 'calculator',
    });
  }
  /** `shotId:json` of every setShotDirection call. */
  readonly directions: string[] = [];
  setShotDirection(shotId: string, direction: ShotDirection | null): Promise<void> {
    this.directions.push(`${shotId}:${JSON.stringify(direction)}`);
    return Promise.resolve();
  }
  async releaseNext(): Promise<void> {
    this.release.shift()?.();
    // Let the controller's await continuation run.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

describe('PreviewController', () => {
  it('picks objects only once a video is loaded, at the clamped time', async () => {
    const harness = new ManualHarness();
    const controller = new PreviewController(harness, { draw: () => undefined }, () => {
      throw new Error('unexpected error');
    });
    expect(await controller.pick(0.5, 0.5, 1)).toBeNull();
    await controller.load(MANIFEST);
    const picked = await controller.pick(0.25, 0.75, 9);
    expect(picked?.name).toBe('calculator');
    expect(harness.picks).toEqual(['0.25,0.75,5']);
  });

  it('ignores seeks before load and clamps to the video', async () => {
    const harness = new ManualHarness();
    const drawn: number[] = [];
    const controller = new PreviewController(
      harness,
      { draw: (_f, _w, _h, t) => drawn.push(t) },
      () => {
        throw new Error('unexpected error');
      },
    );
    controller.requestSeek(1);
    expect(harness.seeks).toEqual([]);
    await controller.load(MANIFEST);
    controller.requestSeek(99);
    await harness.releaseNext();
    expect(drawn).toEqual([5]);
  });

  it('renders only the latest of the seeks requested while a frame is in flight', async () => {
    const harness = new ManualHarness();
    const drawn: number[] = [];
    const controller = new PreviewController(
      harness,
      { draw: (_f, _w, _h, t) => drawn.push(t) },
      () => {
        throw new Error('unexpected error');
      },
    );
    await controller.load(MANIFEST);
    controller.requestSeek(0);
    controller.requestSeek(1);
    controller.requestSeek(2);
    controller.requestSeek(3);
    await harness.releaseNext();
    await harness.releaseNext();
    expect(harness.seeks).toEqual([0, 3]);
    expect(drawn).toEqual([0, 3]);
  });

  it('loads one manifest at a time, after the frame in flight', async () => {
    const harness = new ManualHarness();
    const drawn: number[] = [];
    const controller = new PreviewController(
      harness,
      { draw: (_f, _w, _h, t) => drawn.push(t) },
      () => {
        throw new Error('unexpected error');
      },
    );
    await controller.load(MANIFEST);
    controller.requestSeek(2);
    const second: RenderManifest = {
      ...MANIFEST,
      shots: [{ id: 's01', t0: 0, t1: 5, scene: { file: 'scenes/s01.js', source: 'x' } }],
    };
    const reloads = Promise.all([controller.load(second), controller.load(MANIFEST)]);
    await Promise.resolve();
    expect(harness.loads).toEqual(['s00']);
    await harness.releaseNext();
    await reloads;
    expect(harness.loads).toEqual(['s00', 's01', 's00']);
    // The frame finished after the reload started: not drawn.
    expect(drawn).toEqual([]);
  });

  it('reports engine errors and keeps accepting seeks', async () => {
    const harness = new ManualHarness();
    const errors: unknown[] = [];
    const drawn: number[] = [];
    const controller = new PreviewController(
      harness,
      { draw: (_f, _w, _h, t) => drawn.push(t) },
      (error) => errors.push(error),
    );
    await controller.load(MANIFEST);
    harness.failNext = true;
    controller.requestSeek(1);
    await harness.releaseNext();
    expect(errors).toHaveLength(1);
    harness.failNext = false;
    controller.requestSeek(2);
    await harness.releaseNext();
    expect(drawn).toEqual([2]);
  });

  it('applies only what changed: nothing, single shots, or a full load', async () => {
    const harness = new ManualHarness();
    const controller = new PreviewController(harness, { draw: () => undefined }, () => {
      throw new Error('unexpected error');
    });
    const two: RenderManifest = {
      ...MANIFEST,
      shots: [
        { id: 's01', t0: 0, t1: 2, scene: { file: 'scenes/s01.js', source: 'a' } },
        { id: 's02', t0: 2, t1: 5, scene: { file: 'scenes/s02.js', source: 'b' } },
      ],
    };
    expect(await controller.apply(two)).toMatchObject({ kind: 'loaded' });
    expect(await controller.apply(structuredClone(two))).toMatchObject({ kind: 'unchanged' });
    const edited = structuredClone(two);
    const second = edited.shots[1];
    if (second) second.scene.source = 'b2';
    expect(await controller.apply(edited)).toMatchObject({ kind: 'reloaded', shotIds: ['s02'] });
    expect(harness.reloads).toEqual(['s02:b2']);
    // Now the engine runs the edited scene: applying it again does nothing.
    expect(await controller.apply(edited)).toMatchObject({ kind: 'unchanged' });
    const retimed = structuredClone(edited);
    if (retimed.shots[0]) retimed.shots[0].t1 = 2.5;
    if (retimed.shots[1]) retimed.shots[1].t0 = 2.5;
    expect(await controller.apply(retimed)).toMatchObject({ kind: 'loaded' });
    expect(harness.loads).toEqual(['s01', 's01']);
    expect(controller.shotAt(1)).toBe('s01');
    expect(controller.shotAt(3)).toBe('s02');
  });

  it('hot-applies live directions without rebuilding or reloading (PLAN.md#12.14)', async () => {
    const harness = new ManualHarness();
    const controller = new PreviewController(harness, { draw: () => undefined }, () => {
      throw new Error('unexpected error');
    });
    await controller.apply(MANIFEST);
    const directed = structuredClone(MANIFEST);
    if (directed.shots[0]) directed.shots[0].direction = { zoom: 1.1 };
    expect(await controller.apply(directed)).toMatchObject({ kind: 'directed', shotIds: ['s00'] });
    expect(await controller.apply(structuredClone(directed))).toMatchObject({ kind: 'unchanged' });
    expect(await controller.apply(MANIFEST)).toMatchObject({ kind: 'directed' });
    expect(harness.directions).toEqual(['s00:{"zoom":1.1}', 's00:null']);
    expect(harness.loads).toEqual(['s00']);
    expect(harness.reloads).toEqual([]);
  });

  it('keeps the previous shot (and retries it) when a shot reload fails', async () => {
    const harness = new ManualHarness();
    const controller = new PreviewController(harness, { draw: () => undefined }, () => {
      throw new Error('unexpected error');
    });
    await controller.apply(MANIFEST);
    const broken = structuredClone(MANIFEST);
    if (broken.shots[0]) broken.shots[0].scene.source = 'broken';
    harness.failReload = 'scene lint failed';
    await expect(controller.apply(broken)).rejects.toThrow('scene lint failed');
    // Still ready: seeks render the old shot.
    controller.requestSeek(1);
    expect(harness.seeks).toEqual([1]);
    harness.failReload = undefined;
    expect(await controller.apply(broken)).toMatchObject({ kind: 'reloaded', shotIds: ['s00'] });
    await harness.releaseNext();
  });

  it('refresh() resolves once a frame requested after it is drawn', async () => {
    const harness = new ManualHarness();
    const drawn: { t: number; renderMs: number }[] = [];
    let clock = 0;
    const controller = new PreviewController(
      harness,
      { draw: (_f, _w, _h, t, renderMs) => drawn.push({ t, renderMs }) },
      () => {
        throw new Error('unexpected error');
      },
      () => clock,
    );
    await controller.load(MANIFEST);
    controller.requestSeek(1);
    let refreshed = false;
    const refresh = controller.refresh(1).then(() => {
      refreshed = true;
    });
    clock = 7;
    // The frame in flight was requested before refresh(): not enough.
    await harness.releaseNext();
    expect(refreshed).toBe(false);
    await harness.releaseNext();
    await refresh;
    expect(drawn).toEqual([
      { t: 1, renderMs: 7 },
      { t: 1, renderMs: 0 },
    ]);
  });
});

describe('playerNeedsVideo', () => {
  const reloaded = { kind: 'reloaded', info: INFO, shotIds: ['s00'] } as const;

  it('takes the video after every full load', () => {
    expect(playerNeedsVideo({ kind: 'loaded', info: INFO }, { duration: 5, fps: 30 })).toBe(true);
  });

  it('leaves the player alone when the applied video matches it', () => {
    expect(playerNeedsVideo({ kind: 'unchanged', info: INFO }, { duration: 5, fps: 30 })).toBe(
      false,
    );
    expect(playerNeedsVideo(reloaded, { duration: 5, fps: 30 })).toBe(false);
  });

  it('catches up after a superseded full load (the next apply is unchanged)', async () => {
    const harness = new ManualHarness();
    const controller = new PreviewController(harness, { draw: () => undefined }, () => {
      throw new Error('unexpected error');
    });
    // The caller of this full load was superseded by a newer file change: its result is dropped,
    // so the player still has the duration of the video before.
    await controller.apply(MANIFEST);
    const stalePlayer = { duration: 90, fps: 30 };
    const again = await controller.apply(structuredClone(MANIFEST));
    expect(again.kind).toBe('unchanged');
    expect(playerNeedsVideo(again, stalePlayer)).toBe(true);
    expect(playerNeedsVideo(again, { duration: 5, fps: 24 })).toBe(true);
  });
});
