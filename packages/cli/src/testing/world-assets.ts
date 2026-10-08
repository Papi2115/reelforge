/**
 * Test support (not exported): a forest film's own assets in each world (PLAN.md#13.15 phase 2),
 * the asset files a world-assets step would write, and a scene per world that loads them with the
 * documented one-liner and draws one of them.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { WorldAssetWorld } from '@reelforge/shared';

const COMIC_FOREST = readFileSync(
  path.resolve(
    import.meta.dirname,
    '..',
    '..',
    '..',
    'kit',
    'examples',
    'comic',
    'open',
    'assets',
    'comic',
    'forest.json',
  ),
  'utf8',
);

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** Project-relative asset files per world. */
export const FOREST_ASSETS: Readonly<Record<WorldAssetWorld, Readonly<Record<string, string>>>> = {
  sketchbook: {
    'assets/sketchbook/ranger.json': json({
      version: 1,
      id: 'ranger',
      kind: 'figure',
      description: 'the park ranger: brimmed hat, green vest, a map',
      spec: {
        clothes: 'vest',
        color: 'green',
        hat: 'brim',
        hatColor: 'kraft',
        hair: 'short',
        skin: 'tan',
        holds: 'map',
      },
    }),
    'assets/sketchbook/red-deer.json': json({
      version: 1,
      id: 'red-deer',
      kind: 'prop',
      description: 'a red deer stag',
      spec: { draw: 'beast', type: 'deer', h: 120 },
    }),
    'assets/sketchbook/old-oak.json': json({
      version: 1,
      id: 'old-oak',
      kind: 'prop',
      description: 'the three-hundred-year-old oak',
      spec: { draw: 'tree', type: 'oak', h: 200 },
    }),
    'assets/sketchbook/fire-tower.json': json({
      version: 1,
      id: 'fire-tower',
      kind: 'prop',
      description: 'a fire lookout tower on four splayed legs',
      spec: {
        h: 150,
        doodle: {
          box: [80, 150],
          parts: [
            { line: [14, 150, 30, 50], sharp: true, width: 2 },
            { line: [66, 150, 50, 50], sharp: true, width: 2 },
            { zigzag: [24, 140, 34, 60], teeth: 5, amp: 34, nib: 'fine' },
            { rect: [22, 26, 36, 24], fill: 'kraft' },
            { rect: [30, 32, 20, 10], fill: 'skyPencil', shade: 'dense' },
            { poly: [16, 28, 40, 14, 64, 28], fill: 'coffee' },
          ],
        },
      },
    }),
  },
  comic: { 'assets/comic/forest.json': COMIC_FOREST },
  'game-b2': {
    'assets/game-b2/forest.json': json({
      version: 1,
      world: 'game-b2',
      sprites: {
        oak: { gen: 'plant', kind: 'deciduous', seed: 3, height: 2.6 },
        pine: { gen: 'plant', kind: 'conifer', seed: 5, height: 3.2 },
        deer: {
          gen: 'creature',
          kind: 'quadruped',
          form: 'grazer',
          horns: 'antlers',
          seed: 6,
          size: 1.1,
          fps: 0,
        },
        ranger: { gen: 'person', hat: 'top', outfit: 'suit', tool: 'cane' },
      },
      textures: {
        moss: { gen: 'texture', kind: 'grass', seed: 2 },
        thicket: { gen: 'texture', kind: 'foliage', seed: 6 },
      },
      icons: { acorn: { gen: 'icon', kind: 'apple' }, map: { gen: 'icon', kind: 'map' } },
    }),
  },
  'game-b1': {
    'assets/game-b1/forest.json': json({
      version: 1,
      world: 'game-b1',
      describe: 'The valley of old oaks',
      sprites: {
        stump: {
          describe: 'a felled oak',
          rows: ['..####..', '.#.##.#.', '.######.', '########'],
          colours: { 0: 'tan', 1: 'teak', 2: 'walnut' },
          size: 2,
          rowH: 2,
        },
      },
      generated: {
        oak: { kind: 'tree', shape: 'round', height: 26, size: 2, seed: 4 },
        ranger: { kind: 'person', role: 'ranger', tool: 'document' },
        deer: { kind: 'animal', like: 'deer', size: 2 },
        canopy: { kind: 'scenery', type: 'canopy', rows: 6, rowH: 4, seed: 3 },
      },
    }),
  },
};

/** A scene that loads the film's assets with the world's one-liner and draws `ranger`. */
export function forestScene(world: WorldAssetWorld, id: string): string {
  const meta = `export const meta = { id: '${id}', title: 'Forest', treatment: 'character-scene' };\n`;
  switch (world) {
    case 'sketchbook':
      return `${meta}
export function build(ctx) {
  const page = ctx.kit.fx.sketchPage({ size: [ctx.shot.width, ctx.shot.height], duration: ctx.shot.duration, seed: 3, library: ctx.worldAssets });
  ctx.scene.add(page);
  page.use('old-oak', { x: 640, y: 470, h: 300, at: 0, appear: 'bloom' });
  page.person({ like: 'ranger', x: 300, y: 470, h: 220, at: 0.1 });
  return { page };
}
export function update(t, state) { state.page.update(t); }
`;
    case 'comic':
      return `${meta}
export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ seed: 5, anchor: ctx.anchor, duration: ctx.shot.duration });
  ctx.scene.add(page);
  page.art.load(ctx.worldAssets);
  const [panel] = page.layout([{ at: 0, weight: 1, backdrop: 'pine-dawn' }]);
  const [x, y, w, h] = panel.box;
  panel.draw((g) => page.art.draw(g, 'ranger', { x: x + w * 0.4, y: y + h * 0.95, size: h * 0.6 }));
  return { page };
}
export function update(t, state) { state.page.update(t); }
`;
    case 'game-b2':
      return `${meta}
const LEVEL = {
  name: 'forest',
  sky: { preset: 'day', skyline: 'trees' },
  floor: 'moss',
  grid: ['........', '..TT....', '........', '........', '........'],
  legend: { T: { wall: 'thicket' } },
  lights: [],
  sprites: [{ sprite: 'oak', pos: [5, 1.5] }, { sprite: 'ranger', pos: [4, 3] }, { sprite: 'deer', pos: [6, 4] }],
};
export function build(ctx) {
  const view = ctx.kit.fx.b2View({ size: [ctx.shot.width, ctx.shot.height], level: LEVEL, assets: ctx.worldAssets, duration: ctx.shot.duration, seed: 4, path: [{ at: 0, x: 0.5, y: 3, yaw: 0 }] });
  ctx.scene.add(view);
  return { view };
}
export function update(t, state) { state.view.update(t); }
`;
    case 'game-b1':
      return `${meta}
export function build(ctx) {
  const screen = ctx.kit.fx.b1Screen({ size: [ctx.shot.width, ctx.shot.height], duration: ctx.shot.duration, seed: 3 });
  screen.assets(ctx.worldAssets);
  screen.tv((g) => {
    g.field('canopy', 40);
    g.draw('oak', 30, 80, { playfield: true });
    g.draw('ranger', 80, 120, { frame: 0, flicker: false });
  });
  ctx.scene.add(screen);
  return { screen };
}
export function update(t, state) { state.screen.update(t); }
`;
  }
}
