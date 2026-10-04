import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { listLooks } from '@reelforge/kit';
import type { ProjectFile } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ProjectSettings } from '../shared/project-settings-contract.js';
import { createLogger } from './logger.js';
import { lookSummaries } from './project-settings-ipc.js';
import {
  applyProjectSettingsPatch,
  describeSettingsChange,
  effectiveProjectSettings,
  ProjectSettingsService,
} from './project-settings-service.js';

const BASE_PROJECT: ProjectFile = {
  version: 1,
  title: 'Mój film',
  language: 'en',
  style: 'voxel-pixel-crisp640',
  fps: 30,
  seed: 2115,
};
const LOOKS = [{ id: 'voxel', label: 'Voxel 3D', description: 'The classic look.' }];

let root: string;
let dir: string | undefined;
let commits: string[];
let commitResult: boolean;
let service: ProjectSettingsService;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'reelforge project settings ż-'));
  dir = root;
  commits = [];
  commitResult = true;
  service = new ProjectSettingsService({
    projectDir: () => dir,
    commit: (message) => {
      commits.push(message);
      return Promise.resolve(commitResult);
    },
    looks: () => LOOKS,
    log: createLogger(() => undefined),
  });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true, maxRetries: 5 });
});

async function writeProject(value: unknown): Promise<void> {
  await writeFile(path.join(root, 'project.json'), JSON.stringify(value, null, 2));
}

async function readProject(): Promise<unknown> {
  return JSON.parse(await readFile(path.join(root, 'project.json'), 'utf8'));
}

describe('effectiveProjectSettings', () => {
  it('fills in the defaults of fields project.json does not have', () => {
    expect(effectiveProjectSettings(BASE_PROJECT)).toEqual({
      lookMode: 'voxel-only',
      ambientVariation: false,
      researchMode: 'off',
      researchSources: [],
      tensionMap: 'off',
      patternInterrupts: 'off',
      openLoops: 'off',
      revealMoments: 'off',
      beatSync: 'off',
      repetitionControl: 'off',
      characters: 'classic',
      mascot: 'none',
      shotsPerMinute: null,
      fasterChecks: false,
    });
    expect(
      effectiveProjectSettings({
        ...BASE_PROJECT,
        lookMode: 'mixed',
        ambientVariation: true,
      }),
    ).toEqual({
      lookMode: 'mixed',
      ambientVariation: true,
      researchMode: 'off',
      researchSources: [],
      tensionMap: 'off',
      patternInterrupts: 'off',
      openLoops: 'off',
      revealMoments: 'off',
      beatSync: 'off',
      repetitionControl: 'off',
      characters: 'classic',
      mascot: 'none',
      shotsPerMinute: null,
      fasterChecks: false,
    });
  });
});

describe('applyProjectSettingsPatch', () => {
  it('sets only the defined fields and keeps unknown keys and key order', () => {
    const raw = { version: 1, title: 'x', custom: { keep: true } };
    const next = applyProjectSettingsPatch(raw, { ambientVariation: true });
    expect(next).toEqual({
      version: 1,
      title: 'x',
      custom: { keep: true },
      ambientVariation: true,
    });
    expect(Object.keys(next)).toEqual(['version', 'title', 'custom', 'ambientVariation']);
    expect(applyProjectSettingsPatch(raw, { tensionMap: 'auto' })).toMatchObject({
      tensionMap: 'auto',
    });
    expect(raw).not.toHaveProperty('ambientVariation');
  });
});

