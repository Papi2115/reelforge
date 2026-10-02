import { MUSIC_MOODS } from '@reelforge/pipeline';
import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STYLE_MOODS,
  MIN_ACT_S,
  STYLE_MOODS,
  actMoods,
  bedEnergy,
  defaultMood,
  densityEnergy,
  detectActs,
  type FilmAct,
} from './acts.js';
import { plannedMusicCues } from './music.js';

/** `count` shots of `lengthS`, a crossfade into the shots listed in `soft`. */
function shots(count: number, lengthS: number, soft: readonly number[] = []): StoryboardShot[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `s${String(index + 1).padStart(2, '0')}`,
    t0: index * lengthS,
    t1: (index + 1) * lengthS,
    treatment: 'map' as const,
    intent: 'x',
    scene: 'scenes/x.js',
    ...(soft.includes(index)
      ? { transitionIn: { type: 'crossfade' as const, duration: 0.5 } }
      : {}),
  }));
}

describe('detectActs', () => {
  it('keeps a short film as one act', () => {
    const acts = detectActs(shots(7, 4.5), 31.5);
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({ from: 0, to: 31.5, role: 'full' });
    expect(acts[0]?.shotIds).toHaveLength(7);
  });

  it('cuts a long film into ~60 s acts at shot boundaries: intro, body, outro', () => {
    const film = shots(36, 5);
    const acts = detectActs(film, 180);
    expect(acts.map((act) => act.role)).toEqual(['intro', 'body', 'outro']);
    expect(acts.map((act) => [act.from, act.to])).toEqual([
      [0, 60],
      [60, 120],
      [120, 180],
    ]);
    const starts = new Set(film.map((shot) => shot.t0));
    for (const act of acts) {
      expect(starts.has(act.from)).toBe(true);
      expect(act.to - act.from).toBeGreaterThanOrEqual(MIN_ACT_S);
    }
    expect(acts.flatMap((act) => act.shotIds)).toEqual(film.map((shot) => shot.id));
  });

  it('prefers a non-cut transition (the storyboard act break) near the ideal boundary', () => {
    // Ideal boundary at 60 s; a crossfade into the shot at 65 s wins over the cut at 60 s.
    const acts = detectActs(shots(24, 5, [13]), 120);
    expect(acts.map((act) => act.from)).toEqual([0, 65]);
  });

  it('derives energy from the shot density, calmer for intro and outro', () => {
    expect(densityEnergy(4, 60)).toBeCloseTo(0.3);
    expect(densityEnergy(12, 60)).toBeCloseTo(0.7);
    expect(densityEnergy(60, 60)).toBe(0.9);
    const [intro, body] = detectActs(shots(36, 5), 180);
    expect(body?.energy).toBe(0.7);
    expect(intro?.energy).toBeCloseTo(0.6, 1);
    expect(bedEnergy({ ...(body as FilmAct), energy: 0.9 })).toBe(0.7);
  });
});

describe('moods', () => {
  const act = (role: FilmAct['role'], energy: number): FilmAct => ({
    from: 0,
    to: 60,
    role,
    shotIds: [],
    energy,
  });

  it('maps every style to valid moods', () => {
    for (const moods of [...Object.values(STYLE_MOODS), DEFAULT_STYLE_MOODS]) {
      for (const mood of moods) expect(MUSIC_MOODS).toContain(mood);
    }
  });

  it('picks the style mood by role and energy', () => {
    const style = 'voxel-pixel-crisp640';
    expect(defaultMood(act('intro', 0.9), style)).toBe('calm-tech');
    expect(defaultMood(act('body', 0.4), style)).toBe('calm-tech');
    expect(defaultMood(act('body', 0.7), style)).toBe('bright-explainer');
    expect(defaultMood(act('full', 0.85), style)).toBe('retro-wave');
    expect(defaultMood(act('body', 0.9), 'noir-voxel')).toBe('lofi-chill');
    expect(defaultMood(act('body', 0.3), 'soft-480')).toBe('lofi-chill');
    expect(defaultMood(act('body', 0.3), 'my-style')).toBe('calm-tech');
  });

  it("uses Claude's hint only when it has one mood per act", () => {
    const acts = [act('intro', 0.5), act('outro', 0.5)];
    expect(actMoods(acts, 'noir-voxel')).toEqual(['tense-investigation', 'tense-investigation']);
    expect(actMoods(acts, 'noir-voxel', ['retro-wave', 'lofi-chill'])).toEqual([
      'retro-wave',
      'lofi-chill',
    ]);
    expect(actMoods(acts, 'noir-voxel', ['retro-wave'])).toEqual([
      'tense-investigation',
      'tense-investigation',
    ]);
  });

  it('plans crossfaded, ducked beds for the acts', () => {
    const acts = detectActs(shots(36, 5), 180);
    const cues = plannedMusicCues({
      acts,
      moods: actMoods(acts, 'voxel-pixel-crisp640'),
      seed: 7,
      durationS: 180,
    });
    expect(cues.map((cue) => [cue.from, cue.to, cue.fadeInS, cue.fadeOutS])).toEqual([
      [0, 61, 1.5, 2],
      [59, 121, 2, 2],
      [119, 180, 2, 3],
    ]);
    expect(cues.every((cue) => cue.ducking?.enabled === true && cue.gainDb === -5)).toBe(true);
    expect(cues.map((cue) => cue.file.split('/').at(-1)?.split('-').slice(1, 3).join('-'))).toEqual(
      ['calm-tech', 'bright-explainer', 'calm-tech'],
    );
  });
});
