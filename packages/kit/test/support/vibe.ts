/**
 * Vibe guard for render tests (ADR-009): every golden test of a look calls `expectVibe` on its
 * frames, so a look that bypasses the post-fx (own gradients, anti-aliasing, unfiltered images)
 * fails before its golden is even compared. A full-colour style (`quantize: false`, PLAN.md#14.1)
 * has no palette snap, so only its opacity is checked.
 */
import { expect } from 'vitest';
import { resolveStyle, vibeGuard, type VibeImage } from '../../../engine/src/index.js';

export function expectVibe(frame: VibeImage, label: string, style = 'voxel-pixel-crisp640'): void {
  const resolved = resolveStyle({ style });
  const fullColour = resolved.post.lut === undefined;
  const options = fullColour ? { maxOffPalettePct: 100 } : {};
  expect(vibeGuard(frame, resolved, options).issues, label).toEqual([]);
}
