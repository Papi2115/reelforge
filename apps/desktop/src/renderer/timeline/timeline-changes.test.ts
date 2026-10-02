import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import type { CuesView } from '../../shared/snapshot-contract.js';
import {
  addSfxChange,
  boundaryChange,
  deleteCuesChange,
  gainChange,
  placeBoundary,
  placeRange,
  rangeChange,
  shiftCuesChange,
} from './timeline-changes.js';
import { wordBoundaries } from './word-index.js';

function shot(id: string, t0: number, t1: number): StoryboardShot {
  return { id, t0, t1, treatment: 'title-card', intent: 'x', scene: `scenes/${id}.js` };
}

const shots = [shot('s01', 0, 2.2), shot('s02', 2.2, 7.5), shot('s03', 7.5, 8)];
const boundaries = wordBoundaries([
  { t: 2.3, tEnd: 2.5 },
  { t: 2.5, tEnd: 3.1 },
  { t: 0.6, tEnd: 0.9 },
]);
const snap = { boundaries, enabled: true };
const free = { boundaries, enabled: false };

const cues: CuesView = {
  sfx: [
    { t: 0.2, label: 'hit', gainDb: 0 },
    { t: 3, label: 'pop', gainDb: -3 },
  ],
  ambience: [{ from: 1, to: 5, label: 'hum', gainDb: 0 }],
  music: [],
};

describe('placeBoundary', () => {
  it('snaps to a word boundary within 150 ms, unless snapping is off', () => {
    expect(placeBoundary(shots, 0, 2.41, snap)).toEqual({ t: 2.5, snapped: true });
    expect(placeBoundary(shots, 0, 2.41, free)).toEqual({ t: 2.41, snapped: false });
    expect(placeBoundary(shots, 0, 3.4, snap)).toEqual({ t: 3.4, snapped: false });
  });

  it('keeps both shots at least 1 s long (shorter shots may not shrink)', () => {
    expect(placeBoundary(shots, 0, 0.62, snap)).toEqual({ t: 1, snapped: false });
    expect(placeBoundary(shots, 0, 9, snap)).toEqual({ t: 6.5, snapped: false });
    // s03 is only 0.5 s: its start may move left, never right.
    expect(placeBoundary(shots, 1, 7.9, free)).toEqual({ t: 7.5, snapped: false });
    expect(placeBoundary(shots, 1, 7.2, free)).toEqual({ t: 7.2, snapped: false });
    expect(placeBoundary(shots, 2, 9, free)).toBeUndefined();
  });

  it('builds the edit, or nothing when the boundary did not move', () => {
    expect(boundaryChange(shots, 0, 2.5)).toEqual({
      file: 'storyboard',
      edits: [{ kind: 'move-boundary', left: 's01', right: 's02', from: 2.2, to: 2.5 }],
    });
    expect(boundaryChange(shots, 0, 2.2)).toBeUndefined();
  });
});

describe('cue changes', () => {
  it('shifts selected cues together without going below 0 s', () => {
    const refs = [
      { track: 'sfx', index: 0 },
      { track: 'ambience', index: 0 },
    ] as const;
    expect(shiftCuesChange(cues, refs, 0.1)).toEqual({
      file: 'cues',
      edits: [
        { kind: 'move-sfx', index: 0, from: 0.2, to: 0.3 },
        {
          kind: 'set-range',
          track: 'ambience',
          index: 0,
          from: { from: 1, to: 5 },
          to: { from: 1.1, to: 5.1 },
        },
      ],
    });
    expect(shiftCuesChange(cues, refs, -1)?.edits[0]).toEqual({
      kind: 'move-sfx',
      index: 0,
      from: 0.2,
      to: 0,
    });
    expect(shiftCuesChange(cues, [{ track: 'sfx', index: 0 }], -0.5)?.edits).toHaveLength(1);
    expect(shiftCuesChange(cues, [{ track: 'sfx', index: 9 }], 1)).toBeUndefined();
  });

  it('deletes from the highest index down', () => {
    const change = deleteCuesChange(cues, [
      { track: 'sfx', index: 0 },
      { track: 'sfx', index: 1 },
      { track: 'ambience', index: 0 },
    ]);
    expect(change?.edits).toEqual([
      { kind: 'delete-cue', track: 'ambience', index: 0, at: 1 },
      { kind: 'delete-cue', track: 'sfx', index: 1, at: 3 },
      { kind: 'delete-cue', track: 'sfx', index: 0, at: 0.2 },
    ]);
  });

  it('adds a built-in sound at the end of the list', () => {
    expect(addSfxChange(cues, 4.12345, 'whoosh')).toEqual({
      file: 'cues',
      edits: [{ kind: 'insert-cue', track: 'sfx', index: 2, cue: { t: 4.123, name: 'whoosh' } }],
    });
  });

  it('places range edges with a minimum length and moves whole ranges', () => {
    const range = { from: 1, to: 5 };
    expect(placeRange(range, 'from', 6, 0, free, 10)).toEqual({
      from: 4.9,
      to: 5,
      snapAt: undefined,
    });
    expect(placeRange(range, 'to', 2.45, 0, snap, 10)).toEqual({
      from: 1,
      to: 2.5,
      snapAt: 2.5,
    });
    expect(placeRange(range, 'move', 0.5, 1, free, 10)).toEqual({
      from: 0,
      to: 4,
      snapAt: undefined,
    });
    expect(rangeChange(cues, 'ambience', 0, { from: 1, to: 5 })).toBeUndefined();
  });

  it('sets the gain within the mixer limits', () => {
    expect(gainChange(cues, { track: 'sfx', index: 1 }, -100)?.edits).toEqual([
      { kind: 'set-gain', track: 'sfx', index: 1, from: -3, to: -60 },
    ]);
    expect(gainChange(cues, { track: 'sfx', index: 1 }, -3)).toBeUndefined();
    expect(gainChange(cues, { track: 'sfx', index: 1 }, Number.NaN)).toBeUndefined();
  });
});
