import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { previewGesture, timelineKeyAction, type TimelineKey } from './timeline-gestures.js';
import { wordParts, type TimelineModel } from './timeline-model.js';
import type { TimelineView } from './timeline-view.js';

function shot(id: string, t0: number, t1: number): StoryboardShot {
  return { id, t0, t1, treatment: 'title-card', intent: 'x', scene: `scenes/${id}.js` };
}

const model: TimelineModel = {
  shots: [shot('s01', 0, 2.2), shot('s02', 2.2, 7.5)],
  ...wordParts([
    { text: 'This', t: 2.3, tEnd: 2.5 },
    { text: 'calculator', t: 2.5, tEnd: 3.1 },
  ]),
  cues: {
    sfx: [{ t: 3.7, label: 'hit', gainDb: 0 }],
    ambience: [{ from: 1, to: 4, label: 'hum', gainDb: 0 }],
    music: [],
  },
};
const view: TimelineView = { duration: 10, width: 1000, pxPerSecond: 100, scrollX: 0 };

describe('previewGesture', () => {
  it('drags a boundary with snapping (Alt off) and ignores tiny moves', () => {
    const drag = { kind: 'boundary', left: 0, startX: 220 } as const;
    expect(previewGesture(drag, model, view, 221, true).change).toBeUndefined();
    expect(previewGesture(drag, model, view, 244, true)).toEqual({
      change: {
        file: 'storyboard',
        edits: [{ kind: 'move-boundary', left: 's01', right: 's02', from: 2.2, to: 2.5 }],
      },
      snapAt: 2.5,
    });
    expect(previewGesture(drag, model, view, 244, false)).toMatchObject({
      change: { edits: [{ to: 2.44 }] },
      snapAt: undefined,
    });
  });

  it('moves grabbed cues by the pointer travel, snapping the grabbed one', () => {
    const drag = {
      kind: 'cues',
      refs: [{ track: 'sfx', index: 0 }],
      grabT: 3.7,
      startX: 370,
    } as const;
    expect(previewGesture(drag, model, view, 315, true)).toEqual({
      change: { file: 'cues', edits: [{ kind: 'move-sfx', index: 0, from: 3.7, to: 3.1 }] },
      snapAt: 3.1,
    });
  });

  it('resizes a range from its edge', () => {
    const drag = {
      kind: 'range',
      track: 'ambience',
      index: 0,
      grip: 'to',
      grabOffset: 3,
      startX: 400,
    } as const;
    expect(previewGesture(drag, model, view, 600, true).change).toEqual({
      file: 'cues',
      edits: [
        {
          kind: 'set-range',
          track: 'ambience',
          index: 0,
          from: { from: 1, to: 4 },
          to: { from: 1, to: 6 },
        },
      ],
    });
    expect(previewGesture({ kind: 'scrub' }, model, view, 600, true).change).toBeUndefined();
  });
});

describe('timelineKeyAction', () => {
  const key = (value: string, modifiers: Partial<TimelineKey> = {}): TimelineKey => ({
    key: value,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...modifiers,
  });

  it('maps undo/redo, delete, nudge, zoom and Escape', () => {
    expect(timelineKeyAction(key('z', { ctrlKey: true }), false)).toEqual({ kind: 'undo' });
    expect(timelineKeyAction(key('Z', { ctrlKey: true, shiftKey: true }), false)).toEqual({
      kind: 'redo',
    });
    expect(timelineKeyAction(key('y', { ctrlKey: true }), false)).toEqual({ kind: 'redo' });
    expect(timelineKeyAction(key('Delete'), true)).toEqual({ kind: 'delete' });
    expect(timelineKeyAction(key('ArrowRight', { shiftKey: true }), true)).toEqual({
      kind: 'nudge',
      direction: 1,
      coarse: true,
    });
    expect(timelineKeyAction(key('+'), false)).toEqual({ kind: 'zoom', direction: 1 });
    expect(timelineKeyAction(key('Escape'), false)).toEqual({ kind: 'clear-selection' });
  });

  it('leaves arrows and Delete to the player when no cue is selected', () => {
    expect(timelineKeyAction(key('ArrowLeft'), false)).toBeUndefined();
    expect(timelineKeyAction(key('Delete'), false)).toBeUndefined();
    expect(timelineKeyAction(key('ArrowLeft', { altKey: true }), true)).toBeUndefined();
  });
});
