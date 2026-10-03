/**
 * Missing props built as project props (PLAN.md#7.4) on fake-claude with the scripted frame
 * renderer (no browser): build → QA → scene rebuilt with the prop, failure → ⚠ and the module
 * moved aside, one build per name for several shots, the per-film budget, storyboard props first,
 * a custom handler instead of the builder. The real-engine flow: test/props-build.test.ts.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { autocommit } from '@reelforge/project';
import type { FakeClaudeScript } from '@reelforge/fake-claude';
import { propsReportSchema, scenesReportSchema, type ShotBuildRecord } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from '../runner.js';
import type { MissingPropsHandler } from '../scenes/tools.js';
import { DEFAULT_SCENE_SETTINGS, DEFAULT_STAGE_SETTINGS } from '../settings.js';
import { FakeClaudeHarness } from '../testing/fake-claude.js';
import {
  CRITIC_OK,
  FRIDGE_PROP,
  buildRule,
  filmShots,
  propRule,
  propSceneSource,
  rebuildRule,
  sceneSource,
  writeFilm,
  type FilmShot,
} from '../testing/film.js';
import { TestProjects, readProject, writeProject } from '../testing/project.js';
import { ScriptedFrameRenderer } from '../testing/scripted-renderer.js';
import { parsePropEntry } from './builder.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

interface Setup {
  readonly count: number;
  readonly script: (shots: readonly FilmShot[]) => FakeClaudeScript;
  readonly maxNewProps?: number;
  readonly onMissingProps?: MissingPropsHandler;
  readonly prepare?: (dir: string) => void;
}

async function setup(name: string, options: Setup) {
  const shots = filmShots(options.count);
  const dir = await projects.create(name);
  writeFilm(dir, shots);
  options.prepare?.(dir);
  expect((await autocommit(dir, 'Storyboard', { kind: 'manual', git: projects.git })).ok).toBe(
    true,
  );
  const harness = new FakeClaudeHarness(options.script(shots), { concurrency: 2 });
  harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
    scenes: { frames: new ScriptedFrameRenderer(), onMissingProps: options.onMissingProps },
    settings: {
      ...DEFAULT_STAGE_SETTINGS,
      scenes: { ...DEFAULT_SCENE_SETTINGS, maxNewProps: options.maxNewProps ?? 12 },
    },
  });
  return { dir, shots, harness, runner };
}

function shotRecords(dir: string): Map<string, ShotBuildRecord> {
  const parsed = scenesReportSchema.parse(
    JSON.parse(readProject(dir, '.reelforge/scenes-report.json')),
  );
  return new Map(parsed.shots.map((entry) => [entry.shotId, entry]));
}

function propsReport(dir: string) {
  return propsReportSchema.parse(JSON.parse(readProject(dir, '.reelforge/props-report.json')));
}

const shot = (shots: readonly FilmShot[], index: number): FilmShot => {
  const found = shots[index];
  if (found === undefined) throw new Error(`no shot ${String(index)}`);
  return found;
};

const promptsOf = (harness: FakeClaudeHarness, needle: string): string[] =>
  harness.specs.map((spec) => spec.prompt).filter((prompt) => prompt.includes(needle));

describe('missing props → project props', { timeout: 120_000 }, () => {
  it('builds the prop, QAs it, commits it and builds the shot again with it (✓)', async () => {
    const { dir, harness, runner } = await setup('prop built', {
      count: 1,
      script: (shots) => ({
        version: 1,
        rules: [
          rebuildRule(shot(shots, 0), propSceneSource(shot(shots, 0), 'fridge')),
          buildRule(shot(shots, 0), sceneSource(shot(shots, 0)), 'Built.\nMISSING: fridge'),
          propRule('fridge', FRIDGE_PROP),
        ],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      }),
    });
    const result = await runner.run({ stage: 'scenes' });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.message).toBe('1 shots: 1 ✓; props built: fridge');
    expect(result.value.metrics).toMatchObject({ builtProps: 1, missingProps: 0 });
    expect(shotRecords(dir).get('s01')).toMatchObject({
      status: 'ok',
      missingProps: [],
      builtProps: ['fridge'],
    });
    expect(readProject(dir, 'scenes/s01.js')).toContain('ctx.kit.props.fridge');
    expect(propsReport(dir).props).toEqual([
      expect.objectContaining({
        name: 'fridge',
        status: 'built',
        attempts: 1,
        shots: ['s01'],
        sheet: '.reelforge/frames/props/fridge/qa-1.png',
      }),
    ]);
    expect(existsSync(path.join(dir, '.reelforge', 'frames', 'props', 'fridge', 'qa-1.png'))).toBe(
      true,
    );
    const rebuild = promptsOf(harness, 'New project props were built for this shot');
    expect(rebuild).toHaveLength(1);
    expect(rebuild[0]).toContain('kit.props.fridge');
    const propSpecs = harness.specs.filter((spec) =>
      spec.prompt.includes('kit-ext/props/fridge.js'),
    );
    expect(propSpecs.map((spec) => [spec.stage, spec.model])).toEqual([['scene-build', 'opus']]);
    expect(promptsOf(harness, '.reelforge/frames/props/fridge/qa-1.png')).toHaveLength(1);
    const subjects = (await projects.history(dir)).map((entry) => entry.subject);
    expect(subjects).toContain('Prop fridge built ✓');
    expect(subjects.indexOf('Prop fridge built ✓')).toBeGreaterThan(
      subjects.indexOf('Scene s01 built ✓'),
    );
  });

  it('fails a prop that stays broken after the fix: module moved aside, shot ⚠ with a fallback', async () => {
    const floating = `// render:floating\n${FRIDGE_PROP}`;
    const { dir, harness, runner } = await setup('prop failed', {
      count: 1,
      script: (shots) => ({
        version: 1,
        rules: [
          buildRule(shot(shots, 0), sceneSource(shot(shots, 0)), 'Built.\nMISSING: fridge'),
          propRule('fridge', floating),
        ],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      }),
    });
    const result = await runner.run({ stage: 'scenes' });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.message).toBe('1 shots: 1 ⚠');
    const record = shotRecords(dir).get('s01');
    expect(record).toMatchObject({ status: 'warning', missingProps: ['fridge'] });
    expect(record?.findings[0]?.message).toMatch(/^missing prop: fridge \(.*could not be built/);
    expect(record?.notes).toEqual(['missing props fridge: built none, could not build fridge']);
    const fixes = promptsOf(harness, 'This is fix 2: the previous version failed QA');
    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toContain('floating: part 2 floats');
    expect(existsSync(path.join(dir, 'kit-ext', 'props', 'fridge.js'))).toBe(false);
    expect(readProject(dir, '.reelforge/props-failed/fridge.js')).toBe(floating);
    expect(propsReport(dir).props[0]).toMatchObject({ status: 'failed', attempts: 2 });
    expect(promptsOf(harness, 'New project props were built')).toEqual([]);
  });

  it('builds a prop once for several shots and normalizes names', async () => {
    const { dir, harness, runner } = await setup('prop shared', {
      count: 2,
      script: (shots) => ({
        version: 1,
        rules: [
          rebuildRule(shot(shots, 0), propSceneSource(shot(shots, 0), 'fileIcon')),
          buildRule(shot(shots, 0), sceneSource(shot(shots, 0)), 'Built.\nMISSING: file-icon'),
          buildRule(shot(shots, 1), propSceneSource(shot(shots, 1), 'fileIcon'), 'Built.'),
          propRule('fileIcon', FRIDGE_PROP.replace("name: 'fridge'", "name: 'fileIcon'")),
        ],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      }),
    });
    // s02 calls kit.props.fileIcon directly (the code check finds it); concurrency 2.
    const result = await runner.run({ stage: 'scenes' });
    if (!result.ok) throw new Error(result.error.message);
    expect(promptsOf(harness, 'Build it as a project prop')).toHaveLength(1);
    expect(propsReport(dir).props.map((entry) => entry.name)).toEqual(['fileIcon']);
    expect([...shotRecords(dir).values()].map((entry) => entry.status)).toEqual(['ok', 'ok']);
  });

  it('respects the per-film budget and a custom handler', async () => {
    const budget = await setup('prop budget', {
      count: 1,
      maxNewProps: 0,
      script: (shots) => ({
        version: 1,
        rules: [buildRule(shot(shots, 0), sceneSource(shot(shots, 0)), 'Built.\nMISSING: fridge')],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      }),
    });
    expect((await budget.runner.run({ stage: 'scenes' })).ok).toBe(true);
    expect(promptsOf(budget.harness, 'Build it as a project prop')).toEqual([]);
    expect(propsReport(budget.dir).props[0]?.findings).toEqual([
      'the limit of 0 new props per film is reached',
    ]);
    const asked: string[][] = [];
    const custom = await setup('prop handler', {
      count: 1,
      onMissingProps: (names) => {
        asked.push([...names]);
        return Promise.resolve({ built: [], failed: [...names] });
      },
      script: (shots) => ({
        version: 1,
        rules: [buildRule(shot(shots, 0), sceneSource(shot(shots, 0)), 'Built.\nMISSING: fridge')],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      }),
    });
    expect((await custom.runner.run({ stage: 'scenes' })).ok).toBe(true);
    expect(asked).toEqual([['fridge']]);
    expect(promptsOf(custom.harness, 'Build it as a project prop')).toEqual([]);
  });

  it('builds the props flagged by the storyboard before the first scene', async () => {
    const { dir, harness, runner } = await setup('storyboard props', {
      count: 1,
      prepare: (dir) => {
        const storyboard = JSON.parse(readProject(dir, 'storyboard.json')) as object;
        writeProject(
          dir,
          'storyboard.json',
          JSON.stringify({ ...storyboard, missingProps: ['Fridge (white kitchen fridge)'] }),
        );
      },
      script: (shots) => ({
        version: 1,
        rules: [
          buildRule(shot(shots, 0), propSceneSource(shot(shots, 0), 'fridge'), 'Built.'),
          propRule('fridge', FRIDGE_PROP),
        ],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      }),
    });
    const result = await runner.run({ stage: 'scenes' });
    if (!result.ok) throw new Error(result.error.message);
    const order = harness.specs.map((spec) =>
      spec.prompt.includes('Build it as a project prop') ? 'prop' : spec.stage,
    );
    expect(order.slice(0, 3)).toEqual(['prop', 'critic', 'scene-build']);
    expect(promptsOf(harness, 'What it must be: Fridge: white kitchen fridge')).toHaveLength(1);
    expect(shotRecords(dir).get('s01')?.status).toBe('ok');
  });
});

describe('parsePropEntry', () => {
  it('splits a storyboard entry into a kit name and a description', () => {
    expect(parsePropEntry('z80Chip (voxel IC package, 40 pins)')).toEqual({
      name: 'z80Chip',
      description: 'z80Chip: voxel IC package, 40 pins',
    });
    expect(parsePropEntry('file-icon')).toEqual({ name: 'fileIcon', description: 'file-icon' });
    expect(parsePropEntry('—')).toBeUndefined();
  });
});
