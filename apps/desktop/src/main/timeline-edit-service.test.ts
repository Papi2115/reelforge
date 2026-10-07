import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SFX_RECIPES } from '@reelforge/pipeline';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BUILTIN_SFX_NAMES,
  timelineEditRequestSchema,
  type FileEdits,
  type TimelineEditResult,
} from '../shared/timeline-contract.js';
import { createLogger } from './logger.js';
import { describeChange, TimelineEditService } from './timeline-edit-service.js';

const FIXTURE = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'packages',
  'cli',
  'test',
  'fixtures',
  'project',
);

let root: string;
let dir: string;
let commits: string[];
let committedPaths: (readonly string[])[];
let service: TimelineEditService;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge timeline ż-'));
  dir = path.join(root, 'Mój film');
  await cp(FIXTURE, dir, { recursive: true });
  commits = [];
  committedPaths = [];
  service = new TimelineEditService({
    projectDir: () => dir,
    commit: (message, paths) => {
      commits.push(message);
      committedPaths.push(paths);
      return Promise.resolve(true);
    },
    log: createLogger(() => undefined),
  });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(dir, file), 'utf8'));
}

const moveS01: FileEdits = {
  file: 'storyboard',
  edits: [{ kind: 'move-boundary', left: 's01', right: 's02', from: 2.2, to: 2.5 }],
};

function okResult(result: TimelineEditResult): Extract<TimelineEditResult, { status: 'ok' }> {
  if (result.status !== 'ok') throw new Error(`${result.status}: ${result.message}`);
  return result;
}

describe('TimelineEditService', () => {
  it('moves a shot boundary, keeps the rest of the file and commits', async () => {
    const result = okResult(await service.edit({ change: moveS01, reason: 'edit' }));
    expect(result.message).toBe('Move boundary s01/s02 to 2.50 s');
    expect(commits).toEqual(['Move boundary s01/s02 to 2.50 s']);
    expect(committedPaths).toEqual([['storyboard.json']]);
    expect(result.inverse).toEqual({
      file: 'storyboard',
      edits: [{ kind: 'move-boundary', left: 's01', right: 's02', from: 2.5, to: 2.2 }],
    });
    expect(await readJson('storyboard.json')).toMatchObject({
      version: 1,
      shots: [
        { id: 's01', t0: 0, t1: 2.5, intent: 'Doom runs on almost anything.' },
        { id: 's02', t0: 2.5, t1: 7.5, transitionIn: { type: 'crossfade', duration: 0.4 } },
      ],
    });

    const undo = okResult(await service.edit({ change: result.inverse, reason: 'undo' }));
    expect(undo.message).toBe('Undo: Move boundary s01/s02 to 2.20 s');
    expect(await readJson('storyboard.json')).toMatchObject({
      shots: [{ t1: 2.2 }, { t0: 2.2 }],
    });
  });

  it('rejects a stale edit, a too-short shot and an invalid file without writing', async () => {
    const before = await readFile(path.join(dir, 'storyboard.json'), 'utf8');
    const stale = await service.edit({
      change: {
        file: 'storyboard',
        edits: [{ kind: 'move-boundary', left: 's01', right: 's02', from: 2, to: 2.5 }],
      },
      reason: 'edit',
    });
    expect(stale).toMatchObject({ status: 'rejected', message: /no longer at 2 s/ });
    const short = await service.edit({
      change: {
        file: 'storyboard',
        edits: [{ kind: 'move-boundary', left: 's01', right: 's02', from: 2.2, to: 0.4 }],
      },
      reason: 'edit',
    });
    expect(short).toMatchObject({ status: 'rejected', message: /at least 1 s/ });
    expect(await readFile(path.join(dir, 'storyboard.json'), 'utf8')).toBe(before);
    expect(commits).toEqual([]);

    await writeFile(path.join(dir, 'cues.json'), '{ broken');
    const broken = await service.edit({
      change: { file: 'cues', edits: [{ kind: 'move-sfx', index: 0, from: 3.7, to: 4 }] },
      reason: 'edit',
    });
    expect(broken).toMatchObject({ status: 'rejected', message: /not valid JSON/ });
  });

  it('edits cues, validates them with the pipeline schema and restores deletes on undo', async () => {
    const added = okResult(
      await service.edit({
        change: {
          file: 'cues',
          edits: [{ kind: 'insert-cue', track: 'sfx', index: 1, cue: { t: 5, name: 'whoosh' } }],
        },
        reason: 'edit',
      }),
    );
    expect(added.message).toBe('Add sfx cue whoosh');
    const deleted = okResult(
      await service.edit({
        change: { file: 'cues', edits: [{ kind: 'delete-cue', track: 'sfx', index: 0, at: 3.7 }] },
        reason: 'edit',
      }),
    );
    expect(deleted.message).toBe('Delete sfx cue hit');
    expect(await readJson('cues.json')).toEqual({
      version: 1,
      sfx: [{ t: 5, name: 'whoosh' }],
      ambience: [],
      music: [],
    });
    await service.edit({ change: deleted.inverse, reason: 'undo' });
    expect(await readJson('cues.json')).toMatchObject({
      sfx: [{ t: 3.7, name: 'hit' }, { t: 5 }],
    });

    const invalid = await service.edit({
      change: {
        file: 'cues',
        edits: [{ kind: 'insert-cue', track: 'sfx', index: 0, cue: { t: 1, name: 'nope' } }],
      },
      reason: 'edit',
    });
    expect(invalid).toMatchObject({ status: 'rejected', message: /^cues\.json: sfx\.0\.name/ });
  });

  it('creates cues.json when the project has none', async () => {
    await rm(path.join(dir, 'cues.json'));
    okResult(
      await service.edit({
        change: {
          file: 'cues',
          edits: [{ kind: 'insert-cue', track: 'sfx', index: 0, cue: { t: 1, name: 'pop' } }],
        },
        reason: 'edit',
      }),
    );
    expect(await readJson('cues.json')).toEqual({ version: 1, sfx: [{ t: 1, name: 'pop' }] });
  });

  it('applies concurrent changes in arrival order', async () => {
    const steps = [2.4, 2.6, 2.8].map((to, index, all) =>
      service.edit({
        change: {
          file: 'storyboard',
          edits: [
            { kind: 'move-boundary', left: 's01', right: 's02', from: all[index - 1] ?? 2.2, to },
          ],
        },
        reason: 'edit',
      }),
    );
    const results = await Promise.all(steps);
    expect(results.map((result) => result.status)).toEqual(['ok', 'ok', 'ok']);
    expect(await readJson('storyboard.json')).toMatchObject({ shots: [{ t1: 2.8 }, { t0: 2.8 }] });
  });
});

