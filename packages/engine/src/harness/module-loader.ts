/**
 * Imports a scene module from its source text via a blob: URL, inside the sandboxed engine frame.
 * Each call gets a fresh URL, so two shots never share module-level state.
 */
import type { SceneSource } from '@reelforge/shared';
import { describeError, EngineError } from '../errors.js';

export async function importSceneSource(scene: SceneSource, shotId: string): Promise<unknown> {
  const body = `${scene.source}\n//# sourceURL=${encodeURI(scene.file)}\n`;
  const url = URL.createObjectURL(new Blob([body], { type: 'text/javascript' }));
  try {
    const namespace: unknown = await import(/* @vite-ignore */ url);
    return namespace;
  } catch (error) {
    throw new EngineError(
      'scene-import',
      `${scene.file} failed to load: ${describeError(error)} (scene modules must not import anything; use ctx)`,
      { shotId, cause: error },
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
