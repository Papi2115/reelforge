/**
 * Frame critics (PLAN.md#7.5) on frames of the REAL engine (Playwright Chromium + SwiftShader):
 * deliberately broken scene variants — blank frame, text cut at the frame edge, overlapping
 * cards — are caught by the programmatic layer without Claude; the Haiku layer runs on
 * fake-claude returning canned JSON.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { ok } from '@reelforge/claude-bridge';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PlaywrightFrameRenderer } from '../src/cli/playwright-renderer.js';
import { criticLookVars } from '../src/looks.js';
import { critiqueFrames, programmaticCritique, type TurnRunner } from '../src/scenes/critic.js';
import { smokeTimes } from '../src/scenes/qa.js';
import type { ShotRenderOk } from '../src/scenes/tools.js';
import { FakeClaudeHarness } from '../src/testing/fake-claude.js';
import { filmShots, sceneSource, writeFilm, type SceneVariant } from '../src/testing/film.js';
import { TestProjects } from '../src/testing/project.js';

const VARIANTS: readonly SceneVariant[] = ['ok', 'blank', 'clipped', 'overlap'];
const projects = new TestProjects();
const renderer = new PlaywrightFrameRenderer();
const shots = filmShots(VARIANTS.length);
const renders = new Map<SceneVariant, ShotRenderOk>();
let dir = '';

beforeAll(async () => {
  dir = await projects.create('critics');
  writeFilm(dir, shots);
  shots.forEach((shot, index) => {
    writeFileSync(path.join(dir, ...shot.scene.split('/')), sceneSource(shot, VARIANTS[index]));
  });
  for (const [index, shot] of shots.entries()) {
    const render = await renderer.renderShot(
      { projectDir: dir, shotId: shot.id, times: smokeTimes(shot.t1 - shot.t0), cards: true },
      new AbortController().signal,
    );
    if (!render.ok) throw new Error(`${shot.id}: ${render.error}`);
    renders.set(VARIANTS[index] ?? 'ok', render);
  }
});

afterAll(async () => {
  await renderer.close();
  projects.dispose();
});

function rendered(variant: SceneVariant): ShotRenderOk {
  const render = renders.get(variant);
  if (render === undefined) throw new Error(`no render of ${variant}`);
  return render;
}

describe('a scene that throws in update()', () => {
  it('is a failed render of that shot (a QA finding), not a renderer outage', async () => {
    const [shot] = filmShots(1);
    if (shot === undefined) throw new Error('no shot');
    const file = path.join(dir, ...shot.scene.split('/'));
    writeFileSync(file, sceneSource(shot, 'update-throws'));
    const render = await renderer.renderShot(
      { projectDir: dir, shotId: shot.id, times: [0, 1.5], cards: true },
      new AbortController().signal,
    );
    writeFileSync(file, sceneSource(shot, VARIANTS[0]));
    expect(render.ok).toBe(false);
    if (render.ok) return;
    expect(render.error).toMatch(
      /^rendering t=1\.50s: \[shot s01\] update\(1\.5\) threw TypeError: Cannot read properties of undefined/,
    );
  });
});

describe('programmatic critics (no Claude)', () => {
  it('pass a clean scene', () => {
    expect(rendered('ok').frames).toHaveLength(5);
    expect(programmaticCritique(rendered('ok'))).toEqual([]);
  });

  it('catch a blank frame', () => {
    const findings = programmaticCritique(rendered('blank'));
    expect(findings.length).toBeGreaterThan(0);
    expect(new Set(findings.map((entry) => entry.source))).toEqual(new Set(['blank']));
    expect(findings.map((entry) => entry.t)).toEqual([0, 0.5, 1, 1.5, 1.9]);
  });

  it('catch text cut at the frame edge (outside the safe area)', () => {
    const [finding, ...rest] = programmaticCritique(rendered('clipped'));
    expect(rest).toEqual([]);
    expect(finding?.source).toBe('cards');
    expect(finding?.message).toContain('[card-outside-safe-area] card "title"');
    expect(finding?.message).toContain('cut off by the frame edge');
  });

  it('catch overlapping cards', () => {
    const findings = programmaticCritique(rendered('overlap'));
    expect(findings.map((entry) => entry.source)).toEqual(['cards']);
    expect(findings[0]?.message).toContain('[card-overlap] cards "clash" and "title" overlap');
  });
});

describe('Haiku critic layer (fake-claude)', () => {
  it('adds the verdicts of the canned critic JSON to the findings', async () => {
    const sheet = '.reelforge/frames/qa/s03/critic-test.png';
    const harness = new FakeClaudeHarness([
      {
        scenario: 'tools-write',
        reply: JSON.stringify({
          frames: [{ path: sheet, verdict: 'clipped', note: 'title cut at the right edge' }],
        }),
      },
      { scenario: 'tools-write', reply: 'The frames look fine to me.' },
    ]);
    const runTurn: TurnRunner = async (turn) =>
      ok(
        await harness.runner.run({
          projectDir: dir,
          stage: 'critic',
          purpose: turn.purpose,
          prompt: turn.text,
          model: 'haiku',
          newSession: turn.newSession,
        }),
      );
    try {
      const input = {
        projectDir: dir,
        shotId: 's03',
        intent: 'Number three lands on the desk.',
        styleId: 'voxel-pixel-crisp640',
        render: rendered('clipped'),
        sheetFile: sheet,
      };
      const judged = await critiqueFrames(input, runTurn);
      expect(judged.ok && judged.value.verdicts).toEqual([
        { verdict: 'clipped', note: 'title cut at the right edge' },
      ]);
      expect(judged.ok && judged.value.findings.map((entry) => entry.source)).toEqual([
        'cards',
        'critic',
      ]);
      expect(harness.specs[0]?.prompt).toContain(`Look at the image(s) at: ${sheet}`);
      expect(harness.specs[0]?.prompt).not.toContain('Look of this shot');
      const lookVars = criticLookVars('mixed', {
        id: 's03',
        t0: 0,
        t1: 4,
        treatment: 'ui-mockup',
        intent: input.intent,
        scene: 'scenes/s03.js',
        look: 'retro-ui',
        roll: 'B',
      });
      const prose = await critiqueFrames({ ...input, lookVars, render: rendered('ok') }, runTurn);
      expect(prose.ok && prose.value.findings).toEqual([]);
      expect(prose.ok && prose.value.notes[0]).toContain('not valid JSON');
      expect(harness.specs[1]?.prompt).toContain('Look of this shot: `retro-ui` (roll B).');
      expect(harness.specs[1]?.prompt).toContain('window title bar and the headline stay whole');
    } finally {
      await harness.dispose();
    }
  });
});
