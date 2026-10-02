/**
 * Waveform of the playing audio for the timeline (PLAN.md#6.5): ffmpeg decodes the file to mono
 * 16-bit PCM at PEAKS_SAMPLE_RATE on stdout, the peak |amplitude| of every bucket becomes one
 * byte, and the result is cached in `.reelforge/cache/peaks-<key>.json` (key = path, size, mtime),
 * so reopening a project does not decode again. Concurrent requests for one file share the work.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { killProcessTree } from '@reelforge/pipeline';
import { WAVEFORM_PEAKS_FILE_VERSION, waveformPeaksFileSchema } from '@reelforge/shared';
import {
  PEAKS_PER_SECOND,
  PEAKS_SAMPLE_RATE,
  type WaveformResult,
} from '../shared/timeline-contract.js';
import { describeError, type Logger } from './logger.js';
import { isInsideFolder } from './project-files.js';

export const PEAKS_CACHE_DIR = '.reelforge/cache';
const DECODE_TIMEOUT_MS = 120_000;
const STDERR_TAIL_CHARS = 2_000;
const FULL_SCALE = 32_768;

/** Turns little-endian 16-bit PCM chunks (any split) into one peak byte per bucket. */
export class PeakAccumulator {
  private readonly peaks: number[] = [];
  private bucketPeak = 0;
  private bucketFill = 0;
  private carry: number | undefined;

  constructor(private readonly bucketSamples: number) {}

  push(chunk: Uint8Array): void {
    let offset = 0;
    if (this.carry !== undefined && chunk.length > 0) {
      this.addSample(this.carry | ((chunk[0] ?? 0) << 8));
      this.carry = undefined;
      offset = 1;
    }
    const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    for (; offset + 1 < chunk.length; offset += 2) this.addSample(view.getUint16(offset, true));
    if (offset < chunk.length) this.carry = chunk[offset];
  }

  /** Peaks so far, including a partly filled last bucket. */
  finish(): Uint8Array {
    if (this.bucketFill > 0) this.closeBucket();
    return Uint8Array.from(this.peaks);
  }

  private addSample(unsigned: number): void {
    const sample = unsigned >= 0x8000 ? unsigned - 0x10000 : unsigned;
    const magnitude = Math.abs(sample);
    if (magnitude > this.bucketPeak) this.bucketPeak = magnitude;
    this.bucketFill += 1;
    if (this.bucketFill === this.bucketSamples) this.closeBucket();
  }

  private closeBucket(): void {
    this.peaks.push(Math.min(255, Math.round((this.bucketPeak / FULL_SCALE) * 255)));
    this.bucketPeak = 0;
    this.bucketFill = 0;
  }
}

/** ffmpeg arguments: decode `input` to mono s16le PCM on stdout. */
export function decodeArgs(input: string): string[] {
  return [
    '-hide_banner',
    '-nostdin',
    '-v',
    'error',
    '-i',
    input,
    '-vn',
    '-ac',
    '1',
    '-ar',
    String(PEAKS_SAMPLE_RATE),
    '-f',
    's16le',
    '-acodec',
    'pcm_s16le',
    'pipe:1',
  ];
}

export function peaksCacheName(relative: string, size: number, mtimeMs: number): string {
  const key = createHash('sha256')
    .update([relative, String(size), String(mtimeMs), String(PEAKS_PER_SECOND)].join('\0'))
    .digest('hex')
    .slice(0, 16);
  return `peaks-${key}.json`;
}

export interface WaveformServiceOptions {
  readonly projectDir: () => string | undefined;
  /** ffmpeg binary, or an error message when it cannot be found. */
  readonly ffmpeg: () => { readonly path: string } | { readonly error: string };
  /** Registers the decoder so it is killed on quit. */
  readonly track: (child: ChildProcess) => void;
  readonly log: Logger;
}

type Decoded = { readonly peaks: Uint8Array } | { readonly error: string };

