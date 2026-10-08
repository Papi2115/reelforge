/**
 * The Comic kit calls quoted by the prompts (prompts `COMIC_SNIPPETS`) run through the real kit:
 * its zod schemas and checks (art generators and defined ids, layout beats, the empty-panel
 * audit, flashback beat order and intent, the spread's hold rule, panels, lettering) throw on a
 * call that drifted from the API, and the page repaints at a few times without an error (the
 * page's first-frame checks run on the first update; painter calls run inside a panel).
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { resolveStyle } from '@reelforge/engine';
import { createKit, type KitOptions, type KitRng } from '@reelforge/kit';
import { COMIC_SNIPPETS, worldPromptText, type ComicSnippet } from '@reelforge/prompts';
import { describe, expect, it } from 'vitest';

/** The kit's own Three.js (the stages package does not depend on three). */
const KIT_DIR = path.resolve(import.meta.dirname, '..', '..', 'kit');
const three = createRequire(path.join(KIT_DIR, 'package.json'))('three') as KitOptions['three'];

/** Every spoken phrase of the snippets lands 2.2 s into the shot. */
const SHOT = { width: 640, height: 360, duration: 6 };
const anchor = (): { t: number } => ({ t: 2.2 });
/** A project asset file as the stages hand it to a scene (`ctx.worldAssets`). */
const WORLD_ASSETS = {
  version: 1,
  world: 'comic',
  characters: { ranger: { gen: 'person', hat: 'brim', tool: 'binoculars' } },
  props: {},
  backdrops: { 'pine-dawn': { layers: [{ gen: 'sky', kind: 'dawn', horizon: 0.7 }] } },
};
/** Snippets that need another one on the page first (a defined id, panels to audit). */
const NEEDS: Partial<Record<ComicSnippet, readonly ComicSnippet[]>> = {
  cast: ['character'],
  audit: ['layout'],
};
/** A painter call (`page.art.<generator>(g, …)`): it runs inside a panel. */
const PAINTER = /^page\.art\.\w+\(g,/;

interface Page {
  update(t: number): void;
}

/** A fixed stream (the snippets are checked, not looked at). */
function fixedRng(): KitRng {
  return Object.assign(() => 0.5, {
    range: (min: number, max: number) => (min + max) / 2,
    int: (min: number) => min,
    pick: <T>(items: readonly T[]): T => {
      const [first] = items;
      if (first === undefined) throw new RangeError('pick: empty list');
      return first;
    },
    fork: () => fixedRng(),
  });
}

function kitApi(): unknown {
  return createKit({
    three,
    palette: resolveStyle({ style: 'comic' }).palette,
    rng: fixedRng(),
    style: 'comic',
  }).api;
}

const inPanel = (code: string): string =>
  PAINTER.test(code)
    ? `page.panel([20, 20, 620, 22, 618, 340, 22, 338]).draw((g, t) => { ${code}; })`
    : code;

/** Runs code on a fresh page and repaints it; returns the page and the code's value. */
function run(code: string, needs: readonly ComicSnippet[] = []): { page: Page; value: unknown } {
  const kit = kitApi();
  const ctx = { shot: SHOT, anchor, worldAssets: WORLD_ASSETS };
  const page = runInNewContext(COMIC_SNIPPETS.page, { kit, ctx }) as Page;
  for (const need of needs) runInNewContext(inPanel(COMIC_SNIPPETS[need]), { kit, ctx, page });
  const value: unknown = runInNewContext(inPanel(code), { kit, ctx, page });
  for (const t of [0, 1.5, 3, 5.9]) page.update(t);
  return { page, value };
}

const snippet = (name: ComicSnippet): (() => unknown) => {
  return () => run(COMIC_SNIPPETS[name], NEEDS[name]);
};

describe('Comic snippets of the prompts', () => {
  it.each(Object.keys(COMIC_SNIPPETS) as ComicSnippet[])('%s runs on the real kit', (name) => {
    expect(snippet(name)).not.toThrow();
  });

  it('lay out a page with no empty panel and explain the preset', () => {
    expect(run(COMIC_SNIPPETS.audit, ['layout']).value).toEqual([]);
    expect(run(COMIC_SNIPPETS.suggest).value).toMatchObject({ layout: '3-up-l', mirror: true });
    expect(run(COMIC_SNIPPETS.assets).value).toEqual(['ranger', 'pine-dawn']);
  });

  it('would fail on a call that drifted from the API', () => {
    const { flashback, spread, sfx, panels, person, animal, layout, cast } = COMIC_SNIPPETS;
    expect(() => run(flashback.replace(/intent: '[^']*', /, ''))).toThrow(/intent/);
    expect(() => run(flashback.replace("arrange: 'stair'", "arrange: 'spiral'"))).toThrow(
      /arrange/,
    );
    expect(() => run(flashback.replace('at: 0.9,', 'at: 3.9,'))).toThrow(/narration order/);
    expect(() => run(spread.replace(/intent: '[^']*', /, ''))).toThrow(/intent/);
    expect(() => run(spread.replace("beats: [3.6, 'the river']", 'beats: []'))).toThrow(
      /holds still/,
    );
    expect(() => run(sfx.replace("at: 'the ice', ", ''))).toThrow(/at/);
    expect(() => run(panels.replace('3-up-l', '9-grid'))).toThrow(/layouts are/);
    expect(() => run(person.replace("'point'", "'dance'"))).toThrow(/pose/);
    expect(() => run(animal.replace("'fox'", "'dragon'"))).toThrow(/species/);
    expect(() => run(layout.replace("'village'", "'atlantis'"))).toThrow(/backdrop/);
    expect(() => run(cast)).toThrow(/keeper/);
  });

  it('are quoted verbatim by the world prompt texts', () => {
    const all = JSON.stringify(worldPromptText('comic'));
    for (const code of Object.values(COMIC_SNIPPETS)) {
      expect(all).toContain(JSON.stringify(code).slice(1, -1));
    }
  });
});
