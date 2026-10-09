/**
 * One alternative version of a shot (PLAN.md#11.3) as the scene-build turn sees it: its direction
 * in the prompt, its tag in the turn label and the fix hint that keeps a QA fix in its own file.
 */
import type { StoryboardShot } from '@reelforge/shared';

/**
 * Built from a creative direction into its own file (the shot's `scene` passed to `buildShot` is
 * that file), never into `scenes/`.
 */
export interface ShotVariantBrief {
  /** 1-based variant number. */
  readonly index: number;
  readonly direction: { readonly label: string; readonly brief: string };
  /** The user's note for every variant. */
  readonly note?: string | undefined;
}

/** ` v2` for variant 2 (turn labels); nothing for the shot itself. */
export function variantTag(variant: ShotVariantBrief | undefined): string {
  return variant === undefined ? '' : ` v${String(variant.index)}`;
}

/** The build prompt's variant variables; none for the shot itself. */
export function variantVars(variant: ShotVariantBrief | undefined): Record<string, string> {
  if (variant === undefined) return {};
  return {
    direction: `${variant.direction.label}. ${variant.direction.brief}`,
    variantIndex: String(variant.index),
    ...(variant.note === undefined || variant.note === '' ? {} : { variantNote: variant.note }),
  };
}

/** Appended to every QA fix request of a variant: which file to edit, which direction to keep. */
export function variantFixHint(shot: StoryboardShot, variant: ShotVariantBrief): string {
  return `This is variant ${String(variant.index)} of the shot: edit only \`${shot.scene}\` (never \`scenes/\`) and keep its creative direction (${variant.direction.label}).`;
}
