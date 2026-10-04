/**
 * Ambient variation in the engine (PLAN.md#12.8, ADR-010): resolves a manifest shot's parameter
 * set from the manifest switch, the shot's storyboard position, its look's budget key and the
 * style budget, and builds `ctx.ambient`. Off (no `ambientVariation`, disabled, or a look whose
 * budget the style lacks) = undefined, and every shot renders exactly as authored.
 * Tension map (PLAN.md#12.22, ADR-017): a manifest shot's `tension` darkens tone families toward
 * their darker member (by palette luma) and reaches the scene as `ctx.ambient.tension`.
 */
import {
  ambientVariation,
  LOOKS,
  toneOf,
  type AmbientVariation,
  type VariationBudget,
} from '@reelforge/kit';
import { ambientShotInputs, DEFAULT_LOOK_ID, type RenderManifest } from '@reelforge/shared';
import type { AmbientApi } from './contract.js';
import { hexToRgb, LUMA_WEIGHTS } from './palette.js';
import type { ResolvedStyle } from './style.js';

/** Budget key of a look id (undefined for an unknown look). */
export function lookBudgetKey(lookId: string): string | undefined {
  return LOOKS.find((look) => look.id === lookId)?.variationBudget;
}

function luma(hex: string | undefined): number | undefined {
  if (hex === undefined) return undefined;
  const rgb = hexToRgb(hex);
  return rgb[0] * LUMA_WEIGHTS[0] + rgb[1] * LUMA_WEIGHTS[1] + rgb[2] * LUMA_WEIGHTS[2];
}

/**
 * Family -> its closest darker member (the first member, closest first, whose luma is lower than
 * the family's own swatch); families without a darker member are left out.
 */
export function darkerTones(
  budget: Pick<VariationBudget, 'tones'>,
  swatches: Readonly<Record<string, string>>,
): Record<string, string> {
  const darker: Record<string, string> = {};
  for (const [family, members] of Object.entries(budget.tones)) {
    const own = luma(swatches[family]);
    if (own === undefined) continue;
    const member = members.find((name) => {
      const value = luma(swatches[name]);
      return value !== undefined && value < own;
    });
    if (member !== undefined) darker[family] = member;
  }
  return darker;
}

/** Parameter set of manifest shot `index`, or undefined when the shot does not vary. */
export function shotAmbient(
  manifest: RenderManifest,
  style: Pick<ResolvedStyle, 'variation'> & Partial<Pick<ResolvedStyle, 'swatches'>>,
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
  const tension = info.tension;
  return ambientVariation({
    seed: settings.seed,
    shotId: shot.id,
    index: info.index,
    actIndex: info.act,
    roll: info.roll,
    budgetKey,
    budget,
    scale: (settings.scale ?? 1) * (info.scale ?? 1),
    ...(tension === undefined
      ? {}
      : {
          tension,
          ...(style.swatches === undefined ? {} : { darker: darkerTones(budget, style.swatches) }),
        }),
  });
}

/** `ctx.ambient`: read-only view of the shot's variation (neutral when off). */
export function createAmbientApi(variation: AmbientVariation | undefined): AmbientApi {
  return Object.freeze({
    enabled: variation !== undefined,
    params: variation,
    tension: variation?.tension,
    tone: (name: string) => toneOf(variation, name),
  });
}
