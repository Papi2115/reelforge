/**
 * The Dramaturgy section's service (PLAN.md#12.25–12.27): proposals from the tension peak, Accept
 * / Reject / back to proposed written to moments.json and committed, a locked shot's moment
 * refused, nothing proposed with the switch off; and the preview manifest applies an accepted
 * slow motion only while the switch is on.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { momentsFileSchema, PAGE_CAMERA_HINTS } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  decidedMoments,
  describeDecision,
  DramaturgyService,
  momentCameraHints,
  syncAnchors,
} from './dramaturgy-service.js';
import { createLogger } from './logger.js';
import { buildProjectManifest } from './project-manifest.js';

const PROJECT = {
  version: 1,
  title: 'Dramat',
  language: 'en',
  style: 'voxel-pixel-crisp640',
  fps: 30,
  seed: 7,
  tensionMap: 'auto',
  revealMoments: 'auto',
};
const SCENE =
  'export const meta = { id: "s" };\nexport function build() { return null; }\nexport function update() {}\n';
const STORYBOARD = {
  version: 1,
  shots: [
    { id: 's01', t0: 0, t1: 48, treatment: 'title-card', intent: 'x', scene: 'scenes/s01.js' },
    {
      id: 's02',
      t0: 48,
      t1: 58,
      treatment: 'metaphor-object',
      intent: 'x',
      scene: 'scenes/s02.js',
    },
  ],
};
const WORDS = {
  version: 1,
  words: [
    { text: 'It', t: 50, tEnd: 50.2 },
    { text: 'was', t: 50.3, tEnd: 50.5 },
    { text: 'gone,', t: 50.6, tEnd: 51 },
    { text: 'forever.', t: 51.6, tEnd: 52.2 },
    { text: 'Silence.', t: 56, tEnd: 57 },
  ],
};
const TENSION = {
  version: 1,
  source: 'claude',
  points: [
    { t: 0, v: 0.2 },
    { t: 51.6, v: 0.95 },
    { t: 58, v: 0.3 },
  ],
};

let root: string;
let commits: string[];
let service: DramaturgyService;

async function write(relative: string, value: unknown): Promise<void> {
  const file = path.join(root, ...relative.split('/'));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge dramaturgy ż-'));
  commits = [];
  service = new DramaturgyService({
    projectDir: () => root,
    commit: (message) => {
      commits.push(message);
      return Promise.resolve(true);
    },
    now: () => new Date('2026-10-04T10:00:00.000Z'),
    log: createLogger(() => undefined),
  });
  await write('project.json', PROJECT);
  await write('storyboard.json', STORYBOARD);
  await write('timing/words.json', WORDS);
  await write('tension.json', TENSION);
  await write('scenes/s01.js', SCENE);
  await write('scenes/s02.js', SCENE);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

async function momentId(): Promise<string> {
  const state = await service.state();
  if (state.status !== 'ok') throw new Error(state.message);
  const id = state.moments[0]?.moment.id;
  if (id === undefined) throw new Error('no proposal');
  return id;
}

describe('DramaturgyService', () => {
  it('proposes a moment at the tension peak and records decisions', async () => {
    const state = await service.state();
    expect(state).toMatchObject({
      status: 'ok',
      switches: { revealMoments: 'auto', patternInterrupts: 'off', openLoops: 'off' },
      report: null,
      momentsNote: null,
      moments: [{ moment: { kind: 'silence-hit', shotId: 's02', at: 51.6 }, locked: false }],
    });
    const id = await momentId();
    const accepted = await service.decide({ id, decision: 'accepted' });
    expect(accepted).toMatchObject({ status: 'ok', committed: true });
    const file = momentsFileSchema.parse(
      JSON.parse(await readFile(path.join(root, 'moments.json'), 'utf8')),
    );
    expect(file.moments).toMatchObject([
      { id, status: 'accepted', decidedAt: '2026-10-04T10:00:00.000Z' },
    ]);
    expect(commits).toEqual(['Moments: accepted silence hit at 0:52 (s02)']);
    await service.decide({ id, decision: 'proposed' });
    const cleared = momentsFileSchema.parse(
      JSON.parse(await readFile(path.join(root, 'moments.json'), 'utf8')),
    );
    expect(cleared.moments).toEqual([]);
    expect(commits.at(-1)).toBe('Moments: undid the decision on silence hit at 0:52 (s02)');
  });

  it('gives a world project page camera ideas (never an orbit)', async () => {
    const voxel = await service.state();
    expect(voxel.status === 'ok' && voxel.moments[0]?.moment.cameraHint).toMatch(/^rack focus/);
    await write('project.json', { ...PROJECT, style: 'sketchbook' });
    const world = await service.state();
    if (world.status !== 'ok') throw new Error(world.message);
    expect(world.moments[0]?.moment).toMatchObject({
      kind: 'silence-hit',
      cameraHint: PAGE_CAMERA_HINTS['silence-hit'],
    });
    for (const view of world.moments) expect(view.moment.cameraHint).not.toMatch(/orbit around/);
    expect(momentCameraHints('sketchbook')).toBe(PAGE_CAMERA_HINTS);
    expect(momentCameraHints('voxel-pixel-crisp640')).toBeUndefined();
    expect(momentCameraHints(undefined)).toBeUndefined();
  });

  it('refuses to accept a moment of a locked shot', async () => {
    await write('locks.json', {
      version: 1,
      shots: [{ shotId: 's02', lockedAt: '2026-10-04T09:00:00.000Z' }],
    });
    const id = await momentId();
    const state = await service.state();
    expect(state.status === 'ok' && state.moments[0]?.locked).toBe(true);
    await expect(service.decide({ id, decision: 'accepted' })).resolves.toEqual({
      status: 'error',
      message: 's02 is locked: unlock the shot to accept this moment',
    });
    await expect(service.decide({ id, decision: 'rejected' })).resolves.toMatchObject({
      status: 'ok',
    });
  });

  it('proposes nothing with the switch off or without a tension curve', async () => {
    await write('project.json', { ...PROJECT, revealMoments: 'off' });
    await expect(service.state()).resolves.toMatchObject({ moments: [] });
    await write('project.json', { ...PROJECT, tensionMap: 'off' });
    const state = await service.state();
    expect(state.status === 'ok' && state.momentsNote).toContain('tension');
  });

  it('applies an accepted slow motion in the preview manifest only while the switch is on', async () => {
    const slow = {
      id: 'slow-motion-s02-51600',
      kind: 'slow-motion',
      shotId: 's02',
      at: 51.6,
      word: 'forever.',
      tension: 0.95,
      from: 51.6,
      to: 53.2,
      rate: 0.4,
      status: 'accepted',
    };
    await write('moments.json', { version: 1, moments: [slow] });
    const on = await buildProjectManifest(root);
    expect(on.status === 'ready' && on.manifest.shots[1]?.timeRemap).toEqual([
      { from: 51.6, to: 53.2, rate: 0.4 },
    ]);
    expect(on.status === 'ready' && on.manifest.shots[0]?.timeRemap).toBeUndefined();
    await write('project.json', { ...PROJECT, revealMoments: 'off' });
    const off = await buildProjectManifest(root);
    expect(off.status === 'ready' && off.manifest.shots[1]).not.toHaveProperty('timeRemap');
  });
});

describe('moment helpers', () => {
  it('reads the visual hits of the sync report and words the commit', () => {
    const event = { spokenT: null, phrase: null, deltaMs: null, verdict: 'ok' as const };
    expect(
      syncAnchors({
        version: 1,
        createdAt: '2026-10-04T10:00:00.000Z',
        toleranceMs: 150,
        shots: [
          {
            shotId: 's02',
            t0: 48,
            t1: 58,
            problems: 0,
            maxDeltaMs: null,
            events: [
              { ...event, kind: 'anchor', label: 'forever', t: 51.6 },
              { ...event, kind: 'annotation', label: 'ring', t: 52 },
              { ...event, kind: 'sfx', label: 'hit', t: 51.62 },
            ],
          },
        ],
        summary: { shots: 1, events: 3, ok: 3, problems: 0, failedShots: 0 },
      }),
    ).toEqual([
      { shotId: 's02', t: 51.6 },
      { shotId: 's02', t: 51.62 },
    ]);
    const moment = {
      id: 'palette-shift-s02-1',
      kind: 'palette-shift' as const,
      shotId: 's02',
      at: 61.2,
      word: 'x',
      tension: 0.7,
      from: 61.2,
      to: 61.7,
      status: 'proposed' as const,
    };
    expect(describeDecision(moment, 'rejected')).toBe(
      'Moments: rejected palette flash at 1:01 (s02)',
    );
    expect(decidedMoments([], moment, 'accepted', new Date(0))).toEqual([
      { ...moment, status: 'accepted', decidedAt: '1970-01-01T00:00:00.000Z' },
    ]);
  });
});
