import { describe, expect, it } from 'vitest';
import { NO_ANCHORS } from '../anchors.js';
import type { SceneContext } from '../contract.js';
import { buildShot } from '../shot.js';
import { resolveStyle } from '../style.js';
import { buildWorldAssets, emptyWorldAssets, videoWorldAssets } from './build.js';

const json = (value: unknown): string => JSON.stringify(value);

const RANGER = {
  version: 1,
  id: 'ranger',
  kind: 'figure',
  description: 'the park ranger with a brimmed hat',
  spec: { clothes: 'vest', color: 'green', hat: 'brim' },
};
const TOWER = {
  version: 1,
  id: 'fire-tower',
  kind: 'prop',
  description: 'a fire lookout tower on four legs',
  spec: { h: 150, draw: 'building', type: 'tower' },
};
const COMIC = {
  version: 1,
  world: 'comic',
  characters: { ranger: { gen: 'person', hat: 'brim', tool: 'binoculars' } },
  props: {},
  backdrops: {},
};
const B2 = {
  version: 1,
  world: 'game-b2',
  sprites: { oak: { gen: 'plant', kind: 'deciduous', seed: 3 } },
  icons: { acorn: { gen: 'icon', kind: 'apple' } },
};
const B1 = {
  version: 1,
  world: 'game-b1',
  sprites: { stump: { rows: ['..##..', '######'], colours: 'tan' } },
  generated: { oak: { kind: 'tree', shape: 'round', height: 20, seed: 4 } },
};

describe('buildWorldAssets', () => {
  it('merges each world into the value its scene API takes, in file-name order', () => {
    const sketch = buildWorldAssets('sketchbook', [
      { file: 'assets/sketchbook/ranger.json', source: json(RANGER) },
      { file: 'assets/sketchbook/fire-tower.json', source: json(TOWER) },
    ]);
    expect(sketch.problems).toEqual([]);
    expect(sketch.files).toEqual([
      'assets/sketchbook/fire-tower.json',
      'assets/sketchbook/ranger.json',
    ]);
    expect(sketch.value).toEqual([TOWER, RANGER]);
    expect(sketch.ids.byKind).toEqual({ figures: ['ranger'], props: ['fire-tower'] });

    const comic = buildWorldAssets('comic', [
      { file: 'assets/comic/forest.json', source: json(COMIC) },
    ]);
    expect(comic.problems).toEqual([]);
    expect(comic.value).toMatchObject({ version: 1, world: 'comic', characters: { ranger: {} } });
    expect(comic.ids.all).toEqual(['ranger']);

    const b2 = buildWorldAssets('game-b2', [
      { file: 'assets/game-b2/forest.json', source: json(B2) },
    ]);
    expect(b2.problems).toEqual([]);
    expect(b2.ids.byKind).toEqual({ sprites: ['oak'], textures: [], icons: ['acorn'] });

    const b1 = buildWorldAssets('game-b1', [
      { file: 'assets/game-b1/forest.json', source: json(B1) },
    ]);
    expect(b1.problems).toEqual([]);
    expect(b1.ids.byKind['sprites']).toEqual(['stump', 'oak']);
  });

  it('leaves out bad files with readable problems and keeps the rest', () => {
    const set = buildWorldAssets('game-b2', [
      { file: 'assets/game-b2/a.json', source: json(B2) },
      { file: 'assets/game-b2/b.json', source: json(B2) },
      { file: 'assets/game-b2/c.json', source: '{ "version": 1, ' },
      {
        file: 'assets/game-b2/d.json',
        source: json({
          version: 1,
          world: 'game-b2',
          sprites: { fern: { rows: ['gX'], legend: { g: 'sage' } } },
        }),
      },
    ]);
    expect(set.files).toEqual(['assets/game-b2/a.json']);
    const text = set.problems.map((problem) => problem.message).join('\n');
    expect(text).toContain(
      'assets/game-b2/b.json: "oak" is already defined in assets/game-b2/a.json',
    );
    expect(text).toContain('assets/game-b2/c.json: not valid JSON');
    expect(text).toMatch(/assets\/game-b2\/d\.json: .*fern.*"X"/);
  });

  it('names the file of a sketchbook asset whose id does not match it', () => {
    const set = buildWorldAssets('sketchbook', [
      { file: 'assets/sketchbook/tower.json', source: json(TOWER) },
    ]);
    expect(set.files).toEqual([]);
    expect(set.problems[0]?.message).toMatch(/must be named fire-tower\.json/);
  });

  it('is frozen, the empty set of a world without files, undefined outside a world', () => {
    const set = buildWorldAssets('comic', [
      { file: 'assets/comic/forest.json', source: json(COMIC) },
    ]);
    expect(Object.isFrozen(set.value)).toBe(true);
    expect(Object.isFrozen((set.value as { characters: object }).characters)).toBe(true);
    expect(emptyWorldAssets('game-b1').value).toEqual({
      version: 1,
      world: 'game-b1',
      sprites: {},
      playfields: {},
      generated: {},
      rooms: {},
    });
    expect(emptyWorldAssets('sketchbook').value).toEqual([]);
    expect(videoWorldAssets('voxel-pixel-crisp640', undefined)).toBeUndefined();
    expect(videoWorldAssets('comic', undefined)?.ids.all).toEqual([]);
  });
});

describe('ctx.worldAssets', () => {
  it('is the same frozen value in build() and update()', () => {
    const value = buildWorldAssets('comic', [
      { file: 'assets/comic/forest.json', source: json(COMIC) },
    ]).value;
    const seen: unknown[] = [];
    const shot = buildShot({
      shot: { id: 's01', t0: 0, duration: 2, width: 640, height: 360, fps: 30 },
      module: {
        meta: { id: 's01' },
        build: (ctx: SceneContext) => {
          seen.push(ctx.worldAssets);
          return null;
        },
        update: (_t, _state, ctx: SceneContext) => {
          seen.push(ctx.worldAssets);
        },
      },
      projectSeed: 1,
      palette: resolveStyle({}).palette,
      resolveAnchor: NO_ANCHORS,
      worldAssets: value,
    });
    shot.update(1);
    expect(seen).toEqual([value, value]);
    expect(seen[0]).toBe(seen[1]);
  });
});
