/**
 * "Look assets" of a world film (PLAN.md#13.15): what the world-assets step of Scenes built
 * designed — its report (`.reelforge/world-assets.json`), whether the storyboard changed since,
 * and the designed things by name (`assets/cast.json` entries, then the asset files of
 * `assets/<world>/` the cast does not name). Read-only; every JSON file through its zod schema, a
 * missing or invalid file reads as "none". Other styles have no look assets (null).
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import {
  isWorldAssetWorld,
  WORLD_ASSETS_REPORT_FILE,
  WORLD_CAST_FILE,
  worldAssetsDir,
  worldAssetsReportSchema,
  worldCastFileSchema,
  type WorldAssetsReport,
  type WorldCastFile,
} from '@reelforge/shared';
import { FILES, inProject } from '@reelforge/stages';
import type { z } from 'zod';
import {
  MAX_LOOK_ASSETS,
  type LookAsset,
  type LookAssets,
} from '../../shared/voiceover-contract.js';

async function readText(dir: string, relative: string): Promise<string | null> {
  try {
    return await readFile(inProject(dir, relative), 'utf8');
  } catch {
    return null; // not written yet (or unreadable): reads as "none"
  }
}

function parseJson<S extends z.ZodType>(text: string | null, schema: S): z.output<S> | null {
  if (text === null) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

/** `.json` files of `assets/<world>/`, sorted, as project-relative paths. */
async function assetFiles(dir: string, folder: string): Promise<string[]> {
  try {
    const entries = await readdir(inProject(dir, folder), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
      .map((entry) => `${folder}/${entry.name}`)
      .sort();
  } catch {
    return []; // no asset folder yet
  }
}

/** Cast entries first (their names), then the files no cast entry points at (pure). */
export function lookAssetList(cast: WorldCastFile | null, files: readonly string[]): LookAsset[] {
  const listed: LookAsset[] = (cast?.entries ?? []).map((entry) => ({
    id: entry.id,
    name: entry.name,
    kind: entry.kind,
    file: entry.file,
  }));
  const named = new Set(listed.map((asset) => asset.file));
  const unnamed = files
    .filter((file) => !named.has(file))
    .map((file): LookAsset => {
      const id =
        file
          .split('/')
          .at(-1)
          ?.replace(/\.json$/i, '') ?? file;
      return { id, name: id, kind: null, file };
    });
  return [...listed, ...unnamed].slice(0, MAX_LOOK_ASSETS);
}

/** True when the set was designed for another storyboard than the one on disk (pure). */
export function storyboardChangedSince(
  report: WorldAssetsReport | null,
  storyboardText: string | null,
): boolean {
  if (report === null || storyboardText === null) return false;
  return createHash('sha256').update(storyboardText).digest('hex') !== report.storyboardHash;
}

/** The look assets of the project, or null when its style is not a world with assets. */
export async function readLookAssets(
  dir: string,
  style: string | undefined,
): Promise<LookAssets | null> {
  if (!isWorldAssetWorld(style)) return null;
  const [reportText, castText, storyboardText, files] = await Promise.all([
    readText(dir, WORLD_ASSETS_REPORT_FILE),
    readText(dir, WORLD_CAST_FILE),
    readText(dir, FILES.storyboard),
    assetFiles(dir, worldAssetsDir(style)),
  ]);
  const report = parseJson(reportText, worldAssetsReportSchema);
  return {
    world: style,
    report,
    storyboardChanged: storyboardChangedSince(report, storyboardText),
    assets: lookAssetList(parseJson(castText, worldCastFileSchema), files),
  };
}
