/** File-system helpers for Windows, where a file another process reads cannot be replaced. */
import { rename } from 'node:fs/promises';

const RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

function codeOf(error: unknown): unknown {
  return error instanceof Error && 'code' in error ? error.code : undefined;
}

/**
 * `rename` that retries a sharing violation for a while (e.g. the app's player is reading the
 * old `mix.wav` that a new render replaces); other errors and the last failure are thrown.
 */
export async function renameRetrying(
  from: string,
  to: string,
  attempts = 30,
  delayMs = 100,
): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      if (attempt >= attempts || !RETRY_CODES.has(String(codeOf(error)))) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
