import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import type { CuesView } from '../../shared/snapshot-contract.js';
import {
  applyChanges,
  contentEnd,
  hitTest,
  rangeLane,
  trackLayout,
  trackRow,
  wordParts,
  type TimelineModel,
} from './timeline-model.js';
import type { TimelineView } from './timeline-view.js';

function shot(id: string, t0: number, t1: number): StoryboardShot {
  return { id, t0, t1, treatment: 'title-card', intent: 'x', scene: `scenes/${id}.js` };
}

const cues: CuesView = {
  sfx: [{ t: 3.7, label: 'hit', gainDb: 0 }],
  ambience: [{ from: 1, to: 4, label: 'hum', gainDb: -6 }],
  music: [{ from: 5, to: 7, label: 'bed.wav', gainDb: 0 }],
};

const model: TimelineModel = {
  shots: [shot('s01', 0, 2.2), shot('s02', 2.2, 7.5)],
  ...wordParts([
    { text: 'Doom', t: 0.3, tEnd: 0.6 },
    { text: 'runs.', t: 0.6, tEnd: 0.85 },
  ]),
  cues,
};

// 100 px per second, no scroll: x = 100 * t.
const view: TimelineView = { duration: 10, width: 1000, pxPerSecond: 100, scrollX: 0 };

function middle(id: Parameters<typeof trackRow>[0]): number {
  const row = trackRow(id);
  return row.top + row.height / 2;
}

describe('hitTest', () => {
  it('finds boundaries before shot bodies', () => {
    expect(hitTest(model, view, 223, middle('shots'), true)).toEqual({ kind: 'boundary', left: 0 });
    expect(hitTest(model, view, 300, middle('shots'), true)).toEqual({ kind: 'shot', index: 1 });
    expect(hitTest(model, view, 900, middle('shots'), true)).toEqual({
      kind: 'lane',
      track: 'shots',
    });
  });

  it('finds words when zoomed in, sentences when zoomed out', () => {
    expect(hitTest(model, view, 70, middle('narration'), true)).toEqual({ kind: 'word', index: 1 });
    expect(hitTest(model, view, 70, middle('narration'), false)).toEqual({
      kind: 'sentence',
      index: 0,
    });
    expect(hitTest(model, view, 150, middle('narration'), true)).toEqual({
      kind: 'lane',
      track: 'narration',
    });
  });

  it('finds sfx markers, range edges and range bodies', () => {
    expect(hitTest(model, view, 372, middle('cues'), true)).toEqual({ kind: 'sfx', index: 0 });
    const ambience = (rangeLane('ambience')?.top ?? 0) + 3;
    const music = (rangeLane('music')?.top ?? 0) + 3;
    expect(hitTest(model, view, 398, ambience, true)).toEqual({
      kind: 'range-edge',
      track: 'ambience',
      index: 0,
      edge: 'to',
    });
    expect(hitTest(model, view, 250, ambience, true)).toEqual({
      kind: 'range',
      track: 'ambience',
      index: 0,
    });
    expect(hitTest(model, view, 600, music, true)).toEqual({
      kind: 'range',
      track: 'music',
      index: 0,
    });
    expect(hitTest(model, view, 10, middle('ruler'), true)).toEqual({ kind: 'ruler' });
    expect(hitTest(model, view, 10, 9_999, true)).toBeUndefined();
  });
});

describe('applyChanges', () => {
  it('shows pending edits on top of the snapshot', () => {
    const shown = applyChanges(model.shots, cues, [
      {
        file: 'storyboard',
        edits: [{ kind: 'move-boundary', left: 's01', right: 's02', from: 2.2, to: 2.5 }],
      },
      {
        file: 'cues',
        edits: [
          { kind: 'insert-cue', track: 'sfx', index: 1, cue: { t: 5, name: 'pop', gainDb: -2 } },
          { kind: 'delete-cue', track: 'music', index: 0, at: 5 },
        ],
      },
    ]);
    expect(shown.shots.map((item) => [item.t0, item.t1])).toEqual([
      [0, 2.5],
      [2.5, 7.5],
    ]);
    expect(shown.cues.sfx).toEqual([cues.sfx[0], { t: 5, label: 'pop', gainDb: -2 }]);
    expect(shown.cues.music).toEqual([]);
  });

  it('reports where the content ends', () => {
    expect(contentEnd(model)).toBe(7.5);
  });
});

describe('track layout', () => {
  it('stacks the shown rows, every row at least 20 px; the ruler always shows', () => {
    const all = trackLayout();
    expect(all.rows.map((row) => row.id)).toEqual([
      'ruler',
      'shots',
      'narration',
      'cues',
      'audio',
      'cards',
      'ambience',
    ]);
    expect(Math.min(...all.rows.map((row) => row.height))).toBeGreaterThanOrEqual(20);
    const some = trackLayout(new Set(['narration', 'cards', 'ruler'] as const));
    expect(some.rows.map((row) => row.id)).toEqual(['ruler', 'shots', 'cues', 'audio', 'ambience']);
    expect(some.rows[2]).toMatchObject({ id: 'cues', top: 48 });
    expect(some.height).toBe(all.height - 24 - 20);
    expect(rangeLane('music', trackLayout(new Set(['ambience'] as const)))).toBeUndefined();
  });

  it('hit-tests the shown rows only', () => {
    const layout = trackLayout(new Set(['narration'] as const));
    const cues = layout.rows.find((row) => row.id === 'cues');
    expect(hitTest(model, view, 372, (cues?.top ?? 0) + 5, true, layout)).toEqual({
      kind: 'sfx',
      index: 0,
    });
  });

  it('grabs the playhead nearby, but not over a boundary or a marker', () => {
    expect(hitTest(model, view, 505, middle('audio'), true, undefined, 5)).toEqual({
      kind: 'playhead',
    });
    expect(hitTest(model, view, 512, middle('audio'), true, undefined, 5)).toEqual({
      kind: 'lane',
      track: 'audio',
    });
    expect(hitTest(model, view, 222, middle('shots'), true, undefined, 2.2)).toEqual({
      kind: 'boundary',
      left: 0,
    });
    expect(hitTest(model, view, 370, middle('cues'), true, undefined, 3.7)).toEqual({
      kind: 'sfx',
      index: 0,
    });
  });
});
