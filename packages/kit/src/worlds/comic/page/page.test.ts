/**
 * The Comic page compositor (PLAN.md#13.3, ADR-032) without three: panels from the layout presets
 * (uneven, hand-ruled, inside the page), a frame as a pure function of t (twice the same, in any
 * seek order), palette-pure indices, entrances/morphs/cameras/clocks, lettering and the rules a
 * scene author meets as readable errors.
 */
import { describe, expect, it } from 'vitest';
import { createResolver } from '../../../looks/blueprint/timing.js';
import { ComicCanvas } from '../draw/canvas.js';
import { measure } from '../draw/text.js';
import { INK, INK_TABLE, plateRemap } from '../inks.js';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../style.js';
import { createStructureApi } from './api.js';
import { createLetteringApi, wrapLines } from './api-lettering.js';
import { LAYOUT_NAMES, layoutQuads, type Quad } from './layouts.js';
import { ComicPageModel } from './model.js';
import { misFor } from './panel.js';

function testPage(seed = 7) {
  const model = new ComicPageModel(seed, misFor(`page${String(seed)}`));
  const ctx = { model, resolve: createResolver(undefined, 'test'), call: 'test', seed };
  const page = { ...createStructureApi(ctx), ...createLetteringApi(ctx) };
  const canvas = new ComicCanvas(PAGE_WIDTH, PAGE_HEIGHT);
  const frame = (t: number) => {
    model.render(canvas, t);
    return canvas.data.slice();
  };
  return { page, model, frame };
}

/** A small page using most of the API, as a scene would build it. */
function demoPage() {
  const built = testPage();
  const { page } = built;
  const [big, top, bottom] = page.panels('3-up-l', { weights: [0.55, 0.4] });
  big?.draw((g, t) => {
    g.rect(
      0,
      0,
      640,
      360,
      g.tone('cyanDeep', (_x, y) => y / 360, { on: 'night' }),
    );
    g.ground({ x0: -20, x1: 400, horizon: 220, bottom: 360, craters: 8, key: 'g' });
    g.speedLines({ x: 160, y: 120 + t * 10, dx: 0, dy: 1 });
    g.plate.poly([120, 100, 200, 100, 200, 160, 120, 160], 'yellow');
    g.ink([120, 100, 200, 100, 200, 160, 120, 160], { key: 'box' });
  });
  top?.camera([
    { at: 0, x: 500, y: 90, zoom: 1 },
    { at: 2, x: 520, y: 80, zoom: 1.6 },
  ]);
  top?.draw((g) => {
    g.rect(300, 0, 340, 200, 'cyanDeep');
    g.digits('1202', 470, 70, { w: 7, h: 11 });
  });
  bottom?.enter({ at: 0.5, kind: 'slide', from: 'right' }).draw((g) => {
    g.rect(300, 150, 340, 210, g.dither('greyMid', 'greyLight', 0.5));
    g.blob([{ e: [500, 260, 30, 20] }, { c: [460, 250, 420, 240, 8] }], 'paper');
  });
  page.balloon("IT'S A 1202.", { x: 160, y: 60, at: 0.8, kind: 'radio', tail: [160, 110] });
  page.caption('JULY 20, 1969.', { x: 30, y: 24, at: 0.3 });
  page.sfx('BEEP', { x: 420, y: 40, at: 1.2 });
  page.note('WHAT IS 1202?', { x: 420, y: 349, at: 1.5 });
  page.arrow([500, 350], [530, 336], { at: 1.6 });
  page.thumbprint(30, 350);
  page.smudge(300, 200);
  return built;
}

