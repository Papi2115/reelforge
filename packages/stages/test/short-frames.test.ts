/**
 * Shorts on the REAL engine (Playwright Chromium + SwiftShader), PLAN.md#13.18: the app-written
 * end card passes its code QA (lint, render, blank, cards, safe area, phone legibility) in a
 * portrait short with captions on; the end card and the word-by-word captions match their
 * goldens; captions are deterministic and absent without the manifest flag.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { autocommit } from '@reelforge/project';
import {
  endCardShot,
  scenesReportSchema,
  storyboardFileSchema,
  type ProjectFile,
  type TimedWord,
} from '@reelforge/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  compareWithGolden,
  launchHarnessBrowser,
  type HarnessBrowser,
  type HarnessPage,
} from '../../engine/src/cli/index.js';
import { PlaywrightFrameRenderer } from '../src/cli/playwright-renderer.js';
import { StageRunner } from '../src/runner.js';
import { endCardSceneSource } from '../src/shorts/end-card-scene.js';
import { FakeClaudeHarness } from '../src/testing/fake-claude.js';
import { buildRule, CRITIC_OK, filmShots, sceneSource, writeFilm } from '../src/testing/film.js';
import { TestProjects, readProject, writeProject } from '../src/testing/project.js';

const GOLDEN_DIR = path.join(import.meta.dirname, 'goldens', 'swiftshader');
const PORTRAIT_FILE = path.join(
  import.meta.dirname,
  '..',
  '..',
  'kit',
  'examples',
  'k12_portrait.js',
);
const END_CARD_TEXT = 'Full video on YT: Voxplain';

type RenderManifest = Parameters<HarnessPage['load']>[0];

const projects = new TestProjects();
const renderer = new PlaywrightFrameRenderer();
let browser: HarnessBrowser;

beforeAll(async () => {
  browser = await launchHarnessBrowser();
});

afterAll(async () => {
  await browser.close();
  await renderer.close();
  projects.dispose();
});

function words(): TimedWord[] {
  const text = 'Your kitchen glass is hiding a rainbow. Fill it with water and shine a light.';
  return text.split(' ').map((word, index) => {
    const t = Math.round((0.2 + index * 0.37) * 1000) / 1000;
    return { text: word, t, tEnd: Math.round((t + 0.3) * 1000) / 1000 };
  });
}

function captionsManifest(captions: boolean): RenderManifest {
  return {
    version: 1,
    format: 'portrait',
    fps: 30,
    seed: 2115,
    ...(captions ? { captions: true } : {}),
    words: { version: 1, words: words() },
    shots: [
      {
        id: 'k12',
        t0: 0,
        t1: 6,
        scene: { file: 'k12_portrait.js', source: readFileSync(PORTRAIT_FILE, 'utf8') },
      },
    ],
  };
}

describe('shorts on the real engine', () => {
  it('writes the end card without Claude and it passes code QA', { timeout: 300_000 }, async () => {
    const dir = await projects.create('short end card real');
    const shots = filmShots(1);
    writeFilm(dir, shots);
    const storyboard = storyboardFileSchema.parse(JSON.parse(readProject(dir, 'storyboard.json')));
    const lastT1 = storyboard.shots.at(-1)?.t1 ?? 0;
    const card = endCardShot(lastT1, END_CARD_TEXT);
    const withCard = { ...storyboard, shots: [...storyboard.shots, card] };
    writeProject(dir, 'storyboard.json', JSON.stringify(withCard, null, 2));
    const project = JSON.parse(readProject(dir, 'project.json')) as ProjectFile;
    const short: ProjectFile = {
      ...project,
      format: 'portrait',
      kind: 'short',
      parentProject: { folder: path.join(dir, 'no parent'), title: 'Parent film' },
      short: { lengthS: 30, captions: true, endCardText: END_CARD_TEXT },
    };
    writeProject(dir, 'project.json', JSON.stringify(short, null, 2));
    expect((await autocommit(dir, 'Storyboard', { kind: 'manual', git: projects.git })).ok).toBe(
      true,
    );
    const [first] = shots;
    if (first === undefined) throw new Error('no shot');
    const harness = new FakeClaudeHarness({
      version: 1,
      rules: [buildRule(first, sceneSource(first))],
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
      const report = scenesReportSchema.parse(
        JSON.parse(readProject(dir, '.reelforge/scenes-report.json')),
      );
      const entry = report.shots.find((shot) => shot.shotId === card.id);
      expect(entry?.findings).toEqual([]);
      expect(entry?.status).toBe('ok');
      expect(harness.specs.filter((spec) => spec.stage === 'scene-build')).toHaveLength(1);
    } finally {
      await harness.dispose();
    }
  });

  it('renders the portrait end card as its golden', async () => {
    const page = await browser.open({ lint: true });
    try {
      const source = endCardSceneSource({
        shot: { id: 'end_card', treatment: 'title-card' },
        text: END_CARD_TEXT,
        format: 'portrait',
      });
      const info = await page.load({
        version: 1,
        format: 'portrait',
        fps: 30,
        seed: 2115,
        shots: [{ id: 'end_card', t0: 0, t1: 2, scene: { file: 'end_card.js', source } }],
      });
      expect([info.width, info.height]).toEqual([360, 640]);
      const data = await page.frameAt(1);
      await compareWithGolden(
        'short-end-card-portrait-t1',
        { width: 360, height: 640, data },
        undefined,
        {
          goldenDir: GOLDEN_DIR,
        },
      );
      expect(page.errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('draws deterministic word-by-word captions only with the flag', async () => {
    const page = await browser.open({ lint: true });
    try {
      await page.load(captionsManifest(false));
      const plain = await page.hashAt(1.5);
      await page.load(captionsManifest(true));
      const captioned = await page.hashAt(1.5);
      expect(captioned).not.toBe(plain);
      expect(await page.hashAt(4)).not.toBe(captioned);
      expect(await page.hashAt(1.5)).toBe(captioned);
      const data = await page.frameAt(1.5);
      await compareWithGolden('short-captions-t1.5', { width: 360, height: 640, data }, undefined, {
        goldenDir: GOLDEN_DIR,
      });
      expect(page.errors).toEqual([]);
    } finally {
      await page.close();
    }
  });
});
