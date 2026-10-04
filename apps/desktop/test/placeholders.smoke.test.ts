/**
 * Preview placeholders (hotfix 2.3.1) in the built app (`pnpm test:app`): a project whose
 * storyboard has three shots but only one built scene previews its own video (not the demo), with
 * placeholder cards for the unbuilt shots and a note saying how many are built; writing a second
 * scene file hot-reloads that shot and updates the note. Screenshots land in out/test-app/.
 */
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ElectronApplication, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeApp,
  fixtureProject,
  frameStats,
  launchApp,
  screenshotDir,
  stubFolderPicker,
  waitForProjectPreview,
  waitForRenderedT,
} from './support/electron-app.js';

const STORYBOARD = {
  version: 1,
  shots: [
    {
      id: 's01',
      t0: 0,
      t1: 2.2,
      treatment: 'title-card',
      intent: 'Doom runs on almost anything.',
      scene: 'scenes/s01_title.js',
    },
    {
      id: 's02',
      t0: 2.2,
      t1: 5,
      treatment: 'metaphor-object',
      intent: 'A calculator with only 61 KB of memory still runs Doom.',
      scene: 'scenes/s02_calc.js',
    },
    {
      id: 's003_unbelievable',
      t0: 5,
      t1: 7.5,
      treatment: 'title-card',
      intent: 'The unbelievable part: it runs at a playable frame rate on a pocket calculator.',
      scene: 'scenes/s003_unbelievable.js',
    },
  ],
};

let app: ElectronApplication;
let page: Page;
let userDataDir: string;
let projectDir: string;
let calcScene: string;

/** Window of the size the placeholder card has to be readable at. */
async function useWindowSize(width: number, height: number): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow }, size) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.setContentSize(size.width, size.height);
      }
    },
    { width, height },
  );
}

async function seek(t: string): Promise<void> {
  await page.getByRole('slider', { name: 'Scrub' }).fill(t);
  await waitForRenderedT(page, Number(t).toFixed(3));
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge placeholders ż-'));
  projectDir = path.join(userDataDir, 'Zaślepki projekt');
  await cp(fixtureProject, projectDir, { recursive: true });
  await writeFile(path.join(projectDir, 'storyboard.json'), JSON.stringify(STORYBOARD, null, 2));
  const calcFile = path.join(projectDir, 'scenes', 's02_calc.js');
  calcScene = await readFile(calcFile, 'utf8');
  await rm(calcFile);
  await mkdir(screenshotDir, { recursive: true });
  app = await launchApp(userDataDir);
  page = await app.firstWindow();
  await useWindowSize(1280, 720);
  await page.getByRole('region', { name: 'Start' }).waitFor();
  await stubFolderPicker(app, projectDir);
  await page.getByRole('button', { name: 'Open project…' }).click();
  await waitForProjectPreview(page);
});

afterAll(async () => {
  await closeApp(app);
  await rm(userDataDir, { recursive: true, force: true });
});

describe('preview placeholders', () => {
  it("previews the project's own video with placeholder cards for unbuilt shots", async () => {
    const note = page.locator('.preview-note');
    await note.filter({ hasText: '1 of 3 shots built — the rest show placeholders' }).waitFor();
    expect(await note.textContent()).not.toContain('demo scene');
    // The whole storyboard plays: 7.5 s, the placeholders keep their shots' durations.
    await seek('7.4');
    const placeholder = await frameStats(page);
    expect(placeholder.distinctColours).toBeGreaterThan(1);
    await page.screenshot({ path: path.join(screenshotDir, 'placeholders-unbuilt-shot.png') });
    await seek('3.5');
    const unbuiltCalc = await frameStats(page);
    expect(unbuiltCalc.hash).not.toBe(placeholder.hash);
    await page
      .locator('canvas.preview-canvas')
      .screenshot({ path: path.join(screenshotDir, 'placeholders-card.png') });
    await seek('1');
    expect((await frameStats(page)).hash).not.toBe(unbuiltCalc.hash);
  });

  it('picks up a scene file written later and updates the note', async () => {
    await seek('3.5');
    const before = await frameStats(page);
    await writeFile(path.join(projectDir, 'scenes', 's02_calc.js'), calcScene);
    await page
      .locator('.preview-note')
      .filter({ hasText: '2 of 3 shots built — the rest show placeholders' })
      .waitFor({ timeout: 15_000 });
    await page
      .getByTestId('preview-reload')
      .filter({ hasText: 'Reloaded s02' })
      .waitFor({ timeout: 15_000 });
    await waitForRenderedT(page, '3.500');
    const after = await frameStats(page);
    expect(after.hash).not.toBe(before.hash);
    expect(await page.getByTestId('preview-problem').count()).toBe(0);
    await page.screenshot({ path: path.join(screenshotDir, 'placeholders-scene-built.png') });
  });
});
