/**
 * Playwright Chromium launch configurations compared by the spike. Flags verified empirically via
 * the reported WebGL renderer string (Chromium 153 headless shell): with NO flags headless uses
 * SwiftShader; `--use-angle=d3d11` (or `--enable-gpu`) is required for the hardware GPU.
 */
import type { LaunchOptions } from 'playwright';

export interface Backend {
  readonly id: string;
  readonly launch: LaunchOptions;
  /**
   * WebGL context hint. Measured: 'low-power' still got the RTX 4050 (not the Radeon 740M iGPU)
   * in headless Chromium on the dev laptop, so only 'high-performance' is benchmarked.
   */
  readonly powerPreference: WebGLPowerPreference;
}

export const GPU_BACKEND: Backend = {
  id: 'pw-angle-d3d11',
  launch: { headless: true, args: ['--use-angle=d3d11'] },
  powerPreference: 'high-performance',
};

export const SWIFTSHADER_BACKEND: Backend = {
  id: 'pw-swiftshader',
  launch: { headless: true, args: ['--use-angle=swiftshader'] },
  powerPreference: 'high-performance',
};

export const BACKENDS: readonly Backend[] = [GPU_BACKEND, SWIFTSHADER_BACKEND];
