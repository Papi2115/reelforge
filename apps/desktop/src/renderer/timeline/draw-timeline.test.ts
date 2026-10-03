import type { StoryboardShot, TimedWord } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import type { CuesView } from '../../shared/snapshot-contract.js';
import { drawTimeline, fitLabel, type DrawContext, type DrawInput } from './draw-timeline.js';
import { wordParts, type TimelineModel } from './timeline-model.js';
import { fitView, zoomAround, type TimelineView } from './timeline-view.js';

/** Counts drawing calls; no pixels. */
class CountingContext implements DrawContext {
  fillStyle: DrawContext['fillStyle'] = '';
  strokeStyle: DrawContext['strokeStyle'] = '';
  lineWidth = 1;
  font = '';
  textBaseline: DrawContext['textBaseline'] = 'alphabetic';
  readonly texts: string[] = [];
  calls = 0;
  fillRect(): void {
    this.calls += 1;
  }
  strokeRect(): void {
    this.calls += 1;
  }
  fillText(text: string): void {
    this.calls += 1;
    this.texts.push(text);
  }
  beginPath(): void {
    this.calls += 1;
  }
  moveTo(): void {
    this.calls += 1;
  }
  lineTo(): void {
    this.calls += 1;
  }
  closePath(): void {
    this.calls += 1;
  }
  stroke(): void {
    this.calls += 1;
  }
  fill(): void {
    this.calls += 1;
  }
  save(): void {
    this.calls += 1;
  }
  restore(): void {
    this.calls += 1;
  }
  rect(): void {
    this.calls += 1;
  }
  clip(): void {
    this.calls += 1;
  }
  setLineDash(): void {
    this.calls += 1;
  }
}

/** A 10-minute project: ~1,700 words, 40 shots, 150 cues (PLAN.md#6.5 perf target). */
function tenMinuteProject(): TimelineModel {
  const words: TimedWord[] = [];
  for (let index = 0; index < 1_700; index += 1) {
    const t = index * 0.35;
    words.push({ text: index % 12 === 11 ? 'end.' : `word${String(index)}`, t, tEnd: t + 0.3 });
  }
  const shots: StoryboardShot[] = [];
  for (let index = 0; index < 40; index += 1) {
    const id = `s${String(index + 1).padStart(2, '0')}`;
    shots.push({
      id,
      t0: index * 15,
      t1: (index + 1) * 15,
      treatment: 'metaphor-object',
      intent: 'x',
      scene: `scenes/${id}.js`,
    });
  }
  const cues: CuesView = {
    sfx: Array.from({ length: 150 }, (_, index) => ({ t: index * 4, label: 'hit', gainDb: 0 })),
    ambience: [{ from: 0, to: 300, label: 'hum', gainDb: -6 }],
    music: [{ from: 300, to: 600, label: 'bed.wav', gainDb: 0 }],
  };
  return { shots, ...wordParts(words), cues };
}

function input(model: TimelineModel, view: TimelineView): DrawInput {
  const peaks = new Uint8Array(600 * 200).map((_, index) => index % 256);
  return {
    model,
    view,
    time: 12,
    selected: new Set(['shot:s02', 'word:3', 'cue:sfx:1']),
    waveform: { kind: 'ok', source: { peaks, peaksPerSecond: 200 } },
    hover: { kind: 'boundary', left: 0 },
    snapAt: 15,
    emptyText: { cards: 'Cards' },
  };
}

describe('drawTimeline', () => {
  const model = tenMinuteProject();
  const fit = fitView(600, 1200);

  it('draws sentences when zoomed out and only the visible words when zoomed in', () => {
    const wide = drawTimeline(new CountingContext(), input(model, fit));
    expect(wide.narration).toBe('sentences');
    const zoomed = zoomAround(fit, 80, 0);
    const close = new CountingContext();
    const stats = drawTimeline(close, input(model, zoomed));
    expect(stats.narration).toBe('words');
    // 1200 px at 160 px/s = 7.5 s on screen: a handful of shots, ~22 words, 2 cues, 1 range.
    expect(stats.items).toBeLessThan(40);
    expect(close.texts).toContain('word0');
    expect(close.texts).not.toContain('word100');
  });

  it('stays far below a 60 fps frame budget while zooming and scrolling a 10-minute project', () => {
    let view = fit;
    const started = performance.now();
    const frames = 120;
    for (let frame = 0; frame < frames; frame += 1) {
      view = frame < 60 ? zoomAround(view, 1.08, 600) : { ...view, scrollX: view.scrollX + 40 };
      drawTimeline(new CountingContext(), input(model, view));
    }
    const perFrame = (performance.now() - started) / frames;
    expect(perFrame).toBeLessThan(4);
  });

  it('draws a padlock on locked shots and keeps their label clear of it', () => {
    const shot = model.shots[0];
    if (shot === undefined) throw new Error('no shot');
    const view = zoomAround(fit, 4, 0);
    const plain = new CountingContext();
    drawTimeline(plain, input(model, view));
    const locked = new CountingContext();
    drawTimeline(locked, input({ ...model, locked: new Set([shot.id]) }, view));
    // The padlock: one filled body + one stroked shackle.
    expect(locked.calls - plain.calls).toBe(2);
  });

  it('fits labels by an average glyph width', () => {
    expect(fitLabel('calculator', 200)).toBe('calculator');
    expect(fitLabel('calculator', 40)).toBe('calc…');
    expect(fitLabel('calculator', 20)).toBe('');
  });
});
