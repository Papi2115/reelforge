/**
 * Look mode plumbing (ADR-009): what the storyboard prompt, its validator and the scene-build
 * prompt get from the project's `lookMode` and the kit's look registry. `voxel-only` (every
 * project made before 2.0) gets nothing, so its prompts and checks stay exactly as they were.
 */
import { getLook, listLooks, voxelLook, type Look } from '@reelforge/kit';
import { shotLook, type LookMode, type StoryboardShot } from '@reelforge/shared';

/** One line per look in the storyboard prompt. */
export function lookLine(look: Look): string {
  return `- \`${look.id}\` (${look.label}): ${look.description}. Rolls: ${look.rolls.join(', ')}. Treatments: ${look.treatments.join(', ')}.`;
}

/** Storyboard prompt variables: none in `voxel-only`. */
export function storyboardLookVars(
  mode: LookMode,
  looks: readonly Look[] = listLooks(),
): Readonly<Record<string, string | boolean>> {
  if (mode === 'voxel-only') return {};
  return {
    looks: looks.map(lookLine).join('\n'),
    ...(looks.length >= 2 ? { multiLook: true } : { singleLook: true }),
  };
}

/** Storyboard validator options: none in `voxel-only`. */
export function storyboardLookOptions(
  mode: LookMode,
  looks: readonly Look[] = listLooks(),
): { readonly lookMode?: LookMode; readonly looks?: readonly string[] } {
  return mode === 'voxel-only' ? {} : { lookMode: mode, looks: looks.map((look) => look.id) };
}

/**
 * Scene-build prompt variables: none in `voxel-only`; in `mixed` the shot's look and its docs (a
 * look that is unknown or not available, e.g. in a hand-edited storyboard, builds as voxel).
 */
export function sceneLookVars(
  mode: LookMode,
  shot: StoryboardShot,
  looks?: readonly Look[],
): Readonly<Record<string, string>> {
  if (mode === 'voxel-only') return {};
  const look = getLook(shotLook(shot), looks) ?? voxelLook;
  return { lookId: look.id, lookDocs: look.docs };
}
