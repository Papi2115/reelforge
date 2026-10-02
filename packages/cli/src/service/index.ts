/**
 * `@reelforge/cli/service`: the render-service protocol shared by the `reelforge` CLI (client)
 * and the desktop app (server), plus the server-side shot planning (same manifests as the CLI).
 * Free of the Playwright harness.
 */
export * from './protocol.js';
export { planServiceShot, type ServiceShotPlan } from './plan.js';
export { ProjectError, UsageError, describeUnknown } from '../errors.js';
export { frameFileName, framesDir } from '../render/output.js';
export type { ShotPlan } from '../project/shots.js';
