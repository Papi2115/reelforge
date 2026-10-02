/** Lints every scene of a render manifest; used to reject broken scenes before they are loaded. */
import type { RenderManifest, SceneSource } from '@reelforge/shared';
import { formatDiagnostics, hasErrors, type LintDiagnostic } from './diagnostics.js';
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

/** Text of all error-level diagnostics, or undefined when every scene passes. */
export function describeLintErrors(results: readonly SceneLintResult[]): string | undefined {
  const blocks = results
    .map((result) => ({
      ...result,
      diagnostics: result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'),
    }))
    .filter((result) => hasErrors(result.diagnostics))
    .map(
      (result) => `[shot ${result.shotId}]\n${formatDiagnostics(result.file, result.diagnostics)}`,
    );
  return blocks.length === 0 ? undefined : blocks.join('\n');
}
