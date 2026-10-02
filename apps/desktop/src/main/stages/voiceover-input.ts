/**
 * Voice-over input of the app (PLAN.md#7.2) before the Voiceover stage copies it in: a file the
 * user picked is checked (extension + an ffmpeg probe: an audio stream with a length); an in-app
 * recording arrives as WAV bytes over IPC and is validated (size cap, RIFF/WAVE header, 16-bit
 * PCM, 48 kHz, mono/stereo, data size) before main writes it atomically to
 * `.reelforge/recordings/` (git-ignored; only the latest take is kept).
 */
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import type { MediaAudioInfo } from '@reelforge/pipeline';
import { writeAtomic } from '@reelforge/project';
import { VOICEOVER_EXTENSIONS, voiceoverExtensionSchema } from '@reelforge/shared';
import { inProject } from '@reelforge/stages';
import { MAX_RECORDING_BYTES, RECORDING_SAMPLE_RATE } from '../../shared/voiceover-contract.js';

export const RECORDINGS_DIR = '.reelforge/recordings';

export interface WavInfo {
  readonly sampleRate: number;
  readonly channels: number;
  readonly bitsPerSample: number;
  readonly durationS: number;
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

/** Parses and checks the header of a recording the renderer encoded (canonical PCM WAV). */
export function validateRecordingWav(bytes: Uint8Array): Result<WavInfo, string> {
  if (bytes.byteLength > MAX_RECORDING_BYTES) {
    return err(`the recording is too large (over ${String(MAX_RECORDING_BYTES >> 20)} MB)`);
  }
  if (bytes.byteLength < 44 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WAVE') {
    return err('the recording is not a WAV file');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  let format: Omit<WavInfo, 'durationS'> | undefined;
  while (offset + 8 <= bytes.byteLength) {
    const id = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ' && size >= 16 && body + 16 <= bytes.byteLength) {
      if (view.getUint16(body, true) !== 1) return err('the recording is not PCM');
      format = {
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (id === 'data') {
      if (format === undefined) return err('the WAV data comes before its format');
      if (body + size > bytes.byteLength) return err('the WAV data is truncated');
      if (format.sampleRate !== RECORDING_SAMPLE_RATE) {
        return err(`the recording must be ${String(RECORDING_SAMPLE_RATE)} Hz`);
      }
      if (format.bitsPerSample !== 16) return err('the recording must be 16-bit PCM');
      if (format.channels < 1 || format.channels > 2)
        return err('the recording must be mono or stereo');
      const frameBytes = format.channels * 2;
      if (size === 0 || size % frameBytes !== 0) return err('the recording has no audio');
      return ok({ ...format, durationS: size / frameBytes / format.sampleRate });
    }
    offset = body + size + (size % 2);
  }
  return err('the WAV file has no audio data');
}

/** Writes a validated take as `.reelforge/recordings/take-<stamp>.wav` (older takes removed). */
export async function saveRecording(
  projectDir: string,
  bytes: Uint8Array,
  now: Date,
): Promise<string> {
  const dir = inProject(projectDir, RECORDINGS_DIR);
  const old = await readdir(dir).catch(() => [] as string[]);
  await Promise.all(
    old
      .filter((name) => /^take-.*\.wav$/i.test(name))
      .map((name) => rm(path.join(dir, name), { force: true })),
  );
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `take-${stamp}.wav`);
  await writeAtomic(file, bytes);
  return file;
}

/** Probe of a picked file (ffmpeg's input banner). */
export type AudioProbe = (file: string) => Promise<Result<MediaAudioInfo, string>>;

/** A picked recording: supported extension, an audio stream and a length (> 0). */
export async function checkImport(
  file: string,
  probe: AudioProbe,
): Promise<Result<number, string>> {
  const extension = path.extname(file).slice(1).toLowerCase();
  if (!voiceoverExtensionSchema.safeParse(extension).success) {
    return err(
      `"${path.basename(file)}" is not a supported recording (use ${VOICEOVER_EXTENSIONS.join(', ')})`,
    );
  }
  const info = await probe(file);
  if (!info.ok) return err(`cannot read "${path.basename(file)}": ${info.error}`);
  if (info.value.sampleRate === null) return err(`"${path.basename(file)}" has no audio stream`);
  if (info.value.durationS === null || info.value.durationS <= 0) {
    return err(`"${path.basename(file)}" has no length (empty or broken file)`);
  }
  return ok(info.value.durationS);
}
