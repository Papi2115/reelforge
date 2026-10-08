/** Editing section handlers (PLAN.md#12.21, #12.23): state, Apply (commit + queue), Ignore. */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { StageRequest } from '@reelforge/stages';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { editingHandlers, REPETITION_STEP } from './editing-ipc.js';
import { createLogger } from './logger.js';

let dir: string;
const commits: [string, string, readonly string[]][] = [];
const queued: StageRequest[][] = [];

const shot = (index: number, extra: Record<string, unknown> = {}) => ({
  id: `s0${String(index + 1)}`,
  t0: index * 5,
  t1: (index + 1) * 5,
  treatment: 'metaphor-object',
  intent: 'x',
  scene: `scenes/s0${String(index + 1)}.js`,
  ...extra,
});

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'rf editing '));
  await mkdir(path.join(dir, 'scenes'));
  await writeFile(
    path.join(dir, 'project.json'),
    JSON.stringify({
      version: 1,
      title: 'x',
      language: 'en',
      style: 'voxel-pixel-crisp640',
      fps: 30,
      seed: 1,
      beatSync: 'auto',
      repetitionControl: 'auto',
    }),
  );
  await writeFile(
    path.join(dir, 'storyboard.json'),
    JSON.stringify({ version: 1, shots: [0, 1, 2, 3].map((index) => shot(index)) }),
  );
  const sfx = [2, 6, 9, 12].map((t, index) => ({
    id: `sfx-0${String(index + 1)}`,
    t,
    name: 'whoosh',
    gainDb: -16,
  }));
  await writeFile(path.join(dir, 'cues.json'), JSON.stringify({ version: 1, sfx }));
  commits.length = 0;
  queued.length = 0;
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function handlers() {
  return editingHandlers({
    currentProject: () => dir,
    commit: (_dir, message, step, paths) => {
      commits.push([message, step, paths]);
      return Promise.resolve(true);
    },
    enqueue: (requests) => {
      queued.push([...requests]);
      return Promise.resolve({ status: 'queued' as const, message: null });
    },
    log: createLogger(() => undefined),
  });
}

describe('editing handlers', () => {
  it('reads the switches and reports (none yet)', async () => {
    expect(await handlers().editingState(null)).toEqual({
      status: 'ok',
      switches: { beatSync: 'auto', repetitionControl: 'auto' },
      beatSync: null,
      repetitions: null,
    });
  });

  it('applies an SFX repetition: cues.json rewritten and committed; Ignore needs an analysis', async () => {
    const editing = handlers();
    expect(await editing.repetitionAction({ id: 'nope', action: 'ignore' })).toMatchObject({
      status: 'error',
    });
    const applied = await editing.repetitionAction({ id: 'sfx:whoosh@2.00', action: 'apply' });
    expect(applied).toMatchObject({ status: 'ok', committed: true, queued: false });
    expect(commits[0]?.[1]).toBe(REPETITION_STEP);
    // Only the file the repetition rewrote is committed.
    expect(commits[0]?.[2]).toEqual(['cues.json']);
    const cues = JSON.parse(await readFile(path.join(dir, 'cues.json'), 'utf8')) as {
      sfx: { name: string }[];
    };
    expect(cues.sfx.map((cue) => cue.name).filter((name) => name === 'whoosh')).toHaveLength(2);
    const state = await editing.editingState(null);
    expect(state.status === 'ok' && state.repetitions?.items.length).toBe(0);
  });
});
