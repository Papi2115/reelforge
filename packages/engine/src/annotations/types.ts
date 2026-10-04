/** Public types of the annotation layer (`ctx.annotate`). */
import type {
  AnnotationType,
  ArrowOptions,
  BadgeOptions,
  BracketOptions,
  CalloutOptions,
  DimensionOptions,
  HighlightOptions,
  PinOptions,
  RingOptions,
  SourceChipOptions,
  SpotlightOptions,
  StampOptions,
  UnderlineOptions,
} from './options.js';

export type {
  AnnotationAnimation,
  AnnotationType,
  ArrowOptions,
  BadgeOptions,
  BracketOptions,
  CalloutOptions,
  DimensionOptions,
  HighlightOptions,
  PinOptions,
  RingOptions,
  SourceChipCorner,
  SourceChipOptions,
  SpotlightOptions,
  StampOptions,
  UnderlineOptions,
} from './options.js';
export type { AnnotationTarget } from './target-spec.js';

/** What an annotate call returns: the card id it is reported under in QA. */
export interface AnnotationHandle {
  readonly id: string;
  readonly type: AnnotationType;
}

/**
 * Pixel-art annotations drawn into the shot's low-res frame with the text (same palette snap and
 * dither). Immediate mode like `ctx.text`: call them in `update(t, ...)` every frame; `at`/`until`
 * (or `anchor: 'spoken phrase'`) time them. They are drawn after update() returns, so 3D targets
 * are projected with the final camera of the frame and follow camera and object moves.
 * Targets: a kit object, `{ object, anchor: 'top' }`, `{ world: [x, y, z] }`,
 * `{ screen: [x, y], size?: [w, h] }` (0..1) or `{ card: '<ctx.text id>', words?: [i, j] }`.
 * Sizes (radius, length, offset, size) are shares of the frame height; thickness/scale are pixels.
 */
export interface AnnotateApi {
  /** Framed box with optional header and a pointer tail to the target (definitions, facts). */
  callout(options: CalloutOptions): AnnotationHandle;
  /** Arrow drawn on towards a target (straight / curved / elbow), optional label at the tail. */
  arrow(options: ArrowOptions): AnnotationHandle;
  /** Circle or rounded rect around a target, drawn on, gently pulsing. */
  ring(options: RingOptions): AnnotationHandle;
  /** Curly/square bracket over a span (two targets, e.g. the first and last of a group). */
  bracket(options: BracketOptions): AnnotationHandle;
  /** Name label on a leader line attached to a target; side picked to stay in the safe area. */
  pin(options: PinOptions): AnnotationHandle;
  /** Line / double / scribble under a text card (or its words) or any target with bounds. */
  underline(options: UnderlineOptions): AnnotationHandle;
  /** Marker bar behind a text card's words (drawn under the text). */
  highlight(options: HighlightOptions): AnnotationHandle;
  /** Numbered circle/square (0-99) or a mark: check, cross, '!', '?'. */
  badge(options: BadgeOptions): AnnotationHandle;
  /** Rotated rubber stamp ('CONFIRMED', 'LEAKED') that slams down, worn ink texture. */
  stamp(options: StampOptions): AnnotationHandle;
  /** Measurement line between two targets with ticks and a value label. */
  dimension(options: DimensionOptions): AnnotationHandle;
  /** Dims the whole frame except a circle/rect around the target (dithered soft edge). */
  spotlight(options: SpotlightOptions): AnnotationHandle;
  /**
   * Small 'SOURCE: NAME' chip (+ optional reference number) in a free corner of the safe area,
   * crediting the source of a claim; drawn after the other marks so it never covers them.
   */
  sourceChip(options: SourceChipOptions): AnnotationHandle;
}
