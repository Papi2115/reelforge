/**
 * The stage reports of the open project (voice-over fit, words alignment, ✓/⚠/✗ per shot, sync
 * report, missing props), read through main again whenever the pipeline state changes in a way
 * that can change them (a stage finished, a shot finished).
 */
import { useEffect, useState } from 'react';
import type { StagesState } from '../../shared/stages-contract.js';
import type { StageReports } from '../../shared/voiceover-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('reports');

/** Changes when a stage status/time or a shot result changes. */
export function reportsKey(state: StagesState | undefined): string {
  if (state === undefined) return '';
  const stages = state.stages.map(
    (info) => `${info.stage}:${info.status ?? ''}:${info.updatedAt ?? ''}`,
  );
  const shots = Object.entries(state.running?.shots ?? {})
    .filter(([, status]) => status !== 'running')
    .map(([id, status]) => `${id}=${status}`);
  return [...stages, state.running?.stage ?? '', ...shots].join('|');
}

export function useStageReports(dir: string, key: string): StageReports | undefined {
  const [reports, setReports] = useState<StageReports | undefined>(undefined);
  useEffect(() => {
    let active = true;
    window.reelforge.getStageReports().then(
      (next) => {
        if (active && next.projectDir === dir) setReports(next);
      },
      (error: unknown) => {
        log.error(`getStageReports failed: ${errorMessage(error)}`);
      },
    );
    return () => {
      active = false;
    };
  }, [dir, key]);
  return reports;
}
