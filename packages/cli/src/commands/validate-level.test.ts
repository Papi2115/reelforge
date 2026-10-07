/**
 * `reelforge validate level` (PLAN.md#13.4 part c): the Game B2 levels a scene writes are read
 * from its source and checked with the kit's level format; a good level passes, a bad one names
 * the grid row or field; level JSON files, built-in names, computed levels and the kit's own
 * Game B2 templates (0 errors on every one).
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { levelsInScene } from '../project/level-source.js';
import { copyFixtureProject, runCli, type TempProject } from '../testing/fixture.js';

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', '..', 'kit', 'examples', 'game-b2');
const example = (name: string): string => readFileSync(path.join(EXAMPLES, name), 'utf8');

let project: TempProject;

beforeEach(async () => {
  project = await copyFixtureProject();
});

afterEach(async () => {
  await project.remove();
});

const RETURNS = example('a3_returns.js');

describe('reelforge validate level', () => {
  it('passes a good level and says what it has', async () => {
    await project.write('scenes/s03_returns.js', RETURNS);
    const run = await runCli(project.root, 'validate', 'level', 'scenes/s03_returns.js');
    expect(run.code).toBe(0);
    expect(run.stdout).toContain(
      'ok      scenes/s03_returns.js:15 level "returns": 13x12 grid, 2 lights, 3 sprites',
    );
    expect(run.stdout).toContain('0 errors, 0 warnings');
    expect(run.stdout).toContain('result: ok');
  });

  it('names the grid row and the field of every error of a bad level', async () => {
    const bad = RETURNS.replace("'##.........##',", "'##..x......##',")
      .replace("'#############',\n  ],", "'#############.',\n  ],")
      .replace("{ id: 'clerk', sprite: 'clerk', pos: [6.45, 3.45] }", "{ id: 'clerk', sprite: 'clerk', pos: [0.5, 0.5] }")
      .replace("label: 'RETURNS' }", "label: 'RETURNS DESK' }"); // prettier-ignore
    await project.write('scenes/s03_returns.js', bad);
    const run = await runCli(project.root, 'validate', 'level', 'scenes/s03_returns.js');
    expect(run.code).toBe(1);
    expect(run.stdout).toContain('error   scenes/s03_returns.js:15 level "returns"');
    expect(run.stdout).toContain('  - grid row 1: "x" at x=4 is not in the legend');
    expect(run.stdout).toContain('  - grid row 11: 14 cells, expected 13 like row 0');
    expect(run.stdout).toContain(
      '  - sprites[0] (clerk): pos [0.5, 0.5] is inside a wall cell; move it into an open cell',
    );
    expect(run.stdout).toMatch(/sprites\[1\]\.label: "RETURNS DESK" .*shorten it/);
    expect(run.stdout).toContain(
      'result: 1 problem found; fix the level and run reelforge validate level scenes/s03_returns.js again',
    );
  });

  it('checks a level JSON file and reports bad JSON', async () => {
    const level = {
      name: 'pit',
      grid: ['#####', '#...#', '#.#.#', '#####'],
      legend: { '#': { wall: 'concrete' } },
    };
    await project.write('pit.json', JSON.stringify(level));
    const good = await runCli(project.root, 'validate', 'level', 'pit.json', '--json');
    expect(good.code).toBe(0);
    expect(JSON.parse(good.stdout)).toMatchObject({
      file: 'pit.json',
      errors: 0,
      levels: [
        { severity: 'ok', level: 'level "pit"', messages: ['5x4 grid, 0 lights, 0 sprites'] },
      ],
    });
    await project.write(
      'pit.json',
      JSON.stringify({ ...level, grid: ['#####', '#....', '#####'] }),
    );
    const open = await runCli(project.root, 'validate', 'level', 'pit.json');
    expect(open.code).toBe(1);
    expect(open.stdout).toContain(
      'grid row 1: cell x=4 is on the border and must be a wall (close the level)',
    );
    await project.write('pit.json', '{ "name": ');
    expect((await runCli(project.root, 'validate', 'level', 'pit.json')).code).toBe(1);
  });

  it('knows the built-in levels and warns about a level built at run time', async () => {
    await project.write(
      'scenes/s01_corridor.js',
      "export function build(ctx) { ctx.kit.fx.b2View({ level: 'office', path: [] }); ctx.kit.fx.b2View({ level: 'castle', path: [] }); }",
    );
    const builtIn = await runCli(project.root, 'validate', 'level', 'scenes/s01_corridor.js');
    expect(builtIn.code).toBe(1);
    expect(builtIn.stdout).toContain('ok      scenes/s01_corridor.js:1 built-in level "office"');
    expect(builtIn.stdout).toContain('unknown; the built-in levels are office, warehouse');
    await project.write(
      'scenes/s01_corridor.js',
      "const ROWS = 5;\nconst LEVEL = { name: 'hall', grid: Array.from({ length: ROWS }, () => '#####'), legend: {} };\n",
    );
    const computed = await runCli(project.root, 'validate', 'level', 'scenes/s01_corridor.js');
    expect(computed.code).toBe(0);
    expect(computed.stdout).toContain('warning scenes/s01_corridor.js:2 a level');
    expect(computed.stdout).toContain('a CallExpression is computed when the scene runs');
  });

  it('says when a scene has no level, and refuses files outside the project', async () => {
    const none = await runCli(project.root, 'validate', 'level', 'scenes/s01_title.js');
    expect(none.code).toBe(1);
    expect(none.stdout).toContain('no level found: write `const LEVEL = {');
    expect(none.stdout).toContain("design the level from this shot's narration");
    expect(none.stdout).not.toMatch(/office|warehouse/);
    await project.write(
      'scenes/s02_open.js',
      RETURNS.replaceAll("'#############',", "'.............',"),
    );
    const open = await runCli(project.root, 'validate', 'level', 'scenes/s02_open.js');
    expect(open.stdout).toMatch(/ {2}- … and \d+ more \(--json lists all\)/);
    const outside = await runCli(project.root, 'validate', 'level', '../evil.js');
    expect(outside.code).toBe(2);
    expect((await runCli(project.root, 'validate', 'level')).code).toBe(2);
    expect((await runCli(project.root, 'validate', 'level', 'notes.txt')).code).toBe(2);
    const help = await runCli(project.root, 'validate', '--help');
    expect(help.stdout).toContain(
      'usage: reelforge validate level <scenes/<shot>.js | level.json>',
    );
  });
});

describe('levels in scene sources', () => {
  it('reads every level of the kit Game B2 templates, through consts and spreads', () => {
    const names = readdirSync(EXAMPLES).filter((name) => name.endsWith('.js'));
    expect(names.length).toBeGreaterThanOrEqual(11);
    for (const name of names) {
      const found = levelsInScene(example(name));
      if (!found.ok) throw new Error(found.error);
      expect(found.levels.length, name).toBeGreaterThan(0);
      expect(
        found.levels.filter((level) => level.kind === 'unreadable'),
        name,
      ).toEqual([]);
    }
    const spread = levelsInScene(
      "const S = { label: 'E.T.' };\nconst L = { name: 'w', grid: ['###'], legend: { s: { wall: 'shelf', ...S } } };",
    );
    expect(spread).toMatchObject({
      ok: true,
      levels: [{ kind: 'object', value: { legend: { s: { wall: 'shelf', label: 'E.T.' } } } }],
    });
    expect(levelsInScene('const = ;').ok).toBe(false);
  });

  it('passes every Game B2 template of the kit', async () => {
    for (const name of readdirSync(EXAMPLES).filter((file) => file.endsWith('.js'))) {
      await project.write('scenes/s09_example.js', example(name));
      const run = await runCli(project.root, 'validate', 'level', 'scenes/s09_example.js');
      expect([name, run.code, run.stdout]).toEqual([
        name,
        0,
        expect.stringContaining('result: ok'),
      ]);
    }
  });
});
