/**
 * What the scene-build prompt gets about real photos/footage: the shot's asset needs and the
 * project's downloaded assets when research is on and the shot asked for something (PLAN.md#12.10),
 * and the assets the storyboard assigned to the shot (`shot.assets`: the user's own files, library
 * copies, downloads; PLAN.md#12.12) in every research mode. External text stays inside the
 * untrusted-data markers. A shot with neither gets nothing (the prompt stays byte for byte as before).
 */
import { readCatalogue, recordLines, untrustedBlock } from '@reelforge/cli/assets';
import type { AssetRecord, StoryboardShot } from '@reelforge/shared';
import { assetNeedLine } from '../stages/assets.js';

/**
 * The catalogue scene builds see (also in research mode off: the user's own files); empty when
 * assets.json is missing or unreadable.
 */
export async function sceneAssetCatalogue(projectDir: string): Promise<readonly AssetRecord[]> {
  try {
    return (await readCatalogue(projectDir)).assets;
  } catch {
    return []; // a damaged assets.json: shots fall back to kit visuals (reelforge validate says why)
  }
}

function needLines(
  shot: StoryboardShot,
  research: boolean,
  catalogue: readonly AssetRecord[],
): string[] {
  const needs = shot.assetNeeds ?? [];
  if (!research || needs.length === 0) return [];
  const downloaded = catalogue.filter((record) => record.source !== 'own');
  return [
    'Needs of this shot:',
    ...needs.map((need) => assetNeedLine({ shotId: shot.id, need })),
    'Downloaded assets of the project:',
    ...(downloaded.length === 0
      ? ['(none downloaded: the needs were rejected or not found yet)']
      : untrustedBlock(downloaded.flatMap(recordLines))),
  ];
}

function assignedLines(shot: StoryboardShot, catalogue: readonly AssetRecord[]): string[] {
  const byId = new Map(catalogue.map((record) => [record.id, record]));
  const assigned = (shot.assets ?? []).flatMap((id) => {
    const record = byId.get(id);
    return record === undefined ? [] : [record];
  });
  if (assigned.length === 0) return [];
  return [
    'Assets the storyboard assigned to this shot (show them; the descriptions say what they are):',
    ...untrustedBlock(assigned.flatMap(recordLines)),
  ];
}

/** `{ shotAssets }` for the shot, or nothing. */
export function shotAssetVars(
  shot: StoryboardShot,
  research: boolean,
  catalogue: readonly AssetRecord[],
): { readonly shotAssets?: string } {
  const lines = [...needLines(shot, research, catalogue), ...assignedLines(shot, catalogue)];
  return lines.length === 0 ? {} : { shotAssets: lines.join('\n') };
}
