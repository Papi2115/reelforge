import { CuesFileSchema } from '@reelforge/pipeline';
import { validateCues } from '@reelforge/prompts';
import { storyboardFileSchema, wordsFileSchema } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { goldenFile } from '../testing/project.js';
import { MIN_SFX_GAP_S, generateDefaultCues, shotGroups } from './default-cues.js';

const storyboard = storyboardFileSchema.parse(JSON.parse(goldenFile('storyboard.json')));
const words = wordsFileSchema.parse(JSON.parse(goldenFile('timing/words.json')));
const input = { shots: storyboard.shots, words: words.words };

function validated(cues: ReturnType<typeof generateDefaultCues>, musicFiles: string[] = []) {
  return validateCues(JSON.stringify(cues), {
    schema: CuesFileSchema,
    durationS: storyboard.shots.at(-1)?.t1 ?? 0,
    musicFileExists: (file) => musicFiles.includes(file),
  });
}

describe('generateDefaultCues', () => {
  it('is deterministic and passes the cues schema and mixing rules', () => {
    const first = generateDefaultCues(input);
    expect(generateDefaultCues(input)).toEqual(first);
    const report = validated(first);
    expect(report.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(report.valid).toBe(true);
  });

  it('puts a whoosh before every non-cut transition and keeps SFX apart', () => {
    const cues = generateDefaultCues(input);
    const transitions = storyboard.shots.filter(
      (shot) => shot.transitionIn !== undefined && shot.transitionIn.type !== 'cut',
    );
    const whooshes = cues.sfx?.filter((cue) => cue.name === 'whoosh') ?? [];
    expect(whooshes.length).toBe(transitions.length);
    const times = (cues.sfx ?? []).map((cue) => cue.t);
    times.slice(1).forEach((t, index) => {
      expect(t - (times[index] ?? 0)).toBeGreaterThanOrEqual(MIN_SFX_GAP_S);
    });
  });

  it('lays one quiet ambience bed per shot group and a ducked music bed when music exists', () => {
    const groups = shotGroups(storyboard.shots);
    const music = ['audio/music/bed.wav'];
    const cues = generateDefaultCues({ ...input, musicFiles: music });
    expect(cues.ambience).toHaveLength(groups.length);
    expect(cues.ambience?.every((cue) => (cue.gainDb ?? 0) <= -20)).toBe(true);
    expect(cues.music).toHaveLength(groups.length);
    expect(cues.music?.[0]).toMatchObject({
      file: 'audio/music/bed.wav',
      ducking: { enabled: true },
    });
    expect(validated(cues, music).valid).toBe(true);
    expect(generateDefaultCues(input).music).toEqual([]);
  });

  it('hits the sfx events built scenes registered instead of guessing', () => {
    const cues = generateDefaultCues({
      ...input,
      sceneSfx: [
        { t: 12.5, name: 'pop' },
        { t: 13, name: 'pop' },
        { t: 20, name: 'unknown-sound' },
      ],
    });
    const nonWhoosh = cues.sfx?.filter((cue) => cue.name !== 'whoosh') ?? [];
    expect(nonWhoosh.map((cue) => [cue.t, cue.name])).toEqual([[12.5, 'pop']]);
  });
});
