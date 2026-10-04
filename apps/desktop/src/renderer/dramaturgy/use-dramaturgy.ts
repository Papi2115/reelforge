/**
 * The Dramaturgy section's state (PLAN.md#12.25–12.27), read through main whenever `key` changes
 * (a review, a sync check or the storyboard changed) and after every moment decision.
 */
import { useCallback, useEffect, useState } from 'react';
import type { DramaturgyState, MomentDecision } from '../../shared/dramaturgy-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('dramaturgy');

export interface DramaturgyControls {
  readonly state: DramaturgyState | undefined;
  /** The last decision's error, if it failed. */
  readonly error: string | undefined;
  readonly pending: boolean;
  decide(id: string, decision: MomentDecision): void;
}

export function useDramaturgy(key: string): DramaturgyControls {
  const [state, setState] = useState<DramaturgyState | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    window.reelforge.getDramaturgy().then(
      (next) => {
        if (active) setState(next);
      },
      (failure: unknown) => {
        log.error(`getDramaturgy failed: ${errorMessage(failure)}`);
      },
    );
    return () => {
      active = false;
    };
  }, [key, revision]);
  const decide = useCallback((id: string, decision: MomentDecision) => {
    setPending(true);
    window.reelforge.decideMoment({ id, decision }).then(
      (result) => {
        setPending(false);
        setError(result.status === 'error' ? result.message : undefined);
        setRevision((value) => value + 1);
      },
      (failure: unknown) => {
        setPending(false);
        setError(errorMessage(failure));
        log.error(`decideMoment failed: ${errorMessage(failure)}`);
      },
    );
  }, []);
  return { state, error, pending, decide };
}
