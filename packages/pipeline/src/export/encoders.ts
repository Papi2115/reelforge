/**
 * H.264 encoder profiles and hardware autodetection. Quality settings were tuned on dithered
 * 640x360 -> 1080p content (docs/export.md): encoder defaults (e.g. NVENC ~2 Mbps) smear the
 * ordered dither, so every profile sets an explicit constant-quality target.
 */
import type { ExportError } from './errors.js';
import type { FfmpegRunner } from '../audio/passes.js';
import { err, ok, type Result } from '../result.js';

export const HARDWARE_ENCODERS = ['h264_nvenc', 'h264_qsv', 'h264_amf'] as const;
export type HardwareEncoderId = (typeof HARDWARE_ENCODERS)[number];
export type VideoEncoderId = HardwareEncoderId | 'libx264';
export const VIDEO_ENCODER_IDS: readonly VideoEncoderId[] = [...HARDWARE_ENCODERS, 'libx264'];

/**
 * `final`: upload quality (the app's Standard). `draft`: faster, visibly softer dither (quick
 * checks). `high`: slower presets / lower quantizers for archival masters (bigger files).
 */
export type ExportQuality = 'final' | 'draft' | 'high';
export const EXPORT_QUALITIES: readonly ExportQuality[] = ['draft', 'final', 'high'];

const QUALITY_ARGS: Readonly<Record<VideoEncoderId, Readonly<Record<ExportQuality, string[]>>>> = {
  // p7/hq/cq19: 49.6 dB PSNR at ~12 Mbps on the dither test clip (p4 defaults: 35.5 dB, 2 Mbps).
  h264_nvenc: {
    final: ['-preset', 'p7', '-tune', 'hq', '-rc', 'vbr', '-cq', '19', '-b:v', '0'],
    draft: ['-preset', 'p4', '-tune', 'hq', '-rc', 'vbr', '-cq', '23', '-b:v', '0'],
    high: ['-preset', 'p7', '-tune', 'hq', '-rc', 'vbr', '-cq', '16', '-b:v', '0'],
  },
  // Not measurable on the dev machine (no Intel GPU): ICQ mode via global_quality.
  h264_qsv: {
    final: ['-preset', 'medium', '-global_quality', '18'],
    draft: ['-preset', 'veryfast', '-global_quality', '23'],
    high: ['-preset', 'slow', '-global_quality', '15'],
  },
  // Constant QP 16/18/20: 46.5 dB at ~12 Mbps.
  h264_amf: {
    final: ['-quality', 'quality', '-rc', 'cqp', '-qp_i', '16', '-qp_p', '18', '-qp_b', '20'],
    draft: ['-quality', 'speed', '-rc', 'cqp', '-qp_i', '20', '-qp_p', '22', '-qp_b', '24'],
    high: ['-quality', 'quality', '-rc', 'cqp', '-qp_i', '13', '-qp_p', '15', '-qp_b', '17'],
  },
  // medium/crf18: 46.1 dB at ~10 Mbps; veryfast/crf20: 41.3 dB, ~3.5x faster.
  libx264: {
    final: ['-preset', 'medium', '-crf', '18'],
    draft: ['-preset', 'veryfast', '-crf', '20'],
    high: ['-preset', 'slow', '-crf', '15'],
  },
};

/** BT.709 for HD+ output; players assume it for untagged HD, so convert and tag explicitly. */
export const COLOR_TAG_ARGS: readonly string[] = [
  '-colorspace',
  'bt709',
  '-color_primaries',
  'bt709',
  '-color_trc',
  'bt709',
  '-color_range',
  'tv',
];

/** Encoder + quality arguments (after `-c:v`), including pixel format and colour tags. */
export function videoCodecArgs(encoder: VideoEncoderId, quality: ExportQuality): string[] {
  const profile = encoder === 'libx264' ? [] : ['-profile:v', 'high'];
  return [
    '-c:v',
    encoder,
    ...QUALITY_ARGS[encoder][quality],
    ...profile,
    '-pix_fmt',
    'yuv420p',
    ...COLOR_TAG_ARGS,
  ];
}

