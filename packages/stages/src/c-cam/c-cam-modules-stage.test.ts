/**
 * Grim Ink people and places on fake-claude (PLAN.md#14.11) with the scripted frame renderer: a
 * film's Scenes build first builds every person and place its storyboard tags (one Opus turn
 * each, QA by code + critic, committed alone) and keeps them for the same storyboard; a lint
 * error or a validator error goes to ONE fix turn; a module that still fails is replaced by a
 * plain placeholder (⚠) and the scenes still build. A person needs its signature gag (one fix
 * turn, else kept ⚠); a turn's writes outside its module are put back. Another style never runs
 * the step.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { autocommit } from '@reelforge/project';
import type { FakeClaudeStep } from '@reelforge/fake-claude';
import { inkModulesReportSchema, scenesReportSchema } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from '../runner.js';
import { DEFAULT_STAGE_SETTINGS } from '../settings.js';
import { FakeClaudeHarness, writes } from '../testing/fake-claude.js';
import { buildRule, CRITIC_OK, filmShots, sceneSource, writeFilm } from '../testing/film.js';
import { readProject, TestProjects, writeProject } from '../testing/project.js';
import { ScriptedFrameRenderer } from '../testing/scripted-renderer.js';
import { PLACEHOLDER_MARKER, placeholderSource } from './placeholder.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const CLERK = 'kit-ext/people/clerk.js';
const BOOTH = 'kit-ext/places/tollBooth.js';
const BUILD_CLERK = `Build \`${CLERK}\` by hand`;
const FIX_CLERK = `This is fix 2 of \`${CLERK}\``;

const DEADPAN = "  defaultExpr: 'deadpan',\n";
const SIGNATURE =
  "  signatureGag: { kind: 'clockCheck', note: 'checks the clock between two cars' },\n";
/** A module that passes every check (the placeholder's drawing under the film's own id). */
const good = (kind: 'people' | 'places', id: string, name: string): string => {
  const source = placeholderSource(kind, id, name).replace(`${PLACEHOLDER_MARKER}\n`, '');
  return kind === 'people' ? source.replace(DEADPAN, `${DEADPAN}${SIGNATURE}`) : source;
};
const GOOD_CLERK = good('people', 'clerk', 'The toll clerk');
const NO_GAG_CLERK = GOOD_CLERK.replace(SIGNATURE, '');
const GOOD_BOOTH = good('places', 'tollBooth', 'The toll booth');
const LINT_ERROR = GOOD_CLERK.replace(
  'const S = 4100;',
  'const S = Math.floor(Math.random() * 9);',
);
const BROKEN_RIG = GOOD_CLERK.replace('sy: -540,', 'sy: -760,');

const rule = (
  needle: string,
  files: Record<string, string>,
): FakeClaudeStep & { promptIncludes: string } => ({
  ...writes(files, 'Built it.\npeople-preview: all checks ok.'),
  promptIncludes: needle,
});

const BOOTH_RULE = rule(`Build \`${BOOTH}\` by hand`, { [BOOTH]: GOOD_BOOTH });

async function film(name: string, style = 'c-cam') {
  const dir = await projects.create(name);
  const project = JSON.parse(readProject(dir, 'project.json')) as Record<string, unknown>;
  writeProject(dir, 'project.json', JSON.stringify({ ...project, style }, null, 2));
  const shots = filmShots(2).map((shot, index) => ({
    ...shot,
    intent:
      index === 0
        ? `cast: clerk (the bridge's toll clerk; axis: a neck as long as his arm; loud prop: a coin bag) | place: toll-booth. ${shot.intent}`
        : `cast: clerk | place: tollBooth. ${shot.intent}`,
  }));
  writeFilm(dir, shots);
  expect((await autocommit(dir, 'Storyboard', { kind: 'manual', git: projects.git })).ok).toBe(
    true,
  );
  return { dir, shots };
}

function setup(dir: string, rules: (FakeClaudeStep & { promptIncludes: string })[]) {
  const harness = new FakeClaudeHarness({
    version: 1,
    rules,
    default: { scenario: 'tools-write', reply: CRITIC_OK },
  });
  harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
    settings: { ...DEFAULT_STAGE_SETTINGS, experimentalWorlds: true },
    scenes: { frames: new ScriptedFrameRenderer() },
  });
  return { harness, runner };
}

const report = (dir: string) =>
  inkModulesReportSchema.parse(JSON.parse(readProject(dir, '.reelforge/ink-modules.json')));
const turns = (harness: FakeClaudeHarness, needle: string) =>
  harness.specs.filter((spec) => spec.prompt.includes(needle));

