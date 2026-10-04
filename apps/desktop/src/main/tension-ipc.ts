/**
 * IPC handlers of the Tension panel (PLAN.md#12.22): curve edits and Reset through the
 * TensionService (tension.json, autocommit), "Propose with Claude" through the stage queue (the
 * storyboard's `tension` action, so it shares the Claude session, the usage guard and the
 * pipeline's live steps).
 */
import type { StageRequest } from '@reelforge/stages';
import type { StageCommandResult } from '../shared/stages-contract.js';
import type { InvokeHandlers } from './ipc-router.js';
import type { Logger } from './logger.js';
import { TENSION_STEP, TensionService } from './tension-service.js';

export type TensionHandlers = Pick<
  InvokeHandlers,
  'tensionSave' | 'tensionReset' | 'tensionPropose'
>;

export interface TensionHandlerOptions {
  readonly currentProject: () => string | undefined;
  /** Commits the open project with `ReelForge-Step: tension`; true when a commit was made. */
  readonly commit: (dir: string, message: string, step: string) => Promise<boolean>;
  readonly enqueue: (requests: readonly StageRequest[]) => Promise<StageCommandResult>;
  readonly log: Logger;
}

export function tensionHandlers(options: TensionHandlerOptions): TensionHandlers {
  const service = new TensionService({
    projectDir: options.currentProject,
    commit: async (message) => {
      const dir = options.currentProject();
      return dir === undefined ? false : options.commit(dir, message, TENSION_STEP);
    },
    log: options.log,
  });
  return {
    tensionSave: (request) => service.save(request),
    tensionReset: () => service.reset(),
    tensionPropose: () => options.enqueue([{ stage: 'storyboard', action: 'tension' }]),
  };
}
