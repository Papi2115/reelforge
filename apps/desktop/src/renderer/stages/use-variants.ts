/**
 * Shot variants of the open project (PLAN.md#11.3): read through main, again whenever the stages
 * state or the project's variant files / scenes change, and every 2 s while variants are being
 * generated (per-variant progress). Also the Economy setting (default count) and the commands.
 */
import { useCallback, useEffect, useState } from 'react';
import type { StageCommandResult, StagesState } from '../../shared/stages-contract.js';
import type {
  VariantCount,
  VariantEstimateView,
  VariantOpRequest,
  VariantsState,
} from '../../shared/variants-contract.js';
import { errorMessage, rendererLog } from '../log.js';
import { reportsKey } from './use-stage-reports.js';

const log = rendererLog('variants');
const POLL_MS = 2_000;
const VARIANT_INPUTS = /^(\.reelforge\/variants\/|scenes\/|storyboard\.json$|locks\.json$)/i;

export interface VariantsControls {
  readonly state: VariantsState | undefined;
  readonly economy: boolean;
  readonly estimate: (count: VariantCount) => Promise<VariantEstimateView | undefined>;
  readonly run: (shotId: string, op: VariantOpRequest) => Promise<StageCommandResult>;
  readonly refresh: () => void;
}

export function useVariants(dir: string, stages: StagesState | undefined): VariantsControls {
  const [state, setState] = useState<VariantsState | undefined>(undefined);
  const [economy, setEconomy] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => {
    setTick((value) => value + 1);
  }, []);
  const key = reportsKey(stages);
  const generating = stages?.running?.action === 'variants';

  useEffect(() => {
    let active = true;
    window.reelforge.getVariantsState().then(
      (next) => {
        if (active && next.projectDir === dir) setState(next);
      },
      (error: unknown) => {
        log.error(`getVariantsState failed: ${errorMessage(error)}`);
      },
    );
    return () => {
      active = false;
    };
  }, [dir, key, tick]);

  useEffect(() => {
    if (!generating) return;
    const timer = window.setInterval(refresh, POLL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [generating, refresh]);

  useEffect(
    () =>
      window.reelforge.onProjectChanged((event) => {
        if (event.dir !== dir) return;
        if (event.truncated || event.paths.some((file) => VARIANT_INPUTS.test(file))) refresh();
      }),
    [dir, refresh],
  );

  useEffect(() => {
    window.reelforge.getSettings().then(
      (settings) => {
        setEconomy(settings.settings.economy);
      },
      (error: unknown) => {
        log.warn(`getSettings failed: ${errorMessage(error)}`);
      },
    );
  }, []);

  const estimate = useCallback(async (count: VariantCount) => {
    try {
      return await window.reelforge.estimateVariants(count);
    } catch (error) {
      log.warn(`estimateVariants failed: ${errorMessage(error)}`);
      return undefined;
    }
  }, []);

  const run = useCallback(
    async (shotId: string, op: VariantOpRequest): Promise<StageCommandResult> => {
      try {
        const result = await window.reelforge.runVariants(shotId, op);
        refresh();
        return result;
      } catch (error) {
        return { status: 'error', message: errorMessage(error) };
      }
    },
    [refresh],
  );

  return { state, economy, estimate, run, refresh };
}
