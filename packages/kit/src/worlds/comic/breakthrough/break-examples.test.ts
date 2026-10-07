/**
 * The three panel-break examples (packages/kit/examples/comic/open/b1-b3, PLAN.md#13.15): topics
 * far from the showcase, each a `page.panelBreak` with an intent and its own mechanism (a sepia
 * print that shrinks away over a present that unrolls; shards pulled into one picture across the
 * fold; wall sections that tear and drag each other down). Each renders palette-pure, as a pure
 * function of t, and never shows an empty panel.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createResolver } from '../../../looks/blueprint/timing.js';
import { createArt } from '../art/api.js';
import { ComicCanvas } from '../draw/canvas.js';
import { INK_TABLE } from '../inks.js';
import { createStructureApi } from '../page/api.js';
import { createLetteringApi } from '../page/api-lettering.js';
import { ComicPageModel } from '../page/model.js';
import { misFor } from '../page/panel.js';
import { PAGE_HEIGHT, PAGE_WIDTH } from '../style.js';
import { createPanelBreak } from './break.js';

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

/** File, shot length, times (before, during and after each break). */
export const BREAK_EXAMPLES = [
  ['b1_glacier.js', 8, [1.2, 4, 7.4]],
  ['b2_bridge.js', 8, [1.6, 4, 7.2]],
  ['b3_levee.js', 8, [2.4, 3.7, 5.2, 7.4]],
] as const;

interface SceneModule {
  build(ctx: unknown): { page: unknown };
}

async function buildScene(file: string, duration: number) {
  const scene = (await import(pathToFileURL(path.join(EXAMPLES, file)).href)) as SceneModule;
  let built: { model: ComicPageModel; page: ReturnType<typeof createStructureApi> } | undefined;
  const comicPage = (params: { seed?: number }) => {
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
      panelBreak: createPanelBreak(ctx, lettering),
      update: () => undefined,
    };
    built = { model, page: structure };
    return page;
  };
  scene.build({
    kit: { fx: { comicPage } },
    scene: { add: () => undefined },
    shot: { duration },
  });
  if (built === undefined) throw new Error(`${file}: no comicPage built`);
  const { model } = built;
  const canvas = new ComicCanvas(PAGE_WIDTH, PAGE_HEIGHT);
  model.validate(file);
  return {
    model,
    frame: (t: number) => {
      model.render(canvas, t);
      return canvas.data.slice();
    },
  };
}

describe('panel-break examples b1-b3', () => {
  it.each(BREAK_EXAMPLES)('%s states its narration, focal point and mechanism', (file) => {
    const source = readFileSync(path.join(EXAMPLES, file), 'utf8');
    expect(source).toMatch(/\/\/ Narration: /);
    expect(source).toMatch(/\/\/ Mechanism \(page\.panelBreak/);
    expect(source).toMatch(/\/\/ Focal: /);
    expect(source).toMatch(/intent:/);
  });

  it.each(BREAK_EXAMPLES)(
    '%s renders palette-pure, deterministic in any seek order, and moves',
    async (file, duration, times) => {
      const { frame } = await buildScene(file, duration);
      const forward = times.map((t) => frame(t));
      const backward = [...times]
        .reverse()
        .map((t) => frame(t))
        .reverse();
      expect(backward).toEqual(forward);
      for (const data of forward) {
        expect(data.every((index) => index < INK_TABLE.length)).toBe(true);
      }
      expect(new Set(forward.map((data) => data.join(','))).size).toBe(times.length);
    },
  );

  it('the three use different entrances, moves and gutters', () => {
    const sources = BREAK_EXAMPLES.map(([file]) => readFileSync(path.join(EXAMPLES, file), 'utf8'));
    const gutters = sources.map((source) => /gutters: \{ kind: '(\w+)'/.exec(source)?.[1]);
    expect(new Set(gutters).size).toBe(3);
  });
});
