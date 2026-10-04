/**
 * IPC handlers of asset research (PLAN.md#12.10), merged into `registerIpc` by main.ts, and the
 * test hook that points the asset layer at a local source server (unpackaged app + test hooks
 * only, like the whisper mirror; never a setting).
 */
import { loopbackAssetRuntime, type AssetRuntime } from '@reelforge/cli/assets';
import { TEST_ASSET_SERVER_ENV } from '../app-paths.js';
import type { InvokeHandlers } from '../ipc-router.js';
import type { Logger } from '../logger.js';
import type { StageService } from '../stages/stage-service.js';
import { AssetsService } from './assets-service.js';

export type AssetsHandlers = Pick<InvokeHandlers, 'assetsState' | 'assetsReview'>;

/** The asset runtime of the test hook, or undefined (the real sources). */
export function assetTestRuntime(
  env: NodeJS.ProcessEnv,
  enabled: boolean,
): AssetRuntime | undefined {
  const base = env[TEST_ASSET_SERVER_ENV] ?? '';
  if (!enabled || !/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) return undefined;
  return loopbackAssetRuntime(base, () => new Date());
}

export interface AssetsHandlerOptions {
  readonly stages: StageService;
  readonly currentProject: () => string | undefined;
  readonly log: Logger;
}

export function assetsHandlers(options: AssetsHandlerOptions): AssetsHandlers {
  const service = new AssetsService({
    projectDir: options.currentProject,
    fetchApproved: () => options.stages.enqueue([{ stage: 'assets', action: 'fetch-approved' }]),
    changed: () => {
      options.stages.refresh();
    },
    log: options.log,
  });
  return {
    assetsState: () => service.state(),
    assetsReview: (request) => service.review(request),
  };
}
