/**
 * Streaming WAV reader for the mix QA: parses the RIFF chunks (PCM 16-bit or IEEE float 32-bit,
 * plain or WAVE_FORMAT_EXTENSIBLE, any extra chunks skipped) and reads frames in blocks, so a long
 * stem never has to fit in memory. Channels come back de-interleaved as float32 in [-1, 1].
 */
import { open, type FileHandle } from 'node:fs/promises';

export interface WavInfo {
  readonly channels: number;
  readonly sampleRate: number;
  readonly format: 'pcm16' | 'float32';
  readonly frames: number;
  /** Byte offset of the first sample. */
  readonly dataOffset: number;
}

const FORMAT_PCM = 1;
const FORMAT_FLOAT = 3;
const FORMAT_EXTENSIBLE = 0xfffe;
const HEADER_PROBE_BYTES = 4096;

export class WavFormatError extends Error {}

/** Parses the header bytes of a WAV file of `fileSize` bytes. */
export function parseWavHeader(bytes: Buffer, fileSize: number): WavInfo {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    throw new WavFormatError('not a RIFF/WAVE file');
  }
  let at = 12;
  let fmt: { tag: number; channels: number; sampleRate: number; bits: number } | undefined;
  while (at + 8 <= bytes.length) {
    const id = bytes.toString('ascii', at, at + 4);
    const size = bytes.readUInt32LE(at + 4);
    const body = at + 8;
    if (id === 'fmt ') {
      let tag = bytes.readUInt16LE(body);
      if (tag === FORMAT_EXTENSIBLE && size >= 26) tag = bytes.readUInt16LE(body + 24);
      fmt = {
        tag,
        channels: bytes.readUInt16LE(body + 2),
        sampleRate: bytes.readUInt32LE(body + 4),
        bits: bytes.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      if (fmt === undefined) throw new WavFormatError('data chunk before fmt chunk');
      const format =
        fmt.tag === FORMAT_PCM && fmt.bits === 16
          ? 'pcm16'
          : fmt.tag === FORMAT_FLOAT && fmt.bits === 32
            ? 'float32'
            : undefined;
      if (format === undefined) {
        throw new WavFormatError(`unsupported WAV format ${String(fmt.tag)}/${String(fmt.bits)}`);
      }
      const frameBytes = fmt.channels * (format === 'pcm16' ? 2 : 4);
      // Streaming writers may leave the size at 0 / 0xFFFFFFFF: trust the file size then.
      const available = Math.max(0, fileSize - body);
      const dataBytes = size === 0 || size > available ? available : size;
      return {
        channels: fmt.channels,
        sampleRate: fmt.sampleRate,
        format,
        frames: Math.floor(dataBytes / frameBytes),
        dataOffset: body,
      };
    }
    at = body + size + (size % 2);
  }
  throw new WavFormatError('no data chunk in the first 4 KB');
}

export class WavReader {
  private constructor(
    private readonly handle: FileHandle,
    readonly info: WavInfo,
  ) {}

  static async open(filePath: string): Promise<WavReader> {
    const handle = await open(filePath, 'r');
    try {
      const { size } = await handle.stat();
      const probe = Buffer.alloc(Math.min(HEADER_PROBE_BYTES, size));
      await handle.read(probe, 0, probe.length, 0);
      return new WavReader(handle, parseWavHeader(probe, size));
    } catch (error) {
      await handle.close();
      throw error;
    }
  }

  /** Frames [from, from + count) per channel (shorter at the end of the file). */
  async read(from: number, count: number): Promise<Float32Array[]> {
    const { channels, format, frames, dataOffset } = this.info;
    const length = Math.max(0, Math.min(count, frames - from));
    const sampleBytes = format === 'pcm16' ? 2 : 4;
    const buffer = Buffer.alloc(length * channels * sampleBytes);
    await this.handle.read(buffer, 0, buffer.length, dataOffset + from * channels * sampleBytes);
    const out = Array.from({ length: channels }, () => new Float32Array(length));
    for (let frame = 0; frame < length; frame++) {
      for (let channel = 0; channel < channels; channel++) {
        const at = (frame * channels + channel) * sampleBytes;
        const target = out[channel];
        if (target === undefined) continue;
        target[frame] =
          format === 'pcm16' ? buffer.readInt16LE(at) / 32768 : buffer.readFloatLE(at);
      }
    }
    return out;
  }

  close(): Promise<void> {
    return this.handle.close();
  }
}
