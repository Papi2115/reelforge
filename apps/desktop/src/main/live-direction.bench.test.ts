/**
 * Live co-direction benchmark (PLAN.md#12.14 AC: 10 commands on the example project, median
 * apply < 1 s, locks respected). Each command runs the real path minus the GPU: parse (local),
 * DirectionsService (atomic write + real git commit), the preview/export manifest rebuild, the
 * hot-reload plan (direction only, no rebuild) and the engine's frame pass for the direction on a
 * 640x360 frame. The GPU render of the frame itself is the same with or without directions.
 * Report: docs/live-direction.md.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createFrameDirector, frameDirection, resolveStyle } from '@reelforge/engine';
import {
  autocommit,
  DEFAULT_STYLES_DIR,
  DEFAULT_TEMPLATE_DIR,
  history,
  type GitOptions,
} from '@reelforge/project';
import {
  parseDirectionCommand,
  storyboardFileSchema,
  wordsFileSchema,
  type RenderManifest,
} from '@reelforge/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DIRECTION_STEP, DirectionsService } from './directions-service.js';
import { EXAMPLE_ID, installExampleProject } from './example-project.js';
import { createLogger } from './logger.js';
import { buildProjectManifest } from './project-manifest.js';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 60_000 });

/** Generous bar for CI runners; the AC is a median under 1 s on Papi's machine. */
const MEDIAN_BAR_MS = 1000;

const EXAMPLES_DIR = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'templates',
  'examples',
);

/** [playhead (s), command]: shots s03 (4.9–11.3 s) and s04 (11.3–17.4 s), EN and PL. */
const COMMANDS: readonly (readonly [number, string])[] = [
  [6, 'slower'],
  [6, 'ciemniej'],
  [7, 'zoom in'],
  [7, 'arrow on the word calculator'],
  [8, 'podkreśl exam'],
  [9.3, 'zakreśl memory'],
  [9.3, 'highlight this'],
  [12.5, 'faster'],
  [12.5, 'jaśniej'],
  [9, 'usuń strzałkę'],
];

let root: string;
let dir: string;
let git: GitOptions;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge direction bench ż-'));
  const globalConfig = path.join(root, 'global.gitconfig');
  await writeFile(globalConfig, '');
  git = { env: { ...process.env, GIT_CONFIG_GLOBAL: globalConfig, GIT_CONFIG_NOSYSTEM: '1' } };
  const installed = await installExampleProject({
    exampleDir: path.join(EXAMPLES_DIR, EXAMPLE_ID),
    projectsDir: root,
    templateDir: DEFAULT_TEMPLATE_DIR,
    stylesDir: DEFAULT_STYLES_DIR,
    git,
    now: () => new Date('2026-10-04T12:00:00.000Z'),
  });
  if (!installed.ok) throw new Error(installed.error.message);
  dir = installed.value;
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

function median(values: readonly number[]): number {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function withoutDirections(manifest: RenderManifest): string {
  return JSON.stringify(manifest.shots.map((shot) => ({ ...shot, direction: undefined })));
}

function changedDirections(before: RenderManifest, after: RenderManifest): string[] {
  return after.shots
    .filter(
      (shot, index) =>
        JSON.stringify(before.shots[index]?.direction) !== JSON.stringify(shot.direction),
    )
    .map((shot) => shot.id);
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(dir, file), 'utf8')) as unknown;
}

describe('live co-direction on the example project', () => {
  it('applies 10 commands with a median under 1 s and refuses a locked shot', async () => {
    const service = new DirectionsService({
      projectDir: () => dir,
      commit: async (message, paths) => {
        const committed = await autocommit(dir, message, {
          kind: 'manual',
          step: DIRECTION_STEP,
          paths,
          git,
        });
        return committed.ok && committed.value.status === 'committed';
      },
      log: createLogger(() => undefined),
    });
    const storyboard = storyboardFileSchema.parse(await readJson('storyboard.json'));
    const words = wordsFileSchema.parse(await readJson('timing/words.json')).words;
    const first = await buildProjectManifest(dir);
    if (first.status !== 'ready') throw new Error(first.status);
    let loaded: RenderManifest = first.manifest;
    const style = resolveStyle({ style: loaded.style });
    const frame = new Uint8Array(style.width * style.height * 4).fill(255);
    const director = createFrameDirector(style, loaded.seed);
    const timings: number[] = [];

    for (const [playhead, command] of COMMANDS) {
      const started = performance.now();
      const shot = storyboard.shots.findLast((candidate) => candidate.t0 <= playhead);
      if (shot === undefined) throw new Error('no shot');
      const state = await service.state();
      if (state.status !== 'ok') throw new Error(state.message);
      const parsed = parseDirectionCommand(command, {
        shot,
        current: state.directions.shots[shot.id],
        words,
        playhead,
      });
      expect(parsed.kind, command).toBe('direction');
      if (parsed.kind !== 'direction') continue;
      const applied = await service.apply({
        shotId: shot.id,
        next: parsed.next ?? null,
        command,
      });
      expect(applied, command).toMatchObject({ status: 'ok', committed: true });
      const built = await buildProjectManifest(dir);
      if (built.status !== 'ready') throw new Error(built.status);
      // What the preview's hot-reload plan sees (reload-plan.ts): only this shot's direction.
      expect(withoutDirections(built.manifest), command).toBe(withoutDirections(loaded));
      expect(changedDirections(loaded, built.manifest), command).toEqual([shot.id]);
      loaded = built.manifest;
      const direction = frameDirection(
        loaded.shots.find((entry) => entry.id === shot.id)?.direction,
      );
      if (direction !== undefined) director.apply(frame, direction, playhead);
      timings.push(performance.now() - started);
    }
    expect(timings).toHaveLength(COMMANDS.length);
    // REELFORGE_BENCH_OUT=<file>: the timings for the report in docs/live-direction.md.
    const out = process.env['REELFORGE_BENCH_OUT'];
    if (out !== undefined) {
      await writeFile(out, JSON.stringify({ timings, median: median(timings) }), { flag: 'a' });
    }
    expect(median(timings)).toBeLessThan(MEDIAN_BAR_MS);

    // Every command is one step of the project history.
    const commits = await history(dir, { limit: 20, git });
    if (!commits.ok) throw new Error(commits.error.message);
    const steps = commits.value.filter((entry) => entry.step === DIRECTION_STEP);
    expect(steps).toHaveLength(COMMANDS.length);
    expect(steps[0]?.subject).toBe('Direction s03: usuń strzałkę');

    // A locked shot is refused and directions.json stays as it was.
    const before = await readFile(path.join(dir, 'directions.json'), 'utf8');
    await writeFile(
      path.join(dir, 'locks.json'),
      JSON.stringify({
        version: 1,
        shots: [{ shotId: 's04', lockedAt: '2026-10-04T12:00:00.000Z' }],
      }),
    );
    const refused = await service.apply({ shotId: 's04', next: { dim: -1 }, command: 'darker' });
    expect(refused).toMatchObject({ status: 'locked', shotId: 's04' });
    expect(await readFile(path.join(dir, 'directions.json'), 'utf8')).toBe(before);
  });
});
