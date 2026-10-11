/**
 * Grim Ink's text fonts in an export (PLAN.md#14.18): the world letters with the prototypes'
 * system fonts when this machine has them, else with the CC0 ink lettering. Before the segment
 * keys are computed, one render window loads the video (the pool keeps it loaded for the first
 * worker) and reports what its text roles found (`LoadInfo.fonts`, probed with `measureText`):
 * the result joins the export cache key and, when a role fell back, the render report.
 */
import { loadInfoFonts, type InkFonts } from '@reelforge/engine';
import { C_CAM_ID } from '@reelforge/kit';
import type { RenderManifest } from '@reelforge/shared';
import { RenderPool } from './render-pool.js';

/** The cache-key part of a font report: `system` or `fallback:<missing families>`. */
export function inkFontsKey(fonts: InkFonts): string {
  return fonts.fallback ? `fallback:${[...fonts.missing].sort().join(',')}` : 'system';
}

/** The render report line when a role fell back; undefined when every font was found. */
export function inkFontsWarning(fonts: InkFonts): string | undefined {
  if (!fonts.fallback) return undefined;
  const missing = fonts.missing.length === 0 ? 'some fonts' : fonts.missing.join(', ');
  return `font fallback used: ${missing} not installed, the Grim Ink lettering stands in for them`;
}

/**
 * The font report of a Grim Ink video, from one pooled render window; undefined for any other
 * style, or when the window cannot load the video (the export then reports that failure itself).
 */
export async function probeInkFonts(
  pool: Pick<RenderPool, 'acquire' | 'release'>,
  manifest: RenderManifest,
): Promise<InkFonts | undefined> {
  if (manifest.style !== C_CAM_ID) return undefined;
  const entry = await pool.acquire();
  if (!entry.ok) return undefined;
  try {
    const loaded = await RenderPool.ensureLoaded(entry.value, manifest);
    return loaded.ok ? loadInfoFonts(loaded.value) : undefined;
  } finally {
    await pool.release(entry.value);
  }
}
