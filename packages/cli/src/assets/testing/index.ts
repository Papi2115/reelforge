/**
 * `@reelforge/cli/assets-testing`: the local asset source server of the CLI tests, for the stage
 * and app tests (PLAN.md#12.10). Never imported by app code.
 */
export {
  ASSET_FIXTURES,
  startAssetServer,
  tinyMp4,
  tinyPng,
  type AssetTestServer,
  type Handler,
} from './server.js';
export { loopbackAssetRuntime, loopbackEndpoints } from './loopback.js';
export { runAssetCommand, type AssetCommandRun } from './commands.js';
