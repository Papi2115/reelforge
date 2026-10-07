/**
 * `page.push(...)`: the page camera. The view moves in on the focus, never off the page, pure in
 * t; the quad corners show exactly that view; build-only, one per page, explicit errors.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KitError } from '../../../errors.js';
import { createKit } from '../../../kit.js';
import { createResolver } from '../../../looks/blueprint/timing.js';
import { SKETCHBOOK_PALETTE } from '../../../testing/palettes.js';
import { testRng } from '../../../testing/rng.js';
import type { PageApi } from './api.js';
import { FULL_VIEW, parsePush, pushView, quadCorners, type PagePush } from './push.js';

type Page = THREE.Group & PageApi & { update(t: number): void; push(options: unknown): void };

function page(params: Record<string, unknown> = {}): Page {
  const { api } = createKit({
    three: THREE,
    palette: SKETCHBOOK_PALETTE,
    rng: testRng(4),
    style: 'sketchbook',
  });
  const factory = (api.fx as unknown as Record<string, (p: unknown) => Page>)['sketchPage'];
  if (!factory) throw new Error('sketchPage is not bound');
  return factory({ size: [480, 270], seed: 11, ...params });
}

function corners(target: Page): number[] {
  const mesh = target.children[0] as THREE.Mesh;
  const position = mesh.geometry.getAttribute('position');
  return Array.from({ length: 4 }, (_, i) => [position.getX(i), position.getY(i)]).flat();
}

const PUSH: PagePush = { focus: [720, 135], t0: 1, t1: 3, scale: 1.2, ease: 'inOut' };

describe('page push', () => {
  it('moves the view from the whole page to a smaller one around the focus, inside the page', () => {
    expect(pushView(PUSH, 0)).toEqual(FULL_VIEW);
    expect(pushView(undefined, 2)).toEqual(FULL_VIEW);
    const [x, y, w, h] = pushView(PUSH, 3);
    expect(w).toBeCloseTo(1 / 1.2);
    expect(h).toBeCloseTo(1 / 1.2);
    // The focus sits right of the centre and high: the view moves right and up, clamped at 0.
    expect(x).toBeGreaterThan(0.1);
    expect(x + w).toBeLessThanOrEqual(1 + 1e-9);
    expect(y).toBeCloseTo(0);
    const mid = pushView(PUSH, 2);
    expect(mid[2]).toBeGreaterThan(w);
    expect(mid[2]).toBeLessThan(1);
    expect(pushView(PUSH, 2)).toEqual(mid);
  });

  it('turns a view into quad corners that show it full frame', () => {
    expect(quadCorners(FULL_VIEW)).toEqual([
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]);
    const [leftBottom, , rightTop] = quadCorners([0.25, 0.25, 0.5, 0.5]);
    expect(leftBottom).toEqual([-2, -2]);
    expect(rightTop).toEqual([2, 2]);
  });

  it('resolves times and defaults until to the page duration', () => {
    const resolve = createResolver(undefined, 'p');
    const push = parsePush({ focus: [480, 270], at: 0.5 }, { resolve, duration: 4, call: 'p' });
    expect(push).toMatchObject({ t0: 0.5, t1: 4, scale: 1.15 });
    expect(parsePush({ focus: [1, 1] }, { resolve, duration: undefined, call: 'p' }).t1).toBe(3);
    expect(() =>
      parsePush({ focus: [1, 1], at: 2, until: 1 }, { resolve, duration: 4, call: 'p' }),
    ).toThrow(/until/);
    expect(() =>
      parsePush({ focus: [1, 1], scale: 2 }, { resolve, duration: 4, call: 'p' }),
    ).toThrow(KitError);
  });

  it('moves the page quad over time, a pure function of t', () => {
    const target = page({ duration: 4 });
    target.write('LABEL', { x: 300, y: 300, size: 40, at: 0.2 });
    target.push({ focus: [300, 280], at: 1, until: 3, scale: 1.25 });
    target.update(0);
    const start = corners(target);
    expect(start).toEqual([-1, -1, 1, -1, 1, 1, -1, 1]);
    target.update(3);
    const end = corners(target);
    // The focus is left of the centre: the view is clamped to the page's left edge and grows right.
    expect(end[0]).toBeCloseTo(-1);
    expect(end[2]).toBeGreaterThan(1.4);
    expect(end[5]).toBeGreaterThan(1);
    target.update(0);
    expect(corners(target)).toEqual(start);
    target.update(3);
    expect(corners(target)).toEqual(end);
  });

  it('is build-only and one per page', () => {
    const target = page();
    target.push({ focus: [300, 280] });
    expect(() => {
      target.push({ focus: [300, 280] });
    }).toThrow(/one push per page/);
    const late = page();
    late.update(0);
    expect(() => {
      late.push({ focus: [300, 280] });
    }).toThrow(/build\(\)/);
  });
});