describe('layout presets', () => {
  it.each(LAYOUT_NAMES)('%s: hand-ruled panels inside the page, never a perfect grid', (name) => {
    const quads = layoutQuads(name, { seed: 3 });
    expect(quads.length).toBeGreaterThanOrEqual(1);
    expect(quads.length).toBeLessThanOrEqual(5);
    for (const quad of quads) {
      expect(quad).toHaveLength(8);
      for (let i = 0; i < 8; i += 2) {
        expect(quad[i]).toBeGreaterThanOrEqual(0);
        expect(quad[i]).toBeLessThanOrEqual(PAGE_WIDTH);
        expect(quad[i + 1]).toBeGreaterThanOrEqual(0);
        expect(quad[i + 1]).toBeLessThanOrEqual(PAGE_HEIGHT);
      }
    }
    if (quads.length > 1) {
      // Uneven: no two panels share a size (panel size = importance).
      const areas = quads.map(area);
      expect(new Set(areas.map((a) => Math.round(a / 400))).size).toBe(quads.length);
    }
  });

  it('leans and varies the gutters, by seed', () => {
    const [a, b] = layoutQuads('2-up', { seed: 11 }) as [Quad, Quad];
    const gutterTop = b[0] - a[2];
    const gutterBottom = b[6] - a[4];
    expect(gutterTop).toBeGreaterThanOrEqual(4);
    expect(a[2]).not.toBe(a[4]); // the gutter leans: top and bottom x differ
    expect(layoutQuads('2-up', { seed: 12 })).not.toEqual(layoutQuads('2-up', { seed: 11 }));
    expect(layoutQuads('2-up', { seed: 11 })).toEqual([a, b]);
    expect(Math.abs(gutterTop - gutterBottom)).toBeLessThanOrEqual(4);
    // Mirrored: the big (first) panel moves to the right.
    const [big, small] = layoutQuads('2-up', { seed: 11, mirror: true }) as [Quad, Quad];
    expect(area(big)).toBeGreaterThan(area(small));
    expect(big[0]).toBeGreaterThan(small[2]);
  });

  it("offsets the 4-grid's horizontal gutters so they never line up", () => {
    const [tl, tr] = layoutQuads('4-grid', { seed: 5, weights: [0.5, 0.5, 0.5] });
    expect(Math.abs((tl?.[7] ?? 0) - (tr?.[5] ?? 0))).toBeGreaterThan(20);
  });
});

function area(quad: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < 4; i += 1) {
    const j = (i + 1) % 4;
    sum +=
      (quad[i * 2] ?? 0) * (quad[j * 2 + 1] ?? 0) - (quad[j * 2] ?? 0) * (quad[i * 2 + 1] ?? 0);
  }
  return Math.abs(sum) / 2;
}

