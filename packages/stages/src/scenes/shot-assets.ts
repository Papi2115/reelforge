/**
 * What the scene-build prompt gets about real photos/footage (PLAN.md#12.10): the shot's asset
 * needs and the project's downloaded assets, the external text inside the untrusted-data markers.
 * Only when research is on and the shot asked for something; otherwise nothing (the prompt stays
 * byte for byte as before). Using the files in scenes is PLAN.md#12.11.
 */
import { readCatalogue, recordLines, untrustedBlock } from '@reelforge/cli/assets';
import {
  projectResearchMode,
  type AssetRecord,
  type ProjectFile,
  type StoryboardShot,
} from '@reelforge/shared';
import { assetNeedLine } from '../stages/assets.js';

/** The catalogue scene builds see: empty when research is off or assets.json is unreadable. */
export async function sceneAssetCatalogue(
  projectDir: string,
  project: ProjectFile,
): Promise<readonly AssetRecord[]> {
  if (projectResearchMode(project) === 'off') return [];
  try {
    return (await readCatalogue(projectDir)).assets;
  } catch {
    return []; // a damaged assets.json: shots fall back to kit visuals (reelforge validate says why)
  }
}

/** `{ shotAssets }` for the shot, or nothing. */
export function shotAssetVars(
  shot: StoryboardShot,
  research: boolean,
  catalogue: readonly AssetRecord[],
): { readonly shotAssets?: string } {
  const needs = shot.assetNeeds ?? [];
  if (!research || needs.length === 0) return {};
  const downloaded =
    catalogue.length === 0
      ? ['(none downloaded: the needs were rejected or not found yet)']
      : untrustedBlock(catalogue.flatMap(recordLines));
  return {
    shotAssets: [
      'Needs of this shot:',
      ...needs.map((need) => assetNeedLine({ shotId: shot.id, need })),
      'Downloaded assets of the project:',
      ...downloaded,
    ].join('\n'),
  };
}
