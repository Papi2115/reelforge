/**
 * The project's assets in the storyboard (PLAN.md#12.12, #12.19): the storyboard prompt lists the
 * assets of assets.json (the user's own files, library copies, downloads) so Claude can assign them
 * to shots (`shot.assets`), mentions the user's asset library when it has entries, and in research
 * mode `off` asks for B-rolls built only from the kit and these assets. Without assets, library
 * and research the prompt stays byte for byte as before. Local files only, never the network.
 */
import { catalogueLine, readCatalogue, readLibrary, untrustedBlock } from '@reelforge/cli/assets';
import type { AssetRecord } from '@reelforge/shared';
import type { StageContext } from '../types.js';

/** Assets listed in the prompt at most (the rest: `reelforge assets list`). */
export const MAX_PROMPT_ASSETS = 40;

async function catalogueOf(ctx: StageContext): Promise<AssetRecord[] | undefined> {
  try {
    return (await readCatalogue(ctx.projectDir)).assets;
  } catch (error) {
    ctx.warn(`assets.json: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

async function libraryEntries(ctx: StageContext): Promise<number> {
  const library = ctx.assets?.library;
  if (library === undefined) return 0;
  try {
    return (await readLibrary(library.dir)).library.entries.length;
  } catch {
    return 0; // an unreadable library: the storyboard works with the project's assets alone
  }
}

/** The lines of the catalogue section (untrusted-data block). */
export function assetCatalogueText(records: readonly AssetRecord[]): string {
  const shown = records.slice(0, MAX_PROMPT_ASSETS).map(catalogueLine);
  const more = records.length - shown.length;
  const lines = shown.length === 0 ? ['(none yet)'] : shown;
  if (more > 0) lines.push(`… and ${String(more)} more: \`reelforge assets list\``);
  return untrustedBlock(lines).join('\n');
}

/** Template variables of the storyboard prompt's asset section (empty = no section). */
export async function storyboardAssetVars(
  ctx: StageContext,
  research: boolean,
): Promise<Readonly<Record<string, string | boolean>>> {
  const [records, library] = await Promise.all([catalogueOf(ctx), libraryEntries(ctx)]);
  const assets = records ?? [];
  if (!research && assets.length === 0 && library === 0) return {};
  return {
    assetCatalogue: assetCatalogueText(assets),
    ...(research ? {} : { assetsOff: true }),
    ...(library > 0 ? { assetLibrary: true } : {}),
  };
}

/** Asset ids of assets.json for the validator (read again: Claude may have copied one in). */
export async function currentAssetIds(projectDir: string): Promise<string[] | undefined> {
  try {
    return (await readCatalogue(projectDir)).assets.map((record) => record.id);
  } catch {
    return undefined; // damaged assets.json: `reelforge validate` reports it; ids stay unchecked
  }
}
