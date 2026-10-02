/**
 * Audio helpers of the stage IPC: the probe of a picked voice-over (ffmpeg of the settings reads
 * the input header: length + first audio stream; a 0.1 s decode, so it is quick for long files)
 * and the test hook that replaces whisper.cpp by a recorded transcription (unpackaged app +
 * REELFORGE_TEST_HOOKS=1 only; app smoke tests never run a real model).
 */
import { readFileSync } from 'node:fs';
import { err, ok } from '@reelforge/claude-bridge';
import { FfmpegManager, parseMediaAudioInfo, WordsRawSchema } from '@reelforge/pipeline';
import type { AppSettings } from '@reelforge/shared';
import type { AudioTools } from '@reelforge/stages';
import { ffmpegLocateOptions } from '../settings-consumers.js';
import type { AudioProbe } from './voiceover-input.js';

export function ffmpegAudioProbe(settings: () => AppSettings): AudioProbe {
  return async (file) => {
    const ffmpeg = await FfmpegManager.create(ffmpegLocateOptions(settings()));
    if (!ffmpeg.ok) return err(`ffmpeg is not available: ${ffmpeg.error.message}`);
    const run = await ffmpeg.value.run(['-i', file, '-t', '0.1', '-f', 'null', '-'], {
      timeoutMs: 30_000,
    });
    if (!run.ok) return err(run.error.message.split('\n')[0] ?? run.error.message);
    return ok(parseMediaAudioInfo(run.value.stderr));
  };
}

/** Test hook env: path of a `words.raw.json` every transcription returns. */
export const TEST_TRANSCRIPT_ENV = 'REELFORGE_TEST_TRANSCRIPT';

/** Audio tools whose transcription replays `rawFile` (any model counts as installed). */
export function recordedTranscription(rawFile: string): (tools: AudioTools) => AudioTools {
  return (tools) => ({
    ...tools,
    hasWhisperModel: () => true,
    transcribe: (request) => {
      try {
        const raw = WordsRawSchema.parse(JSON.parse(readFileSync(rawFile, 'utf8')));
        return Promise.resolve(ok({ ...raw, model: request.model, lang: request.lang }));
      } catch (error) {
        return Promise.resolve(
          err({
            kind: 'test-hook',
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    },
  });
}
