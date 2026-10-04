/**
 * Mood grade of the tension map (PLAN.md#12.22, ADR-017): a host-level pass on the finished frame
 * that follows the shot's tension even when lit scene content outweighs the darker background
 * tones. Tense shots (>= 0.6) step their upper-luma colours to a darker style colour, calm shots
 * (<= 0.4) lift their lower-luma colours a little, everything between is untouched. It reuses the
 * reveal moments' ordered-dither palette shift, so every pixel stays a style colour (vibe guard).
 * Text, dim text and outline colours are never graded, so cards stay crisp.
 */
import type { VariationBudget } from '@reelforge/kit';
import type { RenderManifest } from '@reelforge/shared';
import { shotAmbient } from './ambient.js';
import { applyTone } from './direction-frame.js';
import { hexToRgb, LUMA_WEIGHTS, type Rgb } from './palette.js';
import type { ResolvedStyle } from './style.js';
import type { TimelineSample } from './timeline.js';

/** Tension at or above which a shot darkens. */
export const MOOD_TENSE_FROM = 0.6;
/** Tension at or below which a shot lifts. */
export const MOOD_CALM_UNTIL = 0.4;
/** Largest share of graded pixels when darkening (tension 1). */
export const MOOD_MAX_DARKEN = 0.75;
/** Largest share of graded pixels when lifting (tension 0). */
export const MOOD_MAX_LIFT = 0.2;

/**
 * Signed grade of a tension: < 0 darkens, > 0 lifts, 0 (also for undefined) leaves the frame as
 * rendered. Linear from the neutral 0.5, capped.
 */
export function moodGradeAmount(tension: number | undefined): number {
  if (tension === undefined || !Number.isFinite(tension)) return 0;
  if (tension >= MOOD_TENSE_FROM) return -Math.min(MOOD_MAX_DARKEN, (tension - 0.5) * 1.5);
  if (tension <= MOOD_CALM_UNTIL) return Math.min(MOOD_MAX_LIFT, (0.5 - tension) * 0.5);
  return 0;
}

/** Palette colour (packed 0xRRGGBB) -> the colour it grades to, one map per direction. */
export interface MoodGradeMaps {
  readonly darker: ReadonlyMap<number, number>;
  readonly lighter: ReadonlyMap<number, number>;
}

export interface MoodGradeStyle {
  readonly swatches: Readonly<Record<string, string>>;
  readonly variation: Readonly<Record<string, Pick<VariationBudget, 'tones'>>>;
  /** Hex colours that are never graded (text, dim text, outline). */
  readonly protectedColors: readonly string[];
}

const pack = (rgb: Rgb): number =>
  (Math.round(rgb[0] * 255) << 16) | (Math.round(rgb[1] * 255) << 8) | Math.round(rgb[2] * 255);

const luma = (rgb: Rgb): number =>
  rgb[0] * LUMA_WEIGHTS[0] + rgb[1] * LUMA_WEIGHTS[1] + rgb[2] * LUMA_WEIGHTS[2];

function distance(first: Rgb, second: Rgb): number {
  return (
    LUMA_WEIGHTS[0] * (first[0] - second[0]) ** 2 +
    LUMA_WEIGHTS[1] * (first[1] - second[1]) ** 2 +
    LUMA_WEIGHTS[2] * (first[2] - second[2]) ** 2
  );
}

function medianLuma(colors: readonly Rgb[]): number {
  const sorted = colors.map(luma).sort((first, second) => first - second);
  return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
}

/**
 * The grade maps of a style. Darker: every colour at or above the palette's median luma takes
 * its closest darker tone-family member (STYLE.md variation budgets, closest first), else the
 * nearest darker swatch. Lighter: every colour below the median takes its closest lighter family
 * member, else the nearest lighter swatch that is still below the median. Protected colours are
 * neither sources nor targets.
 */
export function moodGradeMaps(style: MoodGradeStyle): MoodGradeMaps {
  const protectedKeys = new Set(style.protectedColors.map((hex) => pack(hexToRgb(hex))));
  const colors = new Map<string, Rgb>();
  for (const [name, hex] of Object.entries(style.swatches)) {
    const rgb = hexToRgb(hex);
    if (!protectedKeys.has(pack(rgb))) colors.set(name, rgb);
  }
  const all = [...colors.values()];
  const median = medianLuma(all);
  const families = new Map<string, readonly string[]>();
  for (const budget of Object.values(style.variation)) {
    for (const [family, members] of Object.entries(budget.tones)) {
      if (!families.has(family)) families.set(family, members);
    }
  }
  const build = (toward: 'darker' | 'lighter'): Map<number, number> => {
    const graded = (rgb: Rgb): boolean =>
      toward === 'darker' ? luma(rgb) >= median : luma(rgb) < median;
    const beyond = (other: Rgb, own: Rgb): boolean =>
      toward === 'darker'
        ? luma(other) < luma(own) - 1e-6
        : luma(other) > luma(own) + 1e-6 && luma(other) < median;
    const map = new Map<number, number>();
    for (const [name, own] of colors) {
      if (!graded(own) || map.has(pack(own))) continue;
      const member = (families.get(name) ?? [])
        .map((memberName) => colors.get(memberName))
        .find((rgb): rgb is Rgb => rgb !== undefined && beyond(rgb, own));
      let target = member;
      if (target === undefined) {
        for (const other of all) {
          if (!beyond(other, own)) continue;
          if (target === undefined || distance(own, other) < distance(own, target)) target = other;
        }
      }
      if (target !== undefined) map.set(pack(own), pack(target));
    }
    return map;
  };
  return { darker: build('darker'), lighter: build('lighter') };
}

/** Grade of a frame that blends two shots (transition progress 0 = all outgoing). */
export function blendMoodGrade(outgoing: number, incoming: number, progress: number): number {
  const share = Math.min(1, Math.max(0, progress));
  return outgoing * (1 - share) + incoming * share;
}

/** The runtime's grade pass: signed amount of a timeline sample and the pass itself. */
export interface MoodGrader {
  amount(sample: TimelineSample): number;
  /** Graded copy of `frame` (an internal buffer, valid until the next call). */
  apply(frame: Uint8Array, amount: number): Uint8Array<ArrayBuffer>;
}

/**
 * The grade pass of a video, or undefined when no shot is graded (no tension map, ambient
 * variation off, neutral tension): the runtime then keeps its frames exactly as rendered.
 * A shot's tension counts only where it reaches the scene (`ctx.ambient.tension`).
 */
export function createMoodGrader(
  manifest: RenderManifest,
  style: Pick<ResolvedStyle, 'swatches' | 'variation' | 'palette' | 'width' | 'height'>,
): MoodGrader | undefined {
  const amounts = manifest.shots.map((_, index) =>
    moodGradeAmount(shotAmbient(manifest, style, index)?.tension),
  );
  if (amounts.every((amount) => amount === 0)) return undefined;
  const maps = moodGradeMaps({
    swatches: style.swatches,
    variation: style.variation,
    protectedColors: [style.palette.text, style.palette.textDim, style.palette.outline],
  });
  const source = new Uint8Array(style.width * style.height * 4);
  const out = new Uint8Array(style.width * style.height * 4);
  return {
    amount(sample) {
      const current = amounts[sample.current.index] ?? 0;
      if (sample.transition === undefined) return current;
      const outgoing = amounts[sample.transition.outgoing.index] ?? 0;
      return blendMoodGrade(outgoing, current, sample.transition.progress);
    },
    apply(frame, amount) {
      source.set(frame);
      applyTone(source, style.width, maps, amount, out);
      return out;
    },
  };
}
