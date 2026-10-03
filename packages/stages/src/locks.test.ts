/**
 * Shot locks (PLAN.md#11.4) on fake-claude + the scripted renderer, in real project folders with
 * git: the scene stage skips locked shots, a turn's change to a locked file is put back (and never
 * committed), "Rebuild this shot" refuses a locked shot, the review modes leave them alone.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FakeClaudeScript } from '@reelforge/fake-claude';
import { autocommit } from '@reelforge/project';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { discardLockedChanges, lockViolationMessage, snapshotLockedFiles } from './lock-guard.js';
import { propCalls, readLockedShots, setShotsLocked } from './locks.js';
import { StageRunner } from './runner.js';
import { FakeClaudeHarness, writes } from './testing/fake-claude.js';
import {
  CRITIC_OK,
  buildRule,
  filmShots,
  propSceneSource,
  sceneSource,
  writeFilm,
  type FilmShot,
  type SceneVariant,
} from './testing/film.js';
import { TestProjects, readProject, writeProject } from './testing/project.js';
import { ScriptedFrameRenderer } from './testing/scripted-renderer.js';
import type { StageEvent } from './types.js';

const projects = new TestProjects();
const harnesses: FakeClaudeHarness[] = [];
afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()));
});
afterAll(() => {
  projects.dispose();
});

const NOW = new Date('2026-10-03T10:00:00.000Z');

const shotAt = (shots: readonly FilmShot[], index: number): FilmShot => {
  const shot = shots[index];
  if (shot === undefined) throw new Error(`no shot ${String(index)}`);
  return shot;
};

/** A built film (scenes in `variants`), `locked` shots locked, everything committed. */
async function setup(
  name: string,
  variants: readonly SceneVariant[],
  locked: readonly string[],
  script: (shots: readonly FilmShot[]) => FakeClaudeScript,
) {
  const dir = await projects.create(name);
  const shots = filmShots(variants.length);
  writeFilm(dir, shots);
  shots.forEach((shot, index) => {
    writeProject(dir, shot.scene, sceneSource(shot, variants[index]));
  });
  expect((await setShotsLocked(dir, locked, true, NOW)).ok).toBe(true);
  expect((await autocommit(dir, 'Scenes', { kind: 'manual', git: projects.git })).ok).toBe(true);
  const harness = new FakeClaudeHarness(script(shots));
  harnesses.push(harness);
  const runner = new StageRunner({
    projectDir: dir,
    claude: harness.runner,
    guard: harness.guard,
    git: projects.git,
    scenes: { frames: new ScriptedFrameRenderer() },
  });
  const events: StageEvent[] = [];
  runner.on('event', (event) => events.push(event));
  return { dir, shots, harness, runner, events };
}

const warnings = (events: readonly StageEvent[]): string[] =>
  events.flatMap((event) => (event.type === 'warning' ? [event.message] : []));

describe('shot locks', { timeout: 120_000 }, () => {
  it('builds only unlocked shots and discards a turn’s change to a locked scene', async () => {
    const { dir, shots, harness, runner, events } = await setup(
      'locked build',
      ['blank', 'ok', 'blank'],
      ['s02'],
      (film) => ({
        version: 1,
        rules: [
          {
            // The build turn of s01 also "touches" the locked s02.
            ...writes({
              [shotAt(film, 0).scene]: sceneSource(shotAt(film, 0)),
              [shotAt(film, 1).scene]: '// tampered\n',
            }),
            promptIncludes: `Write \`${shotAt(film, 0).scene}\``,
          },
          buildRule(shotAt(film, 2), sceneSource(shotAt(film, 2))),
        ],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      }),
    );
    const result = await runner.run({ stage: 'scenes' });
    expect(result.ok && result.value.message).toBe('2 shots: 2 ✓; 1 locked (kept)');
    expect(result.ok && result.value.metrics['locked']).toBe(1);
    expect(harness.specs.filter((spec) => spec.prompt.includes('scenes/s02.js'))).toEqual([]);
    expect(readProject(dir, 'scenes/s02.js')).toBe(sceneSource(shotAt(shots, 1)));
    expect(warnings(events)).toContain('Claude tried to change locked shot s02; change discarded');
    // No commit after the lock ever carried a change of the locked scene.
    const history = await projects.history(dir); // newest first
    const afterLock = history.slice(
      0,
      history.findIndex((entry) => entry.subject === 'Scenes'),
    );
    expect(afterLock.length).toBeGreaterThan(0);
    const touched = afterLock.flatMap((entry) => entry.files.map((file) => file.path));
    expect(touched).not.toContain('scenes/s02.js');
    expect(touched).toContain('scenes/s01.js');
  });

  it('"Rebuild this shot" on a locked shot builds nothing', async () => {
    const { harness, runner } = await setup('locked rebuild', ['ok', 'ok'], ['s02'], () => ({
      version: 1,
      default: { scenario: 'tools-write', reply: CRITIC_OK },
    }));
    const result = await runner.run({ stage: 'scenes', shots: ['s02'] });
    expect(result.ok && result.value).toMatchObject({
      message: 'Nothing to build: s02 is locked',
      changed: false,
      warnings: ['s02 is locked: not rebuilt'],
    });
    expect(harness.specs).toEqual([]);
  });

  it('review modes neither look at nor fix locked shots', async () => {
    const { dir, shots, harness, runner } = await setup(
      'locked review',
      ['ok', 'small-text'],
      ['s02'],
      () => ({ version: 1, default: { scenario: 'tools-write', reply: '{"suspects":[]}' } }),
    );
    const legibility = await runner.run({ stage: 'scenes', action: 'phone-legibility' });
    expect(legibility.ok && legibility.value.message).toBe(
      'Review (phone-legibility): 0 shots flagged, 0 fixed',
    );
    expect(legibility.ok && legibility.value.warnings).toContain('Locked shots not changed: s02');
    const wrong = await runner.run({ stage: 'scenes', action: 'fix-what-looks-wrong' });
    expect(wrong.ok).toBe(true);
    expect(harness.specs.map((spec) => spec.stage)).toEqual(['critic']);
    expect(harness.specs[0]?.prompt).not.toContain('"s02"');
    expect(readProject(dir, 'scenes/s02.js')).toBe(sceneSource(shotAt(shots, 1), 'small-text'));
  });
});

