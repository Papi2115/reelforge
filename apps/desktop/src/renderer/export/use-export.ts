/**
 * The export dialog's data (PLAN.md#9.1, #9.2): the options of the open project, the queue (main
 * pushes every change) and the YouTube suggestions. `refresh` re-reads the options (after the
 * folder changed); the queue state follows the pushes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { YoutubeMetaFile } from '@reelforge/shared';
import type { ExportOptions, ExportQueueState } from '../../shared/export-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('export');

export interface ExportData {
  readonly options: ExportOptions | undefined;
  readonly queue: ExportQueueState | undefined;
  readonly meta: YoutubeMetaFile | null;
  readonly refresh: () => void;
  readonly setMeta: (meta: YoutubeMetaFile | null) => void;
}

export function useExport(dir: string): ExportData {
  const [options, setOptions] = useState<ExportOptions | undefined>(undefined);
  const [queue, setQueue] = useState<ExportQueueState | undefined>(undefined);
  const [meta, setMeta] = useState<YoutubeMetaFile | null>(null);
  const finished = useRef(0);

  const refresh = useCallback(() => {
    window.reelforge.getExportOptions().then(setOptions, (error: unknown) => {
      log.error(`getExportOptions failed: ${errorMessage(error)}`);
    });
    window.reelforge.getYoutubeMeta().then(setMeta, (error: unknown) => {
      log.error(`getYoutubeMeta failed: ${errorMessage(error)}`);
    });
  }, []);

  useEffect(() => {
    let active = true;
    refresh();
    const unsubscribe = window.reelforge.onExportQueueChanged((next) => {
      if (active && next.projectDir === dir) {
        setQueue(next);
        // A newly finished export rewrites chapters / suggestions (and the options' chapters).
        const done = next.jobs.filter((job) => job.status === 'done').length;
        if (done > finished.current) {
          finished.current = done;
          refresh();
        }
      }
    });
    window.reelforge.getExportQueue().then(
      (initial) => {
        if (active && initial.projectDir === dir) setQueue((current) => current ?? initial);
      },
      (error: unknown) => {
        log.error(`getExportQueue failed: ${errorMessage(error)}`);
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [dir, refresh]);

  return { options, queue, meta, refresh, setMeta };
}
