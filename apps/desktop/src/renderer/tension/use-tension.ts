/**
 * The Tension panel's state (PLAN.md#12.22): the saved curve comes from the project snapshot;
 * a drag or a key press edits a local draft that is saved through main (tension.json + commit,
 * so the project history can revert it); Undo saves the previous curve again; Reset and
 * "Propose with Claude" go through main as well.
 */
import type { TensionFile, TensionPoint } from '@reelforge/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileState } from '../../shared/snapshot-contract.js';
import type { TensionSaveResult } from '../../shared/tension-contract.js';
import { errorMessage, rendererLog } from '../log.js';
import { saveNotice } from './tension-view.js';

const log = rendererLog('tension');
const UNDO_DEPTH = 30;

export interface TensionEdit {
  readonly points: readonly TensionPoint[];
  readonly change: string;
  readonly locked?: boolean;
}

export interface TensionController {
  /** The saved curve (undefined: none or invalid). */
  readonly file: TensionFile | undefined;
  /** Why tension.json cannot be read, when it cannot. */
  readonly invalid: string | undefined;
  /** What the panel draws: the draft while editing, else the saved points. */
  readonly points: readonly TensionPoint[] | undefined;
  readonly setDraft: (points: readonly TensionPoint[] | undefined) => void;
  readonly save: (edit: TensionEdit) => void;
  readonly undo: () => void;
  readonly canUndo: boolean;
  readonly reset: () => void;
  readonly propose: () => void;
  readonly busy: boolean;
  /** What the last action did (or why it failed). */
  readonly notice: string | undefined;
}

export function useTension(
  state: FileState<TensionFile> | undefined,
  reload: () => Promise<void>,
): TensionController {
  const file = state?.status === 'ok' ? state.data : undefined;
  const invalid = state?.status === 'error' ? state.error.message : undefined;
  const [draft, setDraft] = useState<readonly TensionPoint[] | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<readonly (readonly TensionPoint[])[]>([]);
  const fileRef = useRef(file);
  fileRef.current = file;

  // A new curve on disk (save, Reset, Claude, a revert) replaces the draft.
  useEffect(() => {
    setDraft(undefined);
  }, [file]);

  const settle = useCallback(
    (request: Promise<TensionSaveResult>): void => {
      setBusy(true);
      request
        .then(async (result) => {
          setNotice(saveNotice(result));
          if (result.status === 'error') setDraft(undefined);
          await reload();
        })
        .catch((reason: unknown) => {
          log.error(`tension change failed: ${errorMessage(reason)}`);
          setNotice(errorMessage(reason));
          setDraft(undefined);
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [reload],
  );

  const save = useCallback(
    (edit: TensionEdit): void => {
      const before = fileRef.current?.points;
      if (before !== undefined) setHistory((stack) => [...stack.slice(-UNDO_DEPTH + 1), before]);
      setDraft(edit.points);
      settle(
        window.reelforge.saveTension({
          points: [...edit.points],
          change: edit.change,
          ...(edit.locked === undefined ? {} : { locked: edit.locked }),
        }),
      );
    },
    [settle],
  );

  const undo = useCallback((): void => {
    const previous = history.at(-1);
    if (previous === undefined) return;
    setHistory((stack) => stack.slice(0, -1));
    setDraft(previous);
    settle(window.reelforge.saveTension({ points: [...previous], change: 'undo' }));
  }, [history, settle]);

  const reset = useCallback((): void => {
    const before = fileRef.current?.points;
    if (before !== undefined) setHistory((stack) => [...stack.slice(-UNDO_DEPTH + 1), before]);
    settle(window.reelforge.resetTension());
  }, [settle]);

  const propose = useCallback((): void => {
    setBusy(true);
    window.reelforge
      .proposeTension()
      .then((result) => {
        setNotice(
          result.status === 'error'
            ? (result.message ?? 'Not started.')
            : 'Claude is proposing a curve (see the Storyboard step).',
        );
      })
      .catch((reason: unknown) => {
        log.error(`proposeTension failed: ${errorMessage(reason)}`);
        setNotice(errorMessage(reason));
      })
      .finally(() => {
        setBusy(false);
      });
  }, []);

  return {
    file,
    invalid,
    points: draft ?? file?.points,
    setDraft,
    save,
    undo,
    canUndo: history.length > 0,
    reset,
    propose,
    busy,
    notice,
  };
}
