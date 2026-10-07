/**
 * Panel layout by beats and the empty-panel audit (PLAN.md#13.15a, real run Comic 1: presets
 * used 0/13 times, five pages opened on empty ruled panels): the suggestion follows the number
 * and importance of beats, `page.layout` returns panels in beat order with their backdrops drawn
 * from the first frame they show, and the audit finds an empty ruled panel.
 */
import { describe, expect, it } from 'vitest';
import { createResolver } from '../../../looks/blueprint/timing.js';
import { ComicCanvas } from '../draw/canvas.js';
import { createStructureApi } from '../page/api.js';
import { ComicPageModel } from '../page/model.js';
import { misFor } from '../page/panel.js';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../style.js';
import { createArt } from './api.js';
import { suggestLayout } from './layout.js';

function testPage(seed = 3) {
  const model = new ComicPageModel(seed, misFor(`page${String(seed)}`));
  const ctx = { model, resolve: createResolver(undefined, 'test'), call: 'test', seed };
  const structure = createStructureApi(ctx);
  const open = createArt(ctx, (layout, options) => structure.panels(layout, options));
  const canvas = new ComicCanvas(PAGE_WIDTH, PAGE_HEIGHT);
  const frame = (t: number) => {
    model.validate('test');
    model.render(canvas, t);
    return canvas.data.slice();
  };
  return { ...structure, ...open, model, frame };
}

describe('suggestLayout', () => {
  it.each([
    [[1], 'splash', false],
    [[1, 1], '2-up', false],
    [[1, 3], 'splash-inset', false],
    [[2, 1, 1], '3-up-l', false],
    [[1, 1, 2], '3-up-l', true],
    [[1, 2, 1], 'strip', false],
    [[1, 1, 1], 'strip', false],
    [[2, 1, 1, 1], '4-l', false],
    [[1, 1, 1, 2.5], '4-l', true],
    [[1, 1, 1, 1], '4-grid', false],
  ] as const)('%j -> %s (mirror %s)', (weights, layout, mirror) => {
    const suggestion = suggestLayout(weights);
    expect(suggestion.layout).toBe(layout);
    expect(suggestion.mirror).toBe(mirror);
    expect([...suggestion.order].sort()).toEqual(weights.map((_, i) => i));
    expect(suggestion.why.length).toBeGreaterThan(10);
  });

  it('gives the dominant beat the biggest panel', () => {
    for (const weights of [
      [1, 1, 2],
      [2, 1, 1],
      [1, 3],
      [1, 1, 1, 2.5],
      [1, 2, 1],
    ]) {
      const page = testPage();
      const panels = page.layout(weights.map((weight) => ({ weight, backdrop: 'meadow' })));
      const areas = panels.map((panel) => panel.box[2] * panel.box[3]);
      const big = weights.indexOf(Math.max(...weights));
      expect(Math.max(...areas), JSON.stringify(weights)).toBe(areas[big]);
    }
  });

  it('refuses 0 or more than 4 beats, naming the way out', () => {
    expect(() => suggestLayout([])).toThrow(/1-4 beats/);
    expect(() => suggestLayout([1, 1, 1, 1, 1])).toThrow(/second page or panel\(\) quads/);
  });
});

describe('page.layout', () => {
  it("reveal 'page': the whole page from the first frame, each subject on its beat", () => {
    const page = testPage();
    const [a, b] = page.layout([
      { at: 0, weight: 2, backdrop: 'forest' },
      { at: 1, backdrop: { preset: 'desert', time: 'dusk' } },
    ]);
    expect(a?.box[0]).toBeLessThan(b?.box[0] ?? 0);
    let drawnAt: number | undefined;
    b?.draw((_g, t) => {
      drawnAt ??= t;
    });
    page.frame(0.2);
    expect(drawnAt).toBeUndefined();
    expect(page.model.panels.every((panel) => panel.visible(0))).toBe(true);
    page.frame(1.2);
    expect(drawnAt).toBe(1.2);
    expect(page.audit({ until: 3 }).emptyPanels).toEqual([]);
  });

  it("reveal 'beats': panels enter on their beats over their pencil roughs", () => {
    const page = testPage();
    page.layout(
      [
        { at: 0, weight: 2, backdrop: 'forest' },
        { at: 1, backdrop: 'ocean', enter: 'slam' },
      ],
      { reveal: 'beats' },
    );
    const [, second] = page.model.panels;
    expect(second?.visible(0.5)).toBe(false);
    expect(second?.roughVisible(0.5)).toBe(true);
    expect(second?.enter?.kind).toBe('slam');
    expect(page.frame(0.5)).not.toEqual(page.frame(1.2));
  });

  it('accepts a beat painted later, but not a beat that never gets anything', () => {
    const later = testPage();
    const [panel] = later.layout([{ at: 0 }]);
    panel?.draw((g) => {
      g.rect(0, 0, 640, 360, g.tone('cyan', 0.4, { on: 'paper' }));
    });
    expect(() => later.frame(0)).not.toThrow();
    const never = testPage();
    never.layout([{ at: 0, backdrop: 'ocean' }, { at: 1 }]);
    expect(() => never.frame(0)).toThrow(/beat 2: nothing to draw/);
  });

  it('validates backdrops when the page is built, not mid-shot', () => {
    expect(() => testPage().layout([{ backdrop: 'jungle' }])).toThrow(
      /neither a defined id .* nor a preset \(forest, meadow/,
    );
    expect(() => testPage().layout([{ backdrop: { preset: 'city', horizon: 2 } }])).toThrow(
      /horizon/,
    );
  });

  it('draws a defined backdrop into the panel box', () => {
    const page = testPage();
    page.art.defineBackdrop('reef', {
      layers: [
        { gen: 'sky', kind: 'underwater' },
        { gen: 'land', kind: 'seabed' },
      ],
    });
    page.layout([{ backdrop: 'reef' }, { at: 0.5, backdrop: 'reef' }]);
    expect(page.audit({ until: 2 }).emptyPanels).toEqual([]);
  });
});

describe('page.audit', () => {
  it('finds a ruled panel left empty for more than 0.6 s', () => {
    const page = testPage();
    const [left, right] = page.panels('2-up');
    left?.draw((g) => {
      g.rect(0, 0, 640, 360, g.tone('cyan', 0.4, { on: 'paper' }));
    });
    right?.draw((g, t) => {
      if (t > 1.5) g.rect(0, 0, 640, 360, g.tone('red', 0.4, { on: 'paper' }));
    });
    const [empty, ...others] = page.audit({ until: 3 }).emptyPanels;
    expect(others).toEqual([]);
    expect(empty?.panel).toBe(2);
    expect(empty?.from).toBe(0);
    expect(empty?.to).toBeGreaterThan(1.4);
    expect(empty?.to).toBeLessThan(1.7);
    expect(page.audit({ until: 3, longest: 2 }).emptyPanels).toEqual([]);
  });
});
