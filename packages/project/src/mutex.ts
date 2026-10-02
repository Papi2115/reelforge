/**
 * In-process serialization per key (a project folder, a store file): tasks with the same key run
 * one after another, in call order; a failing task does not block the next one.
 */
import path from 'node:path';

const chains = new Map<string, Promise<unknown>>();

/** Same key for the same location (case-insensitive on Windows). */
export function lockKey(location: string): string {
  const resolved = path.resolve(location);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function withLock<T>(location: string, task: () => Promise<T>): Promise<T> {
  const key = lockKey(location);
  const previous = chains.get(key) ?? Promise.resolve();
  // `previous` never rejects (see `settled`).
  const run = previous.then(task);
  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  chains.set(key, settled);
  void settled.then(() => {
    if (chains.get(key) === settled) chains.delete(key);
  });
  return run;
}
