/** FfmpegManager: a located + probed ffmpeg binary with a typed `run()` (progress, cancellation). */
import type { FfmpegError } from './errors.js';
import { locateFfmpeg, type FfmpegBinary, type LocateOptions } from './locate.js';
import {
  capabilitiesOf,
  parseEncoders,
  parseFilters,
  parseVersionOutput,
  type FfmpegCapabilities,
  type FfmpegVersionInfo,
} from './probe.js';
import { ProgressParser, type FfmpegProgress } from './progress.js';
import { runProcess, type ProcessOutput } from './process.js';
import { err, ok, type Result } from '../result.js';

export interface FfmpegInfo extends FfmpegVersionInfo {
  readonly capabilities: FfmpegCapabilities;
  readonly encoders: ReadonlySet<string>;
  readonly filters: ReadonlySet<string>;
}

export interface FfmpegRunOptions {
  /** Working directory (useful for relative paths inside filtergraphs). */
  readonly cwd?: string | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly timeoutMs?: number | undefined;
  /**
   * When set, `-progress pipe:1 -nostats` is added and stdout is parsed as progress. Do not combine
   * with commands that write their own data to stdout.
   */
  readonly onProgress?: ((progress: FfmpegProgress) => void) | undefined;
  /** Expected output duration, used to compute `progress.ratio`. */
  readonly durationS?: number | undefined;
}

export type FfmpegRunOutput = ProcessOutput;

/** Arguments every run gets: no interactive stdin, no banner noise. */
export const BASE_ARGS: readonly string[] = ['-hide_banner', '-nostdin'];

export function buildRunArgs(args: readonly string[], withProgress: boolean): string[] {
  return withProgress
    ? [...BASE_ARGS, '-progress', 'pipe:1', '-nostats', ...args]
    : [...BASE_ARGS, ...args];
}

function probeFailure(error: FfmpegError): Result<never, FfmpegError> {
  if (error.kind === 'cancelled') return err(error);
  return err({ kind: 'probe-failed', message: `ffmpeg probe failed: ${error.message}` });
}

export async function probeFfmpeg(
  ffmpegPath: string,
  signal?: AbortSignal,
): Promise<Result<FfmpegInfo, FfmpegError>> {
  const timeoutMs = 30_000;
  const runProbe = (args: readonly string[]): Promise<Result<ProcessOutput, FfmpegError>> =>
    runProcess(ffmpegPath, args, { signal, timeoutMs });
  const [version, encoders, filters] = await Promise.all([
    runProbe(['-version']),
    runProbe(['-hide_banner', '-encoders']),
    runProbe(['-hide_banner', '-filters']),
  ]);
  if (!version.ok) return probeFailure(version.error);
  if (!encoders.ok) return probeFailure(encoders.error);
  if (!filters.ok) return probeFailure(filters.error);
  const versionInfo = parseVersionOutput(version.value.stdout);
  if (versionInfo === null) {
    return err({
      kind: 'probe-failed',
      message: `${ffmpegPath} does not look like ffmpeg (no "ffmpeg version" line)`,
    });
  }
  const encoderSet = parseEncoders(encoders.value.stdout);
  const filterSet = parseFilters(filters.value.stdout);
  return ok({
    ...versionInfo,
    encoders: encoderSet,
    filters: filterSet,
    capabilities: capabilitiesOf(encoderSet, filterSet),
  });
}

export class FfmpegManager {
  private constructor(
    readonly binary: FfmpegBinary,
    readonly info: FfmpegInfo,
  ) {}

  /** Locates ffmpeg (configured path -> env -> PATH -> common dirs) and probes it. */
  static async create(
    options: LocateOptions & { readonly signal?: AbortSignal } = {},
  ): Promise<Result<FfmpegManager, FfmpegError>> {
    const located = locateFfmpeg(options);
    if (!located.ok) return located;
    const probed = await probeFfmpeg(located.value.ffmpegPath, options.signal);
    if (!probed.ok) return probed;
    return ok(new FfmpegManager(located.value, probed.value));
  }

  hasFilter(name: string): boolean {
    return this.info.filters.has(name);
  }

  hasEncoder(name: string): boolean {
    return this.info.encoders.has(name);
  }

  requireFilters(names: readonly string[]): Result<void, FfmpegError> {
    const missing = names.filter((name) => !this.hasFilter(name));
    if (missing.length === 0) return ok(undefined);
    return err({
      kind: 'missing-capability',
      message: `this ffmpeg build lacks filters: ${missing.join(', ')}`,
      missing,
    });
  }

  /** Runs ffmpeg with `-hide_banner -nostdin` prepended. Never throws for expected failures. */
  run(
    args: readonly string[],
    options: FfmpegRunOptions = {},
  ): Promise<Result<FfmpegRunOutput, FfmpegError>> {
    const onProgress = options.onProgress;
    const parser =
      onProgress === undefined ? undefined : new ProgressParser(options.durationS ?? null);
    return runProcess(this.binary.ffmpegPath, buildRunArgs(args, parser !== undefined), {
      cwd: options.cwd,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
      onStdout:
        parser === undefined || onProgress === undefined
          ? undefined
          : (chunk) => {
              for (const progress of parser.push(chunk)) onProgress(progress);
            },
    });
  }
}
