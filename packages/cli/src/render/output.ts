/** Writes rendered images under `<project>/.reelforge/frames/` (tmp + rename). */
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { encodePng, type RgbaImage } from '@reelforge/engine/raster';
import { PROJECT_PATHS, projectPath } from '../project/paths.js';

/** `s03` + 2.5 -> `s03_t2.500.png` (sortable, safe on Windows). */
export function frameFileName(shotId: string, t: number): string {
  return `${shotId}_t${t.toFixed(3)}.png`;
}

export function framesDir(root: string, ...parts: string[]): string {
  return path.join(projectPath(root, PROJECT_PATHS.frames), ...parts);
}

/** Writes a PNG atomically and returns its absolute path. */
export async function writePng(file: string, image: RgbaImage): Promise<string> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${String(process.pid)}.tmp`;
  await writeFile(temporary, encodePng(image));
  await rename(temporary, file);
  return file;
}
