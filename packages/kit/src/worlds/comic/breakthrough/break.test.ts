/**
 * `page.panelBreak` (PLAN.md#13.15, the Comic breakthroughs as an open toolkit) without three:
 * moves on beats (blending, chained with lag), every entrance landing on its rest place, gutters
 * that close, lift or tear, the camera inside a panel, the older sepia print of a look back,
 * palette purity and seek-order determinism, and every rule a scene author meets as a readable
 * error.
 */
import { describe, expect, it } from 'vitest';
import { createResolver } from '../../../looks/blueprint/timing.js';
import { ComicCanvas } from '../draw/canvas.js';
import { INK, INK_TABLE } from '../inks.js';
import { createStructureApi } from '../page/api.js';
import { createLetteringApi } from '../page/api-lettering.js';
import { ComicPageModel } from '../page/model.js';
import { misFor } from '../page/panel.js';
import type { ComicPen } from '../page/pen.js';
import { LANDSCAPE_PAGE, PAGE_HEIGHT, PAGE_WIDTH } from '../style.js';
import { createPanelBreak } from './break.js';
import { ENTER_DUR, poseAt, type PanelPlan } from './break-motion.js';
import { BREAK_ENTERS, breakSchema, type BreakBox } from './break-schema.js';

function testPage() {
  const seed = 7;
  const model = new ComicPageModel(seed, misFor(`page${String(seed)}`));
  const ctx = { model, resolve: createResolver(undefined, 'test'), call: 'test', seed };
  const lettering = createLetteringApi(ctx);
  const page = {
    ...createStructureApi(ctx),
    ...lettering,
    panelBreak: createPanelBreak(ctx, lettering),
  };
  const canvas = new ComicCanvas(PAGE_WIDTH, PAGE_HEIGHT);
  let checked = false;
  const frame = (t: number) => {
    if (!checked) {
      model.validate('test');
      checked = true;
    }
    model.render(canvas, t);
    return canvas.data.slice();
  };
  return { page, frame, model };
}

/** A sky over a ground with a red sun: colour families the sepia remap touches. */
const field = (g: ComicPen, _t: number, [w, h]: readonly [number, number]) => {
  g.plate.rect(0, 0, w, h * 0.6, g.tone('cyanDeep', 0.3, { on: 'night' }));
  g.plate.rect(0, h * 0.6, w, h * 0.4, 'greyLight');
  g.plate.ellipse(w * 0.7, h * 0.3, 14, 14, 'red');
};

type Box = [number, number, number, number];

const intent = 'the river moved its bed twice in one century, east and then back west';

function plan(box: BreakBox, enter: (typeof BREAK_ENTERS)[number], at = 1): PanelPlan {
  const spec = breakSchema.parse({
    intent,
    panels: [{ id: 'a', box, draw: field, enter }],
    moves: [{ target: 'a', at: 5, to: { x: 1 } }],
  }).panels[0];
  if (spec === undefined) throw new Error('no panel');
  const dur = ENTER_DUR[enter];
  const page = LANDSCAPE_PAGE;
  return { id: 'a', key: 'k', spec, box, at, until: 9, enter, from: 'left', dur, camera: [], page };
}

describe('page.panelBreak motion', () => {
  it.each(BREAK_ENTERS)('%s lands on its rest place', (enter) => {
    const box: BreakBox = [100, 60, 200, 140];
    const rest = poseAt(plan(box, 'cut'), [], undefined, 3).quad;
    const landed = poseAt(plan(box, enter), [], undefined, 1 + ENTER_DUR[enter] + 0.01).quad;
    landed.forEach((value, i) => {
      expect(Math.abs(value - (rest[i] ?? 0)), `${enter} corner ${String(i)}`).toBeLessThan(1.5);
    });
    if (enter !== 'cut') {
      const moving = poseAt(plan(box, enter), [], undefined, 1 + ENTER_DUR[enter] * 0.3).quad;
      expect(moving).not.toEqual(landed);
    }
  });

  it('moves blend in time order and a chain follows its lead with lag', () => {
    const box: BreakBox = [40, 60, 160, 120];
    const lead = { ...plan(box, 'cut'), id: 'a' };
    const follower = { ...plan([240, 60, 160, 120], 'cut'), id: 'b' };
    const moves = [
      { targets: ['a', 'b'], at: 2, dur: 0.5, ease: 'linear' as const, lag: 0.5, to: { y: 80 } },
      { targets: ['a'], at: 3, dur: 0.5, ease: 'linear' as const, lag: 0, to: { y: 0, rotate: 6 } },
    ];
    const y = (p: PanelPlan, t: number) =>
      Math.min(...poseAt(p, moves, undefined, t).quad.filter((_, i) => i % 2 === 1));
    expect(y(lead, 2.5)).toBeCloseTo(y(lead, 1) + 80, 0);
    expect(y(follower, 2.5)).toBeCloseTo(y(follower, 1), 0);
    expect(y(follower, 3)).toBeCloseTo(y(follower, 1) + 80, 0);
    expect(y(lead, 3.25)).toBeLessThan(y(lead, 2.9));
    const tilted = poseAt(lead, moves, undefined, 4).quad;
    expect(tilted[1]).not.toBeCloseTo(tilted[3] ?? 0, 0);
  });

  it('a camera inside the panel moves its content, not its frame', () => {
    const base = plan([100, 60, 200, 140], 'cut');
    const camera = [
      { at: 1, x: 40, y: 40, zoom: 1, ease: 'linear' as const },
      { at: 3, x: 150, y: 90, zoom: 2.5, ease: 'linear' as const },
    ];
    const panned = { ...base, camera };
    const [early, late] = [poseAt(panned, [], undefined, 1), poseAt(panned, [], undefined, 3)];
    expect(late.quad).toEqual(early.quad);
    expect(late.k).toBeCloseTo(2.5);
    expect(late.origin).not.toEqual(early.origin);
  });
});

