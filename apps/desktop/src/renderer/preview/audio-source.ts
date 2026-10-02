/**
 * Which project audio drives the player (PLAN.md#6.4): the final mix when it exists, else the
 * cleaned voice-over, else the original recording.
 */
import { projectMediaUrl } from '../../shared/player-contract.js';

const PLAYBACK_AUDIO = [
  /^audio\/mix\.wav$/i,
  /^audio\/vo\.clean\.wav$/i,
  /^audio\/vo\.original\.(wav|mp3|m4a|aac|ogg|opus|flac|webm)$/i,
];

/** Project-relative path of the audio to play, from the project file listing. */
export function playbackAudioFile(files: readonly string[]): string | undefined {
  for (const pattern of PLAYBACK_AUDIO) {
    const file = files.find((candidate) => pattern.test(candidate));
    if (file !== undefined) return file;
  }
  return undefined;
}

/** True when a change touches project audio (the player must reload its media). */
export function affectsAudio(paths: readonly string[], truncated: boolean): boolean {
  return truncated || paths.some((file) => /^audio\//i.test(file));
}

export function playbackAudioUrl(files: readonly string[], revision: number): string | undefined {
  const file = playbackAudioFile(files);
  return file === undefined ? undefined : projectMediaUrl(file, revision);
}
