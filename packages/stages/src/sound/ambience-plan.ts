/**
 * The ambience beds of the default cues (pure). Without generated music: one quiet bed per shot
 * group — groups split at non-cut transitions and where the sound palette's ambience changes
 * (another look, another diorama type) — in the palette's bed and level. Under generated music:
 * one faint bed per run of shots with the same palette ambience, the whole film for a one-look
 * film. Beds meet at a look boundary overlap by `LOOK_CROSSFADE_S`, so their fades crossfade.
 * An all-voxel film gets exactly the 1.x beds.
 */
import type { CuesFileInput } from '@reelforge/pipeline';
import type { StoryboardShot } from '@reelforge/shared';
import { VOXEL_PALETTE, type ShotPalettes, type SoundPalette } from './palettes/index.js';

type AmbienceCueInput = NonNullable<CuesFileInput['ambience']>[number];

/** Overlap of two beds at a look boundary (s); both fade over it. */
export const LOOK_CROSSFADE_S = 1;
const FADE_S = 1;

const round3 = (value: number): number => Math.round(value * 1000) / 1000;
const cueId = (index: number): string => `amb-${String(index + 1).padStart(2, '0')}`;

interface Run {
  readonly shots: StoryboardShot[];
  readonly palette: SoundPalette;
  /** The palette's ambience key (e.g. the diorama type). */
  readonly key: string;
  /** The run starts at a palette ambience change (not at the film start or a non-cut transition). */
  readonly lookBoundary: boolean;
}

/** Splits shot groups further where the palette ambience changes. */
function runs(groups: readonly (readonly StoryboardShot[])[], palettes: ShotPalettes): Run[] {
  const out: Run[] = [];
  for (const group of groups) {
    let current: Run | undefined;
    for (const shot of group) {
      const palette = palettes.get(shot.id) ?? VOXEL_PALETTE;
      const key = palette.ambience.key(shot);
      if (current?.palette.id === palette.id && current.key === key) {
        current.shots.push(shot);
        continue;
      }
      current = { shots: [shot], palette, key, lookBoundary: current !== undefined };
      out.push(current);
    }
  }
  return out;
}

export interface AmbiencePlanInput {
  readonly shots: readonly StoryboardShot[];
  /** Shot groups (split at non-cut transitions). */
  readonly groups: readonly (readonly StoryboardShot[])[];
  readonly durationS: number;
  readonly palettes: ShotPalettes;
  /** Generated music plays under the film. */
  readonly underMusic: boolean;
}

export function ambienceCues(input: AmbiencePlanInput): AmbienceCueInput[] {
  const half = LOOK_CROSSFADE_S / 2;
  const groups = input.underMusic ? [input.shots] : input.groups;
  const spans = runs(groups, input.palettes)
    .map((run, index, all) => {
      const next = all[index + 1];
      const first = run.shots[0];
      const last = run.shots.at(-1);
      const from = input.underMusic && index === 0 ? 0 : (first?.t0 ?? 0);
      const to = input.underMusic && next === undefined ? input.durationS : (last?.t1 ?? 0);
      return {
        run,
        from: round3(Math.max(0, run.lookBoundary ? from - half : from)),
        to: round3(Math.min(next?.lookBoundary === true ? to + half : to, input.durationS)),
      };
    })
    .filter((span) => span.to > span.from);
  return spans.map((span, index) => {
    const { ambience } = span.run.palette;
    return {
      id: cueId(index),
      from: span.from,
      to: span.to,
      name: input.underMusic
        ? ambience.underMusic(span.run.key)
        : ambience.bed(span.run.key, index),
      gainDb: input.underMusic ? ambience.underMusicGainDb : ambience.gainDb,
      fadeInS: FADE_S,
      fadeOutS: FADE_S,
    };
  });
}
