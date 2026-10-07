/**
 * World assets through the real engine harness (Playwright Chromium + SwiftShader), PLAN.md#13.15
 * phase 2: in each world a project with a forest film's own asset files (assets/<world>/*.json)
 * gets them as ctx.worldAssets in `reelforge frames` (the scene loads them with the documented
 * one-liner) and `reelforge world-assets sheet` draws every asset into readable contact sheets.
 * Copies for viewing: packages/cli/out/world-assets/<world>-*.png.
 */
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { computeFrameStats, decodePng } from '@reelforge/engine/cli';
import { WORLD_ASSET_WORLDS, type WorldAssetWorld } from '@reelforge/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { copyFixtureProject, runCli, type TempProject } from '../../src/testing/fixture.js';
import { FOREST_ASSETS, forestScene } from '../../src/testing/world-assets.js';

const OUT = path.resolve(import.meta.dirname, '..', '..', 'out', 'world-assets');
const projects: TempProject[] = [];

afterAll(async () => {
  await Promise.all(projects.map((project) => project.remove()));
});

async function worldProject(world: WorldAssetWorld): Promise<TempProject> {
  const project = await copyFixtureProject();
  projects.push(project);
  await project.edit('project.json', '"voxel-pixel-crisp640"', `"${world}"`);
  await mkdir(path.join(project.root, 'assets', world), { recursive: true });
  for (const [file, text] of Object.entries(FOREST_ASSETS[world])) await project.write(file, text);
  await project.write('scenes/s02_calc.js', forestScene(world, 's02'));
  return project;
}

interface FramesReport {
  readonly frames: readonly { file: string }[];
  readonly issues: readonly unknown[];
}

interface SheetReport {
  readonly sheets: readonly string[];
  readonly failures: readonly string[];
}

describe.each(WORLD_ASSET_WORLDS)('world assets of %s', { timeout: 300_000 }, (world) => {
  it('reach the scene as ctx.worldAssets and draw into contact sheets', async () => {
    const project = await worldProject(world);
    await mkdir(OUT, { recursive: true });
    const check = await runCli(project.root, 'world-assets', 'check');
    expect(check.stdout).toContain('0 errors');
    expect(check.code).toBe(0);

    const frames = await runCli(project.root, 'frames', '--shot', 's02', '--at', '4.5', '--json');
    expect(frames.stderr).toBe('');
    const report = JSON.parse(frames.stdout) as FramesReport;
    expect(report.issues).toEqual([]);
    const file = report.frames[0]?.file ?? '';
    await copyFile(file, path.join(OUT, `${world}-scene.png`));
    const stats = computeFrameStats(decodePng(await readFile(file)).data);
    expect(stats.dominantColorShare).toBeLessThan(0.97);

    const sheet = await runCli(project.root, 'world-assets', 'sheet', '--json');
    const sheets = JSON.parse(sheet.stdout) as SheetReport;
    expect(sheets.failures).toEqual([]);
    expect(sheet.code).toBe(0);
    expect(sheets.sheets.length).toBeGreaterThan(0);
    for (const [index, png] of sheets.sheets.entries()) {
      const image = decodePng(await readFile(png));
      expect(computeFrameStats(image.data).dominantColorShare).toBeLessThan(0.9);
      await copyFile(png, path.join(OUT, `${world}-sheet-${String(index + 1)}.png`));
    }
  });
});
