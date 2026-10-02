import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  findRecentProject,
  forgetRecentProject,
  listRecentProjects,
  MAX_RECENT_PROJECTS,
  rememberRecentProject,
} from './recent.js';

let root: string;
let store: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge recent ł-'));
  store = path.join(root, 'app data', 'recent-projects.json');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function projectFolder(name: string): Promise<string> {
  const dir = path.join(root, name);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'project.json'), '{}');
  return dir;
}

describe('recent projects', () => {
  it('starts empty, keeps the most recent first without duplicates', async () => {
    expect(await listRecentProjects(store)).toEqual({ ok: true, value: [] });
    const first = await projectFolder('Pierwszy film');
    const second = await projectFolder('Drugi');
    await rememberRecentProject(
      store,
      { dir: first, title: 'Pierwszy' },
      new Date('2026-10-01T10:00:00Z'),
    );
    await rememberRecentProject(
      store,
      { dir: second, title: 'Drugi' },
      new Date('2026-10-01T11:00:00Z'),
    );
    await rememberRecentProject(
      store,
      { dir: first, title: 'Pierwszy (2)' },
      new Date('2026-10-01T12:00:00Z'),
    );
    const list = await listRecentProjects(store);
    expect(list).toEqual({
      ok: true,
      value: [
        { dir: first, title: 'Pierwszy (2)', openedAt: '2026-10-01T12:00:00.000Z', exists: true },
        { dir: second, title: 'Drugi', openedAt: '2026-10-01T11:00:00.000Z', exists: true },
      ],
    });
    expect(JSON.parse(await readFile(store, 'utf8'))).toMatchObject({ version: 1 });
  });

  it('flags missing folders, forgets entries and caps the list', async () => {
    const gone = path.join(root, 'gone');
    await rememberRecentProject(store, { dir: gone, title: 'Gone' });
    const found = await findRecentProject(store, gone);
    expect(found.ok && found.value?.exists).toBe(false);
    await forgetRecentProject(store, gone);
    expect(await listRecentProjects(store)).toEqual({ ok: true, value: [] });

    for (let index = 0; index < MAX_RECENT_PROJECTS + 3; index += 1) {
      await rememberRecentProject(store, {
        dir: path.join(root, `p${String(index)}`),
        title: `P${String(index)}`,
      });
    }
    const list = await listRecentProjects(store);
    expect(list.ok && list.value.length).toBe(MAX_RECENT_PROJECTS);
    expect(list.ok && list.value[0]?.title).toBe(`P${String(MAX_RECENT_PROJECTS + 2)}`);
  });

  it('reports a corrupt store and replaces it on the next update', async () => {
    await mkdir(path.dirname(store), { recursive: true });
    await writeFile(store, '{ nope');
    const corrupt = await listRecentProjects(store);
    expect(!corrupt.ok && corrupt.error.kind).toBe('corrupt');
    const dir = await projectFolder('ok');
    const updated = await rememberRecentProject(store, { dir, title: 'Ok' });
    expect(updated.ok && updated.value.map((entry) => entry.title)).toEqual(['Ok']);
  });
});
