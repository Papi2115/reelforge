/** Parsers for `ffmpeg -version`, `-encoders` and `-filters` output. Pure; no process spawning. */

export type FfmpegLicense = 'LGPL' | 'GPL' | 'nonfree';

export interface FfmpegVersionInfo {
  /** Version token after "ffmpeg version", e.g. "8.1.1-full_build-www.gyan.dev". */
  readonly version: string;
  /** Effective licence of the build, derived from configure flags. */
  readonly license: FfmpegLicense;
  /** `--enable-version3`: (L)GPL v3 instead of v2.1+/v2+. */
  readonly version3: boolean;
  /** Informational only: the app never depends on ffmpeg's built-in whisper filter. */
  readonly hasWhisper: boolean;
  readonly configureFlags: readonly string[];
}

export type HardwareH264 = 'nvenc' | 'qsv' | 'amf';

export interface FfmpegCapabilities {
  readonly libx264: boolean;
  /** Hardware H.264 encoders compiled in (not proof the GPU/driver is present). */
  readonly hardwareH264: readonly HardwareH264[];
  readonly filters: {
    readonly highpass: boolean;
    readonly afftdn: boolean;
    readonly arnndn: boolean;
    readonly loudnorm: boolean;
    readonly alimiter: boolean;
    readonly silenceremove: boolean;
  };
}

export function parseVersionOutput(stdout: string): FfmpegVersionInfo | null {
  const versionMatch = /ffmpeg version (\S+)/.exec(stdout);
  if (versionMatch?.[1] === undefined) return null;
  const configLine = /^\s*configuration:(.*)$/m.exec(stdout)?.[1] ?? '';
  const configureFlags = configLine.split(/\s+/).filter((flag) => flag.startsWith('--'));
  const has = (flag: string): boolean => configureFlags.includes(flag);
  const license: FfmpegLicense = has('--enable-nonfree')
    ? 'nonfree'
    : has('--enable-gpl')
      ? 'GPL'
      : 'LGPL';
  return {
    version: versionMatch[1],
    license,
    version3: has('--enable-version3'),
    hasWhisper: has('--enable-whisper'),
    configureFlags,
  };
}

/** Encoder lines look like ` V....D libx264   libx264 H.264 ...`; the legend lines use `=`. */
export function parseEncoders(stdout: string): Set<string> {
  const names = new Set<string>();
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^\s[VAS][.A-Z]{5}\s+(\S+)\s/.exec(line);
    if (match?.[1] !== undefined && match[1] !== '=') names.add(match[1]);
  }
  return names;
}

/** Filter lines look like ` TS afftdn   A->A   Denoise ...` (2 or 3 flag columns by version). */
export function parseFilters(stdout: string): Set<string> {
  const names = new Set<string>();
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^\s[.A-Z|]{2,3}\s+(\S+)\s+[AVN|]*->[AVN|]*\s/.exec(line);
    if (match?.[1] !== undefined) names.add(match[1]);
  }
  return names;
}

export function capabilitiesOf(
  encoders: ReadonlySet<string>,
  filters: ReadonlySet<string>,
): FfmpegCapabilities {
  const hardware: HardwareH264[] = [];
  if (encoders.has('h264_nvenc')) hardware.push('nvenc');
  if (encoders.has('h264_qsv')) hardware.push('qsv');
  if (encoders.has('h264_amf')) hardware.push('amf');
  return {
    libx264: encoders.has('libx264'),
    hardwareH264: hardware,
    filters: {
      highpass: filters.has('highpass'),
      afftdn: filters.has('afftdn'),
      arnndn: filters.has('arnndn'),
      loudnorm: filters.has('loudnorm'),
      alimiter: filters.has('alimiter'),
      silenceremove: filters.has('silenceremove'),
    },
  };
}
