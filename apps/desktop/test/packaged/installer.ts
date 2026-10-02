/**
 * Silent install / uninstall of the NSIS installer for the installer smoke test, and what the
 * per-user install leaves on the machine: the uninstall registry entry (HKCU) and the Desktop /
 * Start menu shortcuts.
 */
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { PRODUCT_NAME } from '../../electron-builder.config.js';
import { cleanEnv, releaseDir, runProcess } from './packaged-app.js';

export const UNINSTALL_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall';
const POLL_MS = 250;

/** The newest `ReelForge-Setup-<version>-x64.exe` in release/, if `pnpm dist` ran. */
export function findInstaller(): string | undefined {
  if (!existsSync(releaseDir)) return undefined;
  const installers = readdirSync(releaseDir)
    .filter((name) => /^ReelForge-Setup-.+-x64\.exe$/.test(name))
    .sort();
  const newest = installers.at(-1);
  return newest === undefined ? undefined : path.join(releaseDir, newest);
}

/** Number of registry values under `root` whose data contains `text`. */
export async function registryMatches(root: string, text: string): Promise<number> {
  const run = await runProcess('reg.exe', ['query', root, '/s', '/f', text, '/d'], {
    cwd: releaseDir,
    env: cleanEnv(),
  });
  const found = /End of search:\s*(\d+)/.exec(run.stdout);
  if (found?.[1] === undefined) {
    if (run.status === 1) return 0; // "ERROR: The system was unable to find the specified ..."
    throw new Error(`reg query failed (${String(run.status)}): ${run.stderr}`);
  }
  return Number(found[1]);
}

async function shellFolder(name: 'Desktop' | 'Programs'): Promise<string> {
  const run = await runProcess(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', `[Environment]::GetFolderPath('${name}')`],
    { cwd: releaseDir, env: cleanEnv() },
  );
  const folder = run.stdout.trim();
  if (run.status !== 0 || folder === '') throw new Error(`no ${name} folder: ${run.stderr}`);
  return folder;
}

/** Where the installer puts its shortcuts (per-user). */
export async function shortcutFiles(): Promise<string[]> {
  const file = `${PRODUCT_NAME}.lnk`;
  return [
    path.join(await shellFolder('Desktop'), file),
    path.join(await shellFolder('Programs'), file),
  ];
}

/** `/S /D=<dir>`: NSIS wants /D last and unquoted, even with spaces. */
export async function installSilently(installer: string, installDir: string): Promise<void> {
  const run = await runProcess(installer, ['/S', `/D=${installDir}`], {
    cwd: releaseDir,
    env: cleanEnv(),
    verbatim: true,
    argv0: `"${installer}"`,
  });
  if (run.status !== 0) throw new Error(`installer exited with ${String(run.status)}`);
}

export function uninstallerOf(installDir: string): string {
  return path.join(installDir, `Uninstall ${PRODUCT_NAME}.exe`);
}

/**
 * Runs the uninstaller silently. NSIS copies it to %TEMP% and returns at once, so this waits until
 * `done()` holds (the files are gone) or the timeout passes.
 */
export async function uninstallSilently(
  installDir: string,
  done: () => Promise<boolean>,
  timeoutMs = 60_000,
): Promise<boolean> {
  const uninstaller = uninstallerOf(installDir);
  const run = await runProcess(uninstaller, ['/S'], {
    cwd: releaseDir,
    env: cleanEnv(),
    verbatim: true,
    argv0: `"${uninstaller}"`,
  });
  if (run.status !== 0) throw new Error(`uninstaller exited with ${String(run.status)}`);
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (await done()) return true;
    await sleep(POLL_MS);
  }
  return done();
}

/** Whether a process with this image name runs (tasklist, no admin needed). */
export async function isRunning(imageName: string): Promise<boolean> {
  const run = await runProcess(
    'tasklist.exe',
    ['/FI', `IMAGENAME eq ${imageName}`, '/FO', 'CSV', '/NH'],
    { cwd: releaseDir, env: cleanEnv() },
  );
  return run.stdout.toLowerCase().includes(`"${imageName.toLowerCase()}"`);
}
