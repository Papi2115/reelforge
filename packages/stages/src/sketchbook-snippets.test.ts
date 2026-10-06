/**
 * The Sketchbook kit calls quoted by the prompts (prompts `SKETCHBOOK_SNIPPETS`) run through the
 * real kit: its zod schemas and checks (pop-up fit, motions on real pieces, lettering) throw on a
 * call that drifted from the API, and the page repaints at a few times without an error.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { resolveStyle } from '@reelforge/engine';
import { createKit, type KitOptions, type KitRng } from '@reelforge/kit';
import { SKETCHBOOK_SNIPPETS, worldPromptText } from '@reelforge/prompts';
import { describe, expect, it } from 'vitest';

/** The kit's own Three.js (the stages package does not depend on three). */
const KIT_DIR = path.resolve(import.meta.dirname, '..', '..', 'kit');
const three = createRequire(path.join(KIT_DIR, 'package.json'))('three') as KitOptions['three'];

const SHOT = { width: 960, height: 540, duration: 6 };

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
    palette: resolveStyle({ style: 'sketchbook' }).palette,
    rng: fixedRng(),
    style: 'sketchbook',
  }).api;
}

/** Runs a snippet on a fresh story page; returns the page (the snippet's value is not needed). */
function run(code: string): Page {
  const kit = kitApi();
  const ctx = { shot: SHOT };
  const page: unknown = runInNewContext(SKETCHBOOK_SNIPPETS.storyPage, { kit, ctx });
  runInNewContext(code, { kit, ctx, page });
  return page as Page;
}

describe('Sketchbook snippets of the prompts', () => {
  it.each(Object.entries(SKETCHBOOK_SNIPPETS))('%s runs on the real kit', (_, code) => {
    const page = run(code);
    for (const t of [0, 1.5, 3, 5.9]) page.update(t);
  });

  it('would fail on a call that drifted from the API', () => {
    const popup = SKETCHBOOK_SNIPPETS.popup;
    expect(() => run(popup.replace(/intent: '[^']*', /, ''))).toThrow(/intent/);
    expect(() => run(popup.replace("target: 'square'", "target: 'door'"))).toThrow(/door/);
    expect(() => run(SKETCHBOOK_SNIPPETS.heroWrite.replace('hero: true', 'hero: 1'))).toThrow();
  });

  it('are quoted verbatim by the world prompt texts', () => {
    const text = worldPromptText('sketchbook');
    const all = JSON.stringify(text);
    for (const code of Object.values(SKETCHBOOK_SNIPPETS)) {
      expect(all).toContain(JSON.stringify(code).slice(1, -1));
    }
  });
});
