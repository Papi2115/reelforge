/**
 * `node scripts/run.mjs icon`: regenerates the app icon (build-resources/icon.png, 256 px, and
 * build-resources/icon.ico, 16-256 px) from icon-art.ts. The outputs are committed; run this only
 * after changing the design.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { encodePng } from '@reelforge/engine/raster';
import { BUILD_RESOURCES_DIR } from '../electron-builder.config.js';
import type { TaskContext } from './bundle.js';
import { ICON_SIZES, icoContainer, iconImage } from './icon-art.js';

export async function run(task: TaskContext): Promise<void> {
  const target = path.join(task.appRoot, BUILD_RESOURCES_DIR);
  await mkdir(target, { recursive: true });
  const entries = ICON_SIZES.map(([size, grid]) => ({
    size,
    png: encodePng(iconImage(size, grid)),
  }));
  const largest = entries.at(-1);
  if (largest === undefined) throw new Error('no icon sizes');
  await writeFile(path.join(target, 'icon.png'), largest.png);
  await writeFile(path.join(target, 'icon.ico'), icoContainer(entries));
  process.stdout.write(`icon written -> ${target}\n`);
}
