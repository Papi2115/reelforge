/**
 * IPC handlers of live co-direction (PLAN.md#12.14): directions.json through the
 * DirectionsService (atomic write, autocommit with `ReelForge-Step: direction`).
 */
import { DIRECTION_STEP, DirectionsService } from './directions-service.js';
import type { InvokeHandlers } from './ipc-router.js';
import type { Logger } from './logger.js';

export type DirectionsHandlers = Pick<InvokeHandlers, 'directionsState' | 'directionApply'>;

export interface DirectionsHandlerOptions {
  readonly currentProject: () => string | undefined;
  /** Commits the open project with the given step; true when a commit was made. */
  readonly commit: (dir: string, message: string, step: string) => Promise<boolean>;
  readonly log: Logger;
}

export function directionsHandlers(options: DirectionsHandlerOptions): DirectionsHandlers {
  const service = new DirectionsService({
    projectDir: options.currentProject,
    commit: async (message) => {
      const dir = options.currentProject();
      return dir === undefined ? false : options.commit(dir, message, DIRECTION_STEP);
    },
    log: options.log,
  });
  return {
    directionsState: () => service.state(),
    directionApply: (request) => service.apply(request),
  };
}
