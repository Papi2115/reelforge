/**
 * Tension map in the sound design (PLAN.md#12.22): act energy and mood follow the curve (calm or
 * tense, never the cheerful mood), the director grows its SFX budget a little at high tension
 * within the same window limits, and without a curve everything is exactly as before.
 */
import type { StoryboardShot, TensionPoint } from '@reelforge/shared';
import { tensionAt } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { generateDefaultCues } from '../stages/default-cues.js';
import { BROAD_FILM } from '../testing/sound-films.js';
import { actMoods, detectActs, TENSION_STYLE_MOODS } from './acts.js';
import { directCues } from './cue-director.js';
import { findGestures } from './cue-events.js';

const STYLE = 'voxel-pixel-crisp640';

/** A 4-minute film: a shot every 6 s, a crossfade every 60 s. */
const SHOTS: StoryboardShot[] = Array.from({ length: 40 }, (_, index) => ({
  id: `s${String(index + 1).padStart(2, '0')}`,
  t0: index * 6,
  t1: (index + 1) * 6,
  treatment: 'metaphor-object',
  intent: 'x',
  scene: `scenes/s${String(index + 1)}.js`,
  ...(index > 0 && index % 10 === 0
    ? { transitionIn: { type: 'crossfade' as const, duration: 0.5 } }
    : {}),
}));

const flat = (v: number, end = 240): TensionPoint[] => [
  { t: 0, v },
  { t: end, v },
];

describe('acts with a tension curve', () => {
  it('without a curve the acts are exactly the 1.x acts', () => {
    const acts = detectActs(SHOTS, 240);
    expect(acts.every((act) => !('tension' in act))).toBe(true);
    expect(detectActs(SHOTS, 240, undefined)).toEqual(acts);
  });

  it('a tense curve raises the energy and picks the tense mood; a calm one the calm mood', () => {
    const calm = detectActs(SHOTS, 240, flat(0.15));
    const tense = detectActs(SHOTS, 240, flat(0.85));
    expect(calm.map((act) => act.tension)).toEqual(calm.map(() => 0.15));
    calm.forEach((act, index) => {
      expect(tense[index]?.energy ?? 0).toBeGreaterThan(act.energy + 0.15);
    });
    const [calmMood, tenseMood] = TENSION_STYLE_MOODS[STYLE] ?? [];
    expect(actMoods(calm, STYLE)).toEqual(calm.map(() => calmMood));
    expect(actMoods(tense, STYLE)).toEqual(tense.map(() => tenseMood));
    for (const moods of Object.values(TENSION_STYLE_MOODS)) {
      expect(moods).not.toContain('bright-explainer');
    }
  });

  it('a three-act curve: calm intro, tense middle, released outro', () => {
    const curve: TensionPoint[] = [
      { t: 0, v: 0.2 },
      { t: 90, v: 0.4 },
      { t: 120, v: 0.9 },
      { t: 180, v: 0.8 },
      { t: 240, v: 0.15 },
    ];
    const acts = detectActs(SHOTS, 240, curve);
    const moods = actMoods(acts, STYLE);
    expect(acts.map((act) => act.role)).toEqual(['intro', 'body', 'body', 'outro']);
    expect(moods).toEqual(['calm-tech', 'calm-tech', 'retro-wave', 'calm-tech']);
  });
});

describe('sound director with a tension curve', () => {
  const gestures = findGestures({
    shots: BROAD_FILM.shots,
    words: BROAD_FILM.words,
    sceneSfx: BROAD_FILM.sceneSfx ?? [],
    anchors: BROAD_FILM.anchors ?? [],
  });
  const duration = 50;

  it('keeps a few more cues at high tension, fewer when calm, within the window limits', () => {
    const plain = directCues(gestures, BROAD_FILM.shots, duration);
    const tense = directCues(gestures, BROAD_FILM.shots, duration, new Map(), () => 0.95);
    const calm = directCues(gestures, BROAD_FILM.shots, duration, new Map(), () => 0.05);
    const starts = (cues: typeof plain): number => new Set(cues.map((cue) => cue.t)).size;
    expect(starts(tense)).toBeGreaterThanOrEqual(starts(plain));
    expect(starts(calm)).toBeLessThanOrEqual(starts(plain));
    expect(starts(tense)).toBeGreaterThan(starts(calm));
    // The mix QA's "sound moments per minute" (cues < 0.6 s apart count once) stays <= 24.
    const times = tense.map((cue) => cue.t).sort((a, b) => a - b);
    const moments = times.filter((t, index) => index === 0 || t - (times[index - 1] ?? 0) >= 0.6);
    expect((moments.length * 60) / duration).toBeLessThanOrEqual(24);
  });

  it('without a curve the default cues are unchanged', () => {
    expect(generateDefaultCues({ ...BROAD_FILM, tension: undefined })).toEqual(
      generateDefaultCues(BROAD_FILM),
    );
    const points = flat(0.9, 50);
    const steered = generateDefaultCues({ ...BROAD_FILM, tension: points });
    expect(steered.sfx?.length ?? 0).toBeGreaterThanOrEqual(
      generateDefaultCues(BROAD_FILM).sfx?.length ?? 0,
    );
    expect(tensionAt(points, 25)).toBe(0.9);
  });
});
