/** Project roles in the CLI without a browser: cast list/check, manifests, kit-docs, lineup checks. */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { lintScene } from '@reelforge/engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readProjectFiles } from '../project/files.js';
import { isolatedManifest, renderSetup, type ShotPlan } from '../project/shots.js';
import { copyFixtureProject, runCli, type TempProject } from '../testing/fixture.js';
import { lineupChecks, parseRoleMetrics } from './checks.js';
import { LINEUP_VIEWS, lineupSource, lineupTimes, ROLE_METRICS_CUE } from './lineup.js';

/** The kit's example role (cast-presets.ts EXAMPLE_ROLES). */
const FIREFIGHTER = {
  id: 'firefighter',
  label: 'Firefighter',
  description: 'helmet with a shield, turnout coat with reflective bands, air tank, axe',
  skin: 'tan',
  hair: { style: 'cropped', color: 'darkSlate' },
  headgear: { id: 'fireHelmet', color: 'burntOrange', trim: 'lightOrange' },
  top: { color: 'tan' },
  layers: [{ id: 'turnoutCoat', color: 'tan', trim: 'green' }],
  legs: { color: 'tan' },
  shoes: { style: 'boots', color: 'black' },
  accessories: ['airTank'],
  held: 'axe',
};

const RADIO = {
  id: 'shoulderRadio',
  description: 'radio clipped to the shoulder with an antenna',
  slot: 'torso',
  colors: { color: 'black', trim: 'slateGrey' },
  boxes: [
    { color: 'color', at: [2, 5, 2], size: [1.4, 1.8, 0.8] },
    { color: 'trim', at: [2.4, 6.8, 2], size: [0.3, 1.6, 0.3] },
  ],
};

const PLAN: ShotPlan = {
  id: 's01',
  t0: 0,
  t1: 1,
  file: 'scenes/s01_title.js',
  source: 'x',
  standalone: false,
};

let project: TempProject;

beforeEach(async () => {
  project = await copyFixtureProject();
});

afterEach(async () => {
  await project.remove();
});

async function write(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(path.join(project.root, file)), { recursive: true });
  await project.write(file, text);
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

describe('reelforge cast', () => {
  it('lists the pack and the project roles, and reports invalid files', async () => {
    await write('characters/roles/firefighter.json', json(FIREFIGHTER));
    await write('characters/roles/chef.json', '{ "id": "chef" ');
    await write('characters/accessories/shoulderRadio.json', json(RADIO));
    const run = await runCli(project.root, 'cast', 'list');
    expect(run.code).toBe(1);
    expect(run.stdout).toContain('  mascot    bulb — ');
    expect(run.stdout).toContain('  person    engineer — ');
    expect(run.stdout).toMatch(/ {2}role {6}firefighter — Firefighter: helmet with a shield/);
    expect(run.stdout).toContain('  shoulderRadio (torso) — radio clipped to the shoulder');
    expect(run.stdout).toMatch(/characters\/roles\/chef\.json:\n {4}not valid JSON/);
  });

  it('checks a role file with "did you mean" errors, then its spec checks', async () => {
    const typo = { ...FIREFIGHTER, headgear: 'firehelmet', held: 'axes' };
    await write('characters/roles/firefighter.json', json(typo));
    const bad = await runCli(project.root, 'cast', 'check', 'characters/roles/firefighter.json');
    expect(bad.code).toBe(1);
    expect(bad.stdout).toContain(
      'headgear: "firehelmet" is not in the vocabulary (did you mean "fireHelmet"?)',
    );
    expect(bad.stdout).toContain('held: "axes" is not in the vocabulary (did you mean "axe"?)');
    await write('characters/roles/firefighter.json', json(FIREFIGHTER));
    const good = await runCli(project.root, 'cast', 'check', 'characters/roles/firefighter.json');
    expect(good.code).toBe(0);
    expect(good.stdout).toMatch(
      /ok {4}outfit-colors {2}outfit colours: tan, green, burntOrange, lightOrange/,
    );
    expect(good.stdout).toContain('attached: airTank (kit), axe (kit, hand)');
  });

  it('checks accessories and lets roles use them', async () => {
    await write('characters/accessories/shoulderRadio.json', json(RADIO));
    const accessory = await runCli(
      project.root,
      'cast',
      'check',
      'characters/accessories/shoulderRadio.json',
    );
    expect(accessory.stdout).toContain('ok  slot torso, 2 boxes');
    const officer = {
      ...FIREFIGHTER,
      id: 'officer',
      label: 'Officer',
      accessories: ['shoulderRadio'],
    };
    await write('characters/roles/officer.json', json(officer));
    const role = await runCli(project.root, 'cast', 'check', 'characters/roles/officer.json');
    expect(role.stdout).toContain('shoulderRadio (project, torso)');
    const floating = { ...RADIO, boxes: [{ color: 'color', at: [0, 9, 4.5], size: [1, 1, 0.4] }] };
    await write('characters/accessories/shoulderRadio.json', json(floating));
    const again = await runCli(
      project.root,
      'cast',
      'check',
      'characters/accessories/shoulderRadio.json',
    );
    expect(again.code).toBe(1);
    expect(again.stdout).toContain('the box floats');
  });

  it('answers usage errors and a missing role', async () => {
    expect((await runCli(project.root, 'cast')).code).toBe(2);
    expect((await runCli(project.root, 'cast', 'check')).code).toBe(2);
    const missing = await runCli(project.root, 'cast', 'preview', 'pilot');
    expect(missing.code).toBe(1);
    expect(missing.stdout).toContain('characters/roles/pilot.json does not exist');
  });

  it('documents the project roles in kit-docs characters', async () => {
    await write('characters/roles/firefighter.json', json(FIREFIGHTER));
    const docs = await runCli(project.root, 'kit-docs', 'characters');
    expect(docs.stdout).toContain('project roles (characters/roles/<id>.json');
    expect(docs.stdout).toContain('  firefighter — Firefighter: helmet with a shield');
  });
});

