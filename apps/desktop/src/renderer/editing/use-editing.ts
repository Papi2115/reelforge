/**
 * The Editing section's state (PLAN.md#12.21, #12.23), read through main whenever `key` changes
 * (a review or the storyboard changed) and after every repetition action.
 */
import { useCallback, useEffect, useState } from 'react';
import type { EditingState, RepetitionActionRequest } from '../../shared/editing-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('editing');

export interface EditingControls {
  readonly state: EditingState | undefined;
  /** The last action's outcome (error or what was done). */
  readonly message: string | undefined;
  readonly pending: boolean;
  act(id: string, action: RepetitionActionRequest['action']): void;
}

export function useEditing(key: string): EditingControls {
  const [state, setState] = useState<EditingState | undefined>(undefined);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    window.reelforge.getEditing().then(
      (next) => {
        if (active) setState(next);
      },
      (failure: unknown) => {
        log.error(`getEditing failed: ${errorMessage(failure)}`);
      },
    );
    return () => {
      active = false;
    };
  }, [key, revision]);
  const act = useCallback((id: string, action: RepetitionActionRequest['action']) => {
    setPending(true);
    window.reelforge.actOnRepetition({ id, action }).then(
      (result) => {
        setPending(false);
        setMessage(result.message);
        setRevision((value) => value + 1);
      },
      (failure: unknown) => {
        setPending(false);
        setMessage(errorMessage(failure));
        log.error(`actOnRepetition failed: ${errorMessage(failure)}`);
      },
    );
  }, []);
  return { state, message, pending, act };
}
