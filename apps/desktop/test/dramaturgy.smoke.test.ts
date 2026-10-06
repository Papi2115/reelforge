/**
 * Story beats (dramaturgy) in the Director tab of the built app (`pnpm test:app`, PLAN.md#12.25–
 * 12.27, docs/ux/redesign-2.4.md U9) on the CLI fixture project with the tension map and the
 * dramaturgy switches turned on in project.json and a curve with a peak: Scenes built points to
 * the Director ("Open the Director"), whose Story beats section shows a proposed wow moment; Accept
 * writes moments.json and commits it (`Moments: accepted …`, step `moments`); Reject undoes it;
 * the Director's Editing switch "Cut on the beat" commits like Project settings (`Project
 * settings: beat sync on`) and shows its line; Project settings → Direction lists the three
 * dramaturgy switches. No Claude involved.
 * Screenshots at 1280x720: out/test-app/dramaturgy-1280.png, out/test-app/director-1280.png.
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ElectronApplication, Locator, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeApp,
  fixtureProject,
  launchApp,
  screenshotDir,
  stubFolderPicker,
} from './support/electron-app.js';
import { openStage } from './support/pipeline-rows.js';
import { projectMenu } from './support/project-menu.js';

let app: ElectronApplication | undefined;
let page: Page;
let userDataDir: string;
let dir: string;

interface MomentsOnDisk {
  readonly moments: readonly { readonly status: string; readonly kind: string }[];
}

function git(args: readonly string[]): string {
  const run = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return run.stdout.trim();
}

async function moments(): Promise<MomentsOnDisk> {
  return JSON.parse(await readFile(path.join(dir, 'moments.json'), 'utf8')) as MomentsOnDisk;
}

function section(): Locator {
  return page.getByRole('region', { name: 'Story beats', exact: true });
}

beforeAll(async () => {
  userDataDir = await mkdtemp(path.join(tmpdir(), 'reelforge dramaturgy ż-'));
  dir = path.join(userDataDir, 'Projekt ż dramaturgia');
  await cp(fixtureProject, dir, { recursive: true });
  const project = JSON.parse(await readFile(path.join(dir, 'project.json'), 'utf8')) as object;
  await writeFile(
    path.join(dir, 'project.json'),
    JSON.stringify(
      {
        ...project,
        tensionMap: 'auto',
        patternInterrupts: 'auto',
        openLoops: 'auto',
        revealMoments: 'auto',
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(dir, 'tension.json'),
    JSON.stringify({
      version: 1,
      source: 'user',
      points: [
        { t: 0, v: 0.2 },
        { t: 3.7, v: 0.95 },
        { t: 7.5, v: 0.3 },
      ],
    }),
  );
  app = await launchApp(userDataDir);
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.setContentSize(1280, 720);
  });
  page = await app.firstWindow();
  await page.waitForFunction(() => window.innerWidth === 1280 && window.innerHeight === 720);
});

afterAll(async () => {
  await closeApp(app);
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 5 });
});

describe('story beats in the Director', () => {
  it('proposes a wow moment; Accept and Reject are saved and committed', async () => {
    if (app === undefined) throw new Error('the app is not running');
    await stubFolderPicker(app, dir);
    await page.getByRole('button', { name: 'Open project…' }).click();
    // One click on the row docks the Scenes built panel; it points to the Director.
    await openStage(page, 'Scenes built');
    const pointer = page.getByTestId('director-pointer');
    await pointer.waitFor({ timeout: 30_000 });
    expect(await page.getByTestId('dramaturgy').count()).toBe(0);
    await pointer.getByRole('button', { name: 'Open the Director' }).click();
    await page.getByRole('tab', { name: 'Director', selected: true }).waitFor();
    await section().waitFor({ timeout: 30_000 });
    await section().getByText('Wow moments').waitFor();
    await section().getByText('Questions & answers:').waitFor();
    await section().getByText('Wow moments').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(screenshotDir, 'dramaturgy-1280.png') });

    await section().getByRole('button', { name: 'Accept' }).first().click();
    await expect
      .poll(() => git(['log', '-1', '--format=%s']), { timeout: 15_000 })
      .toMatch(/^Moments: accepted /);
    expect(git(['log', '-1', '--format=%(trailers:key=ReelForge-Step,valueonly)'])).toBe('moments');
    expect((await moments()).moments.map((moment) => moment.status)).toEqual(['accepted']);

    await section().getByRole('button', { name: 'Reject' }).first().click();
    await expect
      .poll(() => git(['log', '-1', '--format=%s']), { timeout: 15_000 })
      .toMatch(/^Moments: rejected /);
    expect((await moments()).moments.map((moment) => moment.status)).toEqual(['rejected']);

    // The Director's switches are the Project settings rows: same file, same commit.
    const editing = page.getByRole('region', { name: 'Editing', exact: true });
    await editing.getByRole('checkbox', { name: /^Cut on the beat/ }).check();
    await expect
      .poll(() => git(['log', '-1', '--format=%s']), { timeout: 15_000 })
      .toBe('Project settings: beat sync on');
    await editing.getByTestId('beat-sync-line').waitFor({ timeout: 15_000 });
    await page.getByRole('region', { name: 'Director', exact: true }).evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.screenshot({ path: path.join(screenshotDir, 'director-1280.png') });

    await projectMenu(page, 'Project settings');
    const dialog = page.getByRole('dialog', { name: 'Project settings' });
    for (const label of [
      'Plan pattern interrupts',
      'Open and close loops',
      'Propose reveal moments',
    ]) {
      expect(await dialog.getByRole('checkbox', { name: new RegExp(label) }).isChecked()).toBe(
        true,
      );
    }
  });
});
