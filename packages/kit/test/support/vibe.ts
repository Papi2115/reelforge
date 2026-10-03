/**
 * Vibe guard for render tests (ADR-009): every golden test of a look calls `expectVibe` on its
 * frames, so a look that bypasses the post-fx (own gradients, anti-aliasing, unfiltered images)
 * fails before its golden is even compared.
 */
import { expect } from 'vitest';
import { resolveStyle, vibeGuard, type VibeImage } from '../../../engine/src/index.js';

export function expectVibe(frame: VibeImage, label: string, style = 'voxel-pixel-crisp640'): void {
  expect(vibeGuard(frame, resolveStyle({ style })).issues, label).toEqual([]);
}
