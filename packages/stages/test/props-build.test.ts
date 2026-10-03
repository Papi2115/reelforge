/**
 * PLAN.md#7.4 "missing prop → build it first" on the REAL engine (Playwright Chromium +
 * SwiftShader): the scene-build reply says `MISSING: fridge` → a prop-build turn (fake-claude
 * writes `kit-ext/props/fridge.js`) → QA by code (prop lint, turntable render, size, floating
 * parts, determinism, critic) → the shot is built again with `kit.props.fridge` → ✓. A prop that
 * stays broken after its fix turn is moved aside and the shot keeps its fallback (⚠).
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { autocommit } from '@reelforge/project';
import { propsReportSchema, scenesReportSchema } from '@reelforge/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { PlaywrightFrameRenderer } from '../src/cli/playwright-renderer.js';
import { StageRunner } from '../src/runner.js';
import { FakeClaudeHarness } from '../src/testing/fake-claude.js';
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
} from '../src/testing/film.js';
import { TestProjects, readProject } from '../src/testing/project.js';

const projects = new TestProjects();
const renderer = new PlaywrightFrameRenderer();

afterAll(async () => {
  await renderer.close();
  projects.dispose();
});

async function film(name: string): Promise<{ dir: string; shot: FilmShot }> {
  const dir = await projects.create(name);
  const [shot] = filmShots(1);
  if (shot === undefined) throw new Error('no shot');
  writeFilm(dir, [shot]);
  expect((await autocommit(dir, 'Storyboard', { kind: 'manual', git: projects.git })).ok).toBe(
    true,
  );
  return { dir, shot };
}

describe('missing props on the real engine', () => {
  it(
    'builds the fridge, checks its turntable and rebuilds the shot with it (✓)',
    { timeout: 300_000 },
    async () => {
      const { dir, shot } = await film('fridge built');
      const harness = new FakeClaudeHarness({
        version: 1,
        rules: [
          rebuildRule(shot, propSceneSource(shot, 'fridge')),
          buildRule(shot, sceneSource(shot), 'Built with a white box.\nMISSING: fridge'),
          propRule('fridge', FRIDGE_PROP),
        ],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      });
      try {
        const runner = new StageRunner({
          projectDir: dir,
          claude: harness.runner,
          guard: harness.guard,
          git: projects.git,
          scenes: { frames: renderer },
        });
        const result = await runner.run({ stage: 'scenes' });
        if (!result.ok)
          throw new Error(`${result.error.message}\n${(result.error.issues ?? []).join('\n')}`);
        expect(result.value.message).toBe('1 shots: 1 ✓; props built: fridge');
        const record = scenesReportSchema
          .parse(JSON.parse(readProject(dir, '.reelforge/scenes-report.json')))
          .shots.find((entry) => entry.shotId === shot.id);
        expect(record).toMatchObject({ status: 'ok', builtProps: ['fridge'], missingProps: [] });
        const props = propsReportSchema.parse(
          JSON.parse(readProject(dir, '.reelforge/props-report.json')),
        );
        expect(props.props).toEqual([
          expect.objectContaining({ name: 'fridge', status: 'built', findings: [] }),
        ]);
        expect(
          existsSync(path.join(dir, '.reelforge', 'frames', 'props', 'fridge', 'qa-1.png')),
        ).toBe(true);
        expect(readProject(dir, shot.scene)).toContain('ctx.kit.props.fridge');
        const subjects = (await projects.history(dir)).map((entry) => entry.subject);
        expect(subjects).toEqual(
          expect.arrayContaining(['Prop fridge built ✓', 'Scene s01 built ✓']),
        );
      } finally {
        await harness.dispose();
      }
    },
  );

  it(
    'keeps the fallback (⚠) when the prop still floats after its fix turn',
    { timeout: 300_000 },
    async () => {
      const { dir, shot } = await film('fridge failed');
      const floating = FRIDGE_PROP.replace(
        'hinge.position.set(-10 * s, s, 8 * s);',
        'hinge.position.set(-10 * s, 2, 8 * s);',
      );
      const harness = new FakeClaudeHarness({
        version: 1,
        rules: [
          buildRule(shot, sceneSource(shot), 'Built with a white box.\nMISSING: fridge'),
          propRule('fridge', floating),
        ],
        default: { scenario: 'tools-write', reply: CRITIC_OK },
      });
      try {
        const runner = new StageRunner({
          projectDir: dir,
          claude: harness.runner,
          guard: harness.guard,
          git: projects.git,
          scenes: { frames: renderer },
        });
        const result = await runner.run({ stage: 'scenes' });
        if (!result.ok) throw new Error(result.error.message);
        expect(result.value.message).toBe('1 shots: 1 ⚠');
        const fix = harness.specs.find((spec) => spec.prompt.includes('This is fix 2'));
        expect(fix?.prompt).toMatch(/floating: part \d+ \(.*\) floats at y=/);
        expect(existsSync(path.join(dir, 'kit-ext', 'props', 'fridge.js'))).toBe(false);
        expect(readProject(dir, '.reelforge/props-failed/fridge.js')).toBe(floating);
        const record = scenesReportSchema
          .parse(JSON.parse(readProject(dir, '.reelforge/scenes-report.json')))
          .shots.find((entry) => entry.shotId === shot.id);
        expect(record).toMatchObject({ status: 'warning', missingProps: ['fridge'] });
      } finally {
        await harness.dispose();
      }
    },
  );
});
