/** The acting-beat pose track (quality lab): holds, a jolting two-drawing in-between, snaps. */
import { describe, expect, it } from 'vitest';
import { KitError } from '../../../errors.js';
import { STAGE_INK_NAMES } from '../stage-ink.js';
import { POSE_IN_S, poseAt, type PoseCue, type PoseSource } from './pose-track.js';
import { pose, type PoseName } from './poses.js';
import { TEST_CHARACTER } from './test-character.js';

const person: PoseSource = {
  pose: (name: PoseName, ph = 0, over = {}) => pose(name, TEST_CHARACTER.D, ph, over),
};
const CUES: readonly PoseCue[] = [
  [0, 'stand'],
  [1, 'akimbo'],
  [2, 'point', { lean: 6 }],
];

describe('env.ink.poseAt', () => {
  it('holds each cue, before the first one too, and is on env.ink', () => {
    expect(poseAt(person, CUES, -1)).toEqual(person.pose('stand'));
    expect(poseAt(person, CUES, 0.5)).toEqual(person.pose('stand'));
    expect(poseAt(person, CUES, 1.5)).toEqual(person.pose('akimbo'));
    expect(poseAt(person, CUES, 3)).toEqual(person.pose('point', 0, { lean: 6 }));
    expect(poseAt(person, [], 1)).toEqual(person.pose('stand'));
    expect(STAGE_INK_NAMES).toContain('poseAt');
  });

  it('moves into a new pose in two drawings with an overshoot, then holds', () => {
    const from = person.pose('stand');
    const to = person.pose('akimbo');
    const mid = poseAt(person, CUES, 1 + 1 / 12);
    const k = (mid.hL[0] - from.hL[0]) / (to.hL[0] - from.hL[0]);
    expect(k).toBeGreaterThan(1);
    expect(poseAt(person, CUES, 1 + POSE_IN_S)).toEqual(to);
    // Hand shapes snap; the same t gives the same pose (on twos).
    expect(mid.kL).toBe(to.kL);
    expect(poseAt(person, CUES, 1.01)).toEqual(poseAt(person, CUES, 1.04));
  });

  it('accepts a pose object and rejects unknown names and non-people', () => {
    const lean = person.pose('stand', 0, { lean: -8 });
    expect(poseAt(person, [[0, lean]], 1)).toEqual(lean);
    expect(() => poseAt(person, [[0, 'dab' as PoseName]], 1)).toThrow(KitError);
    expect(() => poseAt({} as PoseSource, CUES, 1)).toThrow(/film person/);
  });
});