describe('describeSettingsChange', () => {
  it('names every changed setting', () => {
    const before: ProjectSettings = {
      lookMode: 'voxel-only',
      ambientVariation: false,
      researchMode: 'off',
      researchSources: [],
      tensionMap: 'off',
      patternInterrupts: 'off',
      openLoops: 'off',
      revealMoments: 'off',
      beatSync: 'off',
      repetitionControl: 'off',
      characters: 'classic',
      mascot: 'none',
      shotsPerMinute: null,
      fasterChecks: false,
    };
    expect(
      describeSettingsChange(before, { ...before, lookMode: 'mixed', ambientVariation: true }),
    ).toBe('Project settings: look mode mixed looks, ambient variation on');
    expect(describeSettingsChange(before, { ...before, ambientVariation: true })).toBe(
      'Project settings: ambient variation on',
    );
    expect(describeSettingsChange(before, before)).toBe('Project settings: no change');
    expect(
      describeSettingsChange(before, {
        ...before,
        researchMode: 'allowlist',
        researchSources: ['wikimedia', 'nasa'],
      }),
    ).toBe(
      'Project settings: research assets auto from selected sources, research sources wikimedia, nasa',
    );
    expect(describeSettingsChange(before, { ...before, researchMode: 'full-auto' })).toBe(
      'Project settings: research assets full auto (unverified licences)',
    );
    expect(describeSettingsChange(before, { ...before, tensionMap: 'auto' })).toBe(
      'Project settings: tension map on',
    );
    expect(
      describeSettingsChange(before, {
        ...before,
        patternInterrupts: 'auto',
        revealMoments: 'auto',
        beatSync: 'off',
        repetitionControl: 'off',
        characters: 'classic',
        mascot: 'none',
        shotsPerMinute: null,
        fasterChecks: false,
      }),
    ).toBe('Project settings: pattern interrupts on, reveal moments on');
    expect(
      describeSettingsChange(before, { ...before, beatSync: 'auto', repetitionControl: 'auto' }),
    ).toBe('Project settings: beat sync on, repetition control on');
    expect(applyProjectSettingsPatch({ version: 1 }, { beatSync: 'auto' })).toEqual({
      version: 1,
      beatSync: 'auto',
    });
    expect(applyProjectSettingsPatch({ version: 1 }, { openLoops: 'auto' })).toEqual({
      version: 1,
      openLoops: 'auto',
    });
  });

  it('sets and removes the scenes per minute and faster checks (ADR-027)', () => {
    const set = applyProjectSettingsPatch(
      { version: 1 },
      { shotsPerMinute: { min: 3, max: 5 }, fasterChecks: true },
    );
    expect(set).toEqual({ version: 1, shotsPerMinute: { min: 3, max: 5 }, fasterChecks: true });
    expect(applyProjectSettingsPatch(set, { shotsPerMinute: null, fasterChecks: false })).toEqual({
      version: 1,
    });
    const before = effectiveProjectSettings(BASE_PROJECT);
    expect(before).toMatchObject({ shotsPerMinute: null, fasterChecks: false });
    expect(
      describeSettingsChange(before, {
        ...before,
        shotsPerMinute: { min: 4, max: 6.5 },
        fasterChecks: true,
      }),
    ).toBe('Project settings: scenes per minute 4–6.5, faster checks on');
    const calm = { ...before, shotsPerMinute: { min: 3, max: 5 } };
    expect(describeSettingsChange(calm, before)).toBe(
      'Project settings: scenes per minute no limit',
    );
  });
});

