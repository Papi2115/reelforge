/** The "looks blank" rule of every rendering command (frames, contact sheets, prop previews). */
import type { FrameStats } from '@reelforge/engine/raster';

/** A frame that is (nearly) one colour is almost certainly a broken scene. */
const BLANK_DOMINANT_SHARE = 0.97;

export function blankFrameNote(stats: FrameStats): string | undefined {
  if (stats.dominantColorShare < BLANK_DOMINANT_SHARE && stats.uniqueColors > 2) return undefined;
  return `looks blank: ${String(Math.round(stats.dominantColorShare * 100))}% of the pixels are one colour (${String(stats.uniqueColors)} colours)`;
}
