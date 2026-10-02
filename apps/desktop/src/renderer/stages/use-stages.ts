/**
 * Pipeline state of the open project (PLAN.md#6.8): read once, then follow main's `stagesChanged`
 * pushes. Commands return main's answer, so the caller can show why something was refused.
 */
import { useCallback, useEffect, useState } from 'react';
import type {
  PipelineStageKey,
  ReplaceableStage,
  StageArtifact,
  StageCommandResult,
  StagesState,
} from '../../shared/stages-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('stages');

export interface StagesControls {
  readonly state: StagesState | undefined;
  readonly run: (stages: readonly PipelineStageKey[]) => Promise<StageCommandResult>;
  readonly stop: (stage: PipelineStageKey) => void;
  readonly replace: (stage: ReplaceableStage) => Promise<StageCommandResult>;
  readonly open: (artifact: StageArtifact) => Promise<StageCommandResult>;
}

async function command(
  action: string,
  call: () => Promise<StageCommandResult>,
): Promise<StageCommandResult> {
  try {
    return await call();
  } catch (error) {
    log.error(`${action} failed: ${errorMessage(error)}`);
    return { status: 'error', message: errorMessage(error) };
  }
}

export function useStages(dir: string): StagesControls {
  const [state, setState] = useState<StagesState | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setState(undefined);
    const unsubscribe = window.reelforge.onStagesChanged((next) => {
      if (active && next.projectDir === dir) setState(next);
    });
    window.reelforge.getStagesState().then(
      (initial) => {
        if (active && initial.projectDir === dir) setState((current) => current ?? initial);
      },
      (error: unknown) => {
        log.error(`getStagesState failed: ${errorMessage(error)}`);
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [dir]);

  const run = useCallback(
    (stages: readonly PipelineStageKey[]) =>
      command('runStages', () => window.reelforge.runStages(stages)),
    [],
  );
  const stop = useCallback((stage: PipelineStageKey) => {
    window.reelforge.stopStage(stage).catch((error: unknown) => {
      log.error(`stopStage failed: ${errorMessage(error)}`);
    });
  }, []);
  const replace = useCallback(
    (stage: ReplaceableStage) =>
      command('replaceStage', () => window.reelforge.replaceStage(stage)),
    [],
  );
  const open = useCallback(
    (artifact: StageArtifact) =>
      command('openStageArtifact', () => window.reelforge.openStageArtifact(artifact)),
    [],
  );
  return { state, run, stop, replace, open };
}
