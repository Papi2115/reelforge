/**
 * The six open-vocabulary examples (packages/kit/examples/comic/open/o1-o6, PLAN.md#13.15a) and the
 * project asset files, without three: each example is built only from the open layer (no
 * free-form drawing on the pen), lays its page out by beats, renders palette-pure as a pure
 * function of t and never shows an empty panel for more than 0.6 s; the forest film's asset file
 * parses, is exactly what o1 loads, and covers every id o1 draws.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createResolver } from '../../../looks/blueprint/timing.js';
import { createFlashback } from '../breakthrough/flashback.js';
import { createSpread } from '../breakthrough/spread.js';
import { ComicCanvas } from '../draw/canvas.js';
import { INK_TABLE } from '../inks.js';
import { createStructureApi } from '../page/api.js';
import { createLetteringApi } from '../page/api-lettering.js';
import { ComicPageModel } from '../page/model.js';
import { misFor } from '../page/panel.js';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../style.js';
import { createArt } from './api.js';
import { parseComicAssets, unknownComicArtIds } from './assets.js';

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
const SCENES = [
  ['o1_forest.js', 7, [0.5, 3.2, 6.4]],
  ['o2_ocean.js', 8, [1.2, 4, 7.6]],
  ['o3_station.js', 7, [1, 3, 6.5]],
  ['o4_village.js', 8, [1, 4.4, 7.6]],
  ['o5_desert.js', 7, [1, 3.2, 6.5]],
  ['o6_city.js', 7, [1, 3.5, 6.6]],
] as const;

interface SceneModule {
  build(ctx: unknown): { page: unknown };
}

function pageFactory(duration: number) {
  const built: { model?: ComicPageModel; page?: ReturnType<typeof makePage> } = {};
  function makePage(params: { seed?: number }) {
    const seed = params.seed ?? 1;
    const model = new ComicPageModel(seed, misFor(`page${String(seed)}`));
    const ctx = {
      model,
      resolve: createResolver(undefined, 'scene'),
      call: 'scene',
      seed,
      duration,
    };
    const structure = createStructureApi(ctx);
    const lettering = createLetteringApi(ctx);
    const page = {
      ...structure,
      ...lettering,
      ...createArt(ctx, (layout, options) => structure.panels(layout, options)),
      flashback: createFlashback(ctx, lettering),
      spread: createSpread(ctx),
      update: () => undefined,
    };
    built.model = model;
    built.page = page;
    return page;
  }
  return { makePage, built };
}

async function buildScene(file: string, duration: number) {
  const scene = (await import(pathToFileURL(path.join(EXAMPLES, file)).href)) as SceneModule;
  const { makePage, built } = pageFactory(duration);
  const ctx = {
    kit: { fx: { comicPage: makePage } },
    scene: { add: () => undefined },
    shot: { duration },
  };
  scene.build(ctx);
  const { model, page } = built;
  if (model === undefined || page === undefined) throw new Error(`${file}: no comicPage built`);
  const canvas = new ComicCanvas(PAGE_WIDTH, PAGE_HEIGHT);
  const frame = (t: number) => {
    model.render(canvas, t);
    return canvas.data.slice();
  };
  model.validate(file);
  return { page, frame };
}

/** Drawing straight on the pen (free-form painter code) instead of the open layer. */
const FREE_FORM =
  /\bg\.(plate|poly|rect|ellipse|line|polyline|ink|tone|blob|dither|clip|text|strokeOn|bigLetter|ground|digits|standing)\b/;

