/** Commands that need no browser, on a copy of the fixture project (path with spaces + Polish letters). */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyFixtureProject, runCli, type TempProject } from './testing/fixture.js';

let project: TempProject;

beforeEach(async () => {
  project = await copyFixtureProject();
});

afterEach(async () => {
  await project.remove();
});

describe('reelforge (dispatch)', () => {
  it('prints the command list, rejects unknown commands with exit 2, --help per command', async () => {
    expect((await runCli(project.root)).code).toBe(2);
    const unknown = await runCli(project.root, 'bogus');
    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toContain('unknown command "bogus"');
    const help = await runCli(project.root, 'frames', '--help');
    expect(help.code).toBe(0);
    expect(help.stdout).toContain('usage: reelforge frames');
  });

  it('reports usage errors on stderr (text) or as JSON with --json', async () => {
    const text = await runCli(project.root, 'status', '--verbose');
    expect(text.code).toBe(2);
    expect(text.stderr).toMatch(
      /^reelforge status: .*--verbose[\s\S]*see: reelforge status --help/,
    );
    const json = await runCli(project.root, 'frames', '--json', '--shot', 's01', '--at', 'x');
    expect(json.code).toBe(2);
    expect(JSON.parse(json.stdout)).toMatchObject({ ok: false, error: { kind: 'usage' } });
  });
});

describe('reelforge status', () => {
  it('shows stages, shots and durations of the fixture', async () => {
    const run = await runCli(project.root, 'status');
    expect(run.code).toBe(0);
    expect(run.stdout).toContain(
      'project: "Doom on a calculator" (en, style voxel-pixel-crisp640, 30 fps, seed 2115)',
    );
    expect(run.stdout).toMatch(
      /\[x\] Words timed\s+timing\/words\.json \(18 words, voice-over ends 7\.10s\)/,
    );
    expect(run.stdout).toMatch(/\[x\] Scenes built\s+2\/2 scene files/);
    expect(run.stdout).toMatch(/\[ \] Audio cleaned\s+missing audio\/vo\.clean\.wav/);
    expect(run.stdout).toMatch(
      /s02\s+2\.20–7\.50s\s+5\.30s\s+metaphor-object\s+scenes\/s02_calc\.js/,
    );
  });

  it("flags a missing scene file and the app's last errors", async () => {
    await project.edit('storyboard.json', 'scenes/s02_calc.js', 'scenes/s02_new.js');
    await mkdir(path.join(project.root, '.reelforge'), { recursive: true });
    const at = '2026-10-02T10:00:00.000Z';
    await project.write(
      '.reelforge/pipeline.json',
      JSON.stringify({
        version: 1,
        updatedAt: at,
        stages: {
          'scene-build': { status: 'failed', updatedAt: at, message: 'shot s02 failed twice' },
        },
        queue: [],
      }),
    );
    const run = await runCli(project.root, 'status');
    expect(run.code).toBe(0);
    expect(run.stdout).toMatch(
      /\[~\] Scenes built\s+1\/2 scene files \(missing: scenes\/s02_new\.js\)/,
    );
    expect(run.stdout).toContain('stage scene-build failed: shot s02 failed twice');
  });

  it('outside a project: says so and exits 1', async () => {
    const run = await runCli(path.join(project.root, 'scenes'), 'status');
    expect(run.code).toBe(1);
    expect(run.stdout).toContain('project: no project.json in this folder');
  });
});

