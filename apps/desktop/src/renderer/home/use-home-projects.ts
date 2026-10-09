/**
 * The Home screen's project cards (PLAN.md#13.16): loaded when Home shows (so leaving a project
 * refreshes them), again when the window gets focus back, and on demand after a rename.
 */
import { useCallback, useEffect, useState } from 'react';
import type { HomeProject } from '../../shared/home-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('home');

export interface HomeProjects {
  /** Undefined until the first answer. */
  readonly projects: readonly HomeProject[] | undefined;
  readonly error: string | undefined;
  readonly reload: () => void;
}

export function useHomeProjects(): HomeProjects {
  const [projects, setProjects] = useState<readonly HomeProject[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const reload = useCallback((): void => {
    window.reelforge.getHomeProjects().then(
      (list) => {
        setProjects(list);
        setError(undefined);
      },
      (reason: unknown) => {
        log.error(`getHomeProjects failed: ${errorMessage(reason)}`);
        setError('Your projects could not be listed. See the log for details.');
      },
    );
  }, []);

  useEffect(() => {
    reload();
    window.addEventListener('focus', reload);
    return () => {
      window.removeEventListener('focus', reload);
    };
  }, [reload]);

  return { projects, error, reload };
}
