/**
 * IPC handlers of Settings → Taste (PLAN.md#12.13), merged into `registerIpc` by main.ts. Every
 * call acts on one profile (PLAN.md#13.13): the open project's channel (and world), else the
 * requested channel / world. The export target comes from main's own save dialog (a
 * renderer-supplied path is never written).
 */
import { writeAtomic } from '@reelforge/claude-bridge';
import type { TasteScopeRequest } from '../../shared/taste-contract.js';
import type { InvokeHandlers } from '../ipc-router.js';
import { describeError, type Logger } from '../logger.js';
import type { TasteTarget } from './taste-scope.js';
import type { TasteService } from './taste-service.js';

export type TasteHandlers = Pick<InvokeHandlers, 'tasteState' | 'tasteReset' | 'tasteExport'>;

export interface TasteHandlerOptions {
  readonly taste: TasteService;
  /** Folder of the open project; undefined when none is open. */
  readonly currentProject: () => string | undefined;
  /** Native save dialog for the exported JSON; undefined when cancelled. */
  readonly pickExportFile: () => Promise<string | undefined>;
  readonly log: Logger;
}

/** The open project wins; without one, the requested channel and world. */
export function tasteTarget(
  currentProject: string | undefined,
  request: TasteScopeRequest,
): TasteTarget {
  if (currentProject !== undefined) return { kind: 'project', dir: currentProject };
  return {
    kind: 'channel',
    ...(request.channelId === undefined ? {} : { channelId: request.channelId }),
    ...(request.world === undefined ? {} : { world: request.world }),
  };
}

export function tasteHandlers(options: TasteHandlerOptions): TasteHandlers {
  const { taste, log } = options;
  const target = (request: TasteScopeRequest): TasteTarget =>
    tasteTarget(options.currentProject(), request);
  return {
    tasteState: (request) => Promise.resolve(taste.state(target(request))),
    tasteReset: async (request) => {
      const chosen = target(request);
      await taste.reset(chosen);
      log.info(`taste profile reset: ${taste.scope(chosen).file}`);
      return taste.state(chosen);
    },
    tasteExport: async (request) => {
      const json = taste.exportJson(target(request));
      const file = await options.pickExportFile();
      if (file === undefined) return { status: 'cancelled' };
      try {
        await writeAtomic(file, json);
        return { status: 'saved', file };
      } catch (error) {
        return { status: 'error', message: `Not saved: ${describeError(error)}` };
      }
    },
  };
}
