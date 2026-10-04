/**
 * Deterministic reveals of the open-loop veils (PLAN.md#12.26): `veiledProp` (voxel),
 * `redactedBlock` (retro-ui) and `maskedRegion` (blueprint) hide an answer until the closing
 * phrase and then uncover it with an ordered (4x4 Bayer) dither wipe. Pure functions of t and
 * the pixel/voxel position: the same frame for the same t, in any seek order.
 */

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

/** Ordered-dither threshold of cell (x, y), in (0, 1). */
export function revealBayer(x: number, y: number): number {
  return ((BAYER4[(y & 3) * 4 + (x & 3)] ?? 0) + 0.5) / 16;
}

/** Reveal progress at local time t: 0 before `revealAt`, 1 after `revealAt + duration`. */
export function revealProgress(t: number, revealAt: number, duration: number): number {
  if (!(duration > 0)) return t >= revealAt ? 1 : 0;
  return Math.min(1, Math.max(0, (t - revealAt) / duration));
}

/** Width (share of the area) of the dithered edge of a sweeping wipe. */
export const WIPE_EDGE = 0.35;

/**
 * A pixel of a wiped area is still covered at `progress`: the wipe sweeps along u (0..1 across
 * the area) with a dithered edge WIPE_EDGE wide. Everything covered at 0, nothing at 1.
 */
export function wipeCovered(x: number, y: number, u: number, progress: number): boolean {
  if (progress <= 0) return true;
  if (progress >= 1) return false;
  const local = Math.min(1, Math.max(0, (progress * (1 + WIPE_EDGE) - u) / WIPE_EDGE));
  return revealBayer(x, y) >= local;
}

/** Dissolve steps of a voxel veil (one mesh per step). */
export const VEIL_STEPS = 8;

/**
 * Dissolve step (0..VEIL_STEPS-1) of voxel (x, y, z) in a veil `height` voxels tall: the top goes
 * first, the Bayer pattern breaks every layer into a dither.
 */
export function veilStep(x: number, y: number, z: number, height: number): number {
  const fromTop = height <= 1 ? 0 : 1 - y / (height - 1);
  const threshold = 0.6 * fromTop + 0.4 * revealBayer(x + z, y);
  return Math.min(VEIL_STEPS - 1, Math.floor(threshold * VEIL_STEPS));
}

/** A dissolve step is still shown at `progress` (all at 0, none at 1). */
export function veilStepShown(step: number, progress: number): boolean {
  return progress < (step + 1) / VEIL_STEPS;
}

/** Question mark glyph (5x7, rows top to bottom; '#' = ink). */
export const QUESTION_GLYPH: readonly string[] = [
  '.###.',
  '#...#',
  '....#',
  '...#.',
  '..#..',
  '.....',
  '..#..',
];

export type RevealState = 'veiled' | 'revealing' | 'revealed';

export function revealState(progress: number): RevealState {
  if (progress <= 0) return 'veiled';
  return progress >= 1 ? 'revealed' : 'revealing';
}
