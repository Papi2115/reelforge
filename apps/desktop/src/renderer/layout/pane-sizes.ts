/**
 * Sizes of the resizable panes (PLAN.md#6.3): left (pipeline + shots) and right (chat) column
 * widths and the timeline height, in CSS pixels. Clamping keeps every pane at its minimum and
 * gives the preview what is left; sizes persist in localStorage (app settings arrive in 6.7).
 */
import { z } from 'zod';

export interface PaneSizes {
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
}

export interface Viewport {
  /** Size of the area the panes share (the shell element). */
  readonly width: number;
  readonly height: number;
}

export const DEFAULT_PANE_SIZES: PaneSizes = { left: 300, right: 320, bottom: 216 };

export const PANE_LIMITS = {
  minLeft: 240,
  minRight: 280,
  minBottom: 120,
  /** Room for the preview's transport bar and a usable picture (PLAN.md#11.2). */
  minCenterWidth: 520,
  minCenterHeight: 260,
  /** Total width of the two vertical splitters / height of the horizontal one. */
  splitterSize: 6,
} as const;

/** Keyboard step of the splitters. */
export const PANE_KEY_STEP = 16;

export const PANE_SIZES_STORAGE_KEY = 'reelforge.layout.panes.v1';

const storedSizesSchema = z.object({
  left: z.number(),
  right: z.number(),
  bottom: z.number(),
});

function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.min(Math.max(value, min), Math.max(min, max)));
}

/**
 * Fits `sizes` into `viewport`: side columns at least their minimum, the preview at least its
 * minimum width (shrinking the chat first, then the left column), the timeline between its
 * minimum and what leaves the preview its minimum height. Below the minimum total the side
 * columns stay at their minimums and the preview shrinks. With `collapsedRight` (the width of the
 * collapsed chat rail) only the left column gives way; the stored chat width is kept for later.
 */
export function clampPaneSizes(
  sizes: PaneSizes,
  viewport: Viewport,
  collapsedRight?: number,
): PaneSizes {
  const limits = PANE_LIMITS;
  const available = viewport.width - 2 * limits.splitterSize - limits.minCenterWidth;
  let left = Math.max(limits.minLeft, sizes.left);
  let right = Math.max(limits.minRight, sizes.right);
  let overflow = left + (collapsedRight ?? right) - available;
  if (overflow > 0 && collapsedRight !== undefined) {
    left -= Math.min(overflow, left - limits.minLeft);
  } else if (overflow > 0) {
    const fromRight = Math.min(overflow, right - limits.minRight);
    right -= fromRight;
    overflow -= fromRight;
    left -= Math.min(overflow, left - limits.minLeft);
  }
  const maxBottom = viewport.height - limits.splitterSize - limits.minCenterHeight;
  return {
    left: Math.round(left),
    right: Math.round(right),
    bottom: clamp(sizes.bottom, limits.minBottom, maxBottom),
  };
}

/** Stored JSON -> sizes; anything unreadable falls back to the defaults. */
export function parseStoredPaneSizes(raw: string | null): PaneSizes {
  if (raw === null) return DEFAULT_PANE_SIZES;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return DEFAULT_PANE_SIZES;
  }
  const parsed = storedSizesSchema.safeParse(json);
  return parsed.success ? parsed.data : DEFAULT_PANE_SIZES;
}

export function serializePaneSizes(sizes: PaneSizes): string {
  return JSON.stringify({ left: sizes.left, right: sizes.right, bottom: sizes.bottom });
}
