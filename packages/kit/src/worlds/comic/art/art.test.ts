/**
 * The comic open vocabulary (PLAN.md#13.15a) without three: every generator draws with its
 * defaults, palette-pure and as a pure function of t; the shape DSL, sprites and the registry of
 * the film's own things draw what they say; every mistake a scene author can make is a readable
 * error naming the valid choices.
 */
import { describe, expect, it } from 'vitest';
import { createResolver } from '../../../looks/blueprint/timing.js';
import { ComicCanvas } from '../draw/canvas.js';
import { INK, INK_TABLE } from '../inks.js';
import { createStructureApi } from '../page/api.js';
import { ComicPageModel } from '../page/model.js';
import { misFor } from '../page/panel.js';
import type { ComicPen } from '../page/pen.js';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../style.js';
import { createArt } from './api.js';
import { GENERATOR_NAMES } from './generators.js';

type Art = ReturnType<typeof createArt>['art'];

function render(draw: (g: ComicPen, art: Art) => void, t = 1, seed = 5): Uint8Array {
  const model = new ComicPageModel(seed, misFor(`page${String(seed)}`));
  const ctx = { model, resolve: createResolver(undefined, 'test'), call: 'test', seed };
  const structure = createStructureApi(ctx);
  const { art } = createArt(ctx, (layout, options) => structure.panels(layout, options));
  const [panel] = structure.panels('splash');
  panel?.draw((g) => {
    draw(g, art);
  });
  const canvas = new ComicCanvas(PAGE_WIDTH, PAGE_HEIGHT);
  model.render(canvas, t);
  return canvas.data.slice();
}

/** Minimal options of each generator: where it goes (and what it is, when that is required). */
const MINIMAL: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
  crowd: { x0: 100, x1: 500, y: 300 },
  grass: { x0: 100, x1: 500, y: 300 },
  flowers: { x0: 100, x1: 500, y: 300 },
  object: { x: 320, y: 300, kind: 'skull' },
  icon: { x: 320, y: 180, kind: 'heart' },
  chart: { box: [200, 100, 240, 160], values: [3, 5, 2] },
  effect: { x: 320, y: 180, kind: 'impact' },
  sky: {},
  land: {},
  hills: {},
  sea: {},
  dunes: {},
  forest: {},
  skyline: {},
  interior: {},
  space: {},
  backdrop: {},
  map: {},
};

function changed(frame: Uint8Array, blank: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < frame.length; i += 1) if (frame[i] !== blank[i]) count += 1;
  return count;
}

