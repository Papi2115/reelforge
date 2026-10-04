/**
 * Hot reload planning (PLAN.md#6.4): compares the loaded render manifest with a fresh one built
 * after a file change. If only scene sources changed, just those shots are rebuilt in the engine;
 * live co-direction overrides (PLAN.md#12.14) are swapped in without any rebuild; any other
 * difference (timings, transitions, words, style, project props in kit-ext - every shot may call
 * them, …) needs a full load.
 */
import type { RenderManifest } from '@reelforge/shared';

export type ReloadPlan =
  | { readonly kind: 'unchanged' }
  | {
      readonly kind: 'shots';
      /** Shots whose scene source changed (rebuilt). */
      readonly shotIds: readonly string[];
      /** Shots whose direction changed (applied without a rebuild). */
      readonly directionShotIds: readonly string[];
    }
  | { readonly kind: 'full' };

/** The manifest with scene sources and directions blanked: what must be equal for a hot update. */
function withoutSources(manifest: RenderManifest): string {
  return JSON.stringify({
    ...manifest,
    shots: manifest.shots.map((shot) => ({
      ...shot,
      scene: { ...shot.scene, source: '' },
      direction: undefined,
    })),
  });
}

export function planReload(loaded: RenderManifest | undefined, next: RenderManifest): ReloadPlan {
  if (!loaded || withoutSources(loaded) !== withoutSources(next)) return { kind: 'full' };
  const shotIds = next.shots
    .filter((shot, index) => loaded.shots[index]?.scene.source !== shot.scene.source)
    .map((shot) => shot.id);
  const directionShotIds = next.shots
    .filter(
      (shot, index) =>
        JSON.stringify(loaded.shots[index]?.direction) !== JSON.stringify(shot.direction),
    )
    .map((shot) => shot.id);
  return shotIds.length === 0 && directionShotIds.length === 0
    ? { kind: 'unchanged' }
    : { kind: 'shots', shotIds, directionShotIds };
}
