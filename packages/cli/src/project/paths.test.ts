import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UsageError } from '../errors.js';
import { isInside, projectRelative, resolveInProject, samePath } from './paths.js';

let root: string;

beforeAll(async () => {
  root = path.join(await mkdtemp(path.join(tmpdir(), 'reelforge paths ')), 'Zażółć gęślą');
});

afterAll(async () => {
  await rm(path.dirname(root), { recursive: true, force: true });
});

describe('resolveInProject', () => {
  it('resolves relative paths inside the project (spaces, Polish letters)', () => {
    expect(resolveInProject(root, 'scenes/s01 intro.js', '--scene')).toBe(
      path.join(root, 'scenes', 's01 intro.js'),
    );
    expect(resolveInProject(root, path.join(root, 'scenes', 'a.js'), '--scene')).toBe(
      path.join(root, 'scenes', 'a.js'),
    );
  });

  it('rejects .. escapes and absolute paths elsewhere, naming the option', () => {
    expect(() => resolveInProject(root, '../other/a.js', '--scene')).toThrow(UsageError);
    expect(() => resolveInProject(root, 'scenes/../../a.js', '--scene')).toThrow(
      /--scene: "scenes\/\.\.\/\.\.\/a\.js" is outside the project folder/,
    );
    expect(() => resolveInProject(root, path.resolve(root, '..', 'x.js'), 'lint')).toThrow(
      /^lint: /,
    );
  });
});

describe('path helpers', () => {
  it('treats a sibling with a common prefix as outside', () => {
    expect(isInside(root, `${root} copy`)).toBe(false);
    expect(isInside(root, path.join(root, '..foo'))).toBe(true);
  });

  it('prints project-relative paths with forward slashes', () => {
    expect(projectRelative(root, path.join(root, 'timing', 'words.json'))).toBe(
      'timing/words.json',
    );
  });

  it('compares paths case-insensitively only on Windows', () => {
    expect(samePath(path.join(root, 'A.js'), path.join(root, 'a.js'))).toBe(
      process.platform === 'win32',
    );
  });
});
