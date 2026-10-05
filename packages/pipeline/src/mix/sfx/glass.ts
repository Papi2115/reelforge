/**
 * Glass (ADR-028: the `shatter` and `cube-smash` wow transitions): a sharp crack, shards
 * tinkling down, or only the tinkle. Bright and short (high-passed, no bass), finished with the
 * shared pixel crush so it sits with the other palettes.
 */
import type { StereoClip } from '../clip.js';
import { applyReverb, type ReverbOptions } from '../reverb.js';
import { attackDecay } from '../synth.js';
import {
  addModal,
  addNoise,
  between,
  jitter,
  type Mode,
  type SfxContext,
  type SfxDefinition,
} from './layers.js';
import { Scatter, crushStereo } from './pixel.js';

/** A small bright room: the shards ring a little, nothing booms. */
const ROOM: ReverbOptions = { decayS: 0.3, wet: 0.08, damping: 0.4, size: 0.4, lowCutHz: 500 };

/** A thin glass shard: a few inharmonic partials that die fast (kept under ~10 kHz). */
const SHARD: readonly Mode[] = [
  [1, 1, 0.09],
  [1.53, 0.45, 0.05],
  [2.21, 0.2, 0.025],
];

/** The crack: a hard high-passed snap and a short bright noise burst. */
function crack(out: Float32Array, ctx: SfxContext, startS: number, gain: number): void {
  addNoise(out, ctx.rng, {
    startS,
    lengthS: 0.03,
    filter: 'hp',
    freq: 2200,
    q: 0.7,
    highpassHz: 900,
    envelope: (t) => attackDecay(t, 0.0003, 0.004),
    gain: 1.6 * gain,
  });
  addNoise(out, ctx.rng, {
    startS,
    lengthS: 0.12,
    filter: 'bp',
    freq: jitter(ctx.rng, 4200, 0.1),
    q: 0.9,
    highpassHz: 1200,
    envelope: (t) => attackDecay(t, 0.0008, 0.025),
    gain: 0.9 * gain,
  });
}

/** `count` shards spread over `spreadS` after `fromS`, thinning out and getting quieter. */
function shards(
  scatter: Scatter,
  ctx: SfxContext,
  count: number,
  fromS: number,
  spreadS: number,
  gain: number,
): void {
  for (let index = 0; index < count; index++) {
    const share = (index + between(ctx.rng, 0, 1)) / count;
    const startS = fromS + spreadS * share * share;
    scatter.add(between(ctx.rng, -0.3, 0.3), (out) => {
      addModal(out, {
        startS,
        freq: between(ctx.rng, 2300, 4300),
        modes: SHARD,
        attackS: 0.0004,
        decayScale: between(ctx.rng, 0.7, 1.4),
        gain: gain * (1 - 0.6 * share),
      });
    });
  }
}

function glass(withCrack: boolean, count: number, spreadS: number) {
  return (ctx: SfxContext): StereoClip => {
    const scatter = new Scatter(ctx.frames);
    if (withCrack) {
      scatter.add(between(ctx.rng, -0.1, 0.1), (out) => {
        crack(out, ctx, 0, 1);
      });
    }
    shards(scatter, ctx, count, withCrack ? 0.02 : 0, spreadS, withCrack ? 0.5 : 0.7);
    return applyReverb(crushStereo(scatter.clip, 0.15), ROOM);
  };
}

export const glassCrack: SfxDefinition = {
  durationS: 0.7,
  category: 'texture',
  use: 'Glass cracks or shatters (the shatter / cube-smash transitions, a break-in, a crash); tinkle = only shards falling.',
  variants: [
    { name: 'crack', render: glass(true, 5, 0.25) },
    { name: 'shatter', render: glass(true, 26, 0.48) },
    { name: 'tinkle', render: glass(false, 12, 0.45) },
  ],
};
