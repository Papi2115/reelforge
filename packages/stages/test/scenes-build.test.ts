/**
 * PLAN.md#7.4 acceptance on the REAL engine (Playwright Chromium + SwiftShader): an 8-shot film
 * builds without manual intervention — fake-claude writes the scene files (a lint error, a blank
 * frame and overlapping cards repaired by one fix each, a "clipped" critic verdict fixed, a
 * missing prop left ⚠), and every QA round is lint + smoke render + code checks + critic.
 * Slow (~30 s): every QA round renders 5 frames of a shot in software WebGL.
 */
import { autocommit } from '@reelforge/project';
import { scenesReportSchema } from '@reelforge/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { PlaywrightFrameRenderer } from '../src/cli/playwright-renderer.js';
import { StageRunner } from '../src/runner.js';
import { FakeClaudeHarness } from '../src/testing/fake-claude.js';
import {
  EIGHT_SHOT_FIXES,
  EIGHT_SHOT_STATUSES,
  eightShotScript,
  filmShots,
  writeFilm,
} from '../src/testing/film.js';
import { TestProjects, readProject } from '../src/testing/project.js';

const projects = new TestProjects();
const renderer = new PlaywrightFrameRenderer();

afterAll(async () => {
  await renderer.close();
  projects.dispose();
});

describe('Scenes built on the real engine', () => {
  it('builds the 8-shot film: 7 ✓, 1 ⚠, two shots at a time', { timeout: 300_000 }, async () => {
    const dir = await projects.create('eight shots real');
    const shots = filmShots(8);
    writeFilm(dir, shots);
    expect((await autocommit(dir, 'Storyboard', { kind: 'manual', git: projects.git })).ok).toBe(
      true,
    );
    const harness = new FakeClaudeHarness(eightShotScript(shots), { concurrency: 2 });
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
      expect(result.value.message).toBe('8 shots: 7 ✓, 1 ⚠');
      const report = scenesReportSchema.parse(
        JSON.parse(readProject(dir, '.reelforge/scenes-report.json')),
      );
      const byId = new Map(report.shots.map((entry) => [entry.shotId, entry]));
      expect(Object.fromEntries([...byId].map(([id, entry]) => [id, entry.status]))).toEqual(
        EIGHT_SHOT_STATUSES,
      );
      for (const [id, fixes] of Object.entries(EIGHT_SHOT_FIXES)) {
        expect(byId.get(id)?.fixIterations, id).toBe(fixes);
      }
      // The engine found the problems the fixes addressed: lint, blank frames, overlapping cards.
      const fixPrompts = harness.specs
        .filter((spec) => spec.stage === 'scene-fix')
        .map((spec) => spec.prompt);
      expect(fixPrompts.find((prompt) => prompt.includes('shot s03'))).toContain('[lint]');
      expect(fixPrompts.find((prompt) => prompt.includes('shot s04'))).toContain('[card-overlap]');
      expect(fixPrompts.find((prompt) => prompt.includes('shot s08'))).toContain('looks blank');
      expect(fixPrompts.find((prompt) => prompt.includes('shot s05'))).toContain('"clipped"');
      expect(byId.get('s01')?.contactSheet).toBe('.reelforge/frames/qa/s01/build-r0.png');
      expect(renderer.maxActive).toBeLessThanOrEqual(2);
    } finally {
      await harness.dispose();
    }
  });
});
