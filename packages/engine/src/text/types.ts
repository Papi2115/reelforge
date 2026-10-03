/** Public types of the pixel-font text system (`ctx.text`, card QA). */
import type {
  FONT_NAMES,
  KineticOptions,
  KineticWord,
  LowerThirdOptions,
  MeasureStyle,
  TitleOptions,
} from './options.js';

export type {
  KineticOptions,
  KineticWord,
  LowerThirdOptions,
  MeasureStyle,
  TitleOptions,
} from './options.js';

export type FontName = (typeof FONT_NAMES)[number];

/** Axis-aligned rectangle in low-res pixels (x/y = top-left, top-down). */
export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** `annotation`: a `ctx.annotate.*` mark (arrow, callout, pin, ...), see `annotation`. */
export type TextCardKind = 'title' | 'lower-third' | 'kinetic' | 'annotation';

/** A text card drawn (or scheduled) in the current frame. */
export interface TextCard {
  readonly id: string;
  readonly kind: TextCardKind;
  readonly text: string;
  /**
   * Pixels the card covers when fully on screen (glyph ink, shadow and plate), unclipped. For
   * annotations: the label part (callout box, pin label, badge, stamp); empty (w = h = 0) for pure
   * strokes (arrow without text, ring, underline, spotlight), which may cross other cards.
   */
  readonly box: PixelRect;
  readonly at: number;
  /** Local time the card is gone (Infinity = end of the shot). */
  readonly until: number;
  /** True when the card is on screen at the current t (at <= t < until). */
  readonly visible: boolean;
  /** Titles and kinetic text: ink box of every word (space-separated), in reading order. */
  readonly words?: readonly PixelRect[] | undefined;
  /** Annotations: what they point at and how they are timed (QA). */
  readonly annotation?: AnnotationCardInfo | undefined;
}

/** Where an annotation target is in the current frame. */
export interface AnnotationTargetProbe {
  /** Which option it came from: `target`, `from` or `to`. */
  readonly role: string;
  /** Short description for QA messages, e.g. `kit.props.calculator() anchor "top"`. */
  readonly label: string;
  /** Projected point, low-res pixels (may be outside the frame). */
  readonly x: number;
  readonly y: number;
  /** In front of the camera and inside the frame. */
  readonly onScreen: boolean;
  /** Behind other geometry; undefined when not tested (screen/card targets, no QA probe). */
  readonly occluded: boolean | undefined;
}

export interface AnnotationCardInfo {
  readonly type: string;
  readonly targets: readonly AnnotationTargetProbe[];
  /** The spoken phrase the annotation illustrates (`anchor` option) and its local time. */
  readonly anchor?: { readonly phrase: string; readonly spokenT: number } | undefined;
  /** Pixel scale of its label text (display/mono font), when it has text. */
  readonly textScale?: number | undefined;
  /** Every pixel it may draw at rest (strokes included), for picking. */
  readonly extent: PixelRect;
}

/** Size of a text block in low-res pixels (line boxes, incl. room for accents and descenders). */
export interface TextMetrics {
  readonly w: number;
  readonly h: number;
  /** Lines after normalization (caps for the display font) and word wrap. */
  readonly lines: readonly string[];
}

/**
 * Pixel-font text drawn into the shot's low-res frame (it goes through the same palette snap and
 * dither as the 3D image). Card calls are immediate-mode: call them in `update(t, ...)` every
 * frame; visibility and enter/exit animation follow from `at`/`until` and the current t.
 * Positions are normalized ([0.5, 0.5] = frame centre), sizes are integer pixel scales.
 */
export interface TextApi {
  /** Safe area in low-res pixels (style margins, 5 % by default); keep cards inside it. */
  readonly safeArea: PixelRect;
  title(text: string, options?: TitleOptions): TextCard;
  /** Name plate at the bottom of the safe area: display-font primary, mono secondary line. */
  lowerThird(primary: string, secondary?: string | null, options?: LowerThirdOptions): TextCard;
  /** Words revealed one by one (`perWordDelay` or per-word `t`, e.g. from `ctx.anchor`). */
  kinetic(words: string | readonly KineticWord[], options?: KineticOptions): TextCard;
  measure(text: string, style?: MeasureStyle): TextMetrics;
  /** Cards registered so far in this frame, in call order. */
  layout(): readonly TextCard[];
}
