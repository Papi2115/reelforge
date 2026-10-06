/**
 * Settings of the open project in the renderer: loaded on open, changed through main. Several
 * controllers may be mounted at once (Project settings and a step's "All options" section): a
 * change one of them saved is passed to the others, so every switch shows the file's state.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  LookSummary,
  ProjectSettings,
  ProjectSettingsPatch,
} from '../../shared/project-settings-contract.js';
import { errorMessage, rendererLog } from '../log.js';
import { withProjectSettingsPatch } from './project-settings-view.js';

const log = rendererLog('project-settings');

type SavedListener = (settings: ProjectSettings) => void;
/** The mounted controllers, told about each other's saved changes. */
const savedListeners = new Set<SavedListener>();

export interface ProjectSettingsController {
  /** Undefined while loading. */
  readonly settings: ProjectSettings | undefined;
  readonly looks: readonly LookSummary[];
  /** Load failure or the last failed change (shown in the dialog). */
  readonly error: string | undefined;
  /** Number of changes main has not answered yet. */
  readonly pending: number;
  readonly update: (patch: ProjectSettingsPatch) => void;
}

export function useProjectSettings(): ProjectSettingsController {
  const [settings, setSettings] = useState<ProjectSettings | undefined>(undefined);
  const [looks, setLooks] = useState<readonly LookSummary[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(0);
  /** Number of the newest change: an older answer must not undo a newer optimistic change. */
  const latest = useRef(0);

  const reload = useCallback((): void => {
    window.reelforge.getProjectSettings().then(
      (state) => {
        if (state.status === 'error') {
          setError(state.message);
          return;
        }
        setSettings(state.settings);
        setLooks(state.looks);
      },
      (reason: unknown) => {
        log.error(`getProjectSettings failed: ${errorMessage(reason)}`);
        setError(errorMessage(reason));
      },
    );
  }, []);

  useEffect(reload, [reload]);

  /** This controller's listener (it does not hear its own changes). */
  const listener = useRef<SavedListener>((next) => {
    setSettings(next);
  });
  useEffect(() => {
    const own = listener.current;
    savedListeners.add(own);
    return () => {
      savedListeners.delete(own);
    };
  }, []);

  const update = useCallback(
    (patch: ProjectSettingsPatch): void => {
      // Optimistic: the control follows the click at once; main's answer settles it.
      setSettings((previous) =>
        previous === undefined ? previous : withProjectSettingsPatch(previous, patch),
      );
      setPending((count) => count + 1);
      latest.current += 1;
      const change = latest.current;
      window.reelforge
        .updateProjectSettings(patch)
        .then(
          (result) => {
            if (result.status === 'error') {
              setError(result.message);
              reload();
              return;
            }
            setError(undefined);
            if (change === latest.current) setSettings(result.settings);
            for (const other of savedListeners) {
              if (other !== listener.current) other(result.settings);
            }
          },
          (reason: unknown) => {
            log.error(`updateProjectSettings failed: ${errorMessage(reason)}`);
            setError(errorMessage(reason));
            reload();
          },
        )
        .finally(() => {
          setPending((count) => count - 1);
        });
    },
    [reload],
  );

  return { settings, looks, error, pending, update };
}
