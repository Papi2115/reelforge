/** Placing a laid-out text block in the frame and drawing it word by word (shadow pass first). */
import { capLine, lineOffset, blockSize, type TextAlign, type TextLayout } from './layout.js';
import type { Paint, Rgb8, TextSurface } from './surface.js';
import type { PixelRect } from './types.js';

export type TextVAlign = 'top' | 'middle' | 'bottom';

export interface BlockPlacement {
  readonly layout: TextLayout;
  readonly align: TextAlign;
  /** Integer pixel scale the block is laid out with. */
  readonly scale: number;
  readonly left: number;
  readonly top: number;
}

/** How one word is drawn in this frame (relative to its rest place in the block). */
export interface WordLook {
  readonly dx: number;
  readonly dy: number;
  /** Word scale; differs from the block scale for per-word pops (scaled about the word centre). */
  readonly scale: number;
  /** Glyphs of the word drawn (typewriter); 0 hides it. */
  readonly glyphs: number;
  readonly color: Rgb8;
}

export interface Shadow {
  readonly color: Rgb8;
  /** Offset down and right, in pixels. */
  readonly offset: number;
}

/** Pixel offset of a drop shadow for a text scale. */
export function shadowOffset(scale: number): number {
  return Math.ceil(scale / 2);
}

/** Top-left of a block anchored at a normalized frame position. */
export function placeBlock(
  layout: TextLayout,
  scale: number,
  anchor: {
    readonly pos: readonly [number, number];
    readonly align: TextAlign;
    readonly valign: TextVAlign;
  },
  frame: { readonly width: number; readonly height: number },
): { left: number; top: number } {
  const { w, h } = blockSize(layout, scale);
  const x = Math.round(anchor.pos[0] * frame.width);
  const y = Math.round(anchor.pos[1] * frame.height);
  const left =
    anchor.align === 'left' ? x : anchor.align === 'right' ? x - w : x - Math.floor(w / 2);
  const top =
    anchor.valign === 'top' ? y : anchor.valign === 'bottom' ? y - h : y - Math.floor(h / 2);
  return { left, top };
}

/** `box` grown by a drop shadow. */
export function withShadow(box: PixelRect, shadow: Shadow | undefined): PixelRect {
  if (!shadow || box.w === 0) return box;
  return { ...box, w: box.w + shadow.offset, h: box.h + shadow.offset };
}

function drawPass(
  surface: TextSurface,
  block: BlockPlacement,
  looks: readonly (WordLook | undefined)[],
  paint: Paint,
  shadow: Shadow | undefined,
): void {
  const { layout, align, scale } = block;
  const capHeight = layout.font.capHeight;
  layout.words.forEach((word, index) => {
    const look = looks[index];
    if (!look || look.glyphs <= 0 || look.scale <= 0) return;
    const restX = block.left + lineOffset(layout, word.line, align, scale) + word.x * scale;
    const restCap = block.top + capLine(layout, word.line, scale);
    const x = restX + Math.floor((word.width * (scale - look.scale)) / 2) + look.dx;
    const cap = restCap + Math.floor((capHeight * (scale - look.scale)) / 2) + look.dy;
    const offset = shadow ? shadow.offset : 0;
    const color = shadow ? shadow.color : look.color;
    word.glyphs.slice(0, look.glyphs).forEach(({ glyph, x: glyphX }) => {
      surface.drawGlyph(
        glyph,
        x + glyphX * look.scale + offset,
        cap + offset,
        look.scale,
        color,
        paint,
      );
    });
  });
}

/** Draws every word with its look; the shadow of all words goes under all fills. */
export function drawBlock(
  surface: TextSurface,
  block: BlockPlacement,
  looks: readonly (WordLook | undefined)[],
  paint: Paint,
  shadow?: Shadow,
): void {
  if (shadow) drawPass(surface, block, looks, paint, shadow);
  drawPass(surface, block, looks, paint, undefined);
}

/** Looks for a block drawn uniformly, revealing the first `glyphs` glyphs in reading order. */
export function uniformLooks(
  layout: TextLayout,
  look: Omit<WordLook, 'glyphs'>,
  glyphs: number,
): WordLook[] {
  let remaining = glyphs;
  return layout.words.map((word) => {
    const shown = Math.max(0, Math.min(word.glyphs.length, remaining));
    remaining -= word.glyphs.length;
    return { ...look, glyphs: shown };
  });
}

export function glyphCount(layout: TextLayout): number {
  return layout.words.reduce((sum, word) => sum + word.glyphs.length, 0);
}
