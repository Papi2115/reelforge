/**
 * `reelforge prop-preview` and scenes using a project prop, through the real engine harness
 * (Playwright Chromium + SwiftShader), on a copy of the fixture project (PLAN.md#7.4).
 */
import { readFileSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { computeFrameStats, decodePng } from '@reelforge/engine/cli';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { copyFixtureProject, runCli, type TempProject } from '../../src/testing/fixture.js';

const FRIDGE = readFileSync(
  path.resolve(import.meta.dirname, '..', '..', '..', 'kit', 'examples', 'kit-ext', 'fridge.js'),
  'utf8',
);

interface PreviewReport {
  readonly sheet: string;
  readonly checks: readonly { id: string; ok: boolean; message: string }[];
  readonly metrics: { size: number[]; floatingParts: string[] } | null;
}

let project: TempProject;

beforeAll(async () => {
  project = await copyFixtureProject();
  await mkdir(path.join(project.root, 'kit-ext', 'props'), { recursive: true });
  await project.write('kit-ext/props/fridge.js', FRIDGE);
});

afterAll(async () => {
  await project.remove();
});

describe('reelforge prop-preview', () => {
  it('renders a turntable sheet of the fridge and passes every check', async () => {
    const run = await runCli(project.root, 'prop-preview', 'fridge', '--json');
    expect(run.stderr).toBe('');
    const report = JSON.parse(run.stdout) as PreviewReport;
    expect(report.checks.filter((check) => !check.ok)).toEqual([]);
    expect(run.code).toBe(0);
    expect(report.metrics?.size[1]).toBeCloseTo(40 / 22, 2);
    const sheet = decodePng(await readFile(report.sheet));
    expect(sheet.width).toBeGreaterThan(1200);
    expect(computeFrameStats(sheet.data).dominantColorShare).toBeLessThan(0.8);
    const text = await runCli(project.root, 'prop-preview', 'fridge', '--angles', '0,180');
    expect(text.stdout).toContain('2 views at 0, 180 deg');
    expect(text.stdout).toMatch(/ok +deterministic/);
  });

  it('fails the floating-part check and reports a prop that does not load', async () => {
    await project.write(
      'kit-ext/props/fridge.js',
      FRIDGE.replace(
        'hinge.position.set(-10 * s, s, 8 * s);',
        'hinge.position.set(-10 * s, 2, 8 * s);',
      ),
    );
    const floating = await runCli(project.root, 'prop-preview', 'fridge');
    expect(floating.code).toBe(1);
    expect(floating.stdout).toMatch(/FAIL {2}floating .*floats at y=/);
    await project.write(
      'kit-ext/props/fridge.js',
      FRIDGE.replace('return Object.assign(fridge, { open });', 'return 42;'),
    );
    const broken = await runCli(project.root, 'prop-preview', 'fridge');
    expect(broken.code).toBe(1);
    expect(broken.stdout).toMatch(/failed to load: .*must return a kit object/);
    await project.write('kit-ext/props/fridge.js', FRIDGE);
  });

  it('lets scenes use the project prop (frames)', async () => {
    await project.edit(
      'scenes/s02_calc.js',
      'export function build(ctx) {',
      'export function build(ctx) {\n  ctx.scene.add(ctx.kit.props.fridge({ scale: 0.5 }));',
    );
    const run = await runCli(project.root, 'frames', '--shot', 's02', '--at', '1');
    expect(run.stdout).toContain('console errors: none');
    expect(run.code).toBe(0);
  });
});
