import { CuesFileSchema, SFX_RECIPES } from '@reelforge/pipeline';
import { validateCues } from '@reelforge/prompts';
import { storyboardFileSchema, wordsFileSchema } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { DENSITY } from '../sound/cue-rules.js';
import { goldenFile } from '../testing/project.js';
import { generateDefaultCues, shotGroups } from './default-cues.js';

const storyboard = storyboardFileSchema.parse(JSON.parse(goldenFile('storyboard.json')));
const words = wordsFileSchema.parse(JSON.parse(goldenFile('timing/words.json')));
const input = { shots: storyboard.shots, words: words.words };
const durationS = storyboard.shots.at(-1)?.t1 ?? 0;

function validated(cues: ReturnType<typeof generateDefaultCues>, musicFiles: string[] = []) {
  return validateCues(JSON.stringify(cues), {
    schema: CuesFileSchema,
    durationS,
    musicFileExists: (file) => musicFiles.includes(file),
  });
}

const GENERATED = {
  cues: [
    {
      id: 'music-01',
      from: 0,
      to: durationS,
      file: 'audio/music/gen-calm-tech-1-0123456789.wav',
      gainDb: -5,
      loop: false,
      fadeInS: 1.5,
      fadeOutS: 3,
      ducking: { enabled: true },
    },
  ],
  moods: ['calm-tech' as const],
};

describe('generateDefaultCues', () => {
  it('is deterministic and passes the cues schema and mixing rules without warnings', () => {
    const first = generateDefaultCues(input);
    expect(generateDefaultCues(input)).toEqual(first);
    const report = validated(first);
    expect(report.issues).toEqual([]);
    expect(report.valid).toBe(true);
  });

  it('uses the new recipes with seeds and a sensible density', () => {
    const cues = generateDefaultCues(input);
    const sfx = cues.sfx ?? [];
    expect(sfx.length).toBeGreaterThanOrEqual(3);
    expect(sfx.length).toBeLessThanOrEqual(durationS / DENSITY.secondsPerGesture + 2);
    for (const cue of sfx) {
      expect(SFX_RECIPES).toContain(cue.name);
      expect(cue.seed).toBeTypeOf('number');
      expect(cue.gainDb ?? 0).toBeLessThan(-6);
    }
    // The wipe into the spectrum shot gets a swoosh just before it.
    const wipe = storyboard.shots.find((shot) => shot.transitionIn?.type === 'wipe');
    expect(sfx.find((cue) => Math.abs(cue.t - ((wipe?.t0 ?? 0) - 0.05)) < 1e-6)?.name).toBe(
      'swoosh-in',
    );
    // A number in a shot without scene sounds gets a soft hit.
    expect(sfx.some((cue) => cue.name === 'hit-soft' || cue.name === 'whoosh-impact')).toBe(true);
  });

  it('lays one quiet ambience bed per shot group and a ducked bed per user music file', () => {
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
    expect(cues.moods).toBeUndefined();
    expect(validated(cues, music).valid).toBe(true);
    // User music wins over generated beds.
    expect(generateDefaultCues({ ...input, musicFiles: music, music: GENERATED }).music).toEqual(
      cues.music,
    );
    expect(generateDefaultCues(input).music).toEqual([]);
  });

  it('plays the generated beds with their moods and keeps the ambience faint under them', () => {
    const cues = generateDefaultCues({ ...input, music: GENERATED });
    expect(cues.music).toEqual(GENERATED.cues);
    expect(cues.moods).toEqual(['calm-tech']);
    expect(cues.ambience).toEqual([
      expect.objectContaining({ from: 0, to: durationS, name: 'room-tone', gainDb: -32 }),
    ]);
    expect(validated(cues, [GENERATED.cues[0]?.file ?? '']).valid).toBe(true);
  });

  it('follows the sounds built scenes registered (a list reveal rises)', () => {
    const shot = storyboard.shots[3];
    if (shot === undefined) throw new Error('golden storyboard changed');
    const pops = [0.6, 1.2, 1.8].map((offset) => ({
      t: shot.t0 + offset,
      name: 'pop',
      shotId: shot.id,
    }));
    const cues = generateDefaultCues({
      ...input,
      sceneSfx: [...pops, { t: 20, name: 'unknown-sound' }],
    });
    const listed = (cues.sfx ?? []).filter((cue) => cue.name === 'pop');
    expect(listed.map((cue) => cue.t)).toEqual(pops.map((pop) => Math.round(pop.t * 1000) / 1000));
    expect(listed.map((cue) => cue.pan)).toEqual([-0.2, 0, 0.2]);
  });
});
