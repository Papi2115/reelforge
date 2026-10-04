/**
 * IPC handlers of the Dramaturgy section (PLAN.md#12.25-12.27): the report and the reveal moments
 * through the DramaturgyService (moments.json, autocommit with `ReelForge-Step: moments`).
 */
import { DramaturgyService, MOMENTS_STEP } from './dramaturgy-service.js';
import type { InvokeHandlers } from './ipc-router.js';
import type { Logger } from './logger.js';

export type DramaturgyHandlers = Pick<InvokeHandlers, 'dramaturgyState' | 'momentDecide'>;

export interface DramaturgyHandlerOptions {
  readonly currentProject: () => string | undefined;
  /** Commits the open project with the given step; true when a commit was made. */
  readonly commit: (dir: string, message: string, step: string) => Promise<boolean>;
  readonly log: Logger;
}

export function dramaturgyHandlers(options: DramaturgyHandlerOptions): DramaturgyHandlers {
  const service = new DramaturgyService({
    projectDir: options.currentProject,
    commit: async (message) => {
      const dir = options.currentProject();
      return dir === undefined ? false : options.commit(dir, message, MOMENTS_STEP);
    },
    now: () => new Date(),
    log: options.log,
  });
  return {
    dramaturgyState: () => service.state(),
    momentDecide: (request) => service.decide(request),
  };
}
