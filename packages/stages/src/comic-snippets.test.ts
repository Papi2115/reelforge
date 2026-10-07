/**
 * The Comic kit calls quoted by the prompts (prompts `COMIC_SNIPPETS`) run through the real kit:
 * its zod schemas and checks (flashback beat order and intent, the spread's hold rule, panels,
 * lettering) throw on a call that drifted from the API, and the page repaints at a few times
 * without an error (the page's first-frame checks run on the first update).
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { resolveStyle } from '@reelforge/engine';
import { createKit, type KitOptions, type KitRng } from '@reelforge/kit';
import { COMIC_SNIPPETS, worldPromptText } from '@reelforge/prompts';
import { describe, expect, it } from 'vitest';

/** The kit's own Three.js (the stages package does not depend on three). */
const KIT_DIR = path.resolve(import.meta.dirname, '..', '..', 'kit');
const three = createRequire(path.join(KIT_DIR, 'package.json'))('three') as KitOptions['three'];

/** Every spoken phrase of the snippets lands 2.2 s into the shot. */
const SHOT = { width: 640, height: 360, duration: 6 };
const anchor = (): { t: number } => ({ t: 2.2 });

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

/** Runs a snippet on a fresh page and repaints it (the first update runs the page's checks). */
function run(code: string): Page {
  const kit = kitApi();
  const ctx = { shot: SHOT, anchor };
  const page = runInNewContext(COMIC_SNIPPETS.page, { kit, ctx }) as Page;
  runInNewContext(code, { kit, ctx, page });
  for (const t of [0, 1.5, 3, 5.9]) page.update(t);
  return page;
}

describe('Comic snippets of the prompts', () => {
  it.each(Object.entries(COMIC_SNIPPETS))('%s runs on the real kit', (_, code) => {
    expect(() => run(code)).not.toThrow();
  });

  it('would fail on a call that drifted from the API', () => {
    const { flashback, spread } = COMIC_SNIPPETS;
    expect(() => run(flashback.replace(/intent: '[^']*', /, ''))).toThrow(/intent/);
    expect(() => run(flashback.replace("arrange: 'stair'", "arrange: 'spiral'"))).toThrow(
      /arrange/,
    );
    expect(() => run(flashback.replace('at: 0.9,', 'at: 3.9,'))).toThrow(/narration order/);
    expect(() => run(spread.replace(/intent: '[^']*', /, ''))).toThrow(/intent/);
    expect(() => run(spread.replace("beats: [3.6, 'tranquility']", 'beats: []'))).toThrow(
      /holds still/,
    );
    expect(() => run(COMIC_SNIPPETS.sfx.replace("at: 'clang', ", ''))).toThrow(/at/);
    expect(() => run(COMIC_SNIPPETS.panels.replace('3-up-l', '9-grid'))).toThrow(/layouts are/);
  });

  it('are quoted verbatim by the world prompt texts', () => {
    const all = JSON.stringify(worldPromptText('comic'));
    for (const code of Object.values(COMIC_SNIPPETS)) {
      expect(all).toContain(JSON.stringify(code).slice(1, -1));
    }
  });
});
