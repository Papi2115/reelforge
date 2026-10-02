/**
 * Pure helpers of the Sound panel (PLAN.md#8.2): the music-ducking presets (Light / Medium /
 * Strong; Medium = the pipeline's defaults) and the cue a library sound becomes when it is dropped
 * on the timeline (an `insert-cue` edit; main validates the result with the cues schema).
 */
import type { Ducking, LibrarySound } from './sound-contract.js';
import type { CueTrack, RawCue } from './timeline-contract.js';
import { roundTime } from './timeline-edits.js';

export const DUCKING_PRESETS = ['light', 'medium', 'strong'] as const;
export type DuckingPreset = (typeof DUCKING_PRESETS)[number];

export const DUCKING_PRESET_VALUES: Readonly<Record<DuckingPreset, Ducking>> = {
  light: { enabled: true, thresholdDb: -24, ratio: 3, attackMs: 30, releaseMs: 300 },
  medium: { enabled: true, thresholdDb: -30, ratio: 8, attackMs: 20, releaseMs: 400 },
  strong: { enabled: true, thresholdDb: -36, ratio: 14, attackMs: 10, releaseMs: 600 },
};

export const DUCKING_OFF: Ducking = { ...DUCKING_PRESET_VALUES.medium, enabled: false };

/** Which preset `ducking` is: a preset id, `off`, or `custom` (edited in Advanced). */
export function duckingPresetOf(ducking: Ducking): DuckingPreset | 'off' | 'custom' {
  if (!ducking.enabled) return 'off';
  const match = DUCKING_PRESETS.find((preset) => {
    const values = DUCKING_PRESET_VALUES[preset];
    return (
      values.thresholdDb === ducking.thresholdDb &&
      values.ratio === ducking.ratio &&
      values.attackMs === ducking.attackMs &&
      values.releaseMs === ducking.releaseMs
    );
  });
  return match ?? 'custom';
}

/** Default levels of dropped cues (the default-cues stage uses the same beds). */
export const DROPPED_AMBIENCE_GAIN_DB = -28;
export const DROPPED_MUSIC_GAIN_DB = -18;
const MIN_RANGE_S = 2;
const DEFAULT_AMBIENCE_S = 10;
const DEFAULT_MUSIC_S = 30;

export interface DropContext {
  /** Timeline length (s). */
  readonly duration: number;
  /** Shot ranges: an ambience bed lasts until the end of the shot it is dropped in. */
  readonly shots: readonly { readonly t0: number; readonly t1: number }[];
  /** Ducking for new music (the panel's current choice). */
  readonly ducking: Ducking;
}

/** End of an ambience bed dropped at `t`: its shot's end (≥ 2 s later), else t + 10 s. */
function ambienceEnd(t: number, context: DropContext): number {
  const shot = context.shots.find((candidate) => t >= candidate.t0 && t < candidate.t1);
  return roundTime(
    shot === undefined ? t + DEFAULT_AMBIENCE_S : Math.max(shot.t1, t + MIN_RANGE_S),
  );
}

/** End of a music bed dropped at `t`: the end of the video, else t + 30 s. */
function musicEnd(t: number, context: DropContext): number {
  return roundTime(context.duration - t >= MIN_RANGE_S ? context.duration : t + DEFAULT_MUSIC_S);
}

/** Display name of a library sound: the recipe name or the file name without the folder. */
export function soundLabel(sound: LibrarySound): string {
  return sound.source === 'builtin' ? sound.name : (sound.file.split('/').pop() ?? sound.file);
}

/** The track and raw cue a library sound becomes when dropped at `t` seconds. */
export function libraryCue(
  sound: LibrarySound,
  t: number,
  context: DropContext,
): { readonly track: CueTrack; readonly cue: RawCue } {
  const at = roundTime(Math.max(0, t));
  const source = sound.source === 'builtin' ? { name: sound.name } : { file: sound.file };
  switch (sound.kind) {
    case 'sfx':
      return { track: 'sfx', cue: { t: at, ...source } };
    case 'ambience':
      return {
        track: 'ambience',
        cue: {
          from: at,
          to: ambienceEnd(at, context),
          ...source,
          gainDb: DROPPED_AMBIENCE_GAIN_DB,
        },
      };
    case 'music':
      return {
        track: 'music',
        cue: {
          from: at,
          to: musicEnd(at, context),
          ...source,
          gainDb: DROPPED_MUSIC_GAIN_DB,
          loop: true,
          ducking: { ...context.ducking },
        },
      };
  }
}
