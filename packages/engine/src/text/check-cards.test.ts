import { describe, expect, it } from 'vitest';
import { NO_ANCHORS } from '../anchors.js';
import type { SceneContext } from '../contract.js';
import { toSceneModule } from '../scene-module.js';
import { buildShot } from '../shot.js';
import { resolveStyle } from '../style.js';
import {
  checkCards,
  collectCardTimeline,
  formatCardDiagnostics,
  type ShotCardTimeline,
} from './check-cards.js';
import type { TextCard } from './types.js';

function timelineOf(update: (t: number, ctx: SceneContext) => void): ShotCardTimeline {
  const shot = buildShot({
    shot: { id: 's07', t0: 0, duration: 4, width: 640, height: 360, fps: 10 },
    module: {
      meta: { id: 's07' },
      build: () => null,
      update: (t, _state, ctx) => {
        update(t, ctx);
      },
    },
    projectSeed: 1,
    palette: resolveStyle({}).palette,
    resolveAnchor: NO_ANCHORS,
  });
  return collectCardTimeline(shot);
}

const EXAMPLE_SCENE = new URL('../../examples/s01_text.js', import.meta.url);

function card(id: string, box: TextCard['box']): TextCard {
  return { id, kind: 'title', text: id, box, at: 0, until: Infinity, visible: true };
}

describe('checkCards', () => {
  it('reports cards that overlap while both are on screen, with ids and time range', () => {
    const timeline = timelineOf((_t, ctx) => {
      ctx.text.title('BIG TITLE', { id: 'headline', pos: [0.3, 0.88], at: 0, until: 3 });
      ctx.text.lowerThird('Papi Kowalski', 'host', { id: 'name', at: 1 });
    });
    const diagnostics = checkCards(timeline);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      rule: 'card-overlap',
      severity: 'error',
      shotId: 's07',
      cards: ['headline', 'name'],
      t0: 1,
      t1: 3,
    });
    expect(diagnostics[0]?.message).toMatch(
      /^cards "headline" and "name" overlap by \d+x\d+ px \(x \d+–\d+, y \d+–\d+\) during t=1\.00–3\.00 s of shot s07$/,
    );
    expect(formatCardDiagnostics(diagnostics)).toMatch(/^\[card-overlap\] .*\. Fix: Move one card/);
  });

  it('does not report cards that are apart in space or in time', () => {
    const apart = timelineOf((_t, ctx) => {
      ctx.text.title('TOP', { pos: [0.5, 0.25] });
      ctx.text.lowerThird('Papi Kowalski', 'host');
    });
    expect(checkCards(apart)).toEqual([]);
    const sequential = timelineOf((_t, ctx) => {
      ctx.text.title('FIRST', { until: 2 });
      ctx.text.title('SECOND', { at: 2 });
    });
    expect(checkCards(sequential)).toEqual([]);
  });

  it('reports cards outside the safe area with the sides and amounts', () => {
    const timeline = timelineOf((_t, ctx) => {
      ctx.text.title('EDGE', { id: 'edge', pos: [0, 0.5], align: 'left', until: 2.5 });
    });
    const [diagnostic, ...rest] = checkCards(timeline);
    expect(rest).toEqual([]);
    expect(diagnostic).toMatchObject({ rule: 'card-outside-safe-area', cards: ['edge'], t0: 0 });
    expect(diagnostic?.t1).toBeCloseTo(2.5);
    expect(diagnostic?.message).toMatch(
      /card "edge" extends outside the safe area \(x 32–608, y 18–342 of 640x360\) during t=0\.00–2\.50 s of shot s07: 32 px past the left edge$/,
    );
    const clipped = timelineOf((_t, ctx) => {
      ctx.text.title('OFF', { id: 'off', pos: [-0.05, 0.5], align: 'left' });
    });
    expect(checkCards(clipped)[0]?.message).toMatch(/past the left edge; part of it is cut off/);
  });

  it('splits a problem into separate time ranges when it stops and starts again', () => {
    const boxA = { x: 100, y: 100, w: 50, h: 20 };
    const boxB = { x: 120, y: 110, w: 50, h: 20 };
    const frames = [0, 1, 2, 3].map((t) => ({
      t,
      cards: t === 1 ? [card('a', boxA)] : [card('a', boxA), card('b', boxB)],
    }));
    const diagnostics = checkCards({
      shotId: 'x',
      width: 640,
      height: 360,
      safeArea: { x: 32, y: 18, w: 576, h: 324 },
      duration: 4,
      step: 1,
      frames,
    });
    expect(diagnostics.map((item) => [item.rule, item.t0, item.t1])).toEqual([
      ['card-overlap', 0, 1],
      ['card-overlap', 2, 4],
    ]);
    expect(diagnostics[0]?.message).toContain('overlap by 30x10 px (x 120–150, y 110–120)');
  });

  it('passes the example text scene (examples/s01_text.js) in every preset size', async () => {
    const namespace: unknown = await import(EXAMPLE_SCENE.href);
    for (const [width, height] of [
      [640, 360],
      [480, 270],
    ] as const) {
      const shot = buildShot({
        shot: { id: 's01', t0: 0, duration: 6, width, height, fps: 30 },
        module: toSceneModule(namespace, 'examples/s01_text.js', 's01'),
        projectSeed: 2115,
        palette: resolveStyle({}).palette,
        resolveAnchor: NO_ANCHORS,
      });
      const timeline = collectCardTimeline(shot);
      expect(formatCardDiagnostics(checkCards(timeline))).toBe('');
      expect(
        new Set(timeline.frames.flatMap((frame) => frame.cards.map((item) => item.id))),
      ).toEqual(new Set(['title', 'name', 'question']));
    }
  });
});
