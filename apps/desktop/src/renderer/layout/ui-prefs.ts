/**
 * Small UI preferences of the window (PLAN.md#11.2): chat dock, folded pipeline, timeline tracks,
 * open sections, shot list mode. Stored as JSON in localStorage (like the pane sizes), each key
 * validated with zod; anything unreadable falls back to the default.
 */
import { useCallback, useState } from 'react';
import type { z } from 'zod';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('ui-prefs');

/** Parses a stored value; `fallback` when missing, not JSON or not matching `schema`. */
export function parsePref<T>(raw: string | null, schema: z.ZodType<T>, fallback: T): T {
  if (raw === null) return fallback;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fallback;
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? parsed.data : fallback;
}

export function loadPref<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  try {
    return parsePref(window.localStorage.getItem(key), schema, fallback);
  } catch (error) {
    log.warn(`${key} not readable, using the default: ${errorMessage(error)}`);
    return fallback;
  }
}

export function savePref(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    log.warn(`${key} not saved: ${errorMessage(error)}`);
  }
}

/** useState that persists every change under `key`. */
export function usePref<T>(
  key: string,
  schema: z.ZodType<T>,
  fallback: T,
): [T, (update: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => loadPref(key, schema, fallback));
  const set = useCallback(
    (update: T | ((current: T) => T)) => {
      setValue((current) => {
        const next = typeof update === 'function' ? (update as (current: T) => T)(current) : update;
        savePref(key, next);
        return next;
      });
    },
    [key],
  );
  return [value, set];
}
