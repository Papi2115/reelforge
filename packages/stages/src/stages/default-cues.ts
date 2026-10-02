/**
 * Deterministic `cues.json` (PLAN.md#8.1): the starting point Claude's sound-cues turn adjusts,
 * and the whole sound design in Economy mode / without Claude. SFX come from the sound director
 * (`sound/cue-events.ts` finds the events, `sound/cue-rules.ts` says what each gets,
 * `sound/cue-director.ts` keeps the density sensible and picks variants); one quiet ambience bed
 * per shot group (groups split at non-cut transitions), or one faint room bed under generated
 * music; music = the generated per-act beds the
 * stage rendered, or the user's own files in `audio/music/` (one ducked bed per group).
 * Same inputs -> same cues.
 */
import {
  AMBIENCE_RECIPES,
  CUES_FILE_VERSION,
  type CuesFileInput,
  type MusicCueInput,
  type MusicMood,
} from '@reelforge/pipeline';
import type { StoryboardShot } from '@reelforge/shared';
import type { SceneSfxEvent } from '../types.js';
import { directCues } from '../sound/cue-director.js';
import { findGestures, type DirectorWord, type SceneAnchorEvent } from '../sound/cue-events.js';

export interface GeneratedMusic {
  /** Rendered per-act beds (`sound/music.ts`). */
  readonly cues: readonly MusicCueInput[];
  /** Mood of each act, written to cues.json `moods`. */
  readonly moods: readonly MusicMood[];
}

export interface DefaultCuesInput {
  readonly shots: readonly StoryboardShot[];
  readonly words: readonly DirectorWord[];
  /** Sounds scheduled by built scenes (`ctx.sfx.at`), global seconds. */
  readonly sceneSfx?: readonly SceneSfxEvent[];
  /** Anchors resolved by built scenes, global seconds. */
  readonly anchors?: readonly SceneAnchorEvent[];
  /** The user's own project-relative music files (`audio/music/…`): one per group, in order. */
  readonly musicFiles?: readonly string[];
  /** Generated music (used when there are no user music files). */
  readonly music?: GeneratedMusic | undefined;
  /** Timeline length; default: the later of the last shot end and the last word end. */
  readonly durationS?: number;
}

const AMBIENCE_BEDS = [
  'room-tone',
  'hum',
] as const satisfies readonly (typeof AMBIENCE_RECIPES)[number][];
const AMBIENCE_GAIN_DB = -28;
/** Under generated music the ambience is one faint room bed (no hum: nothing low under the music). */
const AMBIENCE_UNDER_MUSIC_GAIN_DB = -32;
const USER_MUSIC_GAIN_DB = -18;

const round3 = (value: number): number => Math.round(value * 1000) / 1000;
const cueId = (prefix: string, index: number): string =>
  `${prefix}-${String(index + 1).padStart(2, '0')}`;

/** Consecutive shots between non-cut transitions. */
export function shotGroups(shots: readonly StoryboardShot[]): StoryboardShot[][] {
  const groups: StoryboardShot[][] = [];
  for (const shot of shots) {
    const opensAct = shot.transitionIn !== undefined && shot.transitionIn.type !== 'cut';
    const current = groups.at(-1);
    if (current === undefined || opensAct) groups.push([shot]);
    else current.push(shot);
  }
  return groups;
}

export function defaultDurationS(
  input: Pick<DefaultCuesInput, 'shots' | 'words' | 'durationS'>,
): number {
  const lastShot = input.shots.at(-1)?.t1 ?? 0;
  const lastWord = input.words.at(-1)?.tEnd ?? 0;
  return input.durationS ?? Math.max(lastShot, lastWord);
}

function sfxCues(input: DefaultCuesInput, durationS: number): NonNullable<CuesFileInput['sfx']> {
  const gestures = findGestures({
    shots: input.shots,
    words: input.words,
    sceneSfx: input.sceneSfx ?? [],
    anchors: input.anchors ?? [],
  });
  return directCues(gestures, input.shots, durationS).map((cue, index) => ({
    id: cueId('sfx', index),
    t: cue.t,
    name: cue.name,
    gainDb: cue.gainDb,
    pan: cue.pan,
    seed: cue.seed,
    ...(cue.durationS === undefined ? {} : { durationS: round3(cue.durationS) }),
  }));
}

export function generateDefaultCues(input: DefaultCuesInput): CuesFileInput {
  const durationS = defaultDurationS(input);
  const groups = shotGroups(input.shots)
    .map((group) => ({
      from: round3(group[0]?.t0 ?? 0),
      to: round3(Math.min(group.at(-1)?.t1 ?? 0, durationS)),
    }))
    .filter((group) => group.to > group.from);
  const userMusic = input.musicFiles ?? [];
  const generated = userMusic.length === 0 ? input.music : undefined;
  const underMusic = generated !== undefined && generated.cues.length > 0;
  const music: NonNullable<CuesFileInput['music']> =
    userMusic.length > 0
      ? groups.map((group, index) => ({
          id: cueId('music', index),
          from: group.from,
          to: group.to,
          file: userMusic[index % userMusic.length] ?? '',
          gainDb: USER_MUSIC_GAIN_DB,
          loop: true,
          ducking: { enabled: true },
        }))
      : [...(generated?.cues ?? [])];
  return {
    version: CUES_FILE_VERSION,
    global: { voGainDb: 0, targetLufs: -14, truePeakMaxDbtp: -1 },
    sfx: sfxCues(input, durationS),
    ambience: underMusic
      ? [
          // Under the music only a faint room for the whole film (no hum, no dips at act edges).
          {
            id: cueId('amb', 0),
            from: 0,
            to: round3(durationS),
            name: 'room-tone',
            gainDb: AMBIENCE_UNDER_MUSIC_GAIN_DB,
            fadeInS: 1,
            fadeOutS: 1,
          },
        ]
      : groups.map((group, index) => ({
          id: cueId('amb', index),
          from: group.from,
          to: group.to,
          name: AMBIENCE_BEDS[index % AMBIENCE_BEDS.length] ?? 'room-tone',
          gainDb: AMBIENCE_GAIN_DB,
          fadeInS: 1,
          fadeOutS: 1,
        })),
    music,
    ...(underMusic ? { moods: [...generated.moods] } : {}),
  };
}
