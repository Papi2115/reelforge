/**
 * The Comic breakthrough toolkits (PLAN.md#13.3 part b) without three: `page.flashback` (an
 * older sepia print job, palette-pure, beats revealed panel by panel, a page or a pasted strip)
 * and `page.spread` (one picture across the fold, three assemblies, insets, the 4 s hold rule),
 * pure functions of t in any seek order, and every rule a scene author meets as a readable error.
 */
import { describe, expect, it } from 'vitest';
import { createResolver } from '../../../looks/blueprint/timing.js';
import { ComicCanvas } from '../draw/canvas.js';
import { INK, SEPIA } from '../inks.js';
import { createStructureApi } from '../page/api.js';
import { createLetteringApi } from '../page/api-lettering.js';
import { ComicPageModel } from '../page/model.js';
import { misFor, type Painter } from '../page/panel.js';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../style.js';
import { beatQuads } from './flashback-layout.js';
import { FLASHBACK_ARRANGES } from './flashback-schema.js';
import { createFlashback } from './flashback.js';
import { createSpread } from './spread.js';

function testPage(duration?: number) {
  const seed = 11;
  const model = new ComicPageModel(seed, misFor(`page${String(seed)}`));
  const ctx = { model, resolve: createResolver(undefined, 'test'), call: 'test', seed, duration };
  const lettering = createLetteringApi(ctx);
  const page = {
    ...createStructureApi(ctx),
    ...lettering,
    flashback: createFlashback(ctx, lettering),
    spread: createSpread(ctx),
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
  return { page, frame };
}

/** Night sky over a grey ground with a red mark: every colour family the remap touches. */
const scenery: Painter = (g) => {
  g.rect(-10, -10, 660, 200, g.tone('cyanDeep', 0.3, { on: 'night' }));
  g.plate.rect(-10, 190, 660, 200, g.tone('greyMid', 0.3, { on: 'greyLight' }));
  g.plate.rect(300, 150, 30, 30, 'red');
  g.ink([300, 150, 330, 150, 330, 180, 300, 180], { key: 'mark' });
};

const beats = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ at: 0.5 + i * 0.6, draw: scenery }));

const SEPIA_SET = new Set(
  ['SEP_PAPER', 'SEP_FIBRE', 'SEP_TAN', 'SEP_MID', 'SEP_INK', 'SEP_RED'].map(
    (name) => INK[name as keyof typeof INK],
  ),
);

function inks(data: Uint8Array): Set<number> {
  return new Set(data);
}

describe('page.flashback', () => {
  const intent = 'the goal was set eight years before the landing';

  it('re-inks the whole page as the sepia print job (cover page), palette-pure', () => {
    const { page, frame } = testPage();
    page.panels('2-up')[0]?.draw(scenery);
    page.flashback({
      intent,
      when: 'EIGHT YEARS EARLIER...',
      at: 0.2,
      beats: beats(3),
      stamp: { text: '1961', at: 1.2 },
    });
    const before = frame(0.1);
    expect([...inks(before)].some((ink) => !SEPIA_SET.has(ink))).toBe(true);
    const during = frame(2.5);
    expect([...inks(during)].every((ink) => SEPIA_SET.has(ink))).toBe(true);
    expect(during.includes(INK.SEP_RED)).toBe(true);
    expect(SEPIA[INK.RED]).toBe(INK.SEP_RED);
  });

  it('pastes a torn sepia strip over a present page that stays in colour (cover strip)', () => {
    const { page, frame } = testPage();
    page.panels('splash')[0]?.draw(scenery);
    page.flashback({
      intent,
      when: 'SEPTEMBER 9, 1947.',
      cover: 'strip',
      arrange: 'row',
      beats: beats(3),
    });
    const data = frame(3);
    const at = (x: number, y: number) => data[y * PAGE_WIDTH + x] ?? -1;
    expect(SEPIA_SET.has(at(320, 180))).toBe(true);
    expect(SEPIA_SET.has(at(320, 20))).toBe(false);
    expect(data.includes(INK.NIGHT)).toBe(true);
  });

  it('reveals the beats panel by panel and is a pure function of t in any seek order', () => {
    const { page, frame } = testPage();
    page.flashback({ intent, when: 'MEANWHILE...', arrange: 'stair', beats: beats(4) });
    const times = [0.4, 1.2, 1.8, 2.6];
    const forward = times.map((t) => Buffer.from(frame(t)).toString('base64'));
    const backward = [...times].reverse().map((t) => Buffer.from(frame(t)).toString('base64'));
    expect(backward.reverse()).toEqual(forward);
    expect(new Set(forward).size).toBe(times.length);
  });

  it.each(FLASHBACK_ARRANGES)(
    '%s: beats inside the page, one panel each, never a grid',
    (arrange) => {
      const quads = beatQuads(arrange, [26, 30, 614, 344], [1, 2, 1, 1], 'k');
      expect(quads).toHaveLength(4);
      for (const quad of quads) {
        for (let i = 0; i < 8; i += 2) {
          expect(quad[i]).toBeGreaterThan(-30);
          expect(quad[i]).toBeLessThan(PAGE_WIDTH + 30);
        }
      }
      expect(new Set(quads.map((quad) => Math.round(quad[2] - quad[0]))).size).toBeGreaterThan(1);
    },
  );

  it('rejects specs a scene author can fix, with readable errors', () => {
    const { page } = testPage();
    const base = { intent, when: 'EIGHT YEARS EARLIER...', beats: beats(2) };
    expect(() => page.flashback({ ...base, intent: '' })).toThrow(/intent is required/);
    expect(() => page.flashback({ ...base, beats: beats(6) })).toThrow(/at most 5 beats/);
    const swapped = [
      { at: 2, draw: scenery },
      { at: 1, draw: scenery },
    ];
    expect(() => page.flashback({ ...base, beats: swapped })).toThrow(/narration order/);
    expect(() => page.flashback({ ...base, until: 1.0 })).toThrow(/until/);
    expect(() => page.flashback({ ...base, box: [0, 0, 50, 50] })).toThrow(/box/);
    expect(() => page.flashback({ ...base, intent: 'EIGHT YEARS EARLIER...' })).toThrow(/claim/);
  });
});

