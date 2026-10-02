/**
 * `pnpm test:packaged` after `pnpm dist`: installs the NSIS installer silently (per-user, no
 * admin) into a temporary folder with a space and a Polish letter, runs the packaged smoke checks
 * on the installed app, then uninstalls it silently and checks that the folder, the shortcuts and
 * the uninstall registry entry are gone. Skipped when release/ has no installer.
 */
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PRODUCT_NAME } from '../../electron-builder.config.js';
import {
  findInstaller,
  installSilently,
  isRunning,
  registryMatches,
  shortcutFiles,
  UNINSTALL_KEY,
  uninstallerOf,
  uninstallSilently,
} from './installer.js';
import { definePackagedSmokeTests } from './packaged-checks.js';

const installer = findInstaller();
const EXE = `${PRODUCT_NAME}.exe`;

describe.skipIf(installer === undefined)('NSIS installer (silent, per-user)', () => {
  let installRoot = '';
  let installDir = '';
  let shortcuts: string[] = [];
  let uninstalled = false;

  const installedExe = (): string => path.join(installDir, EXE);
  const leftovers = async (): Promise<string[]> => [
    ...(existsSync(installedExe()) ? [installedExe()] : []),
    ...shortcuts.filter((file) => existsSync(file)),
    ...((await registryMatches(UNINSTALL_KEY, installDir)) > 0 ? [UNINSTALL_KEY] : []),
  ];

  beforeAll(async () => {
    shortcuts = await shortcutFiles();
    const existing = shortcuts.filter((file) => existsSync(file));
    if (existing.length > 0 || (await isRunning(EXE))) {
      throw new Error(
        `ReelForge seems installed or running on this machine (${existing.join(', ')}); not touching it`,
      );
    }
    installRoot = await mkdtemp(path.join(tmpdir(), 'reelforge install ż-'));
    installDir = path.join(installRoot, 'Reel Forge');
    await installSilently(installer ?? '', installDir);
  }, 180_000);

  afterAll(async () => {
    if (!uninstalled && existsSync(uninstallerOf(installDir))) {
      await uninstallSilently(installDir, async () => (await leftovers()).length === 0);
    }
    await rm(installRoot, { recursive: true, force: true });
  }, 120_000);

  it('installs into the chosen folder with shortcuts and an uninstall entry', async () => {
    expect(existsSync(installedExe())).toBe(true);
    expect(existsSync(uninstallerOf(installDir))).toBe(true);
    for (const dir of ['hooks', 'cli', 'template']) {
      expect(existsSync(path.join(installDir, 'resources', dir))).toBe(true);
    }
    expect(await registryMatches(UNINSTALL_KEY, installDir)).toBeGreaterThan(0);
    for (const file of shortcuts) expect(existsSync(file), file).toBe(true);
    // A silent install must not start the app (it would use the real profile).
    expect(await isRunning(EXE)).toBe(false);
  });

  definePackagedSmokeTests('installed', installedExe);

  it('uninstalls silently: folder, shortcuts and uninstall entry are gone', async () => {
    uninstalled = await uninstallSilently(installDir, async () => (await leftovers()).length === 0);
    expect(await leftovers()).toEqual([]);
    expect(existsSync(path.join(installDir, 'resources'))).toBe(false);
    expect(uninstalled).toBe(true);
  }, 90_000);
});
