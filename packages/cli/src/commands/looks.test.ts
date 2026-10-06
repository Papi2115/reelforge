import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { defineLook, listLooks, LOOKS, voxelLook, type Look } from '@reelforge/kit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mainUsage } from '../cli.js';
import { copyFixtureProject, runCli, type TempProject } from '../testing/fixture.js';
import { formatLooks, ROLL_MEANINGS, styleLookSummaries } from './looks.js';

let project: TempProject;

beforeEach(async () => {
  project = await copyFixtureProject();
});

afterEach(async () => {
  await project.remove();
});

describe('reelforge looks', () => {
  it('lists every available look with rolls, sound palette and description', async () => {
    const run = await runCli(project.root, 'looks');
    expect(run.code).toBe(0);
    expect(run.stdout).toContain(`looks (${String(listLooks().length)} available;`);
    const width = Math.max(...listLooks().map((look) => look.id.length));
    for (const look of listLooks()) {
      expect(run.stdout).toContain(
        `  ${look.id.padEnd(width)}  ${look.label}: ${look.description}`,
      );
      expect(run.stdout).toContain(
        `rolls ${look.rolls.join(', ')} · sound palette ${look.soundPalette} · treatments ${look.treatments.join(', ')}`,
      );
    }
    expect(run.stdout).toContain(`  A  ${ROLL_MEANINGS.A}`);
    expect(run.stdout).toContain('reelforge kit-docs');
    expect(run.stdout.trimEnd().endsWith('result: ok')).toBe(true);
    expect(mainUsage()).toMatch(/ {2}looks +the available looks/);
  });

  it("reports the project's look mode (absent = voxel-only, mixed)", async () => {
    expect((await runCli(project.root, 'looks')).stdout).toContain(
      'project look mode: voxel-only (every shot is built in the voxel look',
    );
    await project.edit('project.json', '"fps": 30,', '"fps": 30,\n  "lookMode": "mixed",');
    const json = await runCli(project.root, 'looks', '--json');
    expect(json.code).toBe(0);
    const parsed = JSON.parse(json.stdout) as { lookMode: string; looks: { id: string }[] };
    expect(parsed.lookMode).toBe('mixed');
    expect(parsed.looks.map((look) => look.id)).toEqual(listLooks().map((look) => look.id));
  });

  it('works outside a project and rejects positional arguments', async () => {
    const empty = await mkdtemp(path.join(tmpdir(), 'reelforge looks '));
    try {
      const run = await runCli(empty, 'looks');
      expect(run.code).toBe(0);
      expect(run.stdout).toContain('project look mode: unknown');
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
    expect((await runCli(project.root, 'looks', 'voxel')).code).toBe(2);
  });

  it('formats a single look', () => {
    const lines = formatLooks(
      [
        {
          id: 'voxel',
          label: 'Voxel 3D',
          description: 'blocks',
          rolls: ['A'],
          treatments: ['map'],
          soundPalette: 'voxel',
        },
      ],
      'mixed',
    );
    expect(lines.slice(0, 3)).toEqual([
      'looks (1 available; every look shares the style: palette, pixel fonts, dithering):',
      '  voxel  Voxel 3D: blocks',
      '         rolls A · sound palette voxel · treatments map',
    ]);
    expect(lines).toContain(
      'project look mode: mixed (build each shot in the look its storyboard entry names; absent = voxel)',
    );
  });

  it("lists the built-in looks in every built-in style and only a world's own in its style", () => {
    const world: Look = defineLook({
      ...voxelLook,
      id: 'test-world-page',
      label: 'Test world page',
      description: 'a page of the test world',
      styles: ['test-world'],
      kit: {},
    });
    const looks = [...LOOKS, world];
    const builtIn = styleLookSummaries(undefined);
    expect(builtIn.map((look) => look.id)).toEqual(listLooks().map((look) => look.id));
    for (const style of ['voxel-pixel-crisp640', 'noir-voxel', 'soft-480']) {
      expect(styleLookSummaries(style, looks)).toEqual(builtIn);
    }
    const inWorld = styleLookSummaries('test-world', looks);
    expect(inWorld.map((look) => look.id)).toEqual(['test-world-page']);
    expect(formatLooks(inWorld, 'mixed')).toContain(
      'project look mode: mixed (build each shot in the look its storyboard entry names; absent = test-world-page)',
    );
    expect(formatLooks([], 'mixed')[0]).toBe(
      'looks (0 available; every look shares the style: palette, pixel fonts, dithering):',
    );
  });
});
