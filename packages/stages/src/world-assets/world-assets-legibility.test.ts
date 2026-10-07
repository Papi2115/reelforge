/**
 * Per-asset QA of the world-assets step on fake-claude (PLAN.md#13.15 follow-ups from the real
 * runs Game B2 2 / Game B1 2 / Comic 2): each asset is cropped alone at film size, the blind critic
 * names each crop (never told the names) and a crop that does not read as its asset goes to the
 * fix turn; a person the narration never names is a finding; the design turn's sheet rounds over
 * the allowed 2 are reported.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { autocommit } from '@reelforge/project';
import { worldAssetsReportSchema } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from '../runner.js';
import { DEFAULT_STAGE_SETTINGS } from '../settings.js';
import { FakeClaudeHarness, writes } from '../testing/fake-claude.js';
import { filmShots, writeFilm } from '../testing/film.js';
import { readProject, TestProjects, writeProject } from '../testing/project.js';
import { ScriptedFrameRenderer } from '../testing/scripted-renderer.js';
import { FOREST_FILES, forestCast } from '../testing/world-films.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const DESIGN = 'production designer';
const CRITIC = 'labelled with codes only';

async function forestFilm(name: string, script: string): Promise<string> {
  const dir = await projects.create(name, [], { style: 'game-b2' });
  writeFilm(dir, filmShots(2));
  writeProject(dir, 'script.txt', script);
  expect((await autocommit(dir, 'Storyboard', { kind: 'manual', git: projects.git })).ok).toBe(
    true,
  );
  return dir;
}

function run(dir: string, harness: FakeClaudeHarness) {
  harnesses.push(harness);
  return new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
    settings: { ...DEFAULT_STAGE_SETTINGS, experimentalWorlds: true },
    scenes: { frames: new ScriptedFrameRenderer() },
  }).run({ stage: 'scenes', action: 'world-assets' });
}

const verdict = (tile: string, sees: string, legible = true) => ({
  tile,
  sees,
  legible,
  style: 'ok',
  note: legible ? 'reads' : 'no defining shape',
});

describe('world assets: per-asset legibility and invented people', { timeout: 180_000 }, () => {
  it('names each crop blind and sends the ones that do not read to the fix turn', async () => {
    const dir = await forestFilm('legible', 'The park ranger walks under the oak on the moss.');
    const harness = new FakeClaudeHarness({
      version: 1,
      rules: [
        {
          ...writes({
            ...FOREST_FILES['game-b2'],
            'assets/cast.json': forestCast('game-b2', ['s01']),
          }),
          promptIncludes: DESIGN,
        },
        {
          scenario: 'tools-write',
          promptIncludes: CRITIC,
          reply: JSON.stringify({
            assets: [
              verdict('A1', 'a man in a top hat'),
              verdict('A2', 'a red blob'),
              verdict('A3', 'a green smudge', false),
            ],
          }),
        },
      ],
      default: { scenario: 'tools-write', reply: 'Done.' },
    });
    const done = await run(dir, harness);
    if (!done.ok) throw new Error(JSON.stringify(done.error));

    const critic = harness.specs.find((spec) => spec.prompt.includes(CRITIC));
    expect(critic?.stage).toBe('critic');
    expect(critic?.prompt).toContain('.reelforge/frames/world-assets/crops-A.png: A1, A2, A3');
    // Blind: the critic is never told what the things are.
    expect(critic?.prompt).not.toMatch(/ranger|oak|moss|park/);
    expect(existsSync(path.join(dir, '.reelforge', 'frames', 'world-assets', 'crops-A.png'))).toBe(
      true,
    );

    const turns = harness.specs.filter((spec) => spec.prompt.includes(DESIGN));
    expect(turns).toHaveLength(2);
    const fix = turns[1]?.prompt ?? '';
    expect(fix).toContain(
      'oak does not read as itself at film size (.reelforge/frames/world-assets/crops-A.png tile A2): the critic sees "a red blob"',
    );
    expect(fix).toContain('moss is not legible at film size');
    expect(fix).not.toContain('ranger (');
    const report = worldAssetsReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/world-assets.json')),
    );
    expect(report).toMatchObject({ status: 'warning', attempts: 2 });
  });

  it('flags a person the narration never names and reports sheet rounds over two', async () => {
    const dir = await forestFilm('invented', 'The old oak stands on the moss for centuries.');
    const rounds = JSON.stringify({ version: 1, startedAt: '2026-10-07T12:00:00.000Z', rounds: 5 });
    const harness = new FakeClaudeHarness({
      version: 1,
      rules: [
        {
          ...writes({
            ...FOREST_FILES['game-b2'],
            'assets/cast.json': forestCast('game-b2', ['s01']),
            // The CLI's counter as a turn with 5 `world-assets sheet` runs leaves it.
            '.reelforge/world-assets-rounds.json': rounds,
          }),
          promptIncludes: DESIGN,
        },
      ],
      default: { scenario: 'tools-write', reply: 'Done.' },
    });
    const done = await run(dir, harness);
    if (!done.ok) throw new Error(JSON.stringify(done.error));
    const turns = harness.specs.filter((spec) => spec.prompt.includes(DESIGN));
    expect(turns[0]?.prompt).toContain('`reelforge kit-docs generators`');
    expect(turns[0]?.prompt).toContain('Never invent a keeper');
    expect(turns[1]?.prompt).toContain(
      'ranger ("the park ranger") is a person the narration never mentions (script.txt names no "ranger")',
    );
    expect(done.value.warnings).toEqual(
      expect.arrayContaining([
        'world-assets turn 1 ran 5 sheet rounds (the prompt allows 2)',
        "the world-assets critic's reply was not valid JSON",
      ]),
    );
  });
});
