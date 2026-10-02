/**
 * PCM WAV splicing for the preview mix (PLAN.md#8.2): the re-rendered window replaces the same
 * samples of a full-length copy of `mix.wav`, so the player keeps one continuous file whose only
 * changed region is around the edit. Both files must be the same PCM format (48 kHz 16-bit
 * stereo); chunks are walked by the RIFF rules (ffmpeg may add LIST before `data`).
 */
import { open, readFile, type FileHandle } from 'node:fs/promises';

export interface WavLayout {
  readonly channels: number;
  readonly sampleRate: number;
  readonly bitsPerSample: number;
  /** Byte offset of the first sample. */
  readonly dataOffset: number;
  readonly dataBytes: number;
}

const HEADER_PROBE_BYTES = 4096;

/** Parses the RIFF chunks of a WAV header; null when it is not a PCM/float WAV with data. */
export function parseWavLayout(header: Uint8Array): WavLayout | null {
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const text = (at: number): string =>
    String.fromCharCode(...header.subarray(at, Math.min(at + 4, header.length)));
  if (header.length < 12 || text(0) !== 'RIFF' || text(8) !== 'WAVE') return null;
  let format: Omit<WavLayout, 'dataOffset' | 'dataBytes'> | null = null;
  for (let at = 12; at + 8 <= header.length;) {
    const id = text(at);
    const size = view.getUint32(at + 4, true);
    if (id === 'fmt ' && at + 24 <= header.length) {
      format = {
        channels: view.getUint16(at + 10, true),
        sampleRate: view.getUint32(at + 12, true),
        bitsPerSample: view.getUint16(at + 22, true),
      };
    } else if (id === 'data') {
      return format === null ? null : { ...format, dataOffset: at + 8, dataBytes: size };
    }
    at += 8 + size + (size % 2);
  }
  return null;
}

export async function readWavLayout(file: string): Promise<WavLayout | null> {
  const handle = await open(file, 'r');
  try {
    const buffer = new Uint8Array(HEADER_PROBE_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, HEADER_PROBE_BYTES, 0);
    return parseWavLayout(buffer.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
}

/** Length of a WAV in seconds (from its data chunk). */
export function wavSeconds(layout: WavLayout): number {
  const frameBytes = layout.channels * (layout.bitsPerSample / 8);
  return frameBytes === 0 ? 0 : layout.dataBytes / frameBytes / layout.sampleRate;
}

function sameFormat(a: WavLayout, b: WavLayout): boolean {
  return (
    a.channels === b.channels &&
    a.sampleRate === b.sampleRate &&
    a.bitsPerSample === b.bitsPerSample
  );
}

async function writeAll(handle: FileHandle, bytes: Uint8Array, position: number): Promise<void> {
  let written = 0;
  while (written < bytes.length) {
    const result = await handle.write(bytes, written, bytes.length - written, position + written);
    written += result.bytesWritten;
  }
}

/**
 * Writes the samples of `windowFile` into `targetFile` starting at `startS` (in place; samples
 * past the target's end are dropped). Returns an error message, or null when done.
 */
export async function spliceWav(
  targetFile: string,
  windowFile: string,
  startS: number,
): Promise<string | null> {
  const [target, window] = await Promise.all([
    readWavLayout(targetFile),
    readWavLayout(windowFile),
  ]);
  if (target === null || window === null) return 'not a PCM WAV file';
  if (!sameFormat(target, window)) return 'the preview window has another sample format';
  const frameBytes = target.channels * (target.bitsPerSample / 8);
  const startByte = Math.round(startS * target.sampleRate) * frameBytes;
  if (startByte >= target.dataBytes) return null;
  const windowBytes = await readFile(windowFile);
  const samples = windowBytes.subarray(
    window.dataOffset,
    window.dataOffset + Math.min(window.dataBytes, target.dataBytes - startByte),
  );
  const handle = await open(targetFile, 'r+');
  try {
    await writeAll(handle, samples, target.dataOffset + startByte);
  } finally {
    await handle.close();
  }
  return null;
}
