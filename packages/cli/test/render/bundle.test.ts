/**
 * The built CLI (dist/reelforge.mjs) as the runtime Claude runs it: a separate Node process in a
 * project folder whose path has spaces and Polish letters.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { copyFixtureProject, type TempProject } from '../../src/testing/fixture.js';

const cliRoot = path.resolve(import.meta.dirname, '..', '..');
const bundle = path.join(cliRoot, 'dist', 'reelforge.mjs');

let project: TempProject;

function reelforge(...args: string[]): { status: number | null; stdout: string; stderr: string } {
  const run = spawnSync(process.execPath, [bundle, ...args], {
    cwd: project.root,
    encoding: 'utf8',
  });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr };
}

beforeAll(async () => {
  const build = spawnSync(process.execPath, [path.join(cliRoot, 'scripts', 'build.mjs')], {
    cwd: cliRoot,
    encoding: 'utf8',
  });
  if (build.status !== 0) throw new Error(`CLI build failed: ${build.stderr}`);
  project = await copyFixtureProject();
});

afterAll(async () => {
  await project.remove();
});

describe('dist/reelforge.mjs', () => {
  it('runs status/validate as JSON and renders frames', () => {
    const status = reelforge('status', '--json');
    expect(status.status).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({ project: { title: 'Doom on a calculator' } });
    expect(reelforge('validate').status).toBe(0);
    const frames = reelforge('frames', '--shot', 's01', '--at', '0.5');
    expect(frames.stderr).toBe('');
    expect(frames.status).toBe(0);
    expect(frames.stdout).toMatch(/t=0\.50s\s+.*Zażółć gęślą.*s01_t0\.500\.png/);
  });
});
