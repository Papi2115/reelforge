/**
 * IPC handlers of asset research (PLAN.md#12.10), the user's own files (#12.12) and the global
 * asset library (#12.19), merged into `registerIpc` by main.ts, and the test hook that points the
 * asset layer at a local source server (unpackaged app + test hooks only, like the whisper mirror;
 * never a setting).
 */
import { loopbackAssetRuntime, type AssetRuntime } from '@reelforge/cli/assets';
import { TEST_ASSET_SERVER_ENV } from '../app-paths.js';
import type { InvokeHandlers } from '../ipc-router.js';
import type { Logger } from '../logger.js';
import type { StageService } from '../stages/stage-service.js';
import { AssetActions } from './asset-actions.js';
import { AssetsService } from './assets-service.js';
import { LibraryService } from './library-service.js';

export type AssetsHandlers = Pick<
  InvokeHandlers,
  | 'assetsState'
  | 'assetsReview'
  | 'assetsImport'
  | 'assetsEdit'
  | 'assetsRemove'
  | 'assetsLibrary'
  | 'libraryState'
  | 'libraryEdit'
  | 'libraryRemove'
  | 'libraryUse'
>;

/** The asset runtime of the test hook, or undefined (the real sources). */
export function assetTestRuntime(
  env: NodeJS.ProcessEnv,
  enabled: boolean,
): AssetRuntime | undefined {
  const base = env[TEST_ASSET_SERVER_ENV] ?? '';
  if (!enabled || !/^http:\/\/127\.0\.0\.1:\d+$/.test(base)) return undefined;
  return loopbackAssetRuntime(base, () => new Date());
}

/** File types the "Add my assets" picker offers (the content is checked again). */
export const OWN_ASSET_FILTERS = [
  { name: 'Images and videos', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm'] },
];

export interface AssetsHandlerOptions {
  readonly stages: StageService;
  readonly currentProject: () => string | undefined;
  /** The global asset library folder (`<app data>/library`). */
  readonly libraryDir: string;
  readonly saveOwnToLibrary: () => boolean;
  readonly pickFiles: () => Promise<readonly string[] | undefined>;
  readonly commit: (dir: string, message: string) => Promise<void>;
  readonly log: Logger;
}

export function assetsHandlers(options: AssetsHandlerOptions): AssetsHandlers {
  const changed = (): void => {
    options.stages.refresh();
  };
  const service = new AssetsService({
    projectDir: options.currentProject,
    fetchApproved: () => options.stages.enqueue([{ stage: 'assets', action: 'fetch-approved' }]),
    changed,
    log: options.log,
    libraryDir: options.libraryDir,
  });
  const actions = new AssetActions({
    projectDir: options.currentProject,
    libraryDir: options.libraryDir,
    saveOwnToLibrary: options.saveOwnToLibrary,
    pickFiles: options.pickFiles,
    commit: options.commit,
    changed,
    log: options.log,
  });
  const library = new LibraryService({
    libraryDir: options.libraryDir,
    projectDir: options.currentProject,
    commit: options.commit,
    changed,
    log: options.log,
  });
  return {
    assetsState: () => service.state(),
    assetsReview: (request) => service.review(request),
    assetsImport: (request) => actions.import(request),
    assetsEdit: (request) => actions.edit(request),
    assetsRemove: (request) => actions.remove(request.id),
    assetsLibrary: (request) => actions.setInLibrary(request),
    libraryState: (query) => library.state(query),
    libraryEdit: (request) => library.edit(request),
    libraryRemove: (request) => library.remove(request.sha256),
    libraryUse: (request) => library.use(request.sha256),
  };
}
