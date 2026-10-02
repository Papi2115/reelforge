/**
 * Puts a preview snapshot (PNG bytes from the renderer) on the system clipboard (PLAN.md#6.4),
 * through Electron's async clipboard API (`clipboard.write` + `ClipboardItem`, Electron 44).
 */
import { clipboard, ClipboardItem } from 'electron';
import type { SnapshotCopyResult } from '../shared/player-contract.js';
import type { CopyTextResult } from '../shared/youtube-contract.js';
import { checkPng } from './frame-snapshots.js';
import { describeError } from './logger.js';

export async function copyPngToClipboard(png: Uint8Array): Promise<SnapshotCopyResult> {
  const check = checkPng(png);
  if (!check.ok) return { status: 'error', message: check.error };
  try {
    const image = new Blob([new Uint8Array(png)], { type: 'image/png' });
    await clipboard.write([new ClipboardItem({ 'image/png': image })]);
    return { status: 'copied' };
  } catch (error) {
    return { status: 'error', message: `clipboard write failed: ${describeError(error)}` };
  }
}

/** Puts plain text on the system clipboard (the export dialog's Copy buttons, PLAN.md#9.2). */
export async function copyTextToClipboard(text: string): Promise<CopyTextResult> {
  try {
    await clipboard.writeText(text);
    return { status: 'copied' };
  } catch (error) {
    return { status: 'error', message: `clipboard write failed: ${describeError(error)}` };
  }
}
