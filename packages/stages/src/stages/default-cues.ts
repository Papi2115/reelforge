/**
 * Deterministic `cues.json` (PLAN.md#8.1) used when Claude is unavailable, in Economy mode, or when
 * Claude's cues stay invalid: hits on the sfx events scenes registered (or on the first spoken
 * number of a shot when no scene was built yet), a whoosh before every non-cut transition, one
 * ambience bed per shot group (groups split at non-cut transitions = act changes) and, when the
 * project has music files, one ducked music bed per group. Same inputs -> same cues.
 */
import {
  AMBIENCE_RECIPES,
  CUES_FILE_VERSION,
  SFX_RECIPES,
  type CuesFileInput,
} from '@reelforge/pipeline';
import type { StoryboardShot } from '@reelforge/shared';
import type { SceneSfxEvent } from '../types.js';

export interface DefaultCuesInput {
  readonly shots: readonly StoryboardShot[];
  readonly words: readonly { readonly text: string; readonly t: number; readonly tEnd: number }[];
  /** Sounds scheduled by built scenes (`ctx.sfx.at`), global seconds. */
  readonly sceneSfx?: readonly SceneSfxEvent[];
  /** Project-relative music files (`audio/music/…`), used in order, one per group. */
  readonly musicFiles?: readonly string[];
  /** Timeline length; default: the later of the last shot end and the last word end. */
  readonly durationS?: number;
}

type SfxName = (typeof SFX_RECIPES)[number];

interface SfxPlan {
  readonly t: number;
  readonly name: SfxName;
  readonly gainDb: number;
  /** Lower = kept first when cues crowd each other. */
  readonly priority: number;
}

/** Minimum distance between two SFX (the prompt: never constant). */
export const MIN_SFX_GAP_S = 2;
const WHOOSH_LEAD_S = 0.2;
const AMBIENCE_BEDS = [
  'room-tone',
  'hum',
] as const satisfies readonly (typeof AMBIENCE_RECIPES)[number][];
const AMBIENCE_GAIN_DB = -28;
const MUSIC_GAIN_DB = -18;

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

function isSfxName(name: string): name is SfxName {
  return (SFX_RECIPES as readonly string[]).includes(name);
}

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

function numberHits(input: DefaultCuesInput): SfxPlan[] {
  return input.shots.flatMap((shot) => {
    const word = input.words.find(
      (candidate) => candidate.t >= shot.t0 && candidate.t < shot.t1 && /\d/.test(candidate.text),
    );
    if (word === undefined) return [];
    const name: SfxName = shot.treatment === 'counter/odometer' ? 'tick' : 'hit';
    return [{ t: word.t, name, gainDb: -8, priority: 2 }];
  });
}

function plannedSfx(input: DefaultCuesInput, durationS: number): SfxPlan[] {
  const whooshes = input.shots
    .filter((shot) => shot.transitionIn !== undefined && shot.transitionIn.type !== 'cut')
    .map((shot) => ({
      t: Math.max(0, shot.t0 - WHOOSH_LEAD_S),
      name: 'whoosh' as const,
      gainDb: -10,
      priority: 0,
    }));
  const scene = (input.sceneSfx ?? []).flatMap((event): SfxPlan[] =>
    isSfxName(event.name) ? [{ t: event.t, name: event.name, gainDb: -6, priority: 1 }] : [],
  );
  const hits = scene.length > 0 ? scene : numberHits(input);
  const candidates = [...whooshes, ...hits]
    .filter((cue) => cue.t >= 0 && cue.t <= durationS)
    .sort((a, b) => a.priority - b.priority || a.t - b.t);
  const kept: SfxPlan[] = [];
  for (const cue of candidates) {
    if (kept.every((other) => Math.abs(other.t - cue.t) >= MIN_SFX_GAP_S)) kept.push(cue);
  }
  return kept.sort((a, b) => a.t - b.t);
}

export function defaultDurationS(input: DefaultCuesInput): number {
  const lastShot = input.shots.at(-1)?.t1 ?? 0;
  const lastWord = input.words.at(-1)?.tEnd ?? 0;
  return input.durationS ?? Math.max(lastShot, lastWord);
}

export function generateDefaultCues(input: DefaultCuesInput): CuesFileInput {
  const durationS = defaultDurationS(input);
  const groups = shotGroups(input.shots)
    .map((group) => ({
      from: round3(group[0]?.t0 ?? 0),
      to: round3(Math.min(group.at(-1)?.t1 ?? 0, durationS)),
    }))
    .filter((group) => group.to > group.from);
  const musicFiles = input.musicFiles ?? [];
  return {
    version: CUES_FILE_VERSION,
    global: { voGainDb: 0, targetLufs: -14, truePeakMaxDbtp: -1 },
    sfx: plannedSfx(input, durationS).map((cue, index) => ({
      id: `sfx-${String(index + 1).padStart(2, '0')}`,
      t: round3(cue.t),
      name: cue.name,
      gainDb: cue.gainDb,
      pan: 0,
    })),
    ambience: groups.map((group, index) => ({
      id: `amb-${String(index + 1).padStart(2, '0')}`,
      from: group.from,
      to: group.to,
      name: AMBIENCE_BEDS[index % AMBIENCE_BEDS.length] ?? 'room-tone',
      gainDb: AMBIENCE_GAIN_DB,
      fadeInS: 1,
      fadeOutS: 1,
    })),
    music:
      musicFiles.length === 0
        ? []
        : groups.map((group, index) => ({
            id: `music-${String(index + 1).padStart(2, '0')}`,
            from: group.from,
            to: group.to,
            file: musicFiles[index % musicFiles.length] ?? '',
            gainDb: MUSIC_GAIN_DB,
            loop: true,
            ducking: { enabled: true },
          })),
  };
}
