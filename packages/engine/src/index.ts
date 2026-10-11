/** @reelforge/engine: deterministic scene runtime (scene contract, clock/seek, RNG, transitions + transition kit, post-fx, camera rigs, pixel text, annotations). */
export const packageName = '@reelforge/engine';

export { createAmbientApi, lookBudgetKey, shotAmbient } from './ambient.js';
export * from './anchors.js';
export * from './annotations/index.js';
export * from './camera/easing.js';
export * from './camera/rigs.js';
export type * from './contract.js';
export {
  blendFrameDirections,
  createFrameDirector,
  directedClock,
  directionWindows,
  frameDirection,
  type FrameDirection,
  type FrameDirector,
} from './direction.js';
export * from './errors.js';
export type { GpuInfo } from './gl/frame-renderer.js';
export {
  createSandboxedHarness,
  HarnessTimeoutError,
  type HarnessTimeouts,
  type SandboxedHarness,
  type SandboxedHarnessOptions,
} from './harness/host.js';
export {
  cardDiagnosticSchema,
  loadInfoSchema,
  pickResultSchema,
  RPC_CHANNEL,
  type PickInfo,
  type ReelforgeHarness,
} from './harness/protocol.js';
export { loadInfoFonts, type InkFonts } from './ink-fonts.js';
export * from './lint/index.js';
export * from './palette.js';
export type { PickKind, PickResult } from './pick.js';
export * from './presets/index.js';
export * from './rng.js';
export { parseManifest, type LoadInfo } from './runtime.js';
export * from './style.js';
export * from './text/index.js';
export * from './timeline.js';
export * from './transitions/index.js';
export * from './vibe.js';
export * from './world-assets/build.js';
