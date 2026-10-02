/**
 * Sends timeline edits to main one at a time (PLAN.md#6.5) and shows them right away: a change
 * stays "pending" (applied leniently on top of the last snapshot) until main has written the file
 * and the snapshot was read back, so a drag never flickers and rapid nudges build on each other.
 * Undo/redo send the inverses main returned (edit-history.ts).
 */
import type { StoryboardShot } from '@reelforge/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CuesView } from '../../shared/snapshot-contract.js';
import type { EditReason, FileEdits } from '../../shared/timeline-contract.js';
import { errorMessage, rendererLog } from '../log.js';
import { EditHistory } from './edit-history.js';
import { applyChanges } from './timeline-model.js';

const log = rendererLog('timeline');

export interface TimelineEditing {
  /** Shots and cues with pending edits applied. */
  readonly shots: readonly StoryboardShot[];
  readonly cues: CuesView;
  readonly apply: (change: FileEdits) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Last commit subject or the reason an edit was refused. */
  readonly status: { readonly kind: 'saved' | 'error'; readonly text: string } | undefined;
}

interface Pending {
  readonly id: number;
  readonly change: FileEdits;
}

export function useTimelineEdits(
  dir: string,
  shots: readonly StoryboardShot[],
  cues: CuesView,
  reload: () => Promise<void>,
): TimelineEditing {
  const [pending, setPending] = useState<readonly Pending[]>([]);
  const [status, setStatus] = useState<TimelineEditing['status']>(undefined);
  const [, setHistoryVersion] = useState(0);
  const history = useRef(new EditHistory());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const nextId = useRef(0);

  useEffect(() => {
    history.current.clear();
    setPending([]);
    setStatus(undefined);
    setHistoryVersion((version) => version + 1);
  }, [dir]);

  const send = useCallback(
    async (change: FileEdits, reason: EditReason): Promise<void> => {
      nextId.current += 1;
      const id = nextId.current;
      setPending((list) => [...list, { id, change }]);
      try {
        const result = await window.reelforge.editTimeline({ change, reason });
        if (result.status === 'ok') {
          if (reason === 'edit') history.current.recordEdit(result.inverse);
          else if (reason === 'undo') history.current.recordUndo(result.inverse);
          else history.current.recordRedo(result.inverse);
          setStatus({ kind: 'saved', text: result.message });
        } else {
          log.warn(`timeline ${reason} refused: ${result.message}`);
          setStatus({ kind: 'error', text: result.message });
        }
        await reload();
      } catch (error) {
        log.error(`timeline ${reason} failed: ${errorMessage(error)}`);
        setStatus({ kind: 'error', text: errorMessage(error) });
      } finally {
        setPending((list) => list.filter((item) => item.id !== id));
        setHistoryVersion((version) => version + 1);
      }
    },
    [reload],
  );

  const enqueue = useCallback((task: () => Promise<void>): void => {
    queue.current = queue.current.then(task, task);
  }, []);

  const apply = useCallback(
    (change: FileEdits) => {
      // Shown at once; the request waits for the previous ones (main applies them in order).
      nextId.current += 1;
      const id = nextId.current;
      setPending((list) => [...list, { id, change }]);
      enqueue(async () => {
        setPending((list) => list.filter((item) => item.id !== id));
        await send(change, 'edit');
      });
    },
    [enqueue, send],
  );

  const replay = useCallback(
    (reason: 'undo' | 'redo') => {
      enqueue(async () => {
        const change = reason === 'undo' ? history.current.takeUndo() : history.current.takeRedo();
        if (change) await send(change, reason);
      });
    },
    [enqueue, send],
  );

  const displayed = useMemo(
    () =>
      applyChanges(
        shots,
        cues,
        pending.map((item) => item.change),
      ),
    [shots, cues, pending],
  );

  return {
    shots: displayed.shots,
    cues: displayed.cues,
    apply,
    undo: () => {
      replay('undo');
    },
    redo: () => {
      replay('redo');
    },
    canUndo: history.current.canUndo,
    canRedo: history.current.canRedo,
    status,
  };
}
