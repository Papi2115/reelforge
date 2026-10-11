/**
 * `direction.json` and the storyboard's direction refs (PLAN.md#14.16): the schema takes a plan
 * and refuses broken shapes; a storyboard shot keeps its refs and every other shot stays as before.
 */
import { describe, expect, it } from 'vitest';
import {
  DIRECTION_FILE,
  directionFileSchema,
  framingSequence,
  shotDirectionRefsSchema,
  type DirectionFile,
} from './direction.js';
import { storyboardShotSchema } from './storyboard.js';

const PLAN: DirectionFile = {
  version: 1,
  titleFrame: {
    cast: ['clerk'],
    title: 'The Stamp That Never Came',
    background: { placeId: 'tollBooth', why: 'where the waiting happens' },
    acting: [{ person: 'clerk', pose: 'stand', expr: 'deadpan' }],
    accentObject: 'the rubber stamp',
  },
  motifs: [],
  cast: [
    {
      id: 'clerk',
      signatureGag: {
        kind: 'clockCheck',
        arc: { setup: 'b01', escalations: ['b02'], payoff: 'b03', why: 'he lives by the clock' },
      },
    },
  ],
  beats: [
    {
      id: 'b01',
      span: { t0: 0, t1: 3, text: 'Every car waited.' },
      intent: 'setup',
      camera: {
        progression: [
          { framing: 'wide', subject: 'the queue' },
          { framing: 'ecu', subject: 'the stamp', why: 'information: the claim' },
        ],
      },
      gagRefs: ['clerk'],
    },
  ],
  climax: { beatRef: 'b01', ecuSubject: 'the stamp', why: 'it decides who passes' },
  accidents: [],
};

describe('direction.json', () => {
  it('parses a plan and keeps its fields', () => {
    expect(DIRECTION_FILE).toBe('direction.json');
    expect(directionFileSchema.parse(PLAN)).toEqual(PLAN);
    const withHash = { ...PLAN, source: 'claude', inputsHash: 'a'.repeat(64) };
    expect(directionFileSchema.safeParse(withHash).success).toBe(true);
  });

  it('refuses broken shapes', () => {
    const broken: unknown[] = [
      { ...PLAN, version: 2 },
      { ...PLAN, cast: [] },
      { ...PLAN, titleFrame: { ...PLAN.titleFrame, cast: ['a', 'b', 'c', 'd'] } },
      { ...PLAN, beats: [{ ...PLAN.beats[0], intent: 'montage' }] },
      { ...PLAN, beats: [{ ...PLAN.beats[0], id: '1st' }] },
      { ...PLAN, inputsHash: 'nope' },
      { ...PLAN, source: 'user' },
    ];
    for (const value of broken) expect(directionFileSchema.safeParse(value).success).toBe(false);
  });

  it('gives the size sequence of a progression', () => {
    expect(framingSequence(PLAN.beats[0]?.camera.progression ?? [])).toBe('wide>ecu');
  });
});

describe('storyboard direction refs', () => {
  const shot = {
    id: 's02_queue',
    t0: 2,
    t1: 6,
    treatment: 'character-scene',
    intent: 'cast: clerk | place: tollBooth.',
    scene: 'scenes/s02_queue.js',
  };

  it('stay on a Grim Ink shot and are absent everywhere else', () => {
    const direction = {
      beats: ['b01'],
      gags: ['clerk'],
      framings: [
        { framing: 'wide', subject: 'the queue' },
        { framing: 'close', subject: 'the clerk', why: 'emotion: he does not care' },
      ],
    };
    expect(storyboardShotSchema.parse({ ...shot, direction }).direction).toEqual(direction);
    expect(storyboardShotSchema.parse(shot)).toEqual(shot);
    expect(shotDirectionRefsSchema.safeParse({ titleFrame: true, framings: [] }).success).toBe(
      false,
    );
  });
});
