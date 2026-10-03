/**
 * Lints every scene (and project prop) of a render manifest; used to reject broken modules before
 * they are loaded.
 */
import type { RenderManifest, SceneSource } from '@reelforge/shared';
import { formatDiagnostics, hasErrors, type LintDiagnostic } from './diagnostics.js';
import { lintPropModule } from './lint-prop.js';
import { lintScene } from './lint-scene.js';

export interface SceneLintResult {
  readonly shotId: string;
  readonly file: string;
  readonly diagnostics: readonly LintDiagnostic[];
}

/** Lints the scene of one shot (e.g. before a hot reload of that shot). */
export function lintShotScene(shotId: string, scene: SceneSource): SceneLintResult {
  return {
    shotId,
    file: scene.file,
    diagnostics: lintScene(scene.source, { filename: scene.file }),
  };
}

export function lintManifestScenes(manifest: RenderManifest): SceneLintResult[] {
  return manifest.shots.map((shot) => lintShotScene(shot.id, shot.scene));
}

/** Prop-mode lint of the manifest's project props (`shotId` is `kit-ext:<name>`). */
export function lintManifestKitExtensions(manifest: RenderManifest): SceneLintResult[] {
  return (manifest.kitExtensions ?? []).map((extension) => ({
    shotId: `kit-ext:${extension.name}`,
    file: extension.file,
    diagnostics: lintPropModule(extension.source, { filename: extension.file }),
  }));
}

/** Text of all error-level diagnostics, or undefined when every scene passes. */
export function describeLintErrors(results: readonly SceneLintResult[]): string | undefined {
  const blocks = results
    .map((result) => ({
      ...result,
      diagnostics: result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'),
    }))
    .filter((result) => hasErrors(result.diagnostics))
    .map(
      (result) =>
        `${result.shotId.startsWith('kit-ext:') ? `[${result.shotId}]` : `[shot ${result.shotId}]`}\n${formatDiagnostics(result.file, result.diagnostics)}`,
    );
  return blocks.length === 0 ? undefined : blocks.join('\n');
}
