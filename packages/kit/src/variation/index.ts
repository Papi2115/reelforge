/** Ambient variation (PLAN.md#12.8, ADR-010): per-shot drift of the environments. */
export {
  ambientVariation,
  debrisCount,
  guaranteedAxes,
  layoutLabel,
  toneOf,
  variationDistance,
} from './ambient.js';
export { hash32, seededPermutation, steppedLevel } from './sequence.js';
export * from './types.js';
