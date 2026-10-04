/**
 * Decoding of asset files for the engine (PLAN.md#12.11, ADR-014): ffmpeg (already required)
 * turns any allowed picture (PNG, JPEG, WebP, GIF) or a still of a video (MP4, WebM) into RGBA
 * with bit-exact decoder/converter flags, then `normalizeRaster` bounds it to the manifest size
 * with integer math. The result is cached per file hash under `.reelforge/assets/decoded/`
 * (git-ignored) so a picture is decoded once per machine and stays byte-stable.
 */
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ASSET_SOURCE_MAX_EDGE, type AssetMime } from '@reelforge/shared';
import { describeError } from '../ffmpeg/errors.js';
import { runProcess } from '../ffmpeg/process.js';
import { err, ok, type Result } from '../result.js';
import { decodePam, encodePam, normalizeRaster, type RasterImage } from './pixels.js';

/** Project-relative folder of the decoded cache. */
export const DECODED_ASSETS_DIR = path.join('.reelforge', 'assets', 'decoded');
/** Bump when decoding/normalising changes (part of the cache file name). */
export const ASSET_DECODE_VERSION = 1;

const DECODE_TIMEOUT_MS = 60_000;

export interface DecodeAssetInput {
  /** ffmpeg binary path or why it is unavailable; only asked when ffmpeg has to run. */
  readonly ffmpeg: () => Result<string, string>;
  /** Absolute path of the original file. */
  readonly file: string;
  readonly kind: 'image' | 'video';
  /** Verified type of the file (magic bytes, 12.9): selects the only demuxer ffmpeg may use. */
  readonly mime: AssetMime;
  readonly sha256: string;
  /** Video still time in seconds; undefined = the middle of the video. */
  readonly at?: number | undefined;
  /** Project folder (the cache lives in it). */
  readonly projectDir: string;
  readonly signal?: AbortSignal | undefined;
}

export interface DecodedAsset {
  /** Still time used (videos), undefined for images. */
  readonly at: number | undefined;
  /** RGB, longest edge <= ASSET_SOURCE_MAX_EDGE. */
  readonly image: RasterImage;
}

/**
 * The demuxer per verified type: ffmpeg never probes (a disguised playlist or concat list cannot
 * reach the network or other files); with `-protocol_whitelist file` it reads local files only.
 */
export const ASSET_DEMUXERS: Readonly<Record<AssetMime, string>> = {
  'image/png': 'png_pipe',
  'image/jpeg': 'jpeg_pipe',
  'image/webp': 'webp_pipe',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

const INPUT_GUARD = ['-protocol_whitelist', 'file'];

/** Bit-exact decoding: simple IDCT, bit-exact codec and swscale paths (verified on ffmpeg 8.1). */
export function decodeArgs(
  input: string,
  output: string,
  mime: AssetMime,
  at: number | undefined,
): string[] {
  return [
    '-hide_banner',
    '-nostdin',
    '-v',
    'error',
    '-y',
    ...INPUT_GUARD,
    '-f',
    ASSET_DEMUXERS[mime],
    '-flags:v',
    '+bitexact',
    '-idct',
    'simple',
    ...(at === undefined ? [] : ['-ss', at.toFixed(3)]),
    '-i',
    input,
    '-frames:v',
    '1',
    '-sws_flags',
    'bitexact+accurate_rnd+full_chroma_int',
    '-pix_fmt',
    'rgba',
    '-c:v',
    'pam',
    '-f',
    'image2',
    output,
  ];
}

/** Duration in seconds from ffmpeg's input banner (`Duration: 00:01:02.50`), if any. */
export function parseDuration(stderr: string): number | undefined {
  const match = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(stderr);
  if (!match) return undefined;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

async function videoMiddle(input: DecodeAssetInput, ffmpegPath: string): Promise<number> {
  const probe = await runProcess(
    ffmpegPath,
    [
      '-hide_banner',
      '-nostdin',
      ...INPUT_GUARD,
      '-f',
      ASSET_DEMUXERS[input.mime],
      '-i',
      input.file,
      '-t',
      '0',
      '-f',
      'null',
      '-',
    ],
    { signal: input.signal, timeoutMs: DECODE_TIMEOUT_MS },
  );
  const duration = probe.ok ? parseDuration(probe.value.stderr) : undefined;
  return duration === undefined ? 0 : Math.floor((duration / 2) * 1000) / 1000;
}

/** Cache file name of a decoded picture. */
export function decodedFileName(sha256: string, at: number | undefined): string {
  const still = at === undefined ? '' : `-at${String(Math.round(at * 1000))}`;
  return `${sha256}${still}-${String(ASSET_SOURCE_MAX_EDGE)}-v${String(ASSET_DECODE_VERSION)}.pam`;
}

async function readCached(file: string): Promise<RasterImage | undefined> {
  try {
    return decodePam(await readFile(file));
  } catch {
    // Missing or damaged cache entry: decode again.
    return undefined;
  }
}

/** Decodes (or reads from the cache) one picture; errors are messages for the user. */
export async function decodeAsset(input: DecodeAssetInput): Promise<Result<DecodedAsset, string>> {
  let ffmpegPath: string | undefined;
  const ffmpeg = (): Result<string, string> => {
    if (ffmpegPath !== undefined) return ok(ffmpegPath);
    const located = input.ffmpeg();
    if (located.ok) ffmpegPath = located.value;
    return located;
  };
  let at: number | undefined;
  if (input.kind === 'video') {
    if (input.at !== undefined) at = input.at;
    else {
      const located = ffmpeg();
      if (!located.ok) return err(`ffmpeg is needed: ${located.error}`);
      at = await videoMiddle(input, located.value);
    }
  }
  const dir = path.join(input.projectDir, DECODED_ASSETS_DIR);
  const cached = path.join(dir, decodedFileName(input.sha256, at));
  const hit = await readCached(cached);
  if (hit) return ok({ at, image: hit });
  const located = ffmpeg();
  if (!located.ok) return err(`ffmpeg is needed: ${located.error}`);
  const raw = `${cached}.${String(process.pid)}.ffmpeg.pam`;
  try {
    await mkdir(dir, { recursive: true });
    const run = await runProcess(located.value, decodeArgs(input.file, raw, input.mime, at), {
      signal: input.signal,
      timeoutMs: DECODE_TIMEOUT_MS,
    });
    if (!run.ok) return err(run.error.message);
    const image = normalizeRaster(decodePam(await readFile(raw)));
    const temp = `${cached}.${String(process.pid)}.tmp`;
    await writeFile(temp, encodePam(image));
    await rename(temp, cached);
    return ok({ at, image });
  } catch (error) {
    return err(`cannot decode ${input.file}: ${describeError(error)}`);
  } finally {
    await rm(raw, { force: true });
  }
}
