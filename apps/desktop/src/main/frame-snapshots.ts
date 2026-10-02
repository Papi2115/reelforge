/**
 * Preview frame snapshots (PLAN.md#6.4): the renderer sends PNG bytes, main checks they are a PNG
 * of a sane size, picks the file name and writes it atomically into `<project>/out/snapshots/`.
 * Electron-free (the clipboard lives in main.ts), so the validation is unit-tested.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { writeAtomic } from '@reelforge/project';
import {
  MAX_SNAPSHOT_SIDE,
  SNAPSHOT_DIR,
  type SnapshotSaveRequest,
  type SnapshotSaveResult,
} from '../shared/player-contract.js';
import { describeError, type Logger } from './logger.js';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** Signature (8) + IHDR length (4) + type (4) + width (4) + height (4). */
const PNG_HEADER_BYTES = 24;
const MAX_NAME_SUFFIX = 999;

export interface PngSize {
  readonly width: number;
  readonly height: number;
}

export type PngCheck =
  { readonly ok: true; readonly size: PngSize } | { readonly ok: false; readonly error: string };

/** Checks the PNG signature and the IHDR chunk; returns the image size. */
export function checkPng(bytes: Uint8Array): PngCheck {
  if (bytes.byteLength < PNG_HEADER_BYTES) return { ok: false, error: 'not a PNG (too short)' };
  if (PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) {
    return { ok: false, error: 'not a PNG (bad signature)' };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunkType = String.fromCharCode(...bytes.subarray(12, 16));
  if (view.getUint32(8) !== 13 || chunkType !== 'IHDR') {
    return { ok: false, error: 'not a PNG (IHDR chunk missing)' };
  }
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width < 1 || height < 1 || width > MAX_SNAPSHOT_SIDE || height > MAX_SNAPSHOT_SIDE) {
    return {
      ok: false,
      error: `PNG size ${String(width)}x${String(height)} is outside 1..${String(MAX_SNAPSHOT_SIDE)} px`,
    };
  }
  return { ok: true, size: { width, height } };
}

/** `s02_t002.200_640x360.png` (shot id optional; time zero-padded so names sort by time). */
export function snapshotFileName(t: number, size: PngSize, shotId?: string): string {
  const [seconds = '0', millis = '000'] = t.toFixed(3).split('.');
  const time = `t${seconds.padStart(3, '0')}.${millis}`;
  const prefix = shotId === undefined ? '' : `${shotId}_`;
  return `${prefix}${time}_${String(size.width)}x${String(size.height)}.png`;
}

/** `name.png`, else `name-2.png`, `name-3.png`, … (never overwrites an earlier snapshot). */
export function freeSnapshotPath(folder: string, name: string): string {
  const stem = name.replace(/\.png$/, '');
  for (let suffix = 1; suffix <= MAX_NAME_SUFFIX; suffix += 1) {
    const candidate = path.join(folder, suffix === 1 ? name : `${stem}-${String(suffix)}.png`);
    if (!existsSync(candidate)) return candidate;
  }
  return path.join(folder, name);
}

export async function saveFrameSnapshot(
  projectDir: string | undefined,
  request: SnapshotSaveRequest,
  log: Logger,
): Promise<SnapshotSaveResult> {
  if (projectDir === undefined) return { status: 'error', message: 'no project is open' };
  const png = checkPng(request.png);
  if (!png.ok) return { status: 'error', message: png.error };
  const folder = path.join(projectDir, ...SNAPSHOT_DIR.split('/'));
  const file = freeSnapshotPath(folder, snapshotFileName(request.t, png.size, request.shotId));
  try {
    await writeAtomic(file, request.png);
  } catch (error) {
    log.warn(`snapshot ${file} not written: ${describeError(error)}`);
    return { status: 'error', message: `cannot write ${file}: ${describeError(error)}` };
  }
  const relative = path.relative(projectDir, file).split(path.sep).join('/');
  log.info(`saved snapshot ${relative}`);
  return { status: 'saved', path: file, relative, ...png.size };
}
