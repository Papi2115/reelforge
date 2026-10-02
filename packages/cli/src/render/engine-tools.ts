/**
 * Lazy access to `@reelforge/engine/cli` (Playwright harness, PNG codec, frame stats). It locates
 * the engine sources when it loads, so it is imported only by the commands that render: status,
 * validate, lint, kit-docs and `anchors --phrase` work wherever the CLI bundle lives.
 */
import { describeUnknown, ProjectError } from '../errors.js';

export type EngineCli = typeof import('@reelforge/engine/cli');

let loading: Promise<EngineCli> | undefined;

export async function engineCli(): Promise<EngineCli> {
  loading ??= import('@reelforge/engine/cli');
  try {
    return await loading;
  } catch (error) {
    loading = undefined;
    throw new ProjectError(
      `the frame renderer is not available: ${describeUnknown(error)}`,
      'tell the user that rendering is not set up on this machine (engine sources and Playwright Chromium are needed)',
    );
  }
}
