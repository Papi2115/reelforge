/**
 * `@reelforge/cli/service`: the render-service protocol shared by the `reelforge` CLI (client)
 * and the desktop app (server), plus the server-side shot planning (same manifests as the CLI)
 * and the contact-sheet compositor (scene QA of `@reelforge/stages`). Free of the Playwright
 * harness.
 */
export * from './protocol.js';
export { planServiceShot, type ServiceShotPlan } from './plan.js';
export { ProjectError, UsageError, describeUnknown } from '../errors.js';
export { frameFileName, framesDir } from '../render/output.js';
export { composeSheet, type SheetLayout, type SheetRow, type SheetTile } from '../render/sheet.js';
export type { ShotPlan } from '../project/shots.js';
export { readKitExtensions, type KitExtensionFiles } from '../project/kit-ext.js';
export * from '../props/checks.js';
export * from '../props/turntable.js';
