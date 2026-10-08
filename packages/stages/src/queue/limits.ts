/** The bridge's account-wide LimitGuard as the production line's usage-limit signal. */
import type { LimitGuard, PauseInfo } from '@reelforge/claude-bridge';
import type { UsageLimitSignal, UsageLimitState } from './types.js';

function stateOf(pause: PauseInfo | undefined): UsageLimitState | undefined {
  return pause === undefined ? undefined : { until: pause.until, message: pause.message };
}

/** Any guard pause (limit or the user's manual one) pauses the line. */
export function limitSignalFromGuard(guard: LimitGuard): UsageLimitSignal {
  return {
    current: () => stateOf(guard.pause),
    subscribe: (listener) => {
      const onPaused = (pause: PauseInfo): void => {
        listener(stateOf(pause));
      };
      const onResumed = (): void => {
        listener(stateOf(guard.pause));
      };
      guard.on('paused', onPaused);
      guard.on('resumed', onResumed);
      return () => {
        guard.off('paused', onPaused);
        guard.off('resumed', onResumed);
      };
    },
  };
}
