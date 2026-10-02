/**
 * Shared steps of `pnpm package` (unpacked app, release/win-unpacked) and `pnpm dist` (NSIS
 * installer): build the app, stage the files that go into app.asar, run electron-builder with
 * electron-builder.config.ts and print what the result weighs.
 */
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { Arch, build, Platform } from 'electron-builder';
import { builderConfig, PRODUCT_NAME, RELEASE_DIR } from '../electron-builder.config.js';
import { run as buildApp } from './build.js';
import { appPaths, type TaskContext } from './bundle.js';

/** Built app folders that go into app.asar (the rest of out/ is dev/test output). */
const ASAR_DIRS = ['main', 'preload', 'renderer', 'demo'] as const;

export type PackageTarget = 'dir' | 'nsis';

function versionOf(manifest: unknown): string | undefined {
  const version: unknown =
    typeof manifest === 'object' && manifest !== null ? Reflect.get(manifest, 'version') : null;
  return typeof version === 'string' ? version : undefined;
}

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8')) as unknown;
}

/**
 * out/package/app: a package.json without dependencies (everything is bundled) and the built
 * main / preload / renderer / demo files.
 */
async function stageApp(context: TaskContext): Promise<string> {
  const version = versionOf(await readJson(path.join(context.appRoot, 'package.json')));
  if (version === undefined) throw new Error('apps/desktop/package.json has no version');
  const out = appPaths(context).out;
  const stageDir = path.join(out, 'package', 'app');
  await rm(stageDir, { recursive: true, force: true });
  await mkdir(stageDir, { recursive: true });
  const stagedManifest = {
    name: 'reelforge',
    productName: PRODUCT_NAME,
    version,
    // The exe's FileDescription (Task Manager shows it as the process name).
    description: PRODUCT_NAME,
    author: { name: 'ReelForge' },
    license: 'UNLICENSED',
    private: true,
    type: 'module',
    main: 'out/main/main.mjs',
  };
  await writeFile(
    path.join(stageDir, 'package.json'),
    `${JSON.stringify(stagedManifest, null, 2)}\n`,
  );
  for (const dir of ASAR_DIRS) {
    await cp(path.join(out, dir), path.join(stageDir, 'out', dir), { recursive: true });
  }
  return stageDir;
}

async function electronInputs(
  appRoot: string,
): Promise<{ electronDist: string; electronVersion: string }> {
  const require = createRequire(path.join(appRoot, 'package.json'));
  const binary: unknown = require('electron');
  if (typeof binary !== 'string') throw new Error('the electron package returned no binary path');
  const version = versionOf(await readJson(require.resolve('electron/package.json')));
  if (version === undefined) throw new Error('electron/package.json has no version');
  return { electronDist: path.dirname(binary), electronVersion: version };
}

async function sizeOf(target: string): Promise<number> {
  const info = await stat(target);
  if (!info.isDirectory()) return info.size;
  const entries = await readdir(target);
  const sizes = await Promise.all(entries.map((entry) => sizeOf(path.join(target, entry))));
  return sizes.reduce((sum, size) => sum + size, 0);
}

const MB = 1024 * 1024;

function megabytes(bytes: number): string {
  return `${(bytes / MB).toFixed(1)} MB`;
}

/** Size of every top-level entry (and of resources/) of the unpacked app, biggest first. */
async function sizeReport(unpacked: string): Promise<string> {
  const lines: string[] = [];
  const list = async (dir: string, prefix: string): Promise<void> => {
    const entries = await readdir(dir);
    const sized = await Promise.all(
      entries.map(async (entry) => ({ entry, size: await sizeOf(path.join(dir, entry)) })),
    );
    sized.sort((first, second) => second.size - first.size);
    for (const { entry, size } of sized) {
      if (size >= MB / 10) lines.push(`  ${megabytes(size).padStart(9)}  ${prefix}${entry}`);
    }
  };
  lines.push(`unpacked app: ${megabytes(await sizeOf(unpacked))} (${unpacked})`);
  await list(unpacked, '');
  await list(path.join(unpacked, 'resources'), 'resources/');
  return lines.join('\n');
}

export async function packageApp(context: TaskContext, target: PackageTarget): Promise<void> {
  await buildApp(context);
  const stageDir = await stageApp(context);
  const config = builderConfig({ stageDir, ...(await electronInputs(context.appRoot)) });
  const artifacts = await build({
    projectDir: context.appRoot,
    config,
    targets: Platform.WINDOWS.createTarget(target, Arch.x64),
    publish: 'never',
  });
  const unpacked = path.join(context.appRoot, RELEASE_DIR, 'win-unpacked');
  process.stdout.write(`${await sizeReport(unpacked)}\n`);
  for (const artifact of artifacts) {
    process.stdout.write(`artifact: ${megabytes(await sizeOf(artifact))}  ${artifact}\n`);
  }
}
