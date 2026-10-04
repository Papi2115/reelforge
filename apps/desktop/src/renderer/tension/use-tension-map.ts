/**
 * Whether the open project's tension map is on (project.json `tensionMap`, PLAN.md#12.22), read
 * while the Tension panel is open and again whenever the video inputs change (project.json is
 * one of them), so the panel's "off" note follows the Project settings dialog.
 */
import { useEffect, useState } from 'react';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('tension');

export function useTensionMapOn(open: boolean, revision: number): boolean | undefined {
  const [on, setOn] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    window.reelforge.getProjectSettings().then(
      (state) => {
        if (active && state.status === 'ok') setOn(state.settings.tensionMap === 'auto');
      },
      (reason: unknown) => {
        log.warn(`getProjectSettings failed: ${errorMessage(reason)}`);
      },
    );
    return () => {
      active = false;
    };
  }, [open, revision]);
  return on;
}
