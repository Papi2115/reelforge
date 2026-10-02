/**
 * Incremental parser for `-progress pipe:1` output: blocks of `key=value` lines, each terminated
 * by `progress=continue` or `progress=end`.
 */

export interface FfmpegProgress {
  /** Output position in seconds, null while ffmpeg still reports N/A. */
  readonly outTimeS: number | null;
  readonly frame: number | null;
  readonly fps: number | null;
  /** Processing speed relative to real time (e.g. 25 = 25x). */
  readonly speed: number | null;
  readonly totalSizeBytes: number | null;
  /** outTimeS / durationS clamped to [0, 1]; null without a known duration. */
  readonly ratio: number | null;
  readonly done: boolean;
}

function finiteOrNull(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value.trim());
  return value.trim() !== '' && Number.isFinite(parsed) ? parsed : null;
}

/** Parses `HH:MM:SS.micro` (as printed in `out_time`). */
export function parseClockTime(value: string | undefined): number | null {
  const match = /^(-?)(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(value?.trim() ?? '');
  if (match === null) return null;
  const seconds = Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4]);
  return match[1] === '-' ? -seconds : seconds;
}

function outTimeSeconds(block: ReadonlyMap<string, string>): number | null {
  // `out_time_ms` is (historically) in microseconds too, so both divide by 1e6.
  const micros = finiteOrNull(block.get('out_time_us')) ?? finiteOrNull(block.get('out_time_ms'));
  const seconds = micros === null ? parseClockTime(block.get('out_time')) : micros / 1e6;
  return seconds === null ? null : Math.max(0, seconds);
}

export function progressFromBlock(
  block: ReadonlyMap<string, string>,
  durationS: number | null,
): FfmpegProgress {
  const outTimeS = outTimeSeconds(block);
  const done = block.get('progress') === 'end';
  let ratio: number | null = null;
  if (done) ratio = 1;
  else if (outTimeS !== null && durationS !== null && durationS > 0) {
    ratio = Math.min(1, Math.max(0, outTimeS / durationS));
  }
  const speedRaw = block.get('speed')?.replace(/x$/, '');
  return {
    outTimeS,
    frame: finiteOrNull(block.get('frame')),
    fps: finiteOrNull(block.get('fps')),
    speed: finiteOrNull(speedRaw),
    totalSizeBytes: finiteOrNull(block.get('total_size')),
    ratio,
    done,
  };
}

export class ProgressParser {
  private pending = '';
  private block = new Map<string, string>();

  constructor(private readonly durationS: number | null = null) {}

  /** Feeds a stdout chunk; returns every progress block completed by it. */
  push(chunk: string): FfmpegProgress[] {
    const completed: FfmpegProgress[] = [];
    const lines = (this.pending + chunk).split(/\r?\n/);
    this.pending = lines.pop() ?? '';
    for (const line of lines) {
      const separator = line.indexOf('=');
      if (separator <= 0) continue;
      const key = line.slice(0, separator).trim();
      const value = line.slice(separator + 1).trim();
      this.block.set(key, value);
      if (key === 'progress') {
        completed.push(progressFromBlock(this.block, this.durationS));
        this.block = new Map();
      }
    }
    return completed;
  }
}