describe('page.panelBreak on the page', () => {
  const panels = [
    { id: 'old', box: [30, 40, 260, 280] as Box, draw: field, enter: 'drop' as const },
    { id: 'new', box: [330, 40, 280, 280] as Box, draw: field, at: 1.2, enter: 'swing' as const },
  ];

  it('is palette-pure and a pure function of t in any seek order', () => {
    const { page, frame } = testPage();
    page.panelBreak({
      intent,
      at: 0.4,
      panels,
      moves: [{ target: ['new', 'old'], at: 2, dur: 0.8, lag: 0.3, to: { x: -20, rotate: -4 } }],
      gutters: { kind: 'lift' },
    });
    const times = [0.6, 1.5, 2.4, 3.6];
    const forward = times.map((t) => frame(t));
    const backward = [...times]
      .reverse()
      .map((t) => frame(t))
      .reverse();
    expect(backward).toEqual(forward);
    expect(new Set(forward.map((data) => data.join(','))).size).toBe(times.length);
    for (const data of forward) expect(data.every((ink) => ink < INK_TABLE.length)).toBe(true);
  });

  it('closes its gutters: the borders melt away into one picture', () => {
    const { page, frame } = testPage();
    page.panelBreak({
      intent,
      panels: panels.map((panel) => ({ ...panel, enter: 'cut' as const, at: 0 })),
      moves: [
        { target: 'old', at: 1, dur: 1, to: { box: [-10, -10, 330, 380] } },
        { target: 'new', at: 1, dur: 1, to: { box: [320, -10, 330, 380] } },
      ],
      gutters: { kind: 'close', at: 1, dur: 1 },
    });
    const inked = (data: Uint8Array) => data.filter((ink) => ink === INK.INK).length;
    expect(inked(frame(0.5))).toBeGreaterThan(inked(frame(2.5)) + 400);
  });

  it('tears its frames and prints a look back as the older sepia job', () => {
    const { page, frame } = testPage();
    page.panelBreak({
      intent,
      print: 'past',
      when: 'A CENTURY AGO...',
      panels: [{ id: 'bed', box: [160, 60, 320, 240], draw: field }],
      moves: [{ target: 'bed', at: 1, dur: 0.6, to: { scale: 1.1 } }],
      gutters: { kind: 'tear', at: 1 },
      fold: 320,
    });
    const data = frame(2);
    const at = (x: number, y: number) => data[y * PAGE_WIDTH + x] ?? -1;
    const sepia = new Set([
      INK.SEP_PAPER,
      INK.SEP_FIBRE,
      INK.SEP_TAN,
      INK.SEP_MID,
      INK.SEP_INK,
      INK.SEP_RED,
    ]);
    expect(sepia.has(at(250, 150))).toBe(true);
    expect(sepia.has(at(20, 340))).toBe(false);
  });

  it('rejects specs a scene author can fix, with readable errors', () => {
    const { page } = testPage();
    const only = { id: 'a', box: [40, 40, 200, 160] as Box, draw: field };
    const base = {
      intent,
      panels: [only],
      moves: [{ target: 'a', at: 1, to: { x: 40 } }],
    };
    expect(() => page.panelBreak({ ...base, intent: 'move' })).toThrow(/intent is required/);
    expect(() => page.panelBreak({ ...base, moves: [] })).toThrow(/give moves .* or drive/);
    expect(() =>
      page.panelBreak({ ...base, moves: [{ target: 'b', at: 1, to: { x: 1 } }] }),
    ).toThrow(/no panel 'b'/);
    expect(() => page.panelBreak({ ...base, panels: [only, only] })).toThrow(/unique/);
    expect(() =>
      page.panelBreak({ ...base, panels: [{ ...only, box: [600, 300, 200, 160] as Box }] }),
    ).toThrow(/640x360 page/);
    expect(() =>
      page.panelBreak({ ...base, at: 2, moves: [{ target: 'a', at: 1, to: { x: 1 } }] }),
    ).toThrow(/before the break/);
    expect(() => page.panelBreak({ ...base, moves: [{ target: 'a', at: 1, to: {} }] })).toThrow(
      /a move changes/,
    );
    expect(() =>
      page.panelBreak({ ...base, moves: [{ target: 'a', at: 1, to: { rotate: 40 } }] }),
    ).toThrow();
  });

  it('counts toward the five-panel cap of the page', () => {
    const { page, frame } = testPage();
    page.panels('2-up');
    page.panelBreak({
      intent,
      panels: ['a', 'b', 'c', 'd'].map((id, i) => ({
        id,
        box: [20 + i * 150, 40, 130, 120] as Box,
        draw: field,
      })),
      drive: (t) => ({ a: { y: Math.sin(t) * 4 } }),
    });
    expect(() => frame(1)).toThrow(/at most 5/);
  });
});
