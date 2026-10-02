/**
 * Imports a scene module (or a project prop module) from its source text via a blob: URL, inside
 * the sandboxed engine frame. Each call gets a fresh URL, so two shots never share module state.
 */
import type { KitExtensionSource, SceneSource } from '@reelforge/shared';
import { describeError, EngineError } from '../errors.js';

async function importSource(module: SceneSource): Promise<unknown> {
  const body = `${module.source}\n//# sourceURL=${encodeURI(module.file)}\n`;
  const url = URL.createObjectURL(new Blob([body], { type: 'text/javascript' }));
  try {
    const namespace: unknown = await import(/* @vite-ignore */ url);
    return namespace;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function importSceneSource(scene: SceneSource, shotId: string): Promise<unknown> {
  try {
    return await importSource(scene);
  } catch (error) {
    throw new EngineError(
      'scene-import',
      `${scene.file} failed to load: ${describeError(error)} (scene modules must not import anything; use ctx)`,
      { shotId, cause: error },
    );
  }
}

export async function importKitExtensionSource(extension: KitExtensionSource): Promise<unknown> {
  try {
    return await importSource(extension);
  } catch (error) {
    throw new EngineError(
      'kit-extension',
      `${extension.file} failed to load: ${describeError(error)} (prop modules must not import anything; use ctx.kit.voxel)`,
      { cause: error },
    );
  }
}