describe('lock guard', () => {
  it('finds the project props a scene calls', () => {
    expect(
      propCalls('const a = kit.props.fridge({});\nconst { props } = kit; props.tv( );'),
    ).toEqual(['fridge', 'tv']);
  });

  it('puts back changed, deleted and created locked files and keeps unlocked ones', async () => {
    const dir = await projects.create('guard');
    const shots = filmShots(2);
    writeFilm(dir, shots);
    writeProject(dir, 'scenes/s01.js', propSceneSource(shotAt(shots, 0), 'fridge'));
    mkdirSync(path.join(dir, 'kit-ext', 'props'), { recursive: true });
    writeProject(dir, 'kit-ext/props/fridge.js', '// fridge v1\n');
    writeProject(dir, 'kit-ext/props/lamp.js', '// lamp v1\n');
    expect((await setShotsLocked(dir, ['s01'], true, NOW)).ok).toBe(true);
    const snapshot = await snapshotLockedFiles(dir);
    if (!snapshot.ok) throw new Error(snapshot.error.message);
    expect(snapshot.value.files.map((entry) => entry.file)).toEqual([
      'scenes/s01.js',
      'kit-ext/props/fridge.js',
    ]);
    // A "turn": edits the locked scene, deletes its prop, edits an unlocked scene and prop.
    writeProject(dir, 'scenes/s01.js', '// rewritten\n');
    rmSync(path.join(dir, 'kit-ext', 'props', 'fridge.js'));
    writeProject(dir, 'scenes/s02.js', '// s02 changed\n');
    writeProject(dir, 'kit-ext/props/lamp.js', '// lamp v2\n');
    const discarded = await discardLockedChanges(snapshot.value);
    expect(discarded.ok && discarded.value.map(lockViolationMessage)).toEqual([
      'Claude tried to change locked shot s01; change discarded',
      'Claude tried to change kit-ext/props/fridge.js, used by locked shot s01; change discarded',
    ]);
    expect(readProject(dir, 'scenes/s01.js')).toBe(propSceneSource(shotAt(shots, 0), 'fridge'));
    expect(readProject(dir, 'kit-ext/props/fridge.js')).toBe('// fridge v1\n');
    expect(readProject(dir, 'scenes/s02.js')).toBe('// s02 changed\n');
    expect(readProject(dir, 'kit-ext/props/lamp.js')).toBe('// lamp v2\n');
  });

  it('removes a locked scene a turn created and keeps changes of shots unlocked meanwhile', async () => {
    const dir = await projects.create('guard unlock');
    writeFilm(dir, filmShots(2));
    rmSync(path.join(dir, 'scenes', 's02.js'));
    expect((await setShotsLocked(dir, ['s01', 's02'], true, NOW)).ok).toBe(true);
    const snapshot = await snapshotLockedFiles(dir);
    if (!snapshot.ok) throw new Error(snapshot.error.message);
    writeProject(dir, 'scenes/s02.js', '// created\n');
    writeProject(dir, 'scenes/s01.js', '// edited after the unlock\n');
    expect((await setShotsLocked(dir, ['s01'], false, NOW)).ok).toBe(true);
    const discarded = await discardLockedChanges(snapshot.value);
    expect(discarded.ok && discarded.value.map((entry) => entry.file)).toEqual(['scenes/s02.js']);
    expect(existsSync(path.join(dir, 'scenes', 's02.js'))).toBe(false);
    expect(readProject(dir, 'scenes/s01.js')).toBe('// edited after the unlock\n');
    const locked = await readLockedShots(dir);
    expect(locked.ok && [...locked.value]).toEqual(['s02']);
  });

  it('reports a broken locks.json instead of guessing', async () => {
    const dir = await projects.create('guard broken');
    writeFileSync(path.join(dir, 'locks.json'), '{ not json');
    const snapshot = await snapshotLockedFiles(dir);
    expect(!snapshot.ok && snapshot.error.message).toMatch(/^locks\.json: /);
  });
});
