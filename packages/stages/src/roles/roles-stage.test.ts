/**
 * Project roles (PLAN.md#12.20, ADR-026) on fake-claude with the scripted frame renderer (no
 * browser): the storyboard's newRoles built before the scenes (✓), a spec that stays invalid
 * (moved aside, "did you mean" in the fix), QA findings left on a valid spec (⚠, usable), a role a
 * scene calls by id, and a project without roles (no roles turn, no report). The real-engine
 * render of project roles: packages/engine/test/render/cast-roles.test.ts.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { FakeClaudeScript } from '@reelforge/fake-claude';
import { validateRoleSpec } from '@reelforge/kit';
import { autocommit } from '@reelforge/project';
import { rolesReportSchema, scenesReportSchema } from '@reelforge/shared';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { StageRunner } from '../runner.js';
import { DEFAULT_STAGE_SETTINGS } from '../settings.js';
import { FakeClaudeHarness, writes } from '../testing/fake-claude.js';
import {
  CRITIC_OK,
  buildRule,
  filmShots,
  sceneSource,
  writeFilm,
  type FilmShot,
} from '../testing/film.js';
import { TestProjects, readProject, writeProject } from '../testing/project.js';
import { ScriptedFrameRenderer } from '../testing/scripted-renderer.js';
import { calledRoleIds } from './scene-roles.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

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

const json = (value: object): string => `${JSON.stringify(value, null, 2)}\n`;

/** fake-claude rule: the roles turn of `id` writes `content`. */
function roleRule(id: string, content: string, reply = 'Built it. cast preview: all checks ok.') {
  return {
    ...writes({ [`characters/roles/${id}.json`]: content }, reply),
    promptIncludes: `write \`characters/roles/${id}.json\``,
  };
}

/** `sceneSource(shot)` that also calls `kit.cast.person(id)`. */
function roleSceneSource(shot: FilmShot, id: string): string {
  return sceneSource(shot).replace(
    '  scene.add(desk, cube, side);',
    `  scene.add(desk, cube, side);\n  const person = ctx.kit.cast.person('${id}', { pose: 'wave' });\n  scene.add(person);`,
  );
}

const shot0 = (shots: readonly FilmShot[]): FilmShot => {
  const found = shots[0];
  if (found === undefined) throw new Error('no shot');
  return found;
};

interface Setup {
  readonly script: (shots: readonly FilmShot[]) => FakeClaudeScript;
  readonly newRoles?: readonly { id: string; description: string }[];
}

async function setup(name: string, options: Setup) {
  const shots = filmShots(1);
  const dir = await projects.create(name);
  writeFilm(dir, shots);
  // Roles belong to pack projects (PLAN.md#12.20): the scene checks warn about kit.cast otherwise.
  const project = JSON.parse(readProject(dir, 'project.json')) as object;
  writeProject(dir, 'project.json', JSON.stringify({ ...project, characters: 'pack' }, null, 2));
  if (options.newRoles !== undefined) {
    const storyboard = JSON.parse(readProject(dir, 'storyboard.json')) as object;
    writeProject(
      dir,
      'storyboard.json',
      JSON.stringify({ ...storyboard, newRoles: options.newRoles }),
    );
  }
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
    scenes: { frames: new ScriptedFrameRenderer() },
    settings: DEFAULT_STAGE_SETTINGS,
  });
  return { dir, shots, harness, runner };
}

const rolesReport = (dir: string) =>
  rolesReportSchema.parse(JSON.parse(readProject(dir, '.reelforge/roles-report.json')));

const promptsOf = (harness: FakeClaudeHarness, needle: string): string[] =>
  harness.specs.map((spec) => spec.prompt).filter((prompt) => prompt.includes(needle));

const FIREFIGHTER_ROLE = [{ id: 'firefighter', description: 'helmet, turnout coat, axe' }];

