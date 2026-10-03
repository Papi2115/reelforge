/**
 * Shot locks in the workspace (PLAN.md#11.4): the locked set of the project snapshot, lock /
 * unlock through main (it writes `locks.json` and commits), and Shift+L on the selected shot.
 */
import type { ShotLocksFile } from '@reelforge/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FileState } from '../../shared/snapshot-contract.js';
import { errorMessage } from '../log.js';
import { keyTargetOf } from '../preview/transport-keys.js';
import { isLockShortcut, lockedShotSet } from './locks-view.js';

export interface ShotLocks {
  readonly locked: ReadonlySet<string>;
  readonly setLocked: (shotIds: readonly string[], locked: boolean) => Promise<boolean>;
  /** Why the last lock change failed (cleared by the next one). */
  readonly notice: string | undefined;
}

export function useShotLocks(
  locks: FileState<ShotLocksFile> | undefined,
  selectedShotId: string | undefined,
  reload: () => Promise<void>,
): ShotLocks {
  const locked = useMemo(() => lockedShotSet(locks), [locks]);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const setLocked = useCallback(
    async (shotIds: readonly string[], lock: boolean): Promise<boolean> => {
      setNotice(undefined);
      try {
        const result = await window.reelforge.lockShots(shotIds, lock);
        if (result.status === 'error') {
          setNotice(result.message ?? 'The lock was not changed.');
          return false;
        }
        await reload();
        return true;
      } catch (error) {
        setNotice(errorMessage(error));
        return false;
      }
    },
    [reload],
  );
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (selectedShotId === undefined) return;
      const shortcut = isLockShortcut({
        key: event.key,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        repeat: event.repeat,
        target: keyTargetOf(event.target),
      });
      if (!shortcut) return;
      event.preventDefault();
      void setLocked([selectedShotId], !locked.has(selectedShotId));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [locked, selectedShotId, setLocked]);
  return { locked, setLocked, notice };
}