describe('comic art generators', () => {
  const blank = render(() => undefined);

  it.each(GENERATOR_NAMES)('%s draws with its defaults, palette-pure and deterministic', (name) => {
    const options = MINIMAL[name] ?? { x: 320, y: 300 };
    const draw = (g: ComicPen, art: Art) => {
      art[name](g, options);
    };
    const frame = render(draw, 1.3);
    expect(changed(frame, blank), name).toBeGreaterThan(40);
    expect(frame.every((index) => index < INK_TABLE.length)).toBe(true);
    render(draw, 4);
    expect(render(draw, 1.3)).toEqual(frame);
  });

  it('draws people in every pose and expression, and a crowd with flat back rows', () => {
    for (const pose of [
      'stand',
      'walk',
      'run',
      'point',
      'hold',
      'slump',
      'look-up',
      'wave',
      'sit',
    ]) {
      for (const expression of ['neutral', 'happy', 'sad', 'angry', 'surprised', 'scared']) {
        const frame = render((g, art) => {
          art.person(g, {
            x: 320,
            y: 340,
            size: 260,
            pose,
            expression,
            hat: 'brim',
            tool: 'lantern',
          });
        });
        expect(changed(frame, blank), `${pose} ${expression}`).toBeGreaterThan(2000);
      }
    }
    const crowd = render((g, art) => {
      art.crowd(g, { x0: 40, x1: 600, y: 330, rows: 3, count: 12, size: 120 });
    });
    expect(crowd.includes(INK.GREY_D) || crowd.includes(INK.GREY_M)).toBe(true);
  });

  it('a pose, expression or seed changes the picture; the same options draw the same one', () => {
    const person = (options: Record<string, unknown>) =>
      render((g, art) => {
        art.person(g, { x: 320, y: 340, size: 280, ...options });
      });
    const base = person({});
    expect(person({})).toEqual(base);
    expect(person({ pose: 'point' })).not.toEqual(base);
    expect(person({ expression: 'scared' })).not.toEqual(base);
    expect(person({ seed: 9 })).not.toEqual(base);
    expect(person({ flip: true })).not.toEqual(base);
  });

  it('walk cycles and flapping wings move with t', () => {
    const walk = (t: number) =>
      render((g, art) => {
        art.person(g, { x: 320, y: 340, size: 260, pose: 'walk' });
      }, t);
    expect(walk(0.1)).not.toEqual(walk(0.35));
    const bird = (t: number) =>
      render((g, art) => {
        art.bird(g, { x: 320, y: 180, size: 200, species: 'gull' });
      }, t);
    expect(bird(0)).not.toEqual(bird(0.1));
  });

  it('size 0 (grown from nothing) draws nothing', () => {
    expect(
      render((g, art) => {
        art.effect(g, { kind: 'impact', size: 0 });
      }),
    ).toEqual(blank);
  });

  it('rejects bad options with the valid choices', () => {
    const call = (draw: (g: ComicPen, art: Art) => void) => () => render(draw);
    expect(
      call((g, art) => {
        art.person(g, { x: 0, y: 0, top: 'green' });
      }),
    ).toThrow(/unknown colour "green"; comic inks: ink, night, paper/);
    expect(
      call((g, art) => {
        art.animal(g, { x: 0, y: 0, species: 'unicorn' });
      }),
    ).toThrow(/species.*deer.*rabbit/);
    expect(
      call((g, art) => {
        art.tree(g, { x: 0, y: 0, colour: 'phosphor' });
      }),
    ).toThrow(/page\.art\.tree.*colour/);
    expect(
      call((g, art) => {
        art.object(g, { x: 0, y: 0 });
      }),
    ).toThrow(/page\.art\.object: kind/);
  });
});

describe('comic shape DSL and sprites', () => {
  const blank = render(() => undefined);

  it('draws parts in model units at a place, mirrored by flip', () => {
    const parts = [
      { shape: 'ellipse', at: [0, -40], r: [30, 40], fill: 'yellow', shade: 0.4 },
      { shape: 'rect', at: [10, -20], size: [40, 20], fill: 'red', hatch: { gap: 4 } },
      { shape: 'line', pts: [0, 0, 60, -60], w: 2 },
      { shape: 'dots', pts: [5, -5, 15, -15], r: 2 },
      { shape: 'capsule', from: [-30, -10], to: [-60, -30], r: 6, fill: 'cyan' },
    ];
    const right = render((g, art) => {
      art.shape(g, parts, { x: 320, y: 300, scale: 2 });
    });
    const left = render((g, art) => {
      art.shape(g, parts, { x: 320, y: 300, scale: 2, flip: true });
    });
    expect(changed(right, blank)).toBeGreaterThan(3000);
    expect(left).not.toEqual(right);
    expect(right.includes(INK.RED)).toBe(true);
  });

  it('sprites: ink on the key plate with a grown outline, colours from the legend', () => {
    const spec = { rows: ['.rr.', 'rYYr', '.rr.'], legend: { r: 'red', Y: 'yellow' }, px: 10 };
    const frame = render((g, art) => {
      art.sprite(g, spec, { x: 320, y: 200 });
    });
    expect(frame.includes(INK.RED)).toBe(true);
    expect(frame.includes(INK.YEL)).toBe(true);
    expect(frame.includes(INK.INK)).toBe(true);
    const bare = render((g, art) => {
      art.sprite(g, { ...spec, outline: false }, { x: 320, y: 200 });
    });
    expect(changed(frame, blank)).toBeGreaterThan(changed(bare, blank));
  });

  it('rejects broken specs readably', () => {
    const call = (draw: (g: ComicPen, art: Art) => void) => () => render(draw);
    expect(
      call((g, art) => {
        art.sprite(g, { rows: ['.ab.'], legend: { a: 'red' } });
      }),
    ).toThrow(/characters not in the legend: "b"/);
    expect(
      call((g, art) => {
        art.shape(g, { shape: 'poly', pts: [0, 0, 10] });
      }),
    ).toThrow(/pairs|polygon/);
    expect(
      call((g, art) => {
        art.shape(g, { shape: 'gen', gen: 'dragon' });
      }),
    ).toThrow(/unknown generator 'dragon'; generators: person, crowd/);
  });
});

