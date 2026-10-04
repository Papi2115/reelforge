/** Hook lab state in the renderer (PLAN.md#12.16): read through main, changed by its actions. */
import { useCallback, useEffect, useState } from 'react';
import type { HookLabResult, HookLabView } from '../../shared/hook-lab-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('hook-lab');

export interface HookLabNotice {
  readonly message: string | null;
  readonly warnings: readonly string[];
  readonly error: boolean;
}

export interface HookLabController {
  readonly view: HookLabView | undefined;
  readonly notice: HookLabNotice | null;
  /** An action is running (generate / pick / discard). */
  readonly working: boolean;
  readonly generate: () => void;
  readonly pick: (number: number, index: number) => Promise<boolean>;
  readonly discard: (number: number) => void;
}

export function useHookLab(): HookLabController {
  const [view, setView] = useState<HookLabView | undefined>(undefined);
  const [notice, setNotice] = useState<HookLabNotice | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    window.reelforge.getHookLab().then(
      (state) => {
        if (state.status === 'ok') setView(state.view);
        else setNotice({ message: state.message, warnings: [], error: true });
      },
      (reason: unknown) => {
        log.error(`getHookLab failed: ${errorMessage(reason)}`);
      },
    );
  }, []);

  const apply = useCallback(async (action: () => Promise<HookLabResult>): Promise<boolean> => {
    setWorking(true);
    try {
      const result = await action();
      if (result.status === 'error') {
        setNotice({ message: result.message, warnings: [], error: true });
        return false;
      }
      setView(result.view);
      setNotice(
        result.message === null && result.warnings.length === 0
          ? null
          : { message: result.message, warnings: result.warnings, error: false },
      );
      return true;
    } catch (reason) {
      log.error(`hook lab action failed: ${errorMessage(reason)}`);
      setNotice({ message: errorMessage(reason), warnings: [], error: true });
      return false;
    } finally {
      setWorking(false);
    }
  }, []);

  const generate = useCallback((): void => {
    setView((current) => (current === undefined ? current : { ...current, generating: true }));
    setNotice(null);
    void apply(() => window.reelforge.generateHooks());
  }, [apply]);

  const pick = useCallback(
    (number: number, index: number) => apply(() => window.reelforge.pickHook({ number, index })),
    [apply],
  );

  const discard = useCallback(
    (number: number): void => {
      void apply(() => window.reelforge.discardHooks(number));
    },
    [apply],
  );

  return { view, notice, working, generate, pick, discard };
}
