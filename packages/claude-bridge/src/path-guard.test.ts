import { mkdirSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertInsideProject, isInsideDir } from './path-guard.js';
import { TempDirs } from './testing/fake-claude.js';

const temps = new TempDirs();
afterEach(() => {
  temps.cleanup();
});

describe('isInsideDir', () => {
  it('Windows paths: case-insensitive, other drives/UNC/.. escapes are outside', () => {
    const root = 'C:\\Users\\Papi\\Creatorize Suite\\my film';
    const inside = (target: string): boolean => isInsideDir(root, target, path.win32);
    expect(inside('scenes\\s01.js')).toBe(true);
    expect(inside('c:\\users\\papi\\creatorize suite\\MY FILM\\x.txt')).toBe(true);
    expect(inside(root)).toBe(true);
    expect(inside('..\\other\\x.txt')).toBe(false);
    expect(inside('scenes\\..\\..\\x.txt')).toBe(false);
    expect(inside('D:\\my film\\x.txt')).toBe(false);
    expect(inside('\\\\server\\share\\x.txt')).toBe(false);
    expect(inside('C:\\Users\\Papi\\Creatorize Suite\\my film 2\\x.txt')).toBe(false);
  });

  it('POSIX paths are case-sensitive', () => {
    expect(isInsideDir('/home/p/film', 'a/b', path.posix)).toBe(true);
    expect(isInsideDir('/home/p/film', '/home/p/Film/a', path.posix)).toBe(false);
    expect(isInsideDir('/home/p/film', '/home/p/film-2/a', path.posix)).toBe(false);
  });
});

describe('assertInsideProject', () => {
  it('returns the absolute path inside, a typed error outside', () => {
    const projectDir = temps.make();
    expect(assertInsideProject(projectDir, path.join('scenes', 'new.js'))).toEqual({
      ok: true,
      value: path.join(projectDir, 'scenes', 'new.js'),
    });
    const outside = assertInsideProject(projectDir, path.join('..', 'escape.txt'));
    expect(outside).toMatchObject({
      ok: false,
      error: { kind: 'outside-project', root: projectDir },
    });
  });

  it('follows directory links (junctions on Windows) that point out of the project', () => {
    const projectDir = temps.make();
    const elsewhere = temps.make('rf elsewhere ');
    mkdirSync(path.join(projectDir, 'scenes'));
    symlinkSync(elsewhere, path.join(projectDir, 'scenes', 'link'), 'junction');
    const escaped = assertInsideProject(projectDir, path.join('scenes', 'link', 'x.js'));
    expect(escaped.ok).toBe(false);
    const lexicalOnly = assertInsideProject(projectDir, path.join('scenes', 'link', 'x.js'), {
      followLinks: false,
    });
    expect(lexicalOnly.ok).toBe(true);
  });
});