describe('open vocabulary examples o1-o6', () => {
  it.each(SCENES)('%s is built only from the open layer and laid out by beats', (file) => {
    const source = readFileSync(path.join(EXAMPLES, file), 'utf8');
    expect(source.match(FREE_FORM)?.[0], file).toBeUndefined();
    expect(source).toContain('page.layout(');
    expect(source).toMatch(/\/\/ Focal: /);
    expect(source).toMatch(/\/\/ Traces: /);
  });

  it.each(SCENES)(
    '%s renders palette-pure, deterministic in any seek order, never an empty panel',
    async (file, duration, times) => {
      const { page, frame } = await buildScene(file, duration);
      const forward = times.map((t) => frame(t));
      const backward = [...times]
        .reverse()
        .map((t) => frame(t))
        .reverse();
      expect(backward).toEqual(forward);
      for (const data of forward)
        expect(data.every((index) => index < INK_TABLE.length)).toBe(true);
      expect(new Set(forward.map((data) => data.join(','))).size).toBe(times.length);
      expect(page.audit({ until: duration }).emptyPanels).toEqual([]);
    },
  );

  it('together they use most of the vocabulary', () => {
    const used = new Set<string>();
    const sources = SCENES.map(([file]) => readFileSync(path.join(EXAMPLES, file), 'utf8'));
    for (const source of sources) {
      for (const match of source.matchAll(/\bart\.(\w+)\(|\bgen: '(\w+)'/g))
        used.add(match[1] ?? match[2] ?? '');
    }
    expect(sources.join('\n')).toMatch(/\bsprite: \{/);
    expect(sources.join('\n')).toMatch(/\bparts: \[/);
    for (const name of [
      'person',
      'crowd',
      'animal',
      'bird',
      'fish',
      'reptile',
      'tree',
      'cactus',
      'building',
      'vehicle',
      'object',
      'icon',
      'effect',
      'sign',
      'shape',
      'draw',
      'load',
      'defineProp',
      'defineCharacter',
      'defineBackdrop',
    ]) {
      expect(used, name).toContain(name);
    }
  });
});

describe('comic asset files', () => {
  const forestFile = path.join(EXAMPLES, 'assets', 'comic', 'forest.json');
  const forest = JSON.parse(readFileSync(forestFile, 'utf8')) as unknown;

  it('the forest film file parses and is exactly what o1 loads', async () => {
    const result = parseComicAssets(forest, 'assets/comic/forest.json');
    expect(result.ok && result.ids).toEqual([
      'fern',
      'bark',
      'ranger',
      'red-deer',
      'woodpecker',
      'pine-dawn',
    ]);
    const loaded: unknown[] = [];
    const scene = (await import(
      pathToFileURL(path.join(EXAMPLES, 'o1_forest.js')).href
    )) as SceneModule;
    const { makePage } = pageFactory(7);
    const spy = (params: { seed?: number }) => {
      const page = makePage(params);
      const load = (value: unknown, file?: string) => {
        loaded.push(value);
        return page.art.load(value, file);
      };
      return { ...page, art: { ...page.art, load } };
    };
    scene.build({ kit: { fx: { comicPage: spy } }, scene: { add: () => undefined } });
    expect(loaded).toEqual([forest]);
  });

  it('knows the project ids: what a scene draws must be in the files or defined by the scene', () => {
    const ids = parseComicAssets(forest);
    const known = ids.ok ? ids.ids : [];
    const o1 = readFileSync(path.join(EXAMPLES, 'o1_forest.js'), 'utf8');
    expect(unknownComicArtIds(o1, known)).toEqual([]);
    expect(unknownComicArtIds(o1, []).map((ref) => ref.id)).toContain('ranger');
    for (const [file] of SCENES.slice(1)) {
      expect(unknownComicArtIds(readFileSync(path.join(EXAMPLES, file), 'utf8'), []), file).toEqual(
        [],
      );
    }
    const source =
      "art.defineProp('lamp', spec);\nart.draw(g, 'lamp');\nart.draw(g, 'ghost', { x: 1 });\nart.shape(g, [{ shape: 'use', id: 'spook' }]);";
    expect(unknownComicArtIds(source, [])).toEqual([
      { id: 'ghost', line: 3 },
      { id: 'spook', line: 4 },
    ]);
  });

  it('reports every problem of a broken file at once', () => {
    const result = parseComicAssets(
      {
        version: 1,
        world: 'comic',
        props: { Lamp: { gen: 'object', kind: 'lamp' }, cart: { gen: 'wagon' } },
        characters: { oak: { gen: 'tree' } },
      },
      'assets/comic/bad.json',
    );
    expect(result.ok).toBe(false);
    const errors = result.ok ? [] : result.errors;
    expect(errors).toHaveLength(3);
    expect(errors.join('\n')).toMatch(/props\.Lamp: .*kebab case/);
    expect(errors.join('\n')).toMatch(/props\.cart: .*unknown generator 'wagon'/);
    expect(errors.join('\n')).toMatch(/characters\.oak: .*a character is drawn by person/);
    const wrong = parseComicAssets({ version: 2, world: 'comic' });
    expect(wrong.ok ? [] : wrong.errors).toEqual([expect.stringMatching(/version: .*1/)]);
  });
});