describe('the film vocabulary registry', () => {
  it('defines things once and draws them anywhere; gen presets take per-call knobs', () => {
    const frame = (pose: string) =>
      render((g, art) => {
        art.defineCharacter('ranger', { gen: 'person', hat: 'brim', top: 'phosphor' });
        art.defineProp('lantern', {
          sprite: { rows: ['.#.', '#y#', '###'], legend: { '#': 'ink', y: 'yellow' } },
        });
        art.defineBackdrop('dawn-meadow', {
          layers: [
            { gen: 'sky', kind: 'dawn' },
            { gen: 'land', kind: 'meadow' },
          ],
        });
        art.defineProp('camp', {
          parts: [
            { shape: 'use', id: 'lantern', at: [0, 0], scale: 3 },
            { shape: 'gen', gen: 'object', options: { kind: 'campfire', x: 60, y: 0, size: 50 } },
          ],
        });
        art.draw(g, 'dawn-meadow', { box: [0, 0, 640, 360] });
        art.draw(g, 'ranger', { x: 200, y: 330, size: 200, pose });
        art.draw(g, 'camp', { x: 420, y: 330, size: 100 });
      });
    expect(frame('point')).not.toEqual(frame('stand'));
    expect(frame('stand').includes(INK.GREEN)).toBe(true);
  });

  it('rejects ids and specs that cannot work, naming the fix', () => {
    const call = (draw: (g: ComicPen, art: Art) => void) => () => render(draw);
    expect(
      call((_g, art) => {
        art.defineProp('Lantern', { parts: [{ shape: 'ellipse', at: [0, 0], r: 4 }] });
      }),
    ).toThrow(/kebab case/);
    expect(
      call((_g, art) => {
        art.defineProp('tree', { gen: 'tree' });
      }),
    ).toThrow(/generator name.*old-tree/);
    expect(
      call((_g, art) => {
        art.defineCharacter('oak', { gen: 'tree' });
      }),
    ).toThrow(/a character is drawn by person, animal/);
    expect(
      call((_g, art) => {
        art.defineProp('x', { parts: [], sprite: {} });
      }),
    ).toThrow(/exactly one of parts, sprite, layers, draw, gen \(got parts \+ sprite\)/);
    expect(
      call((g, art) => {
        art.draw(g, 'ghost');
      }),
    ).toThrow(/'ghost' is not defined \(defined: nothing yet/);
    expect(
      call((g, art) => {
        art.defineProp('loop', { parts: [{ shape: 'use', id: 'loop' }] });
        art.draw(g, 'loop', { x: 10, y: 10 });
      }),
    ).toThrow(/nested deeper than 4/);
    expect(
      call((_g, art) => {
        art.defineProp('a', { gen: 'object', kind: 'key' });
        art.defineProp('a', { gen: 'object', kind: 'key' });
      }),
    ).toThrow(/already defined/);
  });
});
