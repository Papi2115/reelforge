/**
 * Test support (not used by the app): a RenderTarget without Electron. Frames encode the time
 * (pixel 0 = round(t * 30)), scene sources steer failures: `FAIL_LOAD` -> engine error with a
 * console error, `CRASH` -> the renderer dies, `OVERLAP` -> one card diagnostic.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import type { CardDiagnostic, LoadInfo } from '@reelforge/engine';
import type { RenderManifest } from '@reelforge/shared';
import type { OpenRenderTarget, RenderError, RenderTarget } from '../render-target.js';

export const FAKE_GPU = 'ANGLE (Fake GPU Direct3D11)';

export function fakeFrame(t: number, width = 640, height = 360): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data.set([(offset / 4) % 251, (offset / 8) % 241, 90, 255], offset);
  }
  data[0] = Math.round(t * 30) % 256;
  return data;
}

export class FakeRenderTarget implements RenderTarget {
  readonly loads: RenderManifest[] = [];
  readonly frames: number[] = [];
  private consoleErrors: string[] = [];
  private loaded: RenderManifest | null = null;
  private dead = false;
  closed = 0;

  get alive(): boolean {
    return !this.dead;
  }

  load(manifest: RenderManifest): Promise<Result<LoadInfo, RenderError>> {
    if (this.dead) return Promise.resolve(err({ kind: 'closed', message: 'closed' }));
    this.loads.push(manifest);
    const sources = manifest.shots.map((shot) => shot.scene.source).join('\n');
    if (sources.includes('CRASH')) {
      this.dead = true;
      return Promise.resolve(err({ kind: 'crashed', message: 'renderer process gone: crashed' }));
    }
    if (sources.includes('FAIL_LOAD')) {
      this.consoleErrors.push('Uncaught TypeError: boom');
      return Promise.resolve(
        err({ kind: 'engine', code: 'scene-build', message: '[shot s02] build() threw: boom' }),
      );
    }
    this.loaded = manifest;
    const last = manifest.shots.at(-1);
    return Promise.resolve(
      ok({
        duration: last?.t1 ?? 0,
        style: manifest.style ?? 'voxel-pixel-crisp640',
        width: 640,
        height: 360,
        fps: manifest.fps,
        cues: manifest.shots.map((shot) => ({ t: shot.t0 + 0.5, name: 'hit', shotId: shot.id })),
        anchors: manifest.shots.map((shot) => ({
          shotId: shot.id,
          phrase: `phrase of ${shot.id}`,
          nth: 1,
          t: shot.t0 + 0.4,
          tEnd: shot.t0 + 0.6,
        })),
        gpu: { vendor: 'Fake', renderer: FAKE_GPU, version: 'WebGL 2.0' },
      }),
    );
  }

  frame(t: number): Promise<Result<Uint8Array, RenderError>> {
    if (this.dead) return Promise.resolve(err({ kind: 'closed', message: 'closed' }));
    if (this.loaded === null) {
      return Promise.resolve(err({ kind: 'engine', message: 'seek() before load()' }));
    }
    this.frames.push(t);
    return Promise.resolve(ok(fakeFrame(t)));
  }

  cards(shotId: string): Promise<Result<readonly CardDiagnostic[], RenderError>> {
    const shot = this.loaded?.shots.find((candidate) => candidate.id === shotId);
    if (!shot?.scene.source.includes('OVERLAP')) return Promise.resolve(ok([]));
    return Promise.resolve(
      ok([
        {
          rule: 'card-overlap',
          severity: 'error',
          shotId,
          cards: ['a', 'b'],
          t0: 0,
          t1: 1,
          message: 'cards "a" and "b" overlap',
          fix: 'move one',
        },
      ]),
    );
  }

  takeConsoleErrors(): string[] {
    return this.consoleErrors.splice(0);
  }

  kill(): void {
    this.dead = true;
  }

  close(): Promise<void> {
    this.dead = true;
    this.closed += 1;
    return Promise.resolve();
  }
}

/** An OpenRenderTarget that records every target it opened. */
export function fakeTargets(): { open: OpenRenderTarget; opened: FakeRenderTarget[] } {
  const opened: FakeRenderTarget[] = [];
  return {
    opened,
    open: () => {
      const target = new FakeRenderTarget();
      opened.push(target);
      return Promise.resolve(ok(target));
    },
  };
}