describe('render manifests with project roles', () => {
  it('inlines the role files; without any the manifest is byte-identical to before', async () => {
    const before = JSON.stringify(
      isolatedManifest(renderSetup(await readProjectFiles(project.root)), PLAN),
    );
    expect(before).not.toContain('castRoles');
    await write('characters/roles/firefighter.json', json(FIREFIGHTER));
    await write('characters/accessories/shoulderRadio.json', json(RADIO));
    const manifest = isolatedManifest(renderSetup(await readProjectFiles(project.root)), PLAN);
    expect(manifest.castRoles).toEqual({
      roles: [
        { id: 'firefighter', file: 'characters/roles/firefighter.json', source: json(FIREFIGHTER) },
      ],
      accessories: [
        {
          id: 'shoulderRadio',
          file: 'characters/accessories/shoulderRadio.json',
          source: json(RADIO),
        },
      ],
    });
    const { castRoles, ...rest } = manifest;
    expect(castRoles).toBeDefined();
    expect(JSON.stringify(rest)).toBe(before);
  });
});

describe('role lineup', () => {
  it('generates a lint-clean scene with 6 views and a repeat', () => {
    expect(lintScene(lineupSource('firefighter'), { filename: 'lineup.js' })).toEqual([]);
    expect(lineupTimes()).toEqual([0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5]);
    expect(LINEUP_VIEWS.map((view) => view.pose)).toEqual([
      'calm',
      'calm',
      'calm',
      'calm',
      'wave',
      'point',
    ]);
  });

  it('checks the height against the pack, blank views and determinism', () => {
    const size = 8;
    const image = (seed: number) => ({
      width: size,
      height: size,
      data: Uint8Array.from({ length: size * size * 4 }, (_, index) =>
        index % 4 === 3 ? 255 : (index * 37 + seed) % 256,
      ),
    });
    const frames = lineupTimes().map((t) => ({ t, image: image(t === 6.5 ? 0.5 : t) }));
    const cue = (height: number) => [
      {
        name: `${ROLE_METRICS_CUE}${JSON.stringify({ size: [0.8, height, 0.6], packHeight: [1.4, 1.8] })}`,
      },
    ];
    expect(parseRoleMetrics(cue(1.7))?.packHeight).toEqual([1.4, 1.8]);
    const ok = lineupChecks({ frames, cues: cue(1.7) });
    expect(ok.map((check) => [check.id, check.ok])).toEqual([
      ['height', true],
      ['blank', true],
      ['deterministic', true],
    ]);
    const tall = lineupChecks({ frames, cues: cue(2.4) });
    expect(tall[0]).toMatchObject({ id: 'height', ok: false });
    expect(tall[0]?.message).toMatch(/2\.40 units tall, outside the pack's 1\.19-2\.07/);
    const broken = lineupChecks({ frames: frames.slice(0, 6), cues: [] });
    expect(broken.map((check) => check.ok)).toEqual([false, true, false]);
  });
});