describe('the page is a pure function of t', () => {
  it('renders the same pixels for the same t, in any seek order and after a rebuild', () => {
    const { frame } = demoPage();
    const times = [0.2, 0.9, 1.4, 2.5];
    const forward = times.map((t) => Buffer.from(frame(t)).toString('base64'));
    const backward = [...times].reverse().map((t) => Buffer.from(frame(t)).toString('base64'));
    expect(backward.reverse()).toEqual(forward);
    expect(new Set(forward).size).toBe(times.length);
    expect(Buffer.from(demoPage().frame(1.4)).toString('base64')).toBe(forward[2]);
  });

  it('paints only the comic inks', () => {
    const { frame } = demoPage();
    for (const t of [0, 1, 2.5]) {
      const used = new Set(frame(t));
      for (const index of used) expect(index).toBeLessThan(INK_TABLE.length);
      expect(used.size).toBeGreaterThan(8);
    }
  });

  it('slides a panel in from off the page and holds it in place after', () => {
    const { page } = testPage();
    const [panel] = page.panels('splash');
    panel?.enter({ at: 1, kind: 'slide', from: 'right', dur: 0.4 });
    const rest = panel?.quad(5) ?? [];
    expect(Math.min(...(panel?.quad(1) ?? []).filter((_, i) => i % 2 === 0))).toBeGreaterThan(
      PAGE_WIDTH,
    );
    expect(panel?.quad(1.6)).toEqual(rest);
  });

  it('morphs gutters, runs a panel clock and moves a panel camera', () => {
    const { page } = testPage();
    const quad = [20, 20, 300, 20, 300, 200, 20, 200];
    const panel = page.panel(quad);
    panel.morph([10, 10, 320, 10, 320, 210, 10, 210], { at: 1, dur: 1 });
    expect(panel.quad(0)).toEqual(quad);
    expect(panel.quad(2)).toEqual([10, 10, 320, 10, 320, 210, 10, 210]);
    panel.camera([
      { at: 0, x: 160, y: 110, zoom: 1 },
      { at: 1, x: 100, y: 110, zoom: 2 },
    ]);
    expect(panel.toPage(160, 110, 0)).toEqual([160, 110]);
    const [x] = panel.toPage(100, 110, 1);
    expect(x).toBeCloseTo(panel.toPage(100, 110, 1)[0]);
    expect(panel.toPage(110, 110, 1)[0] - panel.toPage(100, 110, 1)[0]).toBeCloseTo(20);
  });

  it('prints the plates one by one in the press intro', () => {
    const { page, frame } = testPage();
    page.panels('splash')[0]?.draw((g) => {
      g.rect(0, 0, 640, 360, 'night');
    });
    page.press({ at: 0.1, step: 0.2, order: 'YCMK' });
    expect(new Set(frame(0))).not.toContain(INK.NIGHT);
    expect(new Set(frame(0.35))).toContain(INK.CYAN_D);
    expect(new Set(frame(1))).toContain(INK.NIGHT);
    expect(plateRemap('YCMK')[INK.RED]).toBe(INK.RED);
    expect(plateRemap('Y')[INK.RED]).toBe(INK.PAPER);
  });
});

describe('lettering', () => {
  it('wraps balloon text at the width and keeps explicit breaks', () => {
    const lines = wrapLines('give us a reading on the 1202 program alarm', 100);
    expect(lines.join(' ')).toBe('GIVE US A READING ON THE 1202 PROGRAM ALARM');
    expect(lines.length).toBeGreaterThan(2);
    for (const line of lines) expect(measure('hand', line, 1, true)).toBeLessThanOrEqual(100);
    expect(wrapLines('A\nB C', 200)).toEqual(['A', 'B C']);
  });

  it('pops balloons in on time and keeps the page paper before', () => {
    const { page, frame } = testPage();
    page.balloon('GO.', { x: 320, y: 180, at: 1 });
    expect(new Set(frame(0.5))).not.toContain(INK.INK);
    expect(new Set(frame(1.5))).toContain(INK.INK);
  });
});

describe('scene-author errors', () => {
  it('names the comic inks for an unknown colour', () => {
    const { page, frame } = testPage();
    page.panels('splash')[0]?.draw((g) => {
      g.rect(0, 0, 10, 10, 'teal');
    });
    expect(() => {
      frame(0);
    }).toThrow(/unknown colour "teal"; comic inks: ink, night, paper/);
  });

  it('caps the page at five panels at once', () => {
    const { page, model } = testPage();
    for (let i = 0; i < 6; i += 1)
      page.panel([i * 100, 0, i * 100 + 90, 0, i * 100 + 90, 90, i * 100, 90]);
    expect(() => {
      model.validate('test');
    }).toThrow(/6 panels on the page at once/);
    const { page: timed, model: timedModel } = testPage();
    for (let i = 0; i < 6; i += 1) {
      const panel = timed.panel([i * 100, 0, i * 100 + 90, 0, i * 100 + 90, 90, i * 100, 90]);
      if (i === 0) panel.exit(1);
      if (i === 5) panel.enter({ at: 1 });
    }
    expect(() => {
      timedModel.validate('test');
    }).not.toThrow();
  });

  it('rejects unknown layouts and bad quads', () => {
    const { page } = testPage();
    expect(() => {
      page.panels('6-grid' as never);
    }).toThrow(/layouts are splash, 2-up/);
    expect(() => {
      page.panel([0, 0, 1]);
    }).toThrow(/a quad is 8 numbers/);
  });
});
