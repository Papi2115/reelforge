/**
 * `reelforge cast preview` and a scene using a project role, through the real engine harness
 * (Playwright Chromium + SwiftShader), on a copy of the fixture project (PLAN.md#12.20, ADR-026).
 */
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { computeFrameStats, decodePng } from '@reelforge/engine/cli';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { copyFixtureProject, runCli, type TempProject } from '../../src/testing/fixture.js';

const FARMER = {
  id: 'farmer',
  label: 'Farmer',
  description: 'straw hat, dungarees over a pink shirt, boots, pitchfork',
  skin: 'tan',
  hair: { style: 'short', color: 'rust' },
  headgear: 'strawHat',
  top: { color: 'pink' },
  layers: ['overalls'],
  legs: { color: 'teal' },
  shoes: { style: 'boots', color: 'rust' },
  held: 'pitchfork',
};

interface PreviewReport {
  readonly sheet: string;
  readonly checks: readonly { id: string; ok: boolean; message: string }[];
  readonly metrics: { size: number[]; packHeight: number[] } | null;
}

let project: TempProject;

beforeAll(async () => {
  project = await copyFixtureProject();
  await mkdir(path.join(project.root, 'characters', 'roles'), { recursive: true });
  await project.write('characters/roles/farmer.json', `${JSON.stringify(FARMER, null, 2)}\n`);
});

afterAll(async () => {
  await project.remove();
});

describe('reelforge cast preview', () => {
  it('renders a lineup sheet of the role and passes every check', async () => {
    const run = await runCli(project.root, 'cast', 'preview', 'farmer', '--json');
    expect(run.stderr).toBe('');
    const report = JSON.parse(run.stdout) as PreviewReport;
    expect(report.checks.filter((check) => !check.ok)).toEqual([]);
    expect(report.checks.map((check) => check.id)).toEqual([
      'outfit-colors',
      'palette',
      'face',
      'accessories',
      'height',
      'blank',
      'vibe',
      'deterministic',
    ]);
    expect(run.code).toBe(0);
    expect(report.metrics?.size[1]).toBeGreaterThan(1.5);
    // A copy to look at (git-ignored): packages/cli/out/cast-preview-farmer.png.
    const out = path.resolve(import.meta.dirname, '..', '..', 'out');
    await mkdir(out, { recursive: true });
    await copyFile(report.sheet, path.join(out, 'cast-preview-farmer.png'));
    const sheet = decodePng(await readFile(report.sheet));
    expect(sheet.width).toBeGreaterThan(1800);
    expect(computeFrameStats(sheet.data).dominantColorShare).toBeLessThan(0.8);
  });

  it('lets scenes use the project role (frames)', async () => {
    await project.edit(
      'scenes/s02_calc.js',
      'export function build(ctx) {',
      "export function build(ctx) {\n  ctx.scene.add(ctx.kit.cast.person('farmer', { pose: 'wave' }));",
    );
    const run = await runCli(project.root, 'frames', '--shot', 's02', '--at', '1');
    expect(run.stdout).toContain('console errors: none');
    expect(run.code).toBe(0);
  });
});
