/** `reelforge world-assets check`, `validate` and `validate level` with a world film's own assets (PLAN.md#13.15). */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { copyFixtureProject, runCli, type TempProject } from '../testing/fixture.js';
import { FOREST_ASSETS } from '../testing/world-assets.js';

const projects: TempProject[] = [];
afterEach(async () => {
  await Promise.all(projects.splice(0).map((project) => project.remove()));
});

const level = (sprite: string): string => `export const meta = { id: 's02' };
const LEVEL = {
  name: 'forest',
  sky: { preset: 'day' },
  floor: 'moss',
  grid: ['......', '......', '......'],
  legend: {},
  lights: [],
  sprites: [{ sprite: '${sprite}', pos: [4, 1.5] }],
};
export function build(ctx) {
  const view = ctx.kit.fx.b2View({ size: [640, 360], level: LEVEL, assets: ctx.worldAssets, duration: 2 });
  ctx.scene.add(view);
  return { view };
}
export function update(t, state) {
  state.view.update(t);
}
`;

async function b2Project(): Promise<TempProject> {
  const project = await copyFixtureProject();
  projects.push(project);
  await project.edit('project.json', '"voxel-pixel-crisp640"', '"game-b2"');
  await mkdir(path.join(project.root, 'assets', 'game-b2'), { recursive: true });
  for (const [file, text] of Object.entries(FOREST_ASSETS['game-b2']))
    await project.write(file, text);
  return project;
}

interface Problem {
  readonly file: string;
  readonly message: string;
}

describe('world assets in the CLI', () => {
  it('lists the ids, and validate level knows the project ids', async () => {
    const project = await b2Project();
    await project.write('scenes/s02_calc.js', level('deer'));
    const check = await runCli(project.root, 'world-assets', 'check');
    expect(check.stdout).toContain('assets/game-b2: 1 file, 1 loaded');
    expect(check.stdout).toMatch(/sprites +oak, pine, deer, ranger/);
    expect(check.code).toBe(0);
    const ok = await runCli(project.root, 'validate', 'level', 'scenes/s02_calc.js');
    expect(ok.code).toBe(0);
    await project.write('scenes/s02_calc.js', level('wolf'));
    const bad = await runCli(project.root, 'validate', 'level', 'scenes/s02_calc.js');
    expect(bad.code).toBe(1);
    expect(bad.stdout).toMatch(/unknown sprite "wolf".*assets\.sprites: oak, pine, deer, ranger/);
  });

  it('reports undefined ids of the scenes and invalid files in validate and check', async () => {
    const project = await b2Project();
    await project.write('scenes/s02_calc.js', level('wolf'));
    await project.write('assets/game-b2/broken.json', '{ "version": 1, ');
    const validate = await runCli(project.root, 'validate', '--json');
    const problems = (JSON.parse(validate.stdout) as { problems: Problem[] }).problems;
    const world = problems.filter((problem) => /^(assets|scenes)\//.test(problem.file));
    expect(world.map((problem) => problem.file)).toEqual([
      'assets/game-b2/broken.json',
      'scenes/s02_calc.js',
    ]);
    expect(world[1]?.message).toContain('asset "wolf" is not defined');
    const check = await runCli(project.root, 'world-assets');
    expect(check.code).toBe(1);
    expect(check.stdout).toContain('2 files, 1 loaded');
    expect(check.stdout).toContain('not valid JSON');
  });

  it('refuses a project that is not a world', async () => {
    const project = await copyFixtureProject();
    projects.push(project);
    const check = await runCli(project.root, 'world-assets', 'check');
    expect(check.code).toBe(1);
    expect(check.stdout).toContain('is not a world');
    const validate = await runCli(project.root, 'validate', '--json');
    const problems = (JSON.parse(validate.stdout) as { problems: Problem[] }).problems;
    expect(problems.some((problem) => problem.file.startsWith('assets/'))).toBe(false);
  });
});
