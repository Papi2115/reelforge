/**
 * The Comic page in a portrait short (PLAN.md#13.18): a 360x640 page from a frame taller than
 * wide, layout presets stacked down the page (landscape presets stood upright, the stack presets
 * as named), `page.flow` reading down by default, phone lettering kept in the safe box, spreads
 * without a spine; landscape pages are ruled exactly as before.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../../kit.js';
import { createResolver } from '../../../looks/blueprint/timing.js';
import type { KitPalette } from '../../../types.js';
import { testRng } from '../../../testing/rng.js';
import { ComicCanvas } from '../draw/canvas.js';
import { INK } from '../inks.js';
import {
  COMIC_STYLE,
  LANDSCAPE_PAGE,
  PORTRAIT_PAGE,
  pageSafeBox,
  pageSizeFor,
  type PageSize,
} from '../style.js';
import { createStructureApi } from './api.js';
import { createLetteringApi } from './api-lettering.js';
import type { ComicPageObject } from './comic-page.js';
import { flowBoxes } from './flow.js';
import { LAYOUT_NAMES, layoutQuads, type Quad } from './layouts.js';
import { ComicPageModel } from './model.js';
import { misFor } from './panel.js';
import { balloonBox, safePlace } from './safe.js';

const PALETTE: KitPalette = (() => {
  const swatches: Readonly<Record<string, string>> = COMIC_STYLE.palette;
  const tokens = Object.fromEntries(
    Object.entries(COMIC_STYLE.tokens).map(([token, swatch]) => [token, swatches[swatch] ?? '']),
  );
  return { ...swatches, ...tokens };
})();

function comicPage(frame: PageSize): ComicPageObject {
  const { api } = createKit({
    three: THREE,
    palette: PALETTE,
    rng: testRng(5),
    style: 'comic',
    frame,
  });
  const factory = (api.fx as Record<string, (params: unknown) => unknown>)['comicPage'];
  if (factory === undefined) throw new Error('comicPage is not bound');
  return factory({ seed: 9, duration: 6 }) as ComicPageObject;
}

function modelPage(page: PageSize, seed = 7) {
  const model = new ComicPageModel(seed, misFor(`page${String(seed)}`), page);
  const ctx = { model, resolve: createResolver(undefined, 'test'), call: 'test', seed };
  const api = { ...createStructureApi(ctx), ...createLetteringApi(ctx) };
  const canvas = new ComicCanvas(page.width, page.height);
  return { api, model, canvas };
}

const box = (quad: Quad) => {
  const xs = quad.filter((_, i) => i % 2 === 0);
  const ys = quad.filter((_, i) => i % 2 === 1);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

describe('portrait page size', () => {
  it('is 360x640 for a frame taller than wide, else the landscape page', () => {
    expect(pageSizeFor({ width: 360, height: 640 })).toEqual(PORTRAIT_PAGE);
    expect(pageSizeFor({ width: 1080, height: 1920 })).toEqual({ width: 360, height: 640 });
    expect(pageSizeFor({ width: 640, height: 360 })).toEqual(LANDSCAPE_PAGE);
    expect(pageSizeFor(undefined)).toEqual(LANDSCAPE_PAGE);
  });

  it('keeps key content in the central 80 %, below the top 12 %, above the bottom 20 %', () => {
    expect(pageSafeBox(PORTRAIT_PAGE)).toEqual([36, 77, 288, 435]);
    expect(pageSafeBox(LANDSCAPE_PAGE)).toEqual([0, 0, 640, 360]);
  });

  it('builds the page for the frame: size, format and safe box', () => {
    const portrait = comicPage({ width: 360, height: 640 });
    expect(portrait.size).toEqual([360, 640]);
    expect(portrait.format).toBe('portrait');
    expect(portrait.safe).toEqual([36, 77, 288, 435]);
    const landscape = comicPage({ width: 640, height: 360 });
    expect(landscape.size).toEqual([640, 360]);
    expect(landscape.format).toBe('landscape');
  });
});

describe('portrait layout presets', () => {
  it.each(LAYOUT_NAMES)('%s: hand-ruled panels inside the 360x640 page', (name) => {
    const quads = layoutQuads(name, { seed: 3, page: PORTRAIT_PAGE });
    expect(quads.length).toBeGreaterThanOrEqual(1);
    for (const quad of quads) {
      const b = box(quad);
      expect(b.x0).toBeGreaterThanOrEqual(0);
      expect(b.x1).toBeLessThanOrEqual(360);
      expect(b.y0).toBeGreaterThanOrEqual(0);
      expect(b.y1).toBeLessThanOrEqual(640);
    }
  });

  it.each(['2-up', 'strip', '2-stack', '3-stack'] as const)(
    '%s stacks its panels down the page, each the page wide',
    (name) => {
      const boxes = layoutQuads(name, { seed: 4, page: PORTRAIT_PAGE }).map(box);
      boxes.forEach((b, i) => {
        expect(b.x1 - b.x0, `${name} panel ${String(i)}`).toBeGreaterThan(300);
        const next = boxes[i + 1];
        if (next !== undefined) expect(next.y0).toBeGreaterThan(b.y1 - 8);
      });
    },
  );

  it('splash-strip is a tall splash over two small panels; stagger zig-zags', () => {
    const [splash, left, right] = layoutQuads('splash-strip', { seed: 2, page: PORTRAIT_PAGE }).map(
      box,
    );
    expect(splash && left && right).toBeTruthy();
    if (!splash || !left || !right) return;
    expect(splash.y1 - splash.y0).toBeGreaterThan(360);
    expect(left.y0).toBeGreaterThan(splash.y1);
    expect(left.x1).toBeLessThan(right.x0 + 8);
    const rows = layoutQuads('stagger', { seed: 2, page: PORTRAIT_PAGE }).map(box);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.x0).toBeLessThan(rows[1]?.x0 ?? 0);
    expect(rows[1]?.x1).toBeGreaterThan(rows[2]?.x1 ?? 0);
  });

  it('rules landscape pages exactly as before (an explicit landscape page changes nothing)', () => {
    for (const name of LAYOUT_NAMES) {
      for (const mirror of [false, true]) {
        expect(layoutQuads(name, { seed: 6, mirror, page: LANDSCAPE_PAGE })).toEqual(
          layoutQuads(name, { seed: 6, mirror }),
        );
      }
    }
  });

  it('mirrors a portrait preset left-right on the 360-px page', () => {
    const plain = layoutQuads('splash-strip', { seed: 8, page: PORTRAIT_PAGE });
    const mirrored = layoutQuads('splash-strip', { seed: 8, page: PORTRAIT_PAGE, mirror: true });
    expect(box(mirrored[1] as Quad).x0).toBe(360 - box(plain[1] as Quad).x1);
  });
});

describe('portrait page flow', () => {
  it("reads 'down' a column inside the page width, each panel's foot at 80 % of the frame", () => {
    const { boxes, centres } = flowBoxes('down', [1, 1.4, 1], undefined, 12, PORTRAIT_PAGE);
    boxes.forEach(([x, , w], i) => {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(360);
      if (i > 0) expect(boxes[i]?.[1]).toBeGreaterThan(boxes[i - 1]?.[1] ?? 0);
    });
    const [, y, , h] = boxes[2] ?? [0, 0, 0, 0];
    const centre = centres[2]?.[1] ?? 0;
    expect(y + h + 16 - (centre - 320)).toBeCloseTo(640 * 0.8, 5);
  });

  it('defaults to down on a portrait page and asks for a direction on a landscape one', () => {
    const intent = 'the page reads downward the way the water falls into the well';
    const beat = (at: number) => ({ at, draw: () => undefined });
    const portrait = comicPage({ width: 360, height: 640 });
    const { boxes } = portrait.flow({ intent, beats: [beat(0), beat(1), beat(2)] });
    expect(boxes[1]?.[1]).toBeGreaterThan(boxes[0]?.[1] ?? 0);
    const landscape = comicPage({ width: 640, height: 360 });
    expect(() => landscape.flow({ intent, beats: [beat(0), beat(1)] })).toThrow(/direction/);
  });
});

describe('portrait lettering and breakthroughs', () => {
  it('letters at size 2 and nudges balloons and captions into the safe box', () => {
    const { api } = modelPage(PORTRAIT_PAGE);
    expect(api.caption('THE TIDE TURNS.', { x: 300, y: 600, at: 0 }).height).toBe(2 * 10 + 14);
    const lines = ['THE TIDE', 'TURNS!'];
    const b = balloonBox(lines, 2);
    const [x, y] = safePlace(PORTRAIT_PAGE, [350, 630], b, true);
    expect(x + b.w / 2).toBeLessThanOrEqual(324);
    expect(y + b.h / 2).toBeLessThanOrEqual(512);
    // A reading camera moves the page: only the width is clamped then.
    expect(safePlace(PORTRAIT_PAGE, [350, 630], b, false)[1]).toBe(630);
    expect(safePlace(LANDSCAPE_PAGE, [630, 350], b, true)).toEqual([630, 350]);
  });

  it('renders a stacked page with lettering, deterministic for t', () => {
    const { api, model, canvas } = modelPage(PORTRAIT_PAGE);
    for (const panel of api.panels('3-stack')) {
      panel.draw((g) => {
        g.plate.rect(0, 0, 360, 640, 'cyanDeep');
      });
    }
    api.balloon('HOLD ON!', { x: 340, y: 40, at: 0.2, tail: [200, 300] });
    const frame = (t: number) => {
      model.render(canvas, t);
      return canvas.data.slice();
    };
    const first = frame(1);
    frame(0.1);
    expect(frame(1)).toEqual(first);
    expect(first.length).toBe(360 * 640);
    const inked = first.filter((index) => index === INK.INK).length;
    expect(inked).toBeGreaterThan(1000);
  });

  it('spreads become a tall splash: the landscape spine is off the portrait page', () => {
    const page = comicPage({ width: 360, height: 640 });
    const art = () => undefined;
    const spec = { intent: 'the whole herd crosses the plain at once', art, assemble: 'unfold' };
    expect(() => page.spread({ ...spec, fold: 320 } as Parameters<typeof page.spread>[0])).toThrow(
      /fold/,
    );
    const done = page.spread(spec as Parameters<typeof page.spread>[0]);
    expect(done.assembled).toBeGreaterThan(done.at);
  });
});
