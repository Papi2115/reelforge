/**
 * Which project audio drives the player (PLAN.md#6.4, #8.2): in `mix` monitoring the final mix
 * when it exists (or the preview mix of the last cue edit), else the cleaned voice-over, else the
 * original recording; in `vo` monitoring the voice-over only.
 */
import { projectMediaUrl } from '../../shared/player-contract.js';

export type MonitorMode = 'mix' | 'vo';

const MIX_AUDIO = /^audio\/mix\.wav$/i;
const VOICE_AUDIO = [
  /^audio\/vo\.clean\.wav$/i,
  /^audio\/vo\.original\.(wav|mp3|m4a|aac|ogg|opus|flac|webm)$/i,
];

/** Project-relative path of the audio to play, from the project file listing. */
export function playbackAudioFile(
  files: readonly string[],
  monitor: MonitorMode = 'mix',
): string | undefined {
  const patterns = monitor === 'mix' ? [MIX_AUDIO, ...VOICE_AUDIO] : VOICE_AUDIO;
  for (const pattern of patterns) {
    const file = files.find((candidate) => pattern.test(candidate));
    if (file !== undefined) return file;
  }
  return undefined;
}

/** True when a change touches project audio (the player must reload its media). */
export function affectsAudio(paths: readonly string[], truncated: boolean): boolean {
  return truncated || paths.some((file) => /^audio\//i.test(file));
}

/** A preview mix (cue edits re-rendered around the playhead) to play instead of mix.wav. */
export interface PreviewMixFile {
  readonly file: string;
  readonly revision: number;
}

export function playbackAudioUrl(
  files: readonly string[],
  revision: number,
  monitor: MonitorMode = 'mix',
  preview: PreviewMixFile | null = null,
): string | undefined {
  if (monitor === 'mix' && preview !== null) {
    return projectMediaUrl(preview.file, preview.revision);
  }
  const file = playbackAudioFile(files, monitor);
  return file === undefined ? undefined : projectMediaUrl(file, revision);
}
