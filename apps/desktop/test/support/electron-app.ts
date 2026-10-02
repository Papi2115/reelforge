/**
 * Shared helpers of the app smoke tests: launching the built Electron app through Playwright,
 * opening a project folder through the (stubbed) native picker, and reading the preview canvas.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { _electron, type ElectronApplication, type Page } from 'playwright';
import { settingsFile, USER_DATA_ENV } from '../../src/main/app-paths.js';
import { DEV_SERVER_ENV } from '../../src/main/navigation-policy.js';

export const appRoot = path.resolve(import.meta.dirname, '..', '..');
export const screenshotDir = path.join(appRoot, 'out', 'test-app');
export const fixtureProject = path.resolve(
  appRoot,
  '..',
  '..',
  'packages',
  'cli',
  'test',
  'fixtures',
  'project',
);
export const FIRST_FRAME_TIMEOUT_MS = 60_000;

function electronBinary(): string {
  const require = createRequire(import.meta.url);
  const binary: unknown = require('electron');
  if (typeof binary !== 'string')
    throw new Error('the electron package did not return a binary path');
  return binary;
}

function launchEnv(
  userDataDir: string,
  extra: Readonly<Record<string, string>>,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined && name !== 'ELECTRON_RUN_AS_NODE' && name !== DEV_SERVER_ENV) {
      env[name] = value;
    }
  }
  env[USER_DATA_ENV] = userDataDir;
  return { ...env, ...extra };
}

export interface LaunchOptions {
  /** Keep the first-run "Connect Claude" gate (default: a fresh profile starts with it done). */
  readonly firstRun?: boolean;
  /** Extra env for the app (test hooks). */
  readonly env?: Readonly<Record<string, string>>;
}

/** A fresh profile gets settings with the first-run gate done, so it does not cover the app. */
async function seedSettings(userDataDir: string): Promise<void> {
  const file = settingsFile(userDataDir);
  if (existsSync(file)) return;
  await mkdir(userDataDir, { recursive: true });
  await writeFile(file, JSON.stringify({ version: 1, onboarding: { connectClaudeDone: true } }));
}

/**
 * Launches the built app. Its window is made non-focusable: otherwise it takes the OS keyboard
 * focus and real key presses on the machine running the tests (seen: an auto-repeating
 * ArrowRight) reach the player's shortcuts. Playwright's input does not need OS focus.
 */
export async function launchApp(
  userDataDir: string,
  options: LaunchOptions = {},
): Promise<ElectronApplication> {
  if (options.firstRun !== true) await seedSettings(userDataDir);
  const app = await _electron.launch({
    executablePath: electronBinary(),
    args: [appRoot],
    cwd: appRoot,
    env: launchEnv(userDataDir, options.env ?? {}),
  });
  await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.setFocusable(false);
      window.blur();
    }
  });
  return app;
}

/** Test hook: the native folder picker cannot be driven, so main's dialog is stubbed. */
export async function stubFolderPicker(app: ElectronApplication, folder: string): Promise<void> {
  await app.evaluate(({ dialog }, picked) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [picked] });
  }, folder);
}

export interface FrameStats {
  readonly renderedT: string;
  readonly width: number;
  readonly height: number;
  readonly distinctColours: number;
  readonly hash: string;
}

/** Reads the preview canvas back: size, distinct colours and an FNV-1a hash of the RGBA bytes. */
export function frameStats(page: Page): Promise<FrameStats> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.preview-canvas');
    const context = canvas?.getContext('2d');
    if (!canvas || !context) throw new Error('preview canvas missing');
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const colours = new Set<number>();
    let hash = 0x811c9dc5;
    for (let index = 0; index < data.length; index += 4) {
      colours.add(
        ((data[index] ?? 0) << 16) | ((data[index + 1] ?? 0) << 8) | (data[index + 2] ?? 0),
      );
      for (let channel = 0; channel < 4; channel += 1) {
        hash = Math.imul(hash ^ (data[index + channel] ?? 0), 0x01000193) >>> 0;
      }
    }
    return {
      renderedT: canvas.dataset['renderedT'] ?? '',
      width: canvas.width,
      height: canvas.height,
      distinctColours: colours.size,
      hash: hash.toString(16),
    };
  });
}

/** Waits until the preview shows the frame of time `t` (as written by the canvas sink). */
export async function waitForRenderedT(page: Page, t: string): Promise<void> {
  await page.waitForFunction(
    (expected) =>
      document.querySelector<HTMLCanvasElement>('canvas.preview-canvas')?.dataset['renderedT'] ===
      expected,
    t,
    { timeout: FIRST_FRAME_TIMEOUT_MS },
  );
}

/** Time of the frame on screen, in seconds. */
export async function renderedTime(page: Page): Promise<number> {
  return Number((await frameStats(page)).renderedT);
}
