/**
 * Word-by-word captions (PLAN.md#13.18): with manifest `captions: true` every shot draws the words
 * spoken during it into its text overlay, so preview and export show the same pixels. Big, in the
 * style's pixel font and colours, at most CAPTION_MAX_WORDS words at a time, the word being
 * spoken highlighted, inside the platform-safe band (central 80 % of the width; in portrait above
 * the bottom 20 % the Shorts player covers). A pure function of the video time.
 */
import type { TimedWord } from '@reelforge/shared';
import { defaultTitleScale, shortEdge } from './cards.js';
import { drawBlock, placeBlock, shadowOffset, type WordLook } from './draw.js';
import { DISPLAY_FONT } from './font-display.js';
import { layoutText } from './layout.js';
import { SOLID, type Rgb8, type TextSurface } from './surface.js';

/** Most words shown at once. */
export const CAPTION_MAX_WORDS = 3;
/** A pause longer than this (s) between two words starts a new group. */
export const CAPTION_GAP_S = 0.6;
/** A group stays this long (s) after its last word when the next one does not start sooner. */
export const CAPTION_HOLD_S = 0.4;
/** The spoken word pops up by one text pixel for this long (s) when it starts. */
export const CAPTION_POP_S = 0.08;
/** Share of the frame width captions may use (the central 80 %). */
export const CAPTION_MAX_WIDTH = 0.8;
/** Vertical centre of the caption block: portrait (above the Shorts UI), landscape. */
const CAPTION_CENTER_Y = { portrait: 0.68, landscape: 0.8 } as const;

export interface CaptionGroup {
  readonly words: readonly TimedWord[];
  /** Video seconds the group is on screen: [t0, t1). */
  readonly t0: number;
  readonly t1: number;
}

export interface CaptionColors {
  readonly fill: Rgb8;
  readonly highlight: Rgb8;
  readonly shadow: Rgb8;
}

const SENTENCE_END = /[.!?…:;]["')\]]*$/;

function captionText(word: TimedWord): string {
  return word.text.replace(/\s+/g, '');
}

/**
 * The words spoken in [window.t0, window.t1) (by start time) in groups of at most
 * CAPTION_MAX_WORDS; a sentence end or a pause longer than CAPTION_GAP_S ends a group.
 */
export function captionGroups(
  words: readonly TimedWord[],
  window: { readonly t0: number; readonly t1: number },
): CaptionGroup[] {
  const spoken = words.filter(
    (word) => word.t >= window.t0 && word.t < window.t1 && captionText(word) !== '',
  );
  const chunks: TimedWord[][] = [];
  let current: TimedWord[] = [];
  for (const word of spoken) {
    const previous = current.at(-1);
    const breaks =
      previous !== undefined &&
      (current.length >= CAPTION_MAX_WORDS ||
        SENTENCE_END.test(previous.text) ||
        word.t - previous.tEnd > CAPTION_GAP_S);
    if (breaks) {
      chunks.push(current);
      current = [];
    }
    current.push(word);
  }
  if (current.length > 0) chunks.push(current);
  return chunks.map((chunk, index) => {
    const first = chunk[0];
    const last = chunk.at(-1);
    const next = chunks[index + 1]?.[0];
    const t0 = first?.t ?? window.t0;
    const held = (last?.tEnd ?? t0) + CAPTION_HOLD_S;
    return { words: chunk, t0, t1: Math.min(next?.t ?? Infinity, held, window.t1) };
  });
}

/** The group on screen at video time `time`, if any. */
export function captionGroupAt(
  groups: readonly CaptionGroup[],
  time: number,
): CaptionGroup | undefined {
  return groups.find((group) => time >= group.t0 && time < group.t1);
}

/** Index of the word being spoken (the last one started) in `group` at `time`. */
export function spokenWordIndex(group: CaptionGroup, time: number): number {
  let index = 0;
  group.words.forEach((word, candidate) => {
    if (word.t <= time) index = candidate;
  });
  return index;
}

export interface CaptionFrame {
  readonly width: number;
  readonly height: number;
}

/** Integer text scale of captions: the title default, one step bigger in portrait. */
export function captionScale(frame: CaptionFrame): number {
  const base = defaultTitleScale(shortEdge(frame));
  return frame.height > frame.width ? base + 1 : base;
}

/** Draws the caption group on screen at `time` into `surface` (nothing between groups). */
export function drawCaptions(
  surface: TextSurface,
  groups: readonly CaptionGroup[],
  time: number,
  colors: CaptionColors,
): void {
  const group = captionGroupAt(groups, time);
  if (group === undefined) return;
  const frame = { width: surface.width, height: surface.height };
  const scale = captionScale(frame);
  const text = DISPLAY_FONT.normalize(group.words.map(captionText).join(' '));
  const maxUnits = Math.max(1, Math.floor((frame.width * CAPTION_MAX_WIDTH) / scale));
  const layout = layoutText(text, DISPLAY_FONT, maxUnits);
  const portrait = frame.height > frame.width;
  const anchor = {
    pos: [0.5, portrait ? CAPTION_CENTER_Y.portrait : CAPTION_CENTER_Y.landscape] as const,
    align: 'center' as const,
    valign: 'middle' as const,
  };
  const { left, top } = placeBlock(layout, scale, anchor, frame);
  const spoken = spokenWordIndex(group, time);
  const popping = time - (group.words[spoken]?.t ?? -Infinity) < CAPTION_POP_S;
  const looks: WordLook[] = layout.words.map((word) => {
    const current = word.token === spoken;
    return {
      dx: 0,
      dy: current && popping ? -scale : 0,
      scale,
      glyphs: word.glyphs.length,
      color: current ? colors.highlight : colors.fill,
    };
  });
  const shadow = { color: colors.shadow, offset: shadowOffset(scale) };
  drawBlock(surface, { layout, align: 'center', scale, left, top }, looks, SOLID, shadow);
}
