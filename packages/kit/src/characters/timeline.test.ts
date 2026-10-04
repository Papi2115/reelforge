import { describe, expect, it } from 'vitest';
import { CLIPS, POSE_KEYS } from './clips.js';
import {
  blendedPose,
  evaluatePose,
  expressionAt,
  insertCue,
  lookWeight,
  POSE_BLEND,
  walkState,
  type PoseCue,
  type WalkSegment,
} from './timeline.js';

const PERSONALITY = { energy: 1, lag: 0.15, phase: 1.3, longArms: false };

describe('character cues', () => {
  it('keeps cues sorted; a cue replaces one at the same time unless it yields', () => {
    let cues: PoseCue[] = [{ at: 0, pose: 'calm', auto: false }];
    cues = insertCue(cues, { at: 2, pose: 'wave', auto: false });
    cues = insertCue(cues, { at: 1, pose: 'think', auto: false });
    expect(cues.map((cue) => cue.at)).toEqual([0, 1, 2]);
    cues = insertCue(cues, { at: 2, pose: 'joy', auto: false });
    expect(cues.map((cue) => cue.pose)).toEqual(['calm', 'think', 'joy']);
    expect(insertCue(cues, { at: 2, pose: 'walk', auto: true }, true)).toEqual(cues);
    // Calling the same cue again (e.g. from update()) changes nothing.
    expect(insertCue(cues, { at: 1, pose: 'think', auto: false })).toEqual(cues);
  });

  it('blends a pose change over POSE_BLEND s from the previous pose', () => {
    const cues: PoseCue[] = [
      { at: 0, pose: 'calm', auto: false },
      { at: 2, pose: 'wave', auto: false },
    ];
    const t = 2 + POSE_BLEND / 2;
    const blended = blendedPose(cues, t, PERSONALITY).pose;
    const calm = CLIPS.calm(t, t + PERSONALITY.phase, 1).pose;
    const wave = CLIPS.wave(t - 2, t + PERSONALITY.phase, 1).pose;
    expect(blended.armRZ).toBeCloseTo((calm.armRZ + wave.armRZ) / 2, 6);
    const settled = blendedPose(cues, 2 + POSE_BLEND, PERSONALITY).pose;
    const waving = CLIPS.wave(POSE_BLEND, 2 + POSE_BLEND + PERSONALITY.phase, 1).pose;
    for (const key of POSE_KEYS) expect(settled[key], key).toBeCloseTo(waving[key], 9);
  });

  it('delays the head and folds long arms (mannequin) for think', () => {
    const cues: PoseCue[] = [
      { at: 0, pose: 'calm', auto: false },
      { at: 1, pose: 'think', auto: false },
    ];
    const frame = evaluatePose(cues, 1.2, PERSONALITY);
    expect(frame.pose.headX).toBe(blendedPose(cues, 1.2 - PERSONALITY.lag, PERSONALITY).pose.headX);
    expect(frame.pose.armRX).toBe(blendedPose(cues, 1.2, PERSONALITY).pose.armRX);
    const folded = evaluatePose(cues, 2, { ...PERSONALITY, longArms: true }).pose.armRX;
    expect(Math.abs(folded)).toBeLessThan(Math.abs(evaluatePose(cues, 2, PERSONALITY).pose.armRX));
  });

  it('resolves auto expressions to the pose suggestion', () => {
    const cues = [
      { at: 0, expression: 'auto' as const },
      { at: 3, expression: 'alarm' as const },
    ];
    expect(expressionAt(cues, 1, 'joy')).toBe('joy');
    expect(expressionAt(cues, 3.5, 'joy')).toBe('alarm');
  });

  it('walks between points, turning into the walk and back, the same in any order', () => {
    const segments: WalkSegment[] = [{ start: 1, end: 3, from: [0, 0], to: [2, 0] }];
    expect(walkState(segments, 0)).toEqual({ position: [0, 0], yaw: 0 });
    expect(walkState(segments, 2).position).toEqual([1, 0]);
    expect(walkState(segments, 2).yaw).toBeCloseTo(Math.PI / 2, 6);
    expect(walkState(segments, 5)).toEqual({ position: [2, 0], yaw: 0 });
    // Relative to the object's own facing (rotation.y = pi/2 already looks along +x).
    expect(walkState(segments, 2, Math.PI / 2).yaw).toBeCloseTo(0, 6);
    const times = [0.5, 1.1, 2.9, 3.2, 6];
    const forward = times.map((t) => walkState(segments, t));
    expect([...times].reverse().map((t) => walkState(segments, t))).toEqual(forward.reverse());
  });

  it('fades a look-at in and out over 0.3 s', () => {
    const cue = { at: 1, until: 3, target: [0, 0, 0] };
    expect(lookWeight(cue, 0.9)).toBe(0);
    expect(lookWeight(cue, 2)).toBe(1);
    expect(lookWeight(cue, 3.5)).toBe(0);
    expect(lookWeight({ ...cue, until: undefined }, 9)).toBe(1);
  });
});
