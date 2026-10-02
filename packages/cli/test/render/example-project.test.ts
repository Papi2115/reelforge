/**
 * The bundled example project (templates/examples/doom-on-a-calculator, PLAN.md#10.3) through the
 * real engine harness: 3 frames per shot are not blank, have no console errors and keep every
 * text card inside the safe area without overlaps; every sfx cue lands on its anchor (±150 ms).
 * Runs on a temp copy so the committed folder never gets a .reelforge/ cache.
 */
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { computeFrameStats, decodePng } from '@reelforge/engine/cli';
import { storyboardFileSchema } from '@reelforge/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runCli } from '../../src/testing/fixture.js';

const EXAMPLE = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'templates',
  'examples',
  'doom-on-a-calculator',
);
/** Local shot times as shares of the shot length. */
const FRAME_SHARES = [0.15, 0.5, 0.92];

interface FramesReport {
  readonly frames: readonly { t: number; file: string; blank: string | null }[];
  readonly issues: readonly unknown[];
}

let base = '';
let root = '';

beforeAll(async () => {
  base = await mkdtemp(path.join(tmpdir(), 'reelforge example '));
  root = path.join(base, 'Doom on a calculator');
  await cp(EXAMPLE, root, {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}.reelforge`),
  });
});

afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

describe('example project renders', () => {
  it('renders 3 good frames per shot with clean text cards', async () => {
    const storyboard = storyboardFileSchema.parse(
      JSON.parse(await readFile(path.join(root, 'storyboard.json'), 'utf8')),
    );
    for (const shot of storyboard.shots) {
      const duration = shot.t1 - shot.t0;
      const times = FRAME_SHARES.map((share) => (share * duration).toFixed(2)).join(',');
      const run = await runCli(root, 'frames', '--shot', shot.id, '--at', times, '--json');
      expect(run.stderr, shot.id).toBe('');
      expect(run.code, `${shot.id}: ${run.stdout}`).toBe(0);
      const report = JSON.parse(run.stdout) as FramesReport;
      expect(report.issues, shot.id).toEqual([]);
      expect(report.frames).toHaveLength(FRAME_SHARES.length);
      for (const frame of report.frames) {
        expect(frame.blank, `${shot.id} at ${String(frame.t)}s`).toBeNull();
        const image = decodePng(await readFile(frame.file));
        expect([image.width, image.height]).toEqual([640, 360]);
        const stats = computeFrameStats(image.data);
        expect(stats.dominantColorShare, `${shot.id} at ${String(frame.t)}s`).toBeLessThan(0.6);
      }
    }
  });

  it('lands every scene sfx cue on its anchor', async () => {
    const run = await runCli(root, 'anchors');
    expect(run.stdout).not.toContain('MISS');
    expect(run.stdout).not.toContain('OUTSIDE');
    expect(run.code, run.stdout).toBe(0);
  });
});
