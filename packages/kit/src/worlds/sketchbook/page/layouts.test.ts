/**
 * Look A composition presets (layouts.ts): four different page grammars, the hero figure always
 * >= 25 % of the page height, inside the page, nudged by the seed (roughness, never a grid) and
 * the same for the same seed; `page.slots()` needs a layout.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../../kit.js';
import { SKETCHBOOK_PALETTE } from '../../../testing/palettes.js';
import { testRng } from '../../../testing/rng.js';
import { HERO_MIN_HEIGHT, LAYOUT_NAMES, layoutSlots } from './layouts.js';

function page(params: Record<string, unknown>): { slots(): unknown } {
  const { api } = createKit({
    three: THREE,
    palette: SKETCHBOOK_PALETTE,
    rng: testRng(4),
    style: 'sketchbook',
  });
  const factory = (api.fx as unknown as Record<string, (p: unknown) => { slots(): unknown }>)[
    'sketchPage'
  ];
  if (!factory) throw new Error('sketchPage is not bound');
  return factory({ size: [480, 270], seed: 11, ...params });
}

describe('look A layouts', () => {
  it.each(LAYOUT_NAMES)('%s keeps the hero >= 25 %% of the page and everything on it', (name) => {
    for (const seed of [1, 2, 3, 77]) {
      const slots = layoutSlots(name, seed);
      expect(slots.hero.h).toBeGreaterThanOrEqual(HERO_MIN_HEIGHT);
      for (const figure of [slots.hero, ...slots.figures]) {
        expect(figure.h).toBeGreaterThanOrEqual(HERO_MIN_HEIGHT);
        expect(figure.x).toBeGreaterThan(60);
        expect(figure.x).toBeLessThan(900);
        expect(figure.y - figure.h).toBeGreaterThan(30);
        expect(figure.y).toBeLessThan(520);
      }
      const [x, y, w, h] = slots.thing;
      expect(x).toBeGreaterThanOrEqual(40);
      expect(y).toBeGreaterThanOrEqual(40);
      expect(x + w).toBeLessThanOrEqual(920);
      expect(y + h).toBeLessThanOrEqual(520);
    }
  });

  it('gives four different grammars, nudged by the seed, the same for the same seed', () => {
    const heroes = LAYOUT_NAMES.map((name) => layoutSlots(name, 5).hero);
    expect(
      new Set(
        heroes.map(
          (hero) => `${String(Math.round(hero.x / 50))}:${String(Math.round(hero.h / 50))}`,
        ),
      ).size,
    ).toBe(4);
    expect(layoutSlots('facing', 5)).toEqual(layoutSlots('facing', 5));
    expect(layoutSlots('facing', 5)).not.toEqual(layoutSlots('facing', 6));
    expect(layoutSlots('facing', 5).figures).toHaveLength(1);
    expect(layoutSlots('wide-strip', 5).figures).toHaveLength(2);
  });

  it('is reachable from the page: layout + slots(), a clear error without a layout', () => {
    expect(page({ layout: 'tall-diagram' }).slots()).toMatchObject({ name: 'tall-diagram' });
    expect(() => page({}).slots()).toThrow(/pass layout \(hero-left, facing/);
    expect(() => page({ layout: 'grid' })).toThrow(/layout/);
  });
});
