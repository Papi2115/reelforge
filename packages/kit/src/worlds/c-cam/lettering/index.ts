/** C-CAM ink lettering (CC0 1.0): two stroke faces, deterministic layout, ink-ribbon drawing. */
export { faceChars, glyphOf, hasGlyph, type Glyph, type GlyphStroke } from './glyphs.js';
export {
  FACES,
  layoutText,
  measureText,
  textSpan,
  wrapText,
  type FaceMetrics,
  type LaidStroke,
  type LaidText,
  type LayoutOptions,
} from './layout.js';
export {
  POSTER_COLOURS,
  drawText,
  posterLayers,
  smoothStroke,
  strokeRibbon,
  type DrawOptions,
  type InkLayer,
  type PosterColours,
  type Ribbon,
} from './draw.js';
export { paintInkSurface } from './paint-surface.js';
export { THUD_FPS, THUD_LETTER_STEP, thudIn, thudScale, thudStart, type Thud } from './thud-in.js';
export { FACE_NAMES, type FaceName, type InkSurface, type Pt } from './types.js';
