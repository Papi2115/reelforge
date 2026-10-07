import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildWorldAssets } from '@reelforge/engine';
import { afterAll, describe, expect, it } from 'vitest';
import { unknownWorldAssetRefs } from './world-asset-refs.js';
import {
  manifestWorldAssets,
  readWorldAssetFiles,
  worldAssetFileProblems,
} from './world-assets.js';

const root = mkdtempSync(path.join(tmpdir(), 'reelforge world assets ż '));
afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function project(name: string, files: Record<string, string>): string {
  const dir = path.join(root, name);
  for (const [file, text] of Object.entries(files)) {
    const target = path.join(dir, ...file.split('/'));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
  mkdirSync(dir, { recursive: true });
  return dir;
}

const COMIC = JSON.stringify({
  version: 1,
  world: 'comic',
  characters: { ranger: { gen: 'person', hat: 'brim' } },
});

describe('readWorldAssetFiles', () => {
  it('reads assets/<world>/*.json sorted, skips bad names, nothing outside a world', async () => {
    const dir = project('comic', {
      'assets/comic/forest.json': COMIC,
      'assets/comic/Bad Name.json': COMIC,
      'assets/comic/notes.txt': 'x',
      'assets/game-b2/other.json': '{}',
    });
    const files = await readWorldAssetFiles(dir, 'comic');
    expect(files?.files.map((entry) => entry.file)).toEqual(['assets/comic/forest.json']);
    expect(files?.ignored.map((entry) => entry.file)).toEqual(['assets/comic/Bad Name.json']);
    expect(manifestWorldAssets(files)).toEqual({
      world: 'comic',
      files: [{ file: 'assets/comic/forest.json', source: COMIC }],
    });
    expect(worldAssetFileProblems(files).map((problem) => problem.file)).toEqual([
      'assets/comic/Bad Name.json',
    ]);
    expect(await readWorldAssetFiles(dir, 'voxel-pixel-crisp640')).toBeUndefined();
    const empty = await readWorldAssetFiles(project('empty', {}), 'sketchbook');
    expect(empty).toEqual({ world: 'sketchbook', files: [], ignored: [] });
    expect(manifestWorldAssets(empty)).toBeUndefined();
  });

  it('turns invalid files into validate problems naming the file', async () => {
    const dir = project('broken', {
      'assets/game-b1/forest.json': JSON.stringify({
        version: 1,
        world: 'game-b1',
        sprites: { stump: { rows: ['#########'], colours: 'tan' } },
      }),
    });
    const problems = worldAssetFileProblems(await readWorldAssetFiles(dir, 'game-b1'));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ severity: 'error', file: 'assets/game-b1/forest.json' });
    expect(problems[0]?.message).toMatch(/9 bits wide/);
  });
});

const set = (world: Parameters<typeof buildWorldAssets>[0], value: unknown) =>
  buildWorldAssets(world, [{ file: `assets/${world}/a.json`, source: JSON.stringify(value) }]);

describe('unknownWorldAssetRefs', () => {
  it('Comic: drawn ids that neither the files nor the scene define', () => {
    const assets = set('comic', JSON.parse(COMIC));
    const source = [
      "art.draw(g, 'ranger', { x: 1 });",
      "art.draw(g, 'red-deer', { x: 2 });",
      "art.defineProp('stone', { parts: [] });",
      "art.draw(g, 'stone');",
    ].join('\n');
    const refs = unknownWorldAssetRefs(source, assets);
    expect(refs.map((ref) => [ref.id, ref.line])).toEqual([['red-deer', 2]]);
    expect(refs[0]?.message).toBe(
      'line 2: asset "red-deer" is not defined: define it in assets/comic/<file>.json or use a built-in generator (art.person, art.tree, art.animal, …)',
    );
  });

  it('Sketchbook: use / like ids', () => {
    const assets = set('sketchbook', {
      version: 1,
      id: 'a',
      kind: 'prop',
      description: 'a thing',
      spec: { draw: 'tree' },
    });
    const refs = unknownWorldAssetRefs(
      "page.use('a', {});\npage.person({ like: 'ranger' });",
      assets,
    );
    expect(refs.map((ref) => ref.id)).toEqual(['ranger']);
  });

  it('Game B1: drawn sprites, fields and rooms', () => {
    const assets = set('game-b1', {
      version: 1,
      world: 'game-b1',
      generated: { oak: { kind: 'tree', shape: 'round' } },
    });
    const source =
      "g.draw('oak', 1, 2);\ng.draw('deer', 3, 4);\nscreen.generate('crow', { kind: 'bird' });\ng.draw('crow', 0, 0);\ng.field('canopy', 60);";
    expect(unknownWorldAssetRefs(source, assets).map((ref) => [ref.id, ref.line])).toEqual([
      ['deer', 2],
      ['canopy', 5],
    ]);
  });

  it('Game B2: level sprites and textures, icons; inline and built-in ids pass', () => {
    const assets = set('game-b2', {
      version: 1,
      world: 'game-b2',
      sprites: { oak: { gen: 'plant', kind: 'deciduous' } },
    });
    const level = (sprite: string, wall: string) => `const LEVEL = {
  name: 'wood',
  sky: { preset: 'day' },
  floor: 'concrete',
  grid: ['....', '.T..', '....'],
  legend: { T: { wall: '${wall}' } },
  lights: [],
  sprites: [{ sprite: '${sprite}', pos: [2.5, 2.5] }],
};
view.take({ icon: 'acorn' });
view.hold({ icon: 'key' });`;
    const refs = unknownWorldAssetRefs(level('deer', 'bark'), assets);
    expect(refs.map((ref) => ref.id).sort()).toEqual(['acorn', 'bark', 'deer']);
    expect(refs.find((ref) => ref.id === 'deer')?.message).toMatch(/asset "deer" is not defined/);
    const inline = `${level('oak', 'concrete')}\nconst A = { icons: { acorn: { gen: 'icon', kind: 'apple' } } };`;
    expect(unknownWorldAssetRefs(inline, assets)).toEqual([]);
  });
});