describe('describeChange', () => {
  const labels = (): string => 'rain';
  it('names single and grouped edits', () => {
    expect(
      describeChange(
        {
          file: 'cues',
          edits: [
            {
              kind: 'set-range',
              track: 'ambience',
              index: 0,
              from: { from: 0, to: 1 },
              to: { from: 1, to: 12.345 },
            },
          ],
        },
        labels,
      ),
    ).toBe('Set ambience rain to 1.00–12.35 s');
    expect(
      describeChange(
        {
          file: 'cues',
          edits: [
            { kind: 'move-sfx', index: 0, from: 1, to: 2 },
            { kind: 'move-sfx', index: 1, from: 1, to: 2 },
          ],
        },
        labels,
      ),
    ).toBe('Move 2 cues');
    expect(
      describeChange(
        { file: 'cues', edits: [{ kind: 'set-gain', track: 'music', index: 0, from: 0, to: -6 }] },
        labels,
      ),
    ).toBe('Set music rain gain to -6 dB');
  });
});

describe('timeline contract', () => {
  it('offers exactly the pipeline built-in sfx recipes', () => {
    expect([...BUILTIN_SFX_NAMES]).toEqual([...SFX_RECIPES]);
  });

  it('refuses malformed requests', () => {
    expect(
      timelineEditRequestSchema.safeParse({ change: { file: 'cues', edits: [] }, reason: 'edit' })
        .success,
    ).toBe(false);
    expect(
      timelineEditRequestSchema.safeParse({
        change: {
          file: 'storyboard',
          edits: [{ kind: 'move-boundary', left: '../x', right: 's02', from: 1, to: 2 }],
        },
        reason: 'edit',
      }).success,
    ).toBe(false);
  });
});
