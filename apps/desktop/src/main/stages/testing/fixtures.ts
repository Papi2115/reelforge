/**
 * Test support of the stage service tests (not used by the app): temp projects (space + Polish
 * letter in the path), fake stage definitions that wait for the test, and polling helpers.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  stageError,
  type StageContext,
  type StageError,
  type StageSummary,
} from '@reelforge/stages';

export const SUMMARY: StageSummary = {
  message: 'fake stage done',
  outputs: [],
  changed: false,
  warnings: [],
  metrics: {},
};

export class TempProjects {
  private readonly dirs: string[] = [];

  /** A project folder with project.json and (unless `brief` is false) a brief. */
  create(files: Readonly<Record<string, string>> = {}, brief = true): string {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'rf stages ż '));
    this.dirs.push(dir);
    const all: Record<string, string> = {
      'project.json': JSON.stringify({
        version: 1,
        title: 'Test',
        language: 'en',
        style: 'voxel-pixel-crisp640',
        fps: 30,
        seed: 1,
      }),
      ...(brief
        ? {
            'brief.json': JSON.stringify({
              version: 1,
              topic: 'Rainbows in a glass',
              language: 'en',
              targetMinutes: 0.5,
            }),
          }
        : {}),
      ...files,
    };
    for (const [relative, content] of Object.entries(all)) {
      const file = path.join(dir, ...relative.split('/'));
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, content, 'utf8');
    }
    return dir;
  }

  dispose(): void {
    for (const dir of this.dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  }
}

/** A promise the test resolves: `release()` lets a fake stage finish. */
export class Gate {
  readonly started: Promise<void>;
  private markStarted: () => void = () => undefined;
  private open: () => void = () => undefined;
  private readonly opened: Promise<void>;

  constructor() {
    this.started = new Promise((resolve) => {
      this.markStarted = resolve;
    });
    this.opened = new Promise((resolve) => {
      this.open = resolve;
    });
  }

  release(): void {
    this.open();
  }

  /** Called by the stage: resolves 'released' or 'aborted'. */
  async wait(signal: AbortSignal): Promise<'released' | 'aborted'> {
    this.markStarted();
    if (signal.aborted) return 'aborted';
    return Promise.race([
      this.opened.then(() => 'released' as const),
      new Promise<'aborted'>((resolve) => {
        signal.addEventListener(
          'abort',
          () => {
            resolve('aborted');
          },
          { once: true },
        );
      }),
    ]);
  }
}

/** A stage body that reports a step, waits for the gate and finishes (or is cancelled). */
export function gatedRun(
  gate: Gate,
  label: string,
): (ctx: StageContext) => Promise<Result<StageSummary, StageError>> {
  return async (ctx) => {
    ctx.step(label, 10);
    const outcome = await gate.wait(ctx.signal);
    return outcome === 'aborted' ? err(stageError('cancelled', 'cancelled')) : ok(SUMMARY);
  };
}

export async function until(check: () => boolean, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