describe('reelforge validate', () => {
  it('passes the fixture', async () => {
    const run = await runCli(project.root, 'validate');
    expect(run.code).toBe(0);
    expect(run.stdout).toMatch(/ok\s+storyboard\.json\s+v1, 2 shots/);
    expect(run.stdout).toContain('0 errors, 0 warnings');
  });

  it('reports schema errors by path, gaps between shots, bad JSON and versions', async () => {
    await project.edit('storyboard.json', '"t0": 2.2,', '"t0": 2.4,');
    await project.edit('project.json', '"version": 1', '"version": 2');
    await project.write(
      'cues.json',
      '{ "version": 1, "sfx": [ { "t": 1, "name": "hit", "gain": 3 } ] ',
    );
    await project.edit('timing/words.json', '"tEnd": 4.1', '"tEnd": 3');
    const run = await runCli(project.root, 'validate', '--json');
    expect(run.code).toBe(1);
    const report = JSON.parse(run.stdout) as {
      problems: { file: string; at: string; message: string }[];
    };
    const where = report.problems.map((problem) => `${problem.file} ${problem.at}`);
    expect(where).toEqual(
      expect.arrayContaining([
        'project.json version',
        'cues.json ',
        'timing/words.json words[9].tEnd',
        'storyboard.json shots[1].t0',
      ]),
    );
    const text = await runCli(project.root, 'validate');
    expect(text.stdout).toContain(
      'storyboard.json shots[1].t0: shot "s02" starts at 2.4 s but must start at 2.2 s',
    );
    expect(text.stdout).toMatch(/cues\.json: not valid JSON/);
  });

  it('rejects scene paths that leave the project', async () => {
    await project.edit('storyboard.json', 'scenes/s02_calc.js', '../../evil.js');
    const run = await runCli(project.root, 'validate');
    expect(run.code).toBe(1);
    expect(run.stdout).toContain('"../../evil.js" is outside the project folder');
  });
});

describe('reelforge lint', () => {
  it('lints scenes/*.js by default', async () => {
    const run = await runCli(project.root, 'lint');
    expect(run).toMatchObject({ code: 0 });
    expect(run.stdout).toContain('ok      scenes/s01_title.js');
    expect(run.stdout).toContain('2 files: 0 errors, 0 warnings');
  });

  it('reports determinism errors with a fix line, and refuses files outside the project', async () => {
    await project.edit('scenes/s01_title.js', 'rng.range(2.5, 4.5)', 'Math.random() * 4');
    const run = await runCli(project.root, 'lint', 'scenes/s01_title.js');
    expect(run.code).toBe(1);
    expect(run.stdout).toMatch(/scenes\/s01_title\.js:\d+:\d+ {2}error {2}no-random/);
    expect(run.stdout).toContain('fix: Use ctx.rng()');
    const outside = await runCli(project.root, 'lint', '../outside.js');
    expect(outside.code).toBe(2);
  });
});

describe('reelforge anchors --phrase', () => {
  it('resolves phrases fuzzily (numbers, units) and names the shot', async () => {
    const run = await runCli(project.root, 'anchors', '--phrase', 'sixty one kilobytes');
    expect(run.code).toBe(0);
    expect(run.stdout).toContain(
      'ok "sixty one kilobytes" -> 3.70–4.50s "61 KB" (similarity 1.00) in shot s02',
    );
  });

  it('reports a phrase that is not spoken with the closest matches', async () => {
    const run = await runCli(
      project.root,
      'anchors',
      '--phrase',
      'dum',
      '--phrase',
      'Doom',
      '--nth',
      '3',
    );
    expect(run.code).toBe(1);
    expect(run.stdout).toContain('NOT FOUND "dum" #3');
    expect(run.stdout).toContain(
      'NOT FOUND "Doom" #3: Anchor "Doom" (nth=3) was not found: the phrase occurs only 2 times',
    );
  });
});

describe('reelforge kit-docs', () => {
  it('lists the kit and describes one function with an example', async () => {
    const all = await runCli(project.root, 'kit-docs');
    expect(all.code).toBe(0);
    expect(all.stdout).toContain('kit.voxel.box([sx, sy, sz], color) -> model');
    const one = await runCli(project.root, 'kit-docs', 'voxel.box');
    expect(one.stdout).toContain('Solid box of one colour.');
    const unknown = await runCli(project.root, 'kit-docs', 'teleporter');
    expect(unknown.code).toBe(2);
    expect(unknown.stderr).toContain('no kit function "teleporter"\nkinds: props, env, fx');
  });
});
