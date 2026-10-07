/**
 * `page.flow` and `page.thread` (PLAN.md#13.15, the Comic page unfolding in different directions
 * and carrying things across panels): strips that run across, down or diagonally, a camera that
 * reads them (hold, travel, hold), threads over three or more panels, the two examples p1/p2
 * palette-pure and pure in t, and every rule as a readable error.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createResolver } from '../../../looks/blueprint/timing.js';
import { createArt } from '../art/api.js';
import { ComicCanvas } from '../draw/canvas.js';
import { INK_TABLE } from '../inks.js';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../style.js';
import { createStructureApi } from './api.js';
import { createLetteringApi } from './api-lettering.js';
import { createFlowApi, flowBoxes, FLOW_DIRECTIONS } from './flow.js';
import { ComicPageModel } from './model.js';
import { misFor } from './panel.js';
import type { ComicPen } from './pen.js';

function makePage(seed = 5) {
  const model = new ComicPageModel(seed, misFor(`page${String(seed)}`));
  const ctx = { model, resolve: createResolver(undefined, 'scene'), call: 'scene', seed };
  const structure = createStructureApi(ctx);
  const page = {
    ...structure,
    ...createLetteringApi(ctx),
    ...createArt(ctx, (layout, options) => structure.panels(layout, options)),
    ...createFlowApi(ctx),
    update: () => undefined,
  };
  const canvas = new ComicCanvas(PAGE_WIDTH, PAGE_HEIGHT);
  const frame = (t: number) => {
    model.render(canvas, t);
    return canvas.data.slice();
  };
  return { page, model, frame };
}

const beat = (at: number, weight = 1) => ({
  at,
  weight,
  draw: (g: ComicPen, _t: number, [w, h]: readonly [number, number]) => {
    g.rect(0, 0, w, h, 'cyan');
  },
});
const intent = 'the page reads the way the river runs, from the spring down to the sea';

describe('page.flow', () => {
  it.each(FLOW_DIRECTIONS)('%s: panels advance along the flow, weight = length', (direction) => {
    const { boxes, centres } = flowBoxes(direction, [1, 2, 1], undefined, 12);
    const along = (i: number) => {
      const box = boxes[i] ?? [0, 0, 0, 0];
      return direction === 'down' ? box[1] : box[0];
    };
    expect(along(1)).toBeGreaterThan(along(0));
    expect(along(2)).toBeGreaterThan(along(1));
    const length = (i: number) => (direction === 'down' ? boxes[i]?.[3] : boxes[i]?.[2]) ?? 0;
    expect(length(1)).toBeGreaterThan(length(0));
    if (direction === 'diagonal') expect(boxes[2]?.[1]).toBeGreaterThan(boxes[0]?.[1] ?? 0);
    expect(centres[2]?.[direction === 'down' ? 1 : 0]).toBeGreaterThanOrEqual(
      centres[0]?.[direction === 'down' ? 1 : 0] ?? 0,
    );
  });

  it('the camera holds, travels just before each beat and holds again; pure in t', () => {
    const { page, model, frame } = makePage();
    page.flow({
      intent,
      direction: 'across',
      travel: 0.4,
      beats: [beat(0.2), beat(2), beat(3.5, 1.5)],
    });
    const xs = model.cameraKeys.map((key) => [key.at, key.x]);
    expect(xs[0]).toEqual([0, 320]);
    expect(xs.map(([at]) => at)).toEqual(
      [...xs.map(([at]) => at)].sort((a, b) => (a ?? 0) - (b ?? 0)),
    );
    const late = model.place(4).ox;
    expect(late).toBeLessThan(model.place(0).ox);
    const times = [0.5, 2.1, 3.9];
    const forward = times.map((t) => frame(t));
    const backward = [...times]
      .reverse()
      .map((t) => frame(t))
      .reverse();
    expect(backward).toEqual(forward);
    for (const data of forward) expect(data.every((ink) => ink < INK_TABLE.length)).toBe(true);
  });

  it('rejects specs a scene author can fix', () => {
    const { page } = makePage();
    expect(() =>
      page.flow({ intent: 'down', direction: 'down', beats: [beat(0), beat(2)] }),
    ).toThrow(/intent is required/);
    expect(() => page.flow({ intent, direction: 'down', beats: [beat(0)] })).toThrow(/2-5 panels/);
    expect(() => page.flow({ intent, direction: 'down', beats: [beat(1), beat(1.1)] })).toThrow(
      /reading order/,
    );
    expect(() =>
      page.flow({ intent, direction: 'sideways' as 'down', beats: [beat(0), beat(2)] }),
    ).toThrow(/direction/);
  });
});

describe('page.thread', () => {
  it('crosses three or more different panels', () => {
    const { page } = makePage();
    const { panels } = page.flow({
      intent,
      direction: 'across',
      beats: [beat(0), beat(1), beat(2)],
    });
    const draw = () => undefined;
    expect(() => {
      page.thread({ intent, through: panels, draw });
    }).not.toThrow();
    expect(() => {
      page.thread({ intent, through: panels.slice(0, 2), draw });
    }).toThrow(/at least 3/);
    const [first, second] = panels;
    expect(() => {
      page.thread({ intent, through: [first, second, first], draw });
    }).toThrow(/different panel/);
    expect(() => {
      page.thread({ intent: 'rope', through: panels, draw });
    }).toThrow(/intent/);
  });
});

const EXAMPLES = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'examples',
  'comic',
  'open',
);

describe('page-flow examples p1-p2', () => {
  it.each([
    ['p1_well.js', [0.8, 3, 6]],
    ['p2_letter.js', [0.8, 3, 6]],
  ] as const)('%s renders palette-pure and pure in t, and moves', async (file, times) => {
    const scene = (await import(pathToFileURL(path.join(EXAMPLES, file)).href)) as {
      build(ctx: unknown): unknown;
    };
    let built: ReturnType<typeof makePage> | undefined;
    scene.build({
      kit: {
        fx: {
          comicPage: (params: { seed?: number }) => {
            built = makePage(params.seed);
            return built.page;
          },
        },
      },
      scene: { add: () => undefined },
    });
    if (built === undefined) throw new Error('no page');
    const { model, frame } = built;
    model.validate(file);
    const forward = times.map((t) => frame(t));
    const backward = [...times]
      .reverse()
      .map((t) => frame(t))
      .reverse();
    expect(backward).toEqual(forward);
    for (const data of forward) expect(data.every((ink) => ink < INK_TABLE.length)).toBe(true);
    expect(new Set(forward.map((data) => data.join(','))).size).toBe(times.length);
  });
});
