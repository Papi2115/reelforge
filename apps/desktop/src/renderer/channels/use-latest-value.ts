/**
 * A nested channel value (voice, publishing defaults) that is saved as a whole: quick changes in a
 * row (a slider's arrow keys, then a text field) must build on the value sent last, not on the
 * props of the last answer, or a later save would drop an earlier one. While saves are on their
 * way the value sent last counts; once none is pending, the saved value from props does again.
 */
import { useCallback, useEffect, useRef } from 'react';

export interface LatestValue<T> {
  /** Builds the next value from the latest one, sends it and tracks the save. */
  readonly save: <V extends T>(
    next: (latest: T) => V,
    send: (value: V) => Promise<string | undefined>,
  ) => Promise<string | undefined>;
}

export function useLatestValue<T>(saved: T): LatestValue<T> {
  const latest = useRef(saved);
  const pending = useRef(0);
  const savedRef = useRef(saved);
  useEffect(() => {
    savedRef.current = saved;
    if (pending.current === 0) latest.current = saved;
  }, [saved]);

  const save = useCallback(
    async <V extends T>(
      next: (latest: T) => V,
      send: (value: V) => Promise<string | undefined>,
    ): Promise<string | undefined> => {
      const value = next(latest.current);
      latest.current = value;
      pending.current += 1;
      const message = await send(value);
      pending.current -= 1;
      // A refused change: go back to what is saved.
      if (message !== undefined) latest.current = savedRef.current;
      return message;
    },
    [],
  );
  return { save };
}
