/**
 * `@reelforge/engine/cli`: Node-only dev tooling — harness browser (Playwright + SwiftShader),
 * frame rendering, golden-frame comparison, PNG codec. Not for the app bundle; Playwright is not
 * a product dependency (ADR-002).
 */
export { buildHarness, HARNESS_DIR } from './build-harness.js';
export { runEngineCli } from './engine-cli.js';
export {
  computeFrameStats,
  countDifferingPixels,
  diffImage,
  type FrameStats,
} from './frame-stats.js';
export {
  DEFAULT_GOLDEN_CONFIG,
  goldenConfigSchema,
  goldenTolerance,
  loadGoldenConfig,
  type GoldenConfig,
  type GoldenTolerance,
} from './golden-config.js';
export {
  compareWithGolden,
  GOLDEN_BACKEND,
  GOLDEN_DIR,
  GoldenMismatchError,
  type GoldenOptions,
  type GoldenResult,
} from './goldens.js';
export {
  launchHarnessBrowser,
  sha256,
  SWIFTSHADER_ARGS,
  type HarnessBrowser,
  type HarnessBrowserOptions,
  type HarnessPage,
  type OpenPageOptions,
} from './harness-session.js';
export {
  DEFAULT_COLD_REQUEST_TIMEOUT_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  guardHarnessPage,
  HarnessTimeoutError,
  isHarnessTimeout,
  resolveHarnessTimeouts,
  retryOnHarnessTimeout,
  type HarnessTimeoutReason,
  type HarnessTimeouts,
  type RetriedRender,
} from './harness-timeouts.js';
export { processIo, type CliIo } from './io.js';
export { decodePng, encodePng, type RgbaImage } from './png.js';
export { runRenderFramesCli } from './render-frames.js';
export { startStaticServer, type StaticServer } from './static-server.js';
