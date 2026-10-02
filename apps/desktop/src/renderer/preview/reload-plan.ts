/**
 * Hot reload planning (PLAN.md#6.4): compares the loaded render manifest with a fresh one built
 * after a file change. If only scene sources changed, just those shots are rebuilt in the engine;
 * any other difference (timings, transitions, words, style, …) needs a full load.
 */
import type { RenderManifest } from '@reelforge/shared';

export type ReloadPlan =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'shots'; readonly shotIds: readonly string[] }
  | { readonly kind: 'full' };

/** The manifest with scene sources blanked: what must be equal for a per-shot reload. */
function withoutSources(manifest: RenderManifest): string {
  return JSON.stringify({
    ...manifest,
    shots: manifest.shots.map((shot) => ({ ...shot, scene: { ...shot.scene, source: '' } })),
  });
}

export function planReload(loaded: RenderManifest | undefined, next: RenderManifest): ReloadPlan {
  if (!loaded || withoutSources(loaded) !== withoutSources(next)) return { kind: 'full' };
  const shotIds = next.shots
    .filter((shot, index) => loaded.shots[index]?.scene.source !== shot.scene.source)
    .map((shot) => shot.id);
  return shotIds.length === 0 ? { kind: 'unchanged' } : { kind: 'shots', shotIds };
}