function decode(
  ffmpegPath: string,
  input: string,
  track: (child: ChildProcess) => void,
): Promise<Decoded> {
  return new Promise<Decoded>((resolve) => {
    const accumulator = new PeakAccumulator(PEAKS_SAMPLE_RATE / PEAKS_PER_SECOND);
    let stderr = '';
    const child = spawn(ffmpegPath, decodeArgs(input), {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    track(child);
    const timer = setTimeout(() => {
      killProcessTree(child);
    }, DECODE_TIMEOUT_MS);
    child.stdout.on('data', (chunk: Buffer) => {
      accumulator.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString('utf8')).slice(-STDERR_TAIL_CHARS);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ error: `cannot start ffmpeg: ${describeError(error)}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ peaks: accumulator.finish() });
      else resolve({ error: `ffmpeg exited with ${String(code)}: ${stderr.trim()}` });
    });
  });
}

export class WaveformService {
  private readonly inFlight = new Map<string, Promise<WaveformResult>>();

  constructor(private readonly options: WaveformServiceOptions) {}

  peaks(file: string): Promise<WaveformResult> {
    const dir = this.options.projectDir();
    if (dir === undefined) return Promise.resolve(unavailable('no project is open'));
    const key = `${dir}\0${file}`;
    const running = this.inFlight.get(key);
    if (running) return running;
    const work = this.load(dir, file).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, work);
    return work;
  }

  private async load(dir: string, file: string): Promise<WaveformResult> {
    const absolute = path.resolve(dir, file);
    const info = await statInside(dir, absolute);
    if ('error' in info) return unavailable(`cannot read ${file}: ${info.error}`);
    const cacheFile = path.join(
      dir,
      PEAKS_CACHE_DIR,
      peaksCacheName(file, info.size, info.mtimeMs),
    );
    const cached = await readCache(cacheFile, file);
    if (cached) return { status: 'ok', file, peaksPerSecond: PEAKS_PER_SECOND, peaks: cached };

    const ffmpeg = this.options.ffmpeg();
    if ('error' in ffmpeg) return unavailable(ffmpeg.error);
    const decoded = await decode(ffmpeg.path, absolute, this.options.track);
    if ('error' in decoded) {
      this.options.log.warn(`waveform of ${file} failed: ${decoded.error}`);
      return unavailable('the audio could not be decoded');
    }
    await this.writeCache(cacheFile, {
      version: WAVEFORM_PEAKS_FILE_VERSION,
      source: file,
      size: info.size,
      mtimeMs: info.mtimeMs,
      peaksPerSecond: PEAKS_PER_SECOND,
      peaks: Buffer.from(decoded.peaks).toString('base64'),
    });
    return { status: 'ok', file, peaksPerSecond: PEAKS_PER_SECOND, peaks: decoded.peaks };
  }

  private async writeCache(cacheFile: string, data: unknown): Promise<void> {
    const tmp = `${cacheFile}.${randomBytes(4).toString('hex')}.tmp`;
    try {
      await mkdir(path.dirname(cacheFile), { recursive: true });
      await writeFile(tmp, JSON.stringify(data), 'utf8');
      await rename(tmp, cacheFile);
    } catch (error) {
      await rm(tmp, { force: true });
      this.options.log.warn(`waveform cache not written: ${describeError(error)}`);
    }
  }
}

/** Size and mtime of `absolute` when it really (links followed) lies inside `dir`. */
async function statInside(
  dir: string,
  absolute: string,
): Promise<{ readonly size: number; readonly mtimeMs: number } | { readonly error: string }> {
  try {
    const [realRoot, real] = await Promise.all([realpath(dir), realpath(absolute)]);
    if (!isInsideFolder(realRoot, real)) return { error: 'it is outside the project folder' };
    const info = await stat(real);
    if (!info.isFile()) return { error: 'it is not a file' };
    return { size: info.size, mtimeMs: info.mtimeMs };
  } catch (error) {
    return { error: describeError(error) };
  }
}

function unavailable(reason: string): WaveformResult {
  return { status: 'unavailable', reason };
}

/** Peaks from a valid cache file of `source` at the current resolution, else undefined. */
async function readCache(cacheFile: string, source: string): Promise<Uint8Array | undefined> {
  let text: string;
  try {
    text = await readFile(cacheFile, 'utf8');
  } catch {
    // A missing or unreadable cache is recomputed.
    return undefined;
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // A torn cache file is recomputed.
    return undefined;
  }
  const parsed = waveformPeaksFileSchema.safeParse(json);
  if (!parsed.success) return undefined;
  if (parsed.data.source !== source || parsed.data.peaksPerSecond !== PEAKS_PER_SECOND) {
    return undefined;
  }
  return new Uint8Array(Buffer.from(parsed.data.peaks, 'base64'));
}
