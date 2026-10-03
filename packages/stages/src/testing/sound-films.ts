/**
 * Test support for the sound director and palettes: the example film's inputs, a broad all-voxel
 * film that reaches every event kind, the same film spread over all four looks, test looks with
 * every look available, and a pure-Node hash of the SFX + ambience buses (no ffmpeg).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LOOKS, type Look } from '@reelforge/kit';
import {
  CuesFileSchema,
  MIX_SAMPLE_RATE,
  mixBlock,
  planMix,
  type BusEvent,
  type CuesFileInput,
} from '@reelforge/pipeline';
import { storyboardFileSchema, wordsFileSchema, type StoryboardShot } from '@reelforge/shared';
import type { DefaultCuesInput } from '../stages/default-cues.js';
import { EXAMPLE_DIR, EXAMPLE_SCENE_SFX } from './example-film.js';

const readExample = (file: string): unknown =>
  JSON.parse(readFileSync(path.join(EXAMPLE_DIR, file), 'utf8'));

export const EXAMPLE_SOUND_INPUT: DefaultCuesInput = {
  shots: storyboardFileSchema.parse(readExample('storyboard.json')).shots,
  words: wordsFileSchema.parse(readExample('timing/words.json')).words,
  sceneSfx: EXAMPLE_SCENE_SFX,
};

export const GENERATED_MUSIC: DefaultCuesInput['music'] = {
  cues: [
    {
      id: 'music-01',
      from: 0,
      to: 30.5,
      file: 'audio/music/gen-calm-tech-1-0123456789.wav',
      gainDb: -5,
      fadeInS: 1.5,
      fadeOutS: 3,
      ducking: { enabled: true },
    },
  ],
  moods: ['calm-tech'],
};

function shot(
  id: string,
  t0: number,
  t1: number,
  treatment: StoryboardShot['treatment'],
  transitionIn?: StoryboardShot['transitionIn'],
): StoryboardShot {
  return {
    id,
    t0,
    t1,
    treatment,
    intent: id,
    scene: `scenes/${id}.js`,
    ...(transitionIn === undefined ? {} : { transitionIn }),
  };
}

const spoken = (text: string, t: number) => ({ text, t, tEnd: t + 0.3 });

/** A 50 s all-voxel film that reaches every event kind of the director. */
export const BROAD_FILM: DefaultCuesInput = {
  shots: [
    shot('s01', 0, 4, 'title-card'),
    shot('s02', 4, 10, 'character-scene'),
    shot('s03', 10, 16, 'kinetic-text', { type: 'crossfade', duration: 0.6 }),
    shot('s04', 16, 22, 'counter/odometer'),
    shot('s05', 22, 29, 'ui-mockup', { type: 'wipe', duration: 0.4 }),
    shot('s06', 29, 35, 'metaphor-object', { type: 'glitch', duration: 0.3 }),
    shot('s07', 35, 41, 'data-chart-3d'),
    shot('s08', 41, 46, 'map'),
    shot('s09', 46, 50, 'title-card', { type: 'crossfade', duration: 0.8 }),
  ],
  words: [
    spoken('Meet', 1),
    spoken('Ada.', 1.6),
    spoken('Over', 5.2),
    spoken('300', 5.8),
    spoken('million', 6.3),
    spoken('people.', 6.9),
    spoken('This', 11.5),
    spoken('is', 11.9),
    spoken('HUGE', 12.4),
    spoken('Count', 16.8),
    spoken('to', 17.3),
    spoken('twenty', 20.1),
    spoken('Typing', 23.2),
    spoken('Wait', 30.4),
    spoken('for', 30.8),
    spoken('it:', 31.1),
    spoken('boom!', 33.4),
    spoken('fifty', 37.2),
    spoken('percent', 37.7),
    spoken('Here', 42.2),
    spoken('Thanks!', 47.5),
  ],
  sceneSfx: [
    { t: 17, name: 'tick', shotId: 's04' },
    { t: 20.2, name: 'hit', shotId: 's04' },
    { t: 23.1, name: 'typewriter', shotId: 's05' },
    { t: 25, name: 'click', shotId: 's05' },
    { t: 26.4, name: 'pop', shotId: 's05' },
    { t: 27, name: 'pop', shotId: 's05' },
    { t: 27.6, name: 'pop', shotId: 's05' },
    { t: 28.2, name: 'click', shotId: 's05' },
    { t: 32, name: 'glitch', shotId: 's06' },
  ],
  anchors: [
    { t: 37.2, phrase: 'fifty', shotId: 's07' },
    { t: 43.1, phrase: 'here', shotId: 's08' },
  ],
};

/** Look (and, for dioramas, intent) per shot of `MIXED_FILM`. */
const MIXED_LOOKS: Readonly<Record<string, readonly [string, string?]>> = {
  s02: ['retro-ui'],
  s03: ['retro-ui'],
  s04: ['blueprint'],
  s05: ['retro-ui'],
  s06: ['diorama', 'A tiny server room with blinking racks'],
  s07: ['blueprint'],
  s08: ['diorama', 'The city streets at night'],
};

/** `BROAD_FILM` over all four looks (s01 and s09 stay voxel). */
export const MIXED_FILM: DefaultCuesInput = {
  ...BROAD_FILM,
  shots: BROAD_FILM.shots.map((original) => {
    const [look, intent] = MIXED_LOOKS[original.id] ?? [];
    return look === undefined ? original : { ...original, look, intent: intent ?? original.intent };
  }),
};

/** The kit's looks, every one available (the real flags depend on PLAN.md#12.2-12.4). */
export const ALL_LOOKS: readonly Look[] = LOOKS.map((look) => ({ ...look, available: true }));

/** SHA-256 of the SFX and ambience buses (float32 PCM, pure Node: no ffmpeg involved). */
export function busHash(cues: CuesFileInput): string {
  const parsed = CuesFileSchema.parse({ ...cues, music: [] });
  const durationS = Math.max(
    ...parsed.sfx.map((cue) => cue.t + 2),
    ...parsed.ambience.map((cue) => cue.to),
  );
  const totalFrames = Math.ceil(durationS * MIX_SAMPLE_RATE);
  const plan = planMix(parsed, totalFrames, EXAMPLE_DIR, new Map());
  if (!plan.ok) throw new Error(plan.error.message);
  const hash = createHash('sha256');
  const render = (events: readonly BusEvent[]): void => {
    const left = new Float64Array(totalFrames);
    const right = new Float64Array(totalFrames);
    mixBlock(events, 0, left, right);
    hash.update(new Uint8Array(Float32Array.from(left).buffer));
    hash.update(new Uint8Array(Float32Array.from(right).buffer));
  };
  render(plan.value.sfx);
  render(plan.value.ambience);
  return hash.digest('hex');
}
