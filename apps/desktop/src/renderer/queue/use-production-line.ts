/**
 * The production line in the renderer (PLAN.md#13.9): its state, read once and then pushed by main
 * after every change; whether the Production line dialog is open and which film it shows (a
 * "Needs you" item or a clicked system notification opens it at that film); the films whose
 * script was opened here in this session (only those offer "Approve script", like the app's own
 * flow where you read the script before approving it).
 */
import { useCallback, useEffect, useState } from 'react';
import type { QueueItemRef, QueueState } from '../../shared/queue-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('production-line');

export interface LineDialogState {
  readonly open: boolean;
  /** The film to show (scrolled to and highlighted); null = as it was. */
  readonly focus: QueueItemRef | null;
}

export interface ProductionLineController {
  readonly state: QueueState | undefined;
  readonly dialog: LineDialogState;
  readonly show: (ref?: QueueItemRef) => void;
  readonly close: () => void;
  readonly toggle: () => void;
  readonly viewed: ReadonlySet<string>;
  readonly markViewed: (itemId: string) => void;
}

export function useProductionLine(): ProductionLineController {
  const [state, setState] = useState<QueueState | undefined>(undefined);
  const [dialog, setDialog] = useState<LineDialogState>({ open: false, focus: null });
  const [viewed, setViewed] = useState<ReadonlySet<string>>(new Set());

  const show = useCallback((ref?: QueueItemRef): void => {
    setDialog({ open: true, focus: ref ?? null });
  }, []);

  useEffect(() => {
    let active = true;
    window.reelforge.getQueueState().then(
      (loaded) => {
        if (active) setState(loaded);
      },
      (error: unknown) => {
        log.error(`getQueueState failed: ${errorMessage(error)}`);
      },
    );
    const offChanged = window.reelforge.onQueueChanged((next) => {
      setState(next);
    });
    const offShow = window.reelforge.onQueueShowItem(show);
    return () => {
      active = false;
      offChanged();
      offShow();
    };
  }, [show]);

  return {
    state,
    dialog,
    show,
    close: () => {
      setDialog({ open: false, focus: null });
    },
    toggle: () => {
      setDialog((current) => ({ open: !current.open, focus: null }));
    },
    viewed,
    markViewed: (itemId) => {
      setViewed((current) => new Set([...current, itemId]));
    },
  };
}
