/**
 * `@reelforge/engine/raster`: the PNG codec and frame statistics of the engine tooling, without
 * the Playwright harness, so Node code that only handles frames (the `reelforge` CLI talking to
 * the app's render service, the app's main process) does not need Playwright or esbuild.
 */
export { decodePng, encodePng, type RgbaImage } from '../cli/png.js';
export {
  computeFrameStats,
  countDifferingPixels,
  diffImage,
  type FrameStats,
} from '../cli/frame-stats.js';
