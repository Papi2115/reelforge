/**
 * IPC handlers of Settings → Taste (PLAN.md#12.13), merged into `registerIpc` by main.ts. The
 * export target comes from main's own save dialog (a renderer-supplied path is never written).
 */
import { writeAtomic } from '@reelforge/claude-bridge';
import type { InvokeHandlers } from '../ipc-router.js';
import { describeError, type Logger } from '../logger.js';
import type { TasteService } from './taste-service.js';

export type TasteHandlers = Pick<InvokeHandlers, 'tasteState' | 'tasteReset' | 'tasteExport'>;

export interface TasteHandlerOptions {
  readonly taste: TasteService;
  /** Native save dialog for the exported JSON; undefined when cancelled. */
  readonly pickExportFile: () => Promise<string | undefined>;
  readonly log: Logger;
}

export function tasteHandlers(options: TasteHandlerOptions): TasteHandlers {
  const { taste, log } = options;
  return {
    tasteState: () => Promise.resolve(taste.state()),
    tasteReset: async () => {
      await taste.reset();
      log.info('taste profile reset');
      return taste.state();
    },
    tasteExport: async () => {
      const file = await options.pickExportFile();
      if (file === undefined) return { status: 'cancelled' };
      try {
        await writeAtomic(file, taste.exportJson());
        return { status: 'saved', file };
      } catch (error) {
        return { status: 'error', message: `Not saved: ${describeError(error)}` };
      }
    },
  };
}
