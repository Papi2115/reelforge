/**
 * Dramaturgy in the built app (`pnpm test:app`, PLAN.md#12.25–12.27) on the CLI fixture project
 * with the tension map and the dramaturgy switches turned on in project.json and a curve with a
 * peak: Scenes built shows the Dramaturgy section with a proposed reveal moment; Accept writes
 * moments.json and commits it (`Moments: accepted …`, step `moments`); Reject undoes it; Project
 * settings → Direction lists the three dramaturgy switches. No Claude involved.
 * Screenshot at 1280x720: out/test-app/dramaturgy-1280.png.
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
import { showStage } from './support/pipeline-rows.js';

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
  return page.getByRole('region', { name: 'Dramaturgy' });
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

describe('dramaturgy section', () => {
  it('proposes a reveal moment; Accept and Reject are saved and committed', async () => {
    if (app === undefined) throw new Error('the app is not running');
    await stubFolderPicker(app, dir);
    await page.getByRole('button', { name: 'Open project…' }).click();
    await (await showStage(page, 'Scenes built')).click({ timeout: 30_000 });
    // Selecting the row shows its actions; Open docks the Scenes built panel.
    await page
      .getByRole('region', { name: 'Pipeline' })
      .getByRole('group', { name: 'Scenes built actions' })
      .getByRole('button', { name: 'Open' })
      .click();
    await section().waitFor({ timeout: 30_000 });
    await section().getByText('Reveal moments').waitFor();
    await section().getByText('Open loops:').waitFor();
    await section().getByText('Reveal moments').scrollIntoViewIfNeeded();
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

    await page.getByRole('button', { name: 'Project settings' }).click();
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