describe('project roles in Scenes built', { timeout: 120_000 }, () => {
  it("builds the storyboard's new roles before the scenes, QAs and commits them (✓)", async () => {
    const { dir, harness, runner } = await setup('role built', {
      newRoles: FIREFIGHTER_ROLE,
      script: (shots) => ({
        version: 1,
        rules: [
          roleRule('firefighter', json(FIREFIGHTER)),
          buildRule(shot0(shots), roleSceneSource(shot0(shots), 'firefighter')),
        ],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      }),
    });
    const result = await runner.run({ stage: 'scenes' });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.message).toBe('1 shots: 1 ✓; roles: firefighter');
    expect(result.value.metrics).toMatchObject({ builtRoles: 1, failedRoles: 0 });
    expect(result.value.outputs).toContain('characters/roles/firefighter.json');
    expect(rolesReport(dir).roles).toEqual([
      expect.objectContaining({
        id: 'firefighter',
        status: 'built',
        attempts: 1,
        description: 'helmet, turnout coat, axe',
        sheet: '.reelforge/frames/roles/firefighter/qa-1.png',
        findings: [],
      }),
    ]);
    expect(
      existsSync(path.join(dir, '.reelforge', 'frames', 'roles', 'firefighter', 'qa-1.png')),
    ).toBe(true);
    const order = harness.specs.map((spec) =>
      spec.prompt.includes('characters/roles/firefighter.json') ? 'role' : spec.stage,
    );
    expect(order.slice(0, 3)).toEqual(['role', 'critic', 'scene-build']);
    const roleTurn = harness.specs.find((spec) => spec.prompt.includes('**Firefighter**'));
    expect([roleTurn?.stage, roleTurn?.model]).toEqual(['storyboard', 'sonnet']);
    expect(promptsOf(harness, 'a sibling of the character pack')).toHaveLength(1);
    const subjects = (await projects.history(dir)).map((entry) => entry.subject);
    expect(subjects).toContain('Role firefighter built ✓');
    expect(subjects.indexOf('Role firefighter built ✓')).toBeGreaterThan(
      subjects.indexOf('Scene s01 built ✓'),
    );
  });

  it('fails a role that stays invalid after the fix: moved aside, "did you mean" in the fix', async () => {
    const typo = json({ ...FIREFIGHTER, headgear: 'firehelmet' });
    const { dir, harness, runner } = await setup('role failed', {
      newRoles: FIREFIGHTER_ROLE,
      script: (shots) => ({
        version: 1,
        rules: [roleRule('firefighter', typo), buildRule(shot0(shots), sceneSource(shot0(shots)))],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      }),
    });
    const result = await runner.run({ stage: 'scenes' });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.message).toBe('1 shots: 1 ✓; roles not built: firefighter');
    const fixes = promptsOf(harness, 'This is fix 2: the previous version failed QA');
    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toContain(
      'headgear: "firehelmet" is not in the vocabulary (did you mean "fireHelmet"?)',
    );
    expect(existsSync(path.join(dir, 'characters', 'roles', 'firefighter.json'))).toBe(false);
    expect(readProject(dir, '.reelforge/roles-failed/firefighter.json')).toBe(typo);
    expect(rolesReport(dir).roles[0]).toMatchObject({ status: 'failed', attempts: 2 });
    expect(rolesReport(dir).roles[0]?.findings.join()).toMatch(/did you mean "fireHelmet"/);
  });

  it('keeps a valid role with QA findings as usable with ⚠ after one fix', async () => {
    const tall = json({ ...FIREFIGHTER, notes: 'render:tall' });
    const { dir, harness, runner } = await setup('role warning', {
      newRoles: FIREFIGHTER_ROLE,
      script: (shots) => ({
        version: 1,
        rules: [roleRule('firefighter', tall), buildRule(shot0(shots), sceneSource(shot0(shots)))],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      }),
    });
    const result = await runner.run({ stage: 'scenes' });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.message).toBe('1 shots: 1 ✓; roles: firefighter ⚠');
    expect(promptsOf(harness, 'height: 2.60 units tall, outside the pack')).toHaveLength(1);
    expect(readProject(dir, 'characters/roles/firefighter.json')).toBe(tall);
    expect(rolesReport(dir).roles[0]).toMatchObject({ status: 'warning', attempts: 2 });
    expect(promptsOf(harness, 'a sibling of the character pack')).toEqual([]);
    const subjects = (await projects.history(dir)).map((entry) => entry.subject);
    expect(subjects).toContain('Role firefighter built ⚠');
  });

  it('builds a role a scene calls by id, before the shot QA', async () => {
    const chef = {
      ...FIREFIGHTER,
      id: 'chef',
      label: 'Chef',
      headgear: 'chefHat',
      layers: ['chefJacket'],
      accessories: ['neckerchief'],
      held: 'spatula',
      top: { color: 'cream' },
    };
    const { dir, harness, runner } = await setup('role from scene', {
      script: (shots) => ({
        version: 1,
        rules: [
          roleRule('chef', json(chef)),
          buildRule(shot0(shots), roleSceneSource(shot0(shots), 'chef')),
        ],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      }),
    });
    const result = await runner.run({ stage: 'scenes' });
    if (!result.ok) throw new Error(result.error.message);
    const record = scenesReportSchema
      .parse(JSON.parse(readProject(dir, '.reelforge/scenes-report.json')))
      .shots.find((entry) => entry.shotId === 's01');
    expect(record?.findings).toEqual([]);
    expect(result.value.message).toBe('1 shots: 1 ✓');
    expect(record?.notes).toContain('missing roles chef: built chef');
    expect(rolesReport(dir).roles).toEqual([
      expect.objectContaining({ id: 'chef', status: 'built', shots: ['s01'] }),
    ]);
    expect(promptsOf(harness, 'Who it is: Chef (needed in shot s01')).toHaveLength(1);
  });

  it('leaves projects without roles exactly as before (no roles turn, no report)', async () => {
    const { dir, harness, runner } = await setup('no roles', {
      script: (shots) => ({
        version: 1,
        rules: [buildRule(shot0(shots), sceneSource(shot0(shots)))],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      }),
    });
    const result = await runner.run({ stage: 'scenes' });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.message).toBe('1 shots: 1 ✓');
    expect(Object.keys(result.value.metrics)).not.toContain('builtRoles');
    expect(promptsOf(harness, 'characters/roles/')).toEqual([]);
    expect(existsSync(path.join(dir, '.reelforge', 'roles-report.json'))).toBe(false);
  });
});

describe('role helpers', () => {
  it('finds the ids scenes call (kebab case too) and validates the eval goldens', () => {
    expect(
      calledRoleIds(
        "kit.cast.person('firefighter'); ctx.kit.cast.role(\"police-officer\", {}); kit.cast.spec('chef'); kit.cast.mascot('bulb'); kit.cast.role({ id: 'x' })",
      ),
    ).toEqual(['firefighter', 'policeOfficer', 'chef']);
    const cases = path.resolve(import.meta.dirname, '..', '..', '..', 'prompts', 'evals', 'cases');
    for (const evalCase of readdirSync(cases)) {
      const roles = path.join(cases, evalCase, 'project', 'characters', 'roles');
      for (const file of readdirSync(roles)) {
        const spec: unknown = JSON.parse(readFileSync(path.join(roles, file), 'utf8'));
        expect(validateRoleSpec(spec), `${evalCase}/${file}`).toMatchObject({ ok: true });
      }
    }
  });
});