/**
 * Integer neighbour upscale + RGB -> BT.709 limited-range 4:2:0 conversion in one scale step.
 */
export function upscaleFilter(outputWidth: number, outputHeight: number): string {
  return (
    `scale=${String(outputWidth)}:${String(outputHeight)}:flags=neighbor:` +
    'out_color_matrix=bt709:out_range=tv,format=yuv420p'
  );
}

export interface EncoderProbe {
  readonly encoder: VideoEncoderId;
  readonly ok: boolean;
  /** Why the probe failed (last ffmpeg stderr line), or "ok". */
  readonly detail: string;
}

export interface EncoderChoice {
  readonly encoder: VideoEncoderId;
  readonly quality: ExportQuality;
  readonly hardware: boolean;
  /** Every probe that ran, in order (for logs / the settings UI). */
  readonly probes: readonly EncoderProbe[];
}

export interface DetectEncoderOptions {
  /** `auto` (default) probes hardware encoders first; an id forces that encoder (still probed). */
  readonly prefer?: 'auto' | VideoEncoderId;
  readonly quality?: ExportQuality;
  /** Probe size; hardware encoders have per-generation limits (default 1920x1080). */
  readonly width?: number;
  readonly height?: number;
  readonly signal?: AbortSignal;
}

/** One real 1 s test encode (lavfi testsrc2): listing in `-encoders` does not prove a working GPU. */
async function probeEncoder(
  ffmpeg: FfmpegRunner,
  encoder: VideoEncoderId,
  quality: ExportQuality,
  size: string,
  signal: AbortSignal | undefined,
): Promise<Result<EncoderProbe, ExportError>> {
  const run = await ffmpeg.run(
    [
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      `testsrc2=size=${size}:rate=30`,
      '-t',
      '1',
      ...videoCodecArgs(encoder, quality),
      '-f',
      'null',
      '-',
    ],
    { signal, timeoutMs: 30_000 },
  );
  if (run.ok) return ok({ encoder, ok: true, detail: 'ok' });
  if (run.error.kind === 'cancelled') {
    return err({ kind: 'cancelled', message: 'encoder detection cancelled' });
  }
  // The first stderr line names the cause ("Cannot load nvcuda.dll", "Error creating a MFX session").
  const firstLine =
    run.error.kind === 'exit-code' ? run.error.stderrTail.split('\n')[0] : undefined;
  const detail = firstLine === undefined || firstLine === '' ? run.error.message : firstLine;
  return ok({ encoder, ok: false, detail });
}

/**
 * Picks the first working encoder: h264_nvenc, h264_qsv, h264_amf, then libx264. A forced
 * encoder that fails its probe falls back to libx264 (reported in `probes`).
 */
export async function detectEncoder(
  ffmpeg: FfmpegRunner,
  options: DetectEncoderOptions = {},
): Promise<Result<EncoderChoice, ExportError>> {
  const quality = options.quality ?? 'final';
  const size = `${String(options.width ?? 1920)}x${String(options.height ?? 1080)}`;
  const prefer = options.prefer ?? 'auto';
  const order: VideoEncoderId[] =
    prefer === 'auto'
      ? [...HARDWARE_ENCODERS, 'libx264']
      : prefer === 'libx264'
        ? ['libx264']
        : [prefer, 'libx264'];
  const probes: EncoderProbe[] = [];
  for (const encoder of order) {
    const probe = await probeEncoder(ffmpeg, encoder, quality, size, options.signal);
    if (!probe.ok) return probe;
    probes.push(probe.value);
    if (probe.value.ok) {
      return ok({ encoder, quality, hardware: encoder !== 'libx264', probes });
    }
  }
  return err({
    kind: 'no-encoder',
    message: `no working H.264 encoder: ${probes.map((probe) => `${probe.encoder}: ${probe.detail}`).join('; ')}`,
  });
}
