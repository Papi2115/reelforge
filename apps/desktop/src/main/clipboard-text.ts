/**
 * Writing text to the system clipboard so that it sticks. On Windows another process (clipboard
 * history, a clipboard manager, remote desktop) can hold the clipboard open for a moment; the
 * write then fails silently. So the text is read back and written again a few times before the
 * copy is reported as failed. Text round-trips exactly (checked on Windows with Electron 44,
 * LF and CRLF alike). Electron-free (the clipboard is passed in).
 */

/** Electron 44's main-process clipboard (async text API). */
export interface TextClipboard {
  writeText(text: string): Promise<void>;
  readText(): Promise<string>;
}

export interface VerifiedWriteOptions {
  /** Writes before giving up (default 5). */
  readonly attempts?: number;
  /** Pause between attempts (default 40 ms). */
  readonly waitMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** True once the clipboard holds `text`; false when every attempt was overwritten or lost. */
export async function writeTextVerified(
  clipboard: TextClipboard,
  text: string,
  options: VerifiedWriteOptions = {},
): Promise<boolean> {
  const attempts = Math.max(1, options.attempts ?? 5);
  const sleep = options.sleep ?? defaultSleep;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await clipboard.writeText(text);
    if ((await clipboard.readText()) === text) return true;
    if (attempt < attempts) await sleep(options.waitMs ?? 40);
  }
  return false;
}
