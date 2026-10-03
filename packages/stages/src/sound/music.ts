/**
 * Generated background music for the sound-cues stage: one bed per act (pipeline
 * `generateActMusic`, cached in `audio/music/gen-*.wav`), crossfaded between acts, faded at the
 * film edges, ducked under the voice with the default (Medium) sidechain settings.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  generateActMusic,
  planActMusic,
  type ActMusicOptions,
  type ActSpan,
  type MusicCueInput,
  type MusicMood,
} from '@reelforge/pipeline';
import { stageError, type StageError } from '../types.js';
import { bedEnergy, type FilmAct } from './acts.js';

/** Bed level under the voice (dB on top of the bed's own -23 LUFS). */
export const MUSIC_BED_GAIN_DB = -5;
/** Crossfade between two acts' beds (s). */
export const ACT_CROSSFADE_S = 2;
export const FILM_FADE_IN_S = 1.5;
export const FILM_FADE_OUT_S = 3;
/** Generated beds in `audio/music/` (never treated as the user's own music). */
export const GENERATED_MUSIC_PREFIX = 'gen-';

export interface ActMusicRequest {
  readonly acts: readonly FilmAct[];
  readonly moods: readonly MusicMood[];
  /** Project seed. */
  readonly seed: number;
  readonly durationS: number;
}

function spansAndOptions(request: ActMusicRequest): {
  spans: ActSpan[];
  options: ActMusicOptions;
} {
  return {
    spans: request.acts.map((act, index) => ({
      from: act.from,
      to: act.to,
      mood: request.moods[index],
      energy: bedEnergy(act),
    })),
    options: {
      seed: request.seed,
      gainDb: MUSIC_BED_GAIN_DB,
      crossfadeS: ACT_CROSSFADE_S,
      edgeFadeInS: FILM_FADE_IN_S,
      edgeFadeOutS: FILM_FADE_OUT_S,
      timelineS: request.durationS,
    },
  };
}

/** The music cues of a request without rendering anything (pure). */
export function plannedMusicCues(request: ActMusicRequest): MusicCueInput[] {
  const { spans, options } = spansAndOptions(request);
  return planActMusic(spans, options).map((plan) => plan.cue);
}

/** Renders (or reuses) every act's bed and returns their music cues. */
export async function renderActMusic(
  projectDir: string,
  request: ActMusicRequest,
): Promise<Result<MusicCueInput[], StageError>> {
  const { spans, options } = spansAndOptions(request);
  const rendered = await generateActMusic(projectDir, spans, options);
  return rendered.ok
    ? ok(rendered.value)
    : err(stageError('io', `cannot render the music: ${rendered.error.message}`));
}

/** True for a project-relative file the music generator wrote. */
export function isGeneratedMusic(file: string): boolean {
  const name = file.replaceAll('\\', '/').split('/').at(-1) ?? '';
  return name.startsWith(GENERATED_MUSIC_PREFIX);
}
