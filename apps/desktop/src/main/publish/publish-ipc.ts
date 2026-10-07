/**
 * IPC handlers of the publish kit and the Sources panel (PLAN.md#12.17, #12.18), merged into
 * `registerIpc` by main.ts. Saved files and claims.json are committed like other manual edits.
 */
import type { AppSettings } from '@reelforge/shared';
import type { ClaudeRunner } from '@reelforge/stages';
import type { InvokeHandlers } from '../ipc-router.js';
import type { Logger } from '../logger.js';
import type { StepCommit } from '../project-commits.js';
import { ClaimsService } from './claims-service.js';
import { PublishService } from './publish-service.js';

export type PublishHandlers = Pick<
  InvokeHandlers,
  'publishKit' | 'publishSave' | 'publishOpenFolder' | 'claimsState' | 'claimsCheck' | 'claimsEdit'
>;

export interface PublishHandlerOptions {
  readonly currentProject: () => string | undefined;
  readonly claude: ClaudeRunner;
  readonly settings: () => AppSettings;
  /** Autocommit of `paths` with a step name; false when it failed (logged by the caller). */
  readonly commit: StepCommit;
  readonly openPath: (folder: string) => Promise<string>;
  readonly log: Logger;
}

export function publishHandlers(options: PublishHandlerOptions): PublishHandlers {
  const publish = new PublishService({
    currentProject: options.currentProject,
    commit: (dir, message, paths) => options.commit(dir, message, 'publish', paths),
    openPath: options.openPath,
    log: options.log,
  });
  const claims = new ClaimsService({
    currentProject: options.currentProject,
    claude: options.claude,
    settings: options.settings,
    now: () => new Date(),
    commit: (dir, message, paths) => options.commit(dir, message, 'sources', paths),
    log: options.log,
  });
  return {
    publishKit: () => publish.kit(),
    publishSave: () => publish.save(),
    publishOpenFolder: () => publish.openFolder(),
    claimsState: () => claims.state(),
    claimsCheck: () => claims.check(),
    claimsEdit: (request) => claims.edit(request),
  };
}
