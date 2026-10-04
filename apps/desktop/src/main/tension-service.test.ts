/** Tension panel edits (PLAN.md#12.22): sources, proposal, locks (pins), Reset, write + commit. */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  NEUTRAL_TENSION,
  tensionFileSchema,
  type StoryboardShot,
  type TensionFile,
} from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from './logger.js';
import {
  editedTension,
  resetTension,
  shotChanges,
  TensionService,
  type TensionContext,
} from './tension-service.js';

const SHOTS: StoryboardShot[] = [0, 1, 2, 3].map((index) => ({
  id: `s0${String(index + 1)}`,
  t0: index * 10,
  t1: (index + 1) * 10,
  treatment: 'metaphor-object',
  intent: 'x',
  scene: `scenes/s0${String(index + 1)}.js`,
}));

const CLAUDE: TensionFile = {
  version: 1,
  source: 'claude',
  points: [
    { t: 0, v: 0.2 },
    { t: 40, v: 0.8 },
  ],
  segments: [{ from: 0, to: 40, kind: 'rising' }],
  note: 'A slow climb.',
};

const DRAWN = [
  { t: 0, v: 0.9 },
  { t: 40, v: 0.9 },
];

function context(previous: TensionFile | undefined, locked: string[] = []): TensionContext {
  return { shots: SHOTS, locked: new Set(locked), durationS: 40, previous };
}

describe('editedTension', () => {
  it("marks a drawn curve as the user's and an edited proposal as edited (keeping it)", () => {
    const drawn = editedTension({ points: DRAWN, change: 'preset flat' }, context(undefined));
    expect(drawn).toEqual({ version: 1, source: 'user', points: DRAWN });
    const edited = editedTension({ points: DRAWN, change: 'moved a point' }, context(CLAUDE));
    expect(edited).toMatchObject({
      source: 'edited',
      points: DRAWN,
      segments: CLAUDE.segments,
      note: CLAUDE.note,
      proposal: { points: CLAUDE.points, segments: CLAUDE.segments },
    });
    expect(tensionFileSchema.safeParse(edited).success).toBe(true);
    // A second edit keeps the original proposal.
    const again = editedTension({ points: DRAWN, change: 'x' }, context(edited));
    expect(again.proposal?.points).toEqual(CLAUDE.points);
  });

  it('pins locked shots: their tension under the previous curve, neutral without one', () => {
    const edited = editedTension({ points: DRAWN, change: 'x' }, context(CLAUDE, ['s02']));
    expect(edited.pins).toEqual([{ shotId: 's02', v: 0.425 }]);
    const first = editedTension({ points: DRAWN, change: 'x' }, context(undefined, ['s02']));
    expect(first.pins).toEqual([{ shotId: 's02', v: NEUTRAL_TENSION }]);
  });

  it('cleans the points, spans the film and sets or keeps the lock', () => {
    const edited = editedTension(
      { points: [{ t: 12, v: 1.5 }], change: 'x', locked: true },
      context(CLAUDE),
    );
    expect(edited.points).toEqual([
      { t: 12, v: 1 },
      { t: 40, v: 1 },
    ]);
    expect(edited.locked).toBe(true);
    const kept = editedTension({ points: DRAWN, change: 'x' }, context(edited));
    expect(kept.locked).toBe(true);
  });
});

describe('resetTension and shotChanges', () => {
  it("resets an edited curve to Claude's proposal, a drawn one to no curve", () => {
    const edited = editedTension({ points: DRAWN, change: 'x' }, context(CLAUDE));
    expect(resetTension(context(edited))).toMatchObject({
      source: 'claude',
      points: CLAUDE.points,
      segments: CLAUDE.segments,
    });
    const drawn = editedTension({ points: DRAWN, change: 'x' }, context(undefined));
    expect(resetTension(context(drawn))).toBeNull();
    expect(resetTension(context(undefined))).toBeNull();
  });

  it('reports unlocked shots whose tension changed and the locked ones kept', () => {
    const edited = editedTension({ points: DRAWN, change: 'x' }, context(CLAUDE, ['s04']));
    expect(shotChanges(CLAUDE, edited, context(CLAUDE, ['s04']))).toEqual({
      changedShots: ['s01', 's02', 's03'],
      keptLocked: ['s04'],
    });
  });
});

describe('TensionService', () => {
  let root: string;
  let commits: string[];
  let service: TensionService;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'reelforge tension ż-'));
    commits = [];
    service = new TensionService({
      projectDir: () => root,
      commit: (message) => {
        commits.push(message);
        return Promise.resolve(true);
      },
      log: createLogger(() => undefined),
    });
    await writeFile(
      path.join(root, 'storyboard.json'),
      JSON.stringify({ version: 1, shots: SHOTS }),
    );
    await writeFile(
      path.join(root, 'locks.json'),
      JSON.stringify({
        version: 1,
        shots: [{ shotId: 's03', lockedAt: '2026-10-04T08:00:00.000Z' }],
      }),
    );
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true, maxRetries: 5 });
  });

  const onDisk = async (): Promise<TensionFile> =>
    tensionFileSchema.parse(JSON.parse(await readFile(path.join(root, 'tension.json'), 'utf8')));

  it('writes, commits, reports changes; an unchanged save commits nothing', async () => {
    await writeFile(path.join(root, 'tension.json'), JSON.stringify(CLAUDE));
    const saved = await service.save({ points: DRAWN, change: 'preset flat' });
    expect(saved).toMatchObject({
      status: 'ok',
      committed: true,
      changedShots: ['s01', 's02', 's04'],
      keptLocked: ['s03'],
    });
    expect(commits).toEqual(['Tension: preset flat']);
    const file = await onDisk();
    expect(file).toMatchObject({ source: 'edited', pins: [{ shotId: 's03', v: 0.575 }] });
    expect(await service.save({ points: DRAWN, change: 'again' })).toMatchObject({
      committed: false,
    });
    expect(commits).toHaveLength(1);
  });

  it("Reset brings back Claude's proposal; without one it removes the curve", async () => {
    await writeFile(path.join(root, 'tension.json'), JSON.stringify(CLAUDE));
    await service.save({ points: DRAWN, change: 'x' });
    const reset = await service.reset();
    expect(reset).toMatchObject({ status: 'ok', committed: true });
    expect((await onDisk()).points).toEqual(CLAUDE.points);
    expect(commits.at(-1)).toBe("Tension: reset to Claude's proposal");
    await writeFile(
      path.join(root, 'tension.json'),
      JSON.stringify({ version: 1, source: 'user', points: DRAWN }),
    );
    expect(await service.reset()).toMatchObject({ status: 'ok', file: null });
    await expect(readFile(path.join(root, 'tension.json'), 'utf8')).rejects.toThrow();
  });

  it('refuses without an open project', async () => {
    const closed = new TensionService({
      projectDir: () => undefined,
      commit: () => Promise.resolve(false),
      log: createLogger(() => undefined),
    });
    expect(await closed.save({ points: DRAWN, change: 'x' })).toEqual({
      status: 'error',
      message: 'no project is open',
    });
  });
});
