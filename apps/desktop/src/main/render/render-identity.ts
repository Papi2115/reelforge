/**
 * The export cache identity (pipeline `RenderIdentity`) of the app's renderer. `engineVersion` is
 * a hash of the engine frame bundle the app actually renders with (engine + kit + shared code),
 * so any change to the renderer invalidates cached segments without manual version bumps.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { DEFAULT_STYLE_ID, findStylePreset } from '@reelforge/engine';
import { KIT_VERSION } from '@reelforge/kit';
import type { RenderIdentity } from '@reelforge/pipeline';
import { DEFAULT_VIDEO_FORMAT, orientFrameSize, type VideoFormat } from '@reelforge/shared';
import { ENGINE_ASSET_DIR } from '../../shared/engine-assets.js';

const ENGINE_FRAME_SCRIPT = 'engine-frame.js';

/**
 * `engine-<sha256 prefix>` of the first engine frame bundle found in `assetRoots` (the built
 * renderer, then the dev static dir).
 */
export async function engineBundleVersion(
  assetRoots: readonly string[],
): Promise<Result<string, string>> {
  for (const root of assetRoots) {
    const file = path.join(root, ENGINE_ASSET_DIR, ENGINE_FRAME_SCRIPT);
    const bytes = await readFile(file).catch((): null => null);
    if (bytes !== null) {
      return ok(`engine-${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}`);
    }
  }
  return err(`the engine frame bundle is missing (looked in ${assetRoots.join(', ')})`);
}

/** `format`: the manifest's video format (PLAN.md#13.18); portrait turns the size upright. */
export function renderIdentity(
  style: string | undefined,
  engineVersion: string,
  format: VideoFormat = DEFAULT_VIDEO_FORMAT,
): Result<RenderIdentity, string> {
  const id = style ?? DEFAULT_STYLE_ID;
  const preset = findStylePreset(id);
  if (preset === undefined) return err(`unknown style preset "${id}"`);
  const { width, height } = orientFrameSize(preset.resolution, format);
  return ok({
    engineVersion,
    kitVersion: KIT_VERSION,
    style: { id, width, height, preset },
  });
}