describe('Grim Ink people and places', { timeout: 180_000 }, () => {
  it('are built before the scenes, checked, committed alone and kept for the storyboard', async () => {
    const { dir, shots } = await film('built');
    const [first, second] = shots;
    if (first === undefined || second === undefined) throw new Error('two shots');
    const { harness, runner } = setup(dir, [
      rule(BUILD_CLERK, { [CLERK]: GOOD_CLERK }),
      BOOTH_RULE,
      buildRule(first, sceneSource(first)),
      buildRule(second, sceneSource(second)),
    ]);
    const scenes = await runner.run({ stage: 'scenes' });
    if (!scenes.ok) throw new Error(JSON.stringify(scenes.error));
    const [clerk] = turns(harness, BUILD_CLERK);
    expect(clerk?.stage).toBe('scene-build');
    expect(clerk?.prompt).toContain("clerk: the bridge's toll clerk; axis: a neck as long");
    expect(clerk?.prompt).toContain('s02: "shot two lands here"');
    expect(clerk?.prompt).toContain('never reuse its content');
    expect(turns(harness, `Build \`${BOOTH}\``)).toHaveLength(1);
    // The critic judged each contact sheet.
    expect(turns(harness, '.reelforge/frames/people/clerk/qa-1.png')).toHaveLength(1);
    expect(report(dir).modules.map((entry) => [entry.id, entry.status])).toEqual([
      ['clerk', 'built'],
      ['tollBooth', 'built'],
    ]);
    const subjects = (await projects.history(dir)).map((entry) => entry.subject);
    expect(subjects).toEqual(
      expect.arrayContaining(['Person clerk built ✓', 'Place tollBooth built ✓']),
    );
    expect(scenes.value.outputs).toEqual(expect.arrayContaining([CLERK, BOOTH]));
    const shotsReport = scenesReportSchema.parse(
      JSON.parse(readProject(dir, '.reelforge/scenes-report.json')),
    );
    expect(shotsReport.shots.map((entry) => entry.shotId)).toEqual(['s01', 's02']);

    const before = harness.specs.length;
    const again = await runner.run({ stage: 'scenes', shots: ['s01'] });
    expect(again.ok).toBe(true);
    expect(harness.specs.slice(before).some((spec) => spec.prompt.includes('by hand'))).toBe(false);
  });

  it('sends a lint error to one fix turn that repairs it', async () => {
    const { dir } = await film('lint fix');
    const { harness, runner } = setup(dir, [
      rule(FIX_CLERK, { [CLERK]: GOOD_CLERK }),
      rule(BUILD_CLERK, { [CLERK]: LINT_ERROR }),
      BOOTH_RULE,
    ]);
    const done = await runner.run({ stage: 'scenes', action: 'c-cam-modules' });
    if (!done.ok) throw new Error(JSON.stringify(done.error));
    const clerk = turns(harness, BUILD_CLERK);
    expect(clerk).toHaveLength(2);
    expect(clerk[1]?.prompt).toContain(FIX_CLERK);
    expect(clerk[1]?.prompt).toMatch(/lint errors:[\s\S]*Math\.random/);
    expect(report(dir).modules[0]).toMatchObject({ id: 'clerk', status: 'built', attempts: 2 });
    expect(done.value.message).toBe('People and places: people: clerk ✓; places: tollBooth ✓');
  });

  it('sends validator errors to the fix turn', async () => {
    const { dir } = await film('validators');
    const { harness, runner } = setup(dir, [
      rule(FIX_CLERK, { [CLERK]: GOOD_CLERK }),
      rule(BUILD_CLERK, { [CLERK]: BROKEN_RIG }),
      BOOTH_RULE,
    ]);
    const done = await runner.run({ stage: 'scenes', action: 'c-cam-modules' });
    if (!done.ok) throw new Error(JSON.stringify(done.error));
    const [, fix] = turns(harness, BUILD_CLERK);
    expect(fix?.prompt).toMatch(/- validator shoulder-[a-z-]+.*; fix: /);
    expect(report(dir).modules[0]?.status).toBe('built');
  });

  it('sends a person without a signature gag to one fix turn and keeps it (⚠) when still missing', async () => {
    expect(NO_GAG_CLERK).not.toBe(GOOD_CLERK);
    const { dir } = await film('signature gag');
    const { harness, runner } = setup(dir, [
      rule(FIX_CLERK, { [CLERK]: NO_GAG_CLERK }),
      rule(BUILD_CLERK, { [CLERK]: NO_GAG_CLERK }),
      BOOTH_RULE,
    ]);
    const done = await runner.run({ stage: 'scenes', action: 'c-cam-modules' });
    if (!done.ok) throw new Error(JSON.stringify(done.error));
    const clerk = turns(harness, BUILD_CLERK);
    expect(clerk).toHaveLength(2);
    expect(clerk[1]?.prompt).toMatch(/- validator no-signature-gag: clerk has no signature gag/);
    expect(report(dir).modules[0]).toMatchObject({ id: 'clerk', status: 'warning', attempts: 2 });
    expect(readProject(dir, CLERK)).toBe(NO_GAG_CLERK);
  });

  it("puts back what a module's turn writes outside its own file", async () => {
    const { dir } = await film('outside writes');
    const scene = readProject(dir, 'scenes/s01.js');
    const { runner } = setup(dir, [
      rule(BUILD_CLERK, {
        [CLERK]: GOOD_CLERK,
        'scenes/s01.js': 'export const tampered = true;\n',
        'kit-ext/places/extra.js': 'export const place = {};\n',
      }),
      BOOTH_RULE,
    ]);
    const warnings: string[] = [];
    runner.on('event', (event) => {
      if (event.type === 'warning') warnings.push(event.message);
    });
    const done = await runner.run({ stage: 'scenes', action: 'c-cam-modules' });
    if (!done.ok) throw new Error(JSON.stringify(done.error));
    expect(readFileSync(path.join(dir, 'scenes', 's01.js'), 'utf8')).toBe(scene);
    expect(existsSync(path.join(dir, 'kit-ext', 'places', 'extra.js'))).toBe(false);
    expect(readProject(dir, CLERK)).toBe(GOOD_CLERK);
    const only = `change discarded (it may write only ${CLERK})`;
    expect(warnings).toEqual(
      expect.arrayContaining([
        `the c-cam-build turn of ${CLERK} changed kit-ext/places/extra.js; ${only}`,
        `the c-cam-build turn of ${CLERK} changed scenes/s01.js; ${only}`,
      ]),
    );
    expect(report(dir).modules[0]).toMatchObject({ id: 'clerk', status: 'built' });
  });

  it('replaces a module that still fails with a placeholder (⚠) and the scenes still build', async () => {
    const { dir, shots } = await film('placeholder');
    const [first, second] = shots;
    if (first === undefined || second === undefined) throw new Error('two shots');
    const { harness, runner } = setup(dir, [
      rule(BUILD_CLERK, { [CLERK]: LINT_ERROR }),
      BOOTH_RULE,
      buildRule(first, sceneSource(first)),
      buildRule(second, sceneSource(second)),
    ]);
    const warnings: string[] = [];
    runner.on('event', (event) => {
      if (event.type === 'warning') warnings.push(event.message);
    });
    const scenes = await runner.run({ stage: 'scenes' });
    if (!scenes.ok) throw new Error(JSON.stringify(scenes.error));
    expect(turns(harness, BUILD_CLERK)).toHaveLength(2);
    expect(readProject(dir, CLERK).startsWith(PLACEHOLDER_MARKER)).toBe(true);
    expect(readProject(dir, '.reelforge/ink-failed/people/clerk.js')).toContain('Math.random');
    expect(report(dir).modules[0]).toMatchObject({ id: 'clerk', status: 'placeholder' });
    expect(warnings.join('\n')).toMatch(/person clerk could not be built \(a plain placeholder/);
    expect(scenes.value.warnings.join('\n')).toMatch(/people clerk ⚠ placeholder: lint errors/);
    const subjects = (await projects.history(dir)).map((entry) => entry.subject);
    expect(subjects).toContain('Person clerk placeholder ⚠');
    expect(existsSync(path.join(dir, 'scenes', 's02.js'))).toBe(true);
  });

  it('never runs for another style', async () => {
    const { dir, shots } = await film('voxel', 'voxel-pixel-crisp640');
    const [first, second] = shots;
    if (first === undefined || second === undefined) throw new Error('two shots');
    const { harness, runner } = setup(dir, [
      buildRule(first, sceneSource(first)),
      buildRule(second, sceneSource(second)),
    ]);
    expect((await runner.run({ stage: 'scenes' })).ok).toBe(true);
    expect(harness.specs.some((spec) => spec.prompt.includes('by hand'))).toBe(false);
    expect(existsSync(path.join(dir, '.reelforge', 'ink-modules.json'))).toBe(false);
    const action = await runner.run({ stage: 'scenes', action: 'c-cam-modules' });
    expect(action.ok).toBe(false);
  });
});
