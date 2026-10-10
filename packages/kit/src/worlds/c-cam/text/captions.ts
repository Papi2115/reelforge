/**
 * Captions of Grim Ink films and Shorts (PLAN.md#14.18, brief 11 addendum: "captions must look
 * like the prototypes"): the prototypes' caption pass (`films/*\/js/timeline.js` `caption()`):
 * the spoken line in bold 46 px Arial Black, bone fill #e2d8b8, an 11 px ink outline with round
 * joins, centred at x 960, the last line on y 1010, 58 px line spacing, wrapped at 1500 px, one
 * line group at a time with a hard cut to the next, no highlighted word. Drawn by the kit on the
 * shot's ink stage over what the scene painted (role `caption` of `ink.text`: the system font
 * when installed, else the CC0 poster lettering at the same cap height and width). Every size
 * scales with the frame (1080 px short edge = 1); a portrait Short keeps the block above the
 * bottom 28 % the Shorts player covers. The caption band (bottom 18 % of a landscape frame) is
 * reserved: scene lettering stays out of it (anti-slop guard `caption-band`).
 */
import type { Paint2D } from '../draw/paint.js';
import { inkText, measureInkText, type TextTarget } from './ink-text.js';

/** Most words of one caption line group (the prototypes show a short spoken line at a time). */
export const C_CAM_CAPTION_MAX_WORDS = 9;

/** Share of a landscape frame's height reserved for the captions, from the bottom. */
export const CAPTION_BAND_SHARE = 0.18;

/** The prototype numbers at 1920x1080. */
export const PROTOTYPE_CAPTION = Object.freeze({
  size: 46,
  outline: 11,
  lastLineY: 1010,
  lineSpacing: 58,
  wrap: 1500,
  fill: '#e2d8b8',
  ink: '#16120e',
});

/** Where the last caption line sits in a portrait frame (share of the height). */
const PORTRAIT_LAST_LINE = 0.7;

export interface CaptionFrame {
  readonly width: number;
  readonly height: number;
}

/** Greedy word wrap at `max` px, like the prototype's `caption()`. */
export function wrapCaption(
  text: string,
  max: number,
  measure: (line: string) => number,
): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = current === '' ? word : `${current} ${word}`;
    if (current !== '' && measure(next) > max) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current !== '') lines.push(current);
  return lines;
}

/** Paints one caption group (`text`) on a stage surface of size `frame`. */
export function paintCaption(
  g: Paint2D,
  target: TextTarget | undefined,
  text: string,
  frame: CaptionFrame,
): void {
  const k = Math.min(frame.width, frame.height) / 1080;
  const size = PROTOTYPE_CAPTION.size * k;
  const portrait = frame.height > frame.width;
  const wrap = portrait ? frame.width * 0.85 : PROTOTYPE_CAPTION.wrap * (frame.width / 1920);
  const lines = wrapCaption(text, wrap, (line) => measureInkText(target, line, 'caption', size));
  const lastY = portrait
    ? frame.height * PORTRAIT_LAST_LINE
    : (PROTOTYPE_CAPTION.lastLineY / 1080) * frame.height;
  lines.forEach((line, index) => {
    inkText(g, target, line, {
      role: 'caption',
      x: frame.width / 2,
      y: lastY - (lines.length - 1 - index) * PROTOTYPE_CAPTION.lineSpacing * k,
      size,
      fill: PROTOTYPE_CAPTION.fill,
      outline: PROTOTYPE_CAPTION.ink,
      outlineWidth: PROTOTYPE_CAPTION.outline * k,
      seed: 31 + index,
    });
  });
}

/** What the engine needs from a world that draws its own captions. */
export interface WorldCaptions {
  readonly maxWords: number;
  /**
   * Draws the caption `text` over the shot's frame (`scene` holds the world's drawing surface);
   * false when there is nothing to draw on (the engine then draws its own captions).
   */
  draw(scene: CaptionScene, text: string, frame: CaptionFrame): boolean;
}

/** The part of a THREE object tree the captions walk. */
export interface CaptionScene {
  traverse(callback: (object: unknown) => void): void;
}
