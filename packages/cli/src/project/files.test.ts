import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { storyboardFileSchema } from '@reelforge/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkJsonFile, formatIssuePath } from './files.js';

let root: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge files '));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('checkJsonFile', () => {
  it('distinguishes missing, unparsable, schema-invalid and valid files', async () => {
    expect(await checkJsonFile(root, 'storyboard.json', storyboardFileSchema)).toEqual({
      status: 'missing',
      file: 'storyboard.json',
    });
    await writeFile(path.join(root, 'storyboard.json'), '{ "version": 1, }');
    const broken = await checkJsonFile(root, 'storyboard.json', storyboardFileSchema);
    if (broken.status !== 'invalid') throw new Error('expected invalid JSON');
    expect(broken.problems.map((problem) => problem.at)).toEqual(['']);
    expect(broken.problems[0]?.message).toMatch(/^not valid JSON/);
    await writeFile(
      path.join(root, 'storyboard.json'),
      JSON.stringify({
        version: 1,
        shots: [{ id: 'S1', t0: 0, t1: 1, treatment: 'x', intent: 'i' }],
      }),
    );
    const invalid = await checkJsonFile(root, 'storyboard.json', storyboardFileSchema);
    if (invalid.status !== 'invalid') throw new Error('expected invalid');
    expect(invalid.problems.map((problem) => problem.at)).toEqual([
      'shots[0].id',
      'shots[0].treatment',
      'shots[0].scene',
    ]);
    expect(invalid.problems[2]?.fix).toBe('add the missing field');
  });
});

describe('formatIssuePath', () => {
  it('prints array indices in brackets', () => {
    expect(formatIssuePath(['shots', 1, 'transitionIn', 'duration'])).toBe(
      'shots[1].transitionIn.duration',
    );
    expect(formatIssuePath([])).toBe('');
  });
});
