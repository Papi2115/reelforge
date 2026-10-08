/**
 * Take audio -> one mono timeline (PLAN.md#13.14). Takes are decoded once (pcm/wav directly, mp3
 * through ffmpeg) to 44.1 kHz float samples; the timeline is assembled sample-exactly in Node
 * (silence of the planned pause between takes, a 10 ms raised-cosine fade at every take edge so
 * no join clicks). Loudness is NOT touched per take: the Audio cleaned stage normalises the whole
 * voice-over. Same takes -> same bytes.
 */
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FfmpegManager } from '../ffmpeg/manager.js';
import { renameRetrying } from '../fs-retry.js';
import { encodeWav, wavHeader } from '../mix/wav.js';
import { parseWavHeader } from '../mix/wav-reader.js';
import { err, ok, type Result } from '../result.js';
import { describeError, voiceError, type VoiceError } from './errors.js';

export const VOICE_SAMPLE_RATE = 44_100;
export const EDGE_FADE_S = 0.01;

export interface DecodedTake {
  /** Mono samples in [-1, 1] at `sampleRate`. */
  readonly samples: Float32Array;
  readonly sampleRate: number;
}

export interface TakeDecoder {
  decode(filePath: string): Promise<Result<DecodedTake, VoiceError>>;
}

/** Raw little-endian 16-bit mono PCM (the `pcm_*` formats) -> WAV bytes, sample data unchanged. */
export function wrapPcm(bytes: Uint8Array, sampleRate: number): Buffer {
  const frames = Math.floor(bytes.length / 2);
  return Buffer.concat([
    wavHeader(frames, 1, sampleRate, 'pcm16'),
    Buffer.from(bytes.buffer, bytes.byteOffset, frames * 2),
  ]);
}

/** WAV bytes -> mono samples (channels averaged). */
export function decodeWavBytes(
  bytes: Buffer,
): Result<DecodedTake & { readonly channels: number }, VoiceError> {
  try {
    const info = parseWavHeader(bytes, bytes.length);
    const sampleBytes = info.format === 'pcm16' ? 2 : 4;
    const samples = new Float32Array(info.frames);
    for (let frame = 0; frame < info.frames; frame++) {
      let sum = 0;
      for (let channel = 0; channel < info.channels; channel++) {
        const at = info.dataOffset + (frame * info.channels + channel) * sampleBytes;
        sum += info.format === 'pcm16' ? bytes.readInt16LE(at) / 32768 : bytes.readFloatLE(at);
      }
      samples[frame] = sum / info.channels;
    }
    return ok({ samples, sampleRate: info.sampleRate, channels: info.channels });
  } catch (error) {
    return err(voiceError('decode', `not a readable WAV: ${describeError(error)}`));
  }
}

async function decodeWithFfmpeg(
  ffmpeg: Pick<FfmpegManager, 'run'>,
  filePath: string,
): Promise<Result<DecodedTake, VoiceError>> {
  const temporary = `${filePath}.${randomBytes(4).toString('hex')}.decode.wav`;
  try {
    const run = await ffmpeg.run([
      '-i',
      filePath,
      '-ac',
      '1',
      '-ar',
      String(VOICE_SAMPLE_RATE),
      '-c:a',
      'pcm_f32le',
      '-f',
      'wav',
      '-y',
      temporary,
    ]);
    if (!run.ok)
      return err(voiceError('decode', `ffmpeg cannot decode ${filePath}: ${run.error.message}`));
    const decoded = decodeWavBytes(await readFile(temporary));
    return decoded.ok
      ? ok({ samples: decoded.value.samples, sampleRate: decoded.value.sampleRate })
      : decoded;
  } catch (error) {
    return err(voiceError('io', `cannot read the decoded ${filePath}: ${describeError(error)}`));
  } finally {
    await rm(temporary, { force: true });
  }
}

/**
 * Decoder for stored takes. Mono 44.1 kHz WAV (pcm takes) is read directly; anything else (mp3,
 * other rates) needs ffmpeg and fails with `decode` when none is given.
 */
export function createTakeDecoder(ffmpeg: Pick<FfmpegManager, 'run'> | null): TakeDecoder {
  return {
    async decode(filePath) {
      if (filePath.toLowerCase().endsWith('.wav')) {
        let bytes: Buffer;
        try {
          bytes = await readFile(filePath);
        } catch (error) {
          return err(voiceError('io', `cannot read ${filePath}: ${describeError(error)}`));
        }
        const decoded = decodeWavBytes(bytes);
        if (!decoded.ok) return decoded;
        if (decoded.value.sampleRate === VOICE_SAMPLE_RATE) {
          return ok({ samples: decoded.value.samples, sampleRate: VOICE_SAMPLE_RATE });
        }
      }
      if (ffmpeg === null) {
        return err(voiceError('decode', `ffmpeg is needed to decode ${filePath}`));
      }
      return decodeWithFfmpeg(ffmpeg, filePath);
    },
  };
}

/** Copy of `samples` with raised-cosine fades of `fadeS` at both ends. */
export function fadeEdges(
  samples: Float32Array,
  sampleRate: number,
  fadeS: number = EDGE_FADE_S,
): Float32Array {
  const out = Float32Array.from(samples);
  const length = Math.min(Math.round(fadeS * sampleRate), Math.floor(out.length / 2));
  for (let k = 0; k < length; k++) {
    const gain = 0.5 - 0.5 * Math.cos((Math.PI * k) / length);
    out[k] = (out[k] ?? 0) * gain;
    const tail = out.length - 1 - k;
    out[tail] = (out[tail] ?? 0) * gain;
  }
  return out;
}

export interface TimelinePiece {
  readonly samples: Float32Array;
  /** Silence inserted before this piece (seconds; 0 for the first). */
  readonly pauseBeforeS: number;
}

export interface AssembledTimeline {
  readonly samples: Float32Array;
  readonly sampleRate: number;
  /** Start / end of each piece in seconds (sample-exact). */
  readonly spans: readonly { readonly start: number; readonly end: number }[];
}

export function assembleTimeline(
  pieces: readonly TimelinePiece[],
  sampleRate: number = VOICE_SAMPLE_RATE,
  fadeS: number = EDGE_FADE_S,
): AssembledTimeline {
  const pauses = pieces.map((piece) => Math.max(0, Math.round(piece.pauseBeforeS * sampleRate)));
  const total = pieces.reduce(
    (sum, piece, index) => sum + piece.samples.length + (pauses[index] ?? 0),
    0,
  );
  const samples = new Float32Array(total);
  const spans: { start: number; end: number }[] = [];
  let at = 0;
  pieces.forEach((piece, index) => {
    at += pauses[index] ?? 0;
    samples.set(fadeEdges(piece.samples, sampleRate, fadeS), at);
    spans.push({ start: at / sampleRate, end: (at + piece.samples.length) / sampleRate });
    at += piece.samples.length;
  });
  return { samples, sampleRate, spans };
}

/** Writes the timeline as 16-bit mono WAV atomically; returns its sha256. */
export async function writeTimelineWav(
  filePath: string,
  timeline: AssembledTimeline,
): Promise<Result<string, VoiceError>> {
  const bytes = encodeWav([timeline.samples], timeline.sampleRate, 'pcm16');
  const temporary = `${filePath}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(temporary, bytes);
    await renameRetrying(temporary, filePath);
    return ok(createHash('sha256').update(bytes).digest('hex'));
  } catch (error) {
    await rm(temporary, { force: true });
    return err(voiceError('io', `cannot write ${filePath}: ${describeError(error)}`));
  }
}