describe('ProjectSettingsService', () => {
  it('reads the effective settings and the available looks', async () => {
    await writeProject({ ...BASE_PROJECT, lookMode: 'mixed' });
    await expect(service.get()).resolves.toEqual({
      status: 'ok',
      settings: {
        lookMode: 'mixed',
        ambientVariation: false,
        researchMode: 'off',
        researchSources: [],
        tensionMap: 'off',
        patternInterrupts: 'off',
        openLoops: 'off',
        revealMoments: 'off',
        beatSync: 'off',
        repetitionControl: 'off',
        characters: 'classic',
        mascot: 'none',
        shotsPerMinute: null,
        fasterChecks: false,
      },
      looks: LOOKS,
    });
  });

  it('writes a patch into project.json and commits it', async () => {
    await writeProject({ ...BASE_PROJECT, extra: 'kept' });
    await expect(service.update({ lookMode: 'mixed', ambientVariation: true })).resolves.toEqual({
      status: 'ok',
      settings: {
        lookMode: 'mixed',
        ambientVariation: true,
        researchMode: 'off',
        researchSources: [],
        tensionMap: 'off',
        patternInterrupts: 'off',
        openLoops: 'off',
        revealMoments: 'off',
        beatSync: 'off',
        repetitionControl: 'off',
        characters: 'classic',
        mascot: 'none',
        shotsPerMinute: null,
        fasterChecks: false,
      },
      committed: true,
    });
    expect(await readProject()).toEqual({
      ...BASE_PROJECT,
      extra: 'kept',
      lookMode: 'mixed',
      ambientVariation: true,
    });
    expect(commits).toEqual(['Project settings: look mode mixed looks, ambient variation on']);
    // A second change goes on top of the first one.
    await service.update({ lookMode: 'voxel-only' });
    expect(await readProject()).toMatchObject({ lookMode: 'voxel-only', ambientVariation: true });
    expect(commits.at(-1)).toBe('Project settings: look mode voxel only');
  });

  it('does not write or commit a patch that changes nothing', async () => {
    await writeProject(BASE_PROJECT);
    const before = await readFile(path.join(root, 'project.json'), 'utf8');
    await expect(service.update({ lookMode: 'voxel-only' })).resolves.toEqual({
      status: 'ok',
      settings: {
        lookMode: 'voxel-only',
        ambientVariation: false,
        researchMode: 'off',
        researchSources: [],
        tensionMap: 'off',
        patternInterrupts: 'off',
        openLoops: 'off',
        revealMoments: 'off',
        beatSync: 'off',
        repetitionControl: 'off',
        characters: 'classic',
        mascot: 'none',
        shotsPerMinute: null,
        fasterChecks: false,
      },
      committed: false,
    });
    expect(await readFile(path.join(root, 'project.json'), 'utf8')).toBe(before);
    expect(commits).toEqual([]);
  });

  it('writes the research mode and the allowlist sources (PLAN.md#12.10)', async () => {
    await writeProject(BASE_PROJECT);
    await expect(
      service.update({ researchMode: 'allowlist', researchSources: ['nasa', 'loc'] }),
    ).resolves.toMatchObject({
      status: 'ok',
      settings: { researchMode: 'allowlist', researchSources: ['nasa', 'loc'] },
      committed: true,
    });
    expect(await readProject()).toMatchObject({
      researchMode: 'allowlist',
      researchSources: ['nasa', 'loc'],
    });
    await service.update({ researchMode: 'off' });
    expect(await readProject()).toMatchObject({ researchMode: 'off' });
    expect(commits.at(-1)).toBe('Project settings: research assets off');
  });

  it('writes the characters and the mascot (PLAN.md#12.20)', async () => {
    await writeProject(BASE_PROJECT);
    await service.update({ characters: 'pack' });
    await expect(service.update({ mascot: 'fox' })).resolves.toMatchObject({
      status: 'ok',
      settings: { characters: 'pack', mascot: 'fox' },
      committed: true,
    });
    expect(await readProject()).toMatchObject({ characters: 'pack', mascot: 'fox' });
    // Back to classic keeps the chosen mascot stored (in effect only with the pack).
    await service.update({ characters: 'classic' });
    expect(await readProject()).toMatchObject({ characters: 'classic', mascot: 'fox' });
    expect(commits).toEqual([
      'Project settings: characters pack style',
      'Project settings: mascot Fox',
      'Project settings: characters classic',
    ]);
    await service.update({ mascot: 'none' });
    expect(commits.at(-1)).toBe('Project settings: mascot none');
  });

  it('reports a failed commit but keeps the saved file', async () => {
    await writeProject(BASE_PROJECT);
    commitResult = false;
    await expect(service.update({ ambientVariation: true })).resolves.toMatchObject({
      status: 'ok',
      committed: false,
    });
    expect(await readProject()).toMatchObject({ ambientVariation: true });
  });

  it('runs patches one at a time in arrival order', async () => {
    await writeProject(BASE_PROJECT);
    await Promise.all([
      service.update({ ambientVariation: true }),
      service.update({ lookMode: 'mixed' }),
      service.update({ ambientVariation: false }),
    ]);
    expect(await readProject()).toMatchObject({ lookMode: 'mixed', ambientVariation: false });
    expect(commits).toEqual([
      'Project settings: ambient variation on',
      'Project settings: look mode mixed looks',
      'Project settings: ambient variation off',
    ]);
  });

  it('refuses to touch a damaged or missing project.json', async () => {
    await expect(service.update({ ambientVariation: true })).resolves.toEqual({
      status: 'error',
      message: 'project.json is missing',
    });
    await writeFile(path.join(root, 'project.json'), '{ not json');
    await expect(service.get()).resolves.toMatchObject({
      status: 'error',
      message: expect.stringContaining('not valid JSON') as unknown,
    });
    await writeProject({ ...BASE_PROJECT, fps: 0 });
    await expect(service.update({ ambientVariation: true })).resolves.toMatchObject({
      status: 'error',
      message: expect.stringContaining('fps') as unknown,
    });
    await writeProject([BASE_PROJECT]);
    await expect(service.get()).resolves.toEqual({
      status: 'error',
      message: 'project.json is not a JSON object',
    });
    expect(commits).toEqual([]);
  });

  it('answers with an error when no project is open', async () => {
    dir = undefined;
    await expect(service.get()).resolves.toEqual({
      status: 'error',
      message: 'no project is open',
    });
    await expect(service.update({ lookMode: 'mixed' })).resolves.toEqual({
      status: 'error',
      message: 'no project is open',
    });
  });
});

describe('lookSummaries', () => {
  it('lists the available looks of the kit registry, voxel first', () => {
    const summaries = lookSummaries();
    expect(summaries.map((look) => look.id)).toEqual(listLooks().map((look) => look.id));
    expect(summaries[0]?.id).toBe('voxel');
    for (const look of summaries) expect(Object.keys(look)).toEqual(['id', 'label', 'description']);
  });
});
