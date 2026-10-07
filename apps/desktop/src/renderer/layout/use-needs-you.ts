/**
 * The reports of the "Needs you" inbox that the workspace does not hold itself: the dramaturgy
 * (wow moments, open questions), the editing (repetitions) and the claims state. Read through main
 * once when the project opens and again after project changes (`changeKey`: the snapshot, which
 * is reloaded on every `projectChanged` push, reports included), coalesced so a burst of
 * changes (a scene build) costs one read. No polling.
 */
import { useEffect, useState } from 'react';
import type { DramaturgyState } from '../../shared/dramaturgy-contract.js';
import type { EditingState } from '../../shared/editing-contract.js';
import type { ClaimsState } from '../../shared/publish-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('needs-you');

/** Changes that arrive closer together than this are read once. */
export const ATTENTION_READ_DELAY_MS = 400;

export interface AttentionSources {
  readonly dramaturgy: DramaturgyState | undefined;
  readonly editing: EditingState | undefined;
  readonly claims: ClaimsState | undefined;
}

const NONE: AttentionSources = { dramaturgy: undefined, editing: undefined, claims: undefined };

function read<T>(name: string, request: () => Promise<T>): Promise<T | undefined> {
  return request().then(
    (value) => value,
    (error: unknown) => {
      log.error(`${name} failed: ${errorMessage(error)}`);
      return undefined;
    },
  );
}

export function useAttentionSources(dir: string, changeKey: unknown): AttentionSources {
  const [sources, setSources] = useState<AttentionSources>(NONE);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void Promise.all([
        read('getDramaturgy', () => window.reelforge.getDramaturgy()),
        read('getEditing', () => window.reelforge.getEditing()),
        read('getClaimsState', () => window.reelforge.getClaimsState()),
      ]).then(([dramaturgy, editing, claims]) => {
        if (active) setSources({ dramaturgy, editing, claims });
      });
    }, ATTENTION_READ_DELAY_MS);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [dir, changeKey]);
  return sources;
}
