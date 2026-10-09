/**
 * Reusable assets a short takes from its film (PLAN.md#13.18): project props (`kit-ext/props`),
 * the cast's built roles and accessories (`characters/`) and a world film's own assets
 * (`assets/<world>/*.json`). Scenes, the storyboard, timing and audio are never copied: every
 * scene of a short is new. Files are copied byte for byte with atomic writes.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { writeAtomic } from '@reelforge/project';
import { isWorldAssetWorld, KIT_EXT_PROPS_DIR, worldAssetsDir } from '@reelforge/shared';

/** Folders a short may reuse (project-relative); a world's assets only for a world film. */
export function reusableFolders(style: string): string[] {
  return [
    KIT_EXT_PROPS_DIR,
    'characters',
    ...(isWorldAssetWorld(style) ? [worldAssetsDir(style)] : []),
  ];
}

/** Files under `relative` (recursive, project-relative with `/`); none when it does not exist. */
async function listFiles(root: string, relative: string): Promise<Result<string[], string>> {
  let entries;
  try {
    entries = await readdir(path.join(root, ...relative.split('/')), { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return ok([]);
    return err(
      `cannot list ${relative}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const files: string[] = [];
  for (const entry of entries) {
    const child = `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      const nested = await listFiles(root, child);
      if (!nested.ok) return nested;
      files.push(...nested.value);
    } else if (entry.isFile() && !entry.name.endsWith('.tmp')) {
      files.push(child);
    }
  }
  return ok(files.sort());
}

/** Copies the reusable folders of `fromDir` into `toDir`; returns the copied files. */
export async function copyReusableAssets(
  fromDir: string,
  toDir: string,
  style: string,
): Promise<Result<string[], string>> {
  const copied: string[] = [];
  for (const folder of reusableFolders(style)) {
    const files = await listFiles(fromDir, folder);
    if (!files.ok) return files;
    for (const file of files.value) {
      const parts = file.split('/');
      try {
        await writeAtomic(path.join(toDir, ...parts), await readFile(path.join(fromDir, ...parts)));
      } catch (error) {
        return err(
          `cannot copy ${file}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      copied.push(file);
    }
  }
  return ok(copied);
}
