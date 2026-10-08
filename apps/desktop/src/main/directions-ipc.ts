/**
 * IPC handlers of live co-direction (PLAN.md#12.14): directions.json through the
 * DirectionsService (atomic write, autocommit with `ReelForge-Step: direction`).
 */
import { DIRECTION_STEP, DirectionsService } from './directions-service.js';
import type { InvokeHandlers } from './ipc-router.js';
import type { Logger } from './logger.js';
import type { StepCommit } from './project-commits.js';

export type DirectionsHandlers = Pick<InvokeHandlers, 'directionsState' | 'directionApply'>;

export interface DirectionsHandlerOptions {
  readonly currentProject: () => string | undefined;
  /** Commits `paths` of the project with the given step; true when a commit was made. */
  readonly commit: StepCommit;
  readonly log: Logger;
}

export function directionsHandlers(options: DirectionsHandlerOptions): DirectionsHandlers {
  const service = new DirectionsService({
    projectDir: options.currentProject,
    commit: async (message, paths) => {
      const dir = options.currentProject();
      return dir === undefined ? false : options.commit(dir, message, DIRECTION_STEP, paths);
    },
    log: options.log,
  });
  return {
    directionsState: () => service.state(),
    directionApply: (request) => service.apply(request),
  };
}