describe('page.spread', () => {
  const intent = 'the landing site is one wide quiet plain';

  it.each(['merge', 'unfold', 'pull-back'] as const)(
    '%s: assembles into one picture with a crease, pure in t',
    (assemble) => {
      const { page, frame } = testPage(6);
      page.spread({ intent, art: scenery, assemble, beats: [3.5] });
      const mid = frame(0.7);
      const end = frame(3);
      expect(Buffer.from(frame(0.7)).equals(Buffer.from(mid))).toBe(true);
      // Whole: the picture bleeds off every edge (no paper margin left), the crease is down the fold.
      expect(end[2 * PAGE_WIDTH + 2]).not.toBe(INK.PAPER);
      expect(end[(PAGE_HEIGHT - 3) * PAGE_WIDTH + PAGE_WIDTH - 3]).not.toBe(INK.PAPER);
      expect(Buffer.from(mid).equals(Buffer.from(end))).toBe(false);
    },
  );

  it('holds at most 4 s without a new beat; insets, notes and declared beats count', () => {
    const silent = testPage(9);
    silent.page.spread({ intent, art: scenery });
    expect(() => silent.frame(1)).toThrow(/holds still for 7\.6 s .*at most 4 s/);
    const voiced = testPage(9);
    voiced.page.spread({ intent, art: scenery, beats: [4.5] });
    voiced.page.note('SEA OF TRANQUILITY', { x: 334, y: 40, at: 7 });
    expect(() => voiced.frame(1)).not.toThrow();
  });

  it('rejects specs a scene author can fix, with readable errors', () => {
    const { page } = testPage();
    const base = { intent, art: scenery, until: 6 };
    expect(() => page.spread({ intent, art: scenery })).toThrow(/give until/);
    expect(() => page.spread({ ...base, intent: 'x' })).toThrow(/intent is required/);
    const inset = {
      box: [400, 40, 160, 100] as [number, number, number, number],
      at: 0.5,
      draw: scenery,
    };
    expect(() => page.spread({ ...base, insets: [inset] })).toThrow(/before the spread is whole/);
    const late = { ...inset, at: 2 };
    expect(() => page.spread({ ...base, insets: [late, late, late, late] })).toThrow(
      /at most 3 insets/,
    );
    expect(() => page.spread({ ...base, until: 1.5 })).toThrow(/0\.5 s after it assembles/);
  });
});

describe('page.stamp and typed captions', () => {
  it('slams a worn stamp in its ink and letters a caption in over its type time', () => {
    const { page, frame } = testPage();
    page.stamp('1202', { x: 320, y: 180, at: 0.2 });
    page.caption('EIGHT YEARS EARLIER...', { x: 40, y: 40, at: 1, type: 0.6 });
    const stamped = frame(0.5);
    expect(stamped.includes(INK.RED)).toBe(true);
    const typing = frame(1.2);
    const typed = frame(1.8);
    const inked = (data: Uint8Array) => data.filter((ink) => ink === INK.INK).length;
    expect(inked(typed)).toBeGreaterThan(inked(typing));
    expect(() => page.stamp('TOO LONG TO STAMP', { x: 0, y: 0, at: 0 })).toThrow(/1-8 letters/);
  });
});
