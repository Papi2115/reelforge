/** App settings in the renderer: loaded once, changed through main (which validates and saves). */
import { useCallback, useEffect, useState } from 'react';
import { applyAppSettingsPatch, type AppSettingsPatch } from '@reelforge/shared';
import type { SettingsState } from '../../shared/settings-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('settings');

export interface SettingsController {
  readonly state: SettingsState | undefined;
  /** Last failed change (shown in the dialog). */
  readonly error: string | undefined;
  readonly update: (patch: AppSettingsPatch) => void;
}

export function useSettings(): SettingsController {
  const [state, setState] = useState<SettingsState | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    window.reelforge.getSettings().then(setState, (reason: unknown) => {
      log.error(`getSettings failed: ${errorMessage(reason)}`);
    });
  }, []);

  const update = useCallback((patch: AppSettingsPatch): void => {
    // Optimistic: controls follow the click at once; main's answer (or a reload) settles it.
    setState((previous) => {
      if (!previous) return previous;
      try {
        return { ...previous, settings: applyAppSettingsPatch(previous.settings, patch) };
      } catch (reason) {
        log.warn(`settings patch not applicable locally: ${errorMessage(reason)}`);
        return previous;
      }
    });
    const reload = (): void => {
      window.reelforge.getSettings().then(setState, (reason: unknown) => {
        log.error(`getSettings failed: ${errorMessage(reason)}`);
      });
    };
    window.reelforge.updateSettings(patch).then(
      (result) => {
        if (result.status === 'error') {
          setError(result.message);
          reload();
          return;
        }
        setError(undefined);
        setState((previous) => (previous ? { ...previous, settings: result.settings } : previous));
      },
      (reason: unknown) => {
        log.error(`updateSettings failed: ${errorMessage(reason)}`);
        setError(errorMessage(reason));
        reload();
      },
    );
  }, []);

  return { state, error, update };
}
