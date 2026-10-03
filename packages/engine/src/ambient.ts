/**
 * Ambient variation in the engine (PLAN.md#12.8, ADR-010): resolves a manifest shot's parameter
 * set from the manifest switch, the shot's storyboard position, its look's budget key and the
 * style budget, and builds `ctx.ambient`. Off (no `ambientVariation`, disabled, or a look whose
 * budget the style lacks) = undefined, and every shot renders exactly as authored.
 */
import { ambientVariation, LOOKS, toneOf, type AmbientVariation } from '@reelforge/kit';
import { ambientShotInputs, DEFAULT_LOOK_ID, type RenderManifest } from '@reelforge/shared';
import type { AmbientApi } from './contract.js';
import type { ResolvedStyle } from './style.js';

/** Budget key of a look id (undefined for an unknown look). */
export function lookBudgetKey(lookId: string): string | undefined {
  return LOOKS.find((look) => look.id === lookId)?.variationBudget;
}

/** Parameter set of manifest shot `index`, or undefined when the shot does not vary. */
export function shotAmbient(
  manifest: RenderManifest,
  style: Pick<ResolvedStyle, 'variation'>,
  index: number,
): AmbientVariation | undefined {
  const settings = manifest.ambientVariation;
  const shot = manifest.shots[index];
  if (settings?.enabled !== true || shot === undefined) return undefined;
  // Shots without storyboard info (hand-made manifests) take their manifest position and acts.
  const info = shot.ambient ?? ambientShotInputs(manifest.shots)[index];
  if (info === undefined) return undefined;
  const budgetKey = lookBudgetKey(info.look ?? DEFAULT_LOOK_ID);
  const budget = budgetKey === undefined ? undefined : style.variation[budgetKey];
  if (budgetKey === undefined || budget === undefined) return undefined;
  return ambientVariation({
    seed: settings.seed,
    shotId: shot.id,
    index: info.index,
    actIndex: info.act,
    roll: info.roll,
    budgetKey,
    budget,
    scale: (settings.scale ?? 1) * (info.scale ?? 1),
  });
}

/** `ctx.ambient`: read-only view of the shot's variation (neutral when off). */
export function createAmbientApi(variation: AmbientVariation | undefined): AmbientApi {
  return Object.freeze({
    enabled: variation !== undefined,
    params: variation,
    tone: (name: string) => toneOf(variation, name),
  });
}
