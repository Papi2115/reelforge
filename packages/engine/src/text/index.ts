/** Pixel-font text system: `ctx.text` (titles, lower thirds, kinetic text), measuring and card QA. */
export {
  checkCards,
  collectCardTimeline,
  formatCardDiagnostics,
  type CardDiagnostic,
  type CardFrame,
  type CardRule,
  type CardSource,
  type ShotCardTimeline,
} from './check-cards.js';
export type { BitmapFont, Glyph } from './font.js';
export { DISPLAY_FONT } from './font-display.js';
export { MONO_FONT } from './font-mono.js';
export {
  FONT_NAMES,
  KINETIC_STYLES,
  kineticOptionsSchema,
  LOWER_THIRD_ANIMATIONS,
  lowerThirdOptionsSchema,
  MAX_TEXT_SCALE,
  TITLE_ANIMATIONS,
  titleOptionsSchema,
} from './options.js';
export { safeAreaRect, type TextOverlay } from './text-layer.js';
export type * from './types.js';
