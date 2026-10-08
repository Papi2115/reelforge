/**
 * Test support: a forest film in each world (PLAN.md#13.15 phase 2): the asset files the
 * world-assets turn writes (fake-claude), the cast.json, and scenes that load the film's assets
 * with the world's one-liner and draw one of them by id.
 */
import type { WorldAssetWorld } from '@reelforge/shared';
import type { FilmShot } from './film.js';

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** Project-relative asset files of the forest film; every world defines `ranger`. */
export const FOREST_FILES: Readonly<Record<WorldAssetWorld, Readonly<Record<string, string>>>> = {
  sketchbook: {
    'assets/sketchbook/ranger.json': json({
      version: 1,
      id: 'ranger',
      kind: 'figure',
      description: 'the park ranger with a brimmed hat and a map',
      spec: { clothes: 'vest', color: 'green', hat: 'brim', holds: 'map' },
    }),
    'assets/sketchbook/old-oak.json': json({
      version: 1,
      id: 'old-oak',
      kind: 'prop',
      description: 'the three-hundred-year-old oak',
      spec: { draw: 'tree', type: 'oak', h: 200 },
    }),
  },
  comic: {
    'assets/comic/forest.json': json({
      version: 1,
      world: 'comic',
      characters: { ranger: { gen: 'person', hat: 'brim', tool: 'binoculars', seed: 7 } },
      props: {},
      backdrops: {
        'pine-dawn': {
          layers: [
            { gen: 'sky', kind: 'dawn' },
            { gen: 'forest', kind: 'pine' },
          ],
        },
      },
    }),
  },
  'game-b2': {
    'assets/game-b2/forest.json': json({
      version: 1,
      world: 'game-b2',
      sprites: {
        ranger: { gen: 'person', hat: 'top', outfit: 'suit' },
        oak: { gen: 'plant', kind: 'deciduous', seed: 3 },
      },
      textures: { moss: { gen: 'texture', kind: 'grass', seed: 2 } },
      icons: {},
    }),
  },
  'game-b1': {
    'assets/game-b1/forest.json': json({
      version: 1,
      world: 'game-b1',
      generated: {
        ranger: { kind: 'person', role: 'ranger' },
        oak: { kind: 'tree', shape: 'round', height: 20, seed: 4 },
      },
    }),
  },
};

/** assets/cast.json of the forest film. */
export function forestCast(world: WorldAssetWorld, shots: readonly string[]): string {
  const file = Object.keys(FOREST_FILES[world])[0] ?? '';
  return json({
    version: 1,
    world,
    entries: [{ id: 'ranger', kind: 'character', name: 'the park ranger', file, shots }],
  });
}

/** A scene of `shot` that loads the film's assets (the world's one-liner) and draws `id`. */
export function forestScene(world: WorldAssetWorld, shot: FilmShot, id: string): string {
  const head = `// focal: the ${id} | traces: a wobble, a pause, a smudge
export const meta = { id: '${shot.id}', title: 'Forest', treatment: '${shot.treatment}' };
`;
  const anchor = `  const hit = ctx.anchor('${shot.phrase}');\n  ctx.sfx.at(hit.t, 'hit');\n`;
  switch (world) {
    case 'sketchbook':
      return `${head}
export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({ size: [ctx.shot.width, ctx.shot.height], duration: ctx.shot.duration, library: ctx.worldAssets });
  ctx.scene.add(page);
${anchor}  page.person({ like: '${id}', x: 300, y: 470, h: 220, at: 0.1 });
  return { page };
}
export function update(t, state) {
  state.page.update(t);
}
`;
    case 'comic':
      return `${head}
export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 5, anchor: ctx.anchor, duration: ctx.shot.duration });
  ctx.scene.add(page);
  page.art.load(ctx.worldAssets);
${anchor}  const [panel] = page.layout([{ at: 0, weight: 1, backdrop: 'pine-dawn' }]);
  panel.draw((g) => page.art.draw(g, '${id}', { x: 200, y: 320, size: 200 }));
  return { page };
}
export function update(t, state) {
  state.page.update(t);
}
`;
    case 'game-b2':
      return `${head}
const LEVEL = {
  name: 'forest',
  sky: { preset: 'day' },
  floor: 'moss',
  grid: ['......', '......', '......'],
  legend: {},
  lights: [],
  sprites: [{ sprite: '${id}', pos: [4, 1.5] }],
};
export function build(ctx) {
  const view = ctx.kit.fx.b2View({ size: [ctx.shot.width, ctx.shot.height], level: LEVEL, assets: ctx.worldAssets, duration: ctx.shot.duration, path: [{ at: 0, x: 0.5, y: 1.5, yaw: 0 }] });
  ctx.scene.add(view);
${anchor}  return { view };
}
export function update(t, state) {
  state.view.update(t);
}
`;
    case 'game-b1':
      return `${head}
export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({ size: [ctx.shot.width, ctx.shot.height], duration: ctx.shot.duration });
  screen.assets(ctx.worldAssets);
${anchor}  screen.tv((g) => {
    g.draw('${id}', 60, 100, { frame: 0 });
  });
  ctx.scene.add(screen);
  return { screen };
}
export function update(t, state) {
  state.screen.update(t);
}
`;
  }
}
