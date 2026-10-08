/**
 * Readability rules of the hand and the item icons (real run Game B2 2): a take that is still
 * swinging back when the shot cuts blinks the item out at a continuity seam, so it must settle
 * before the end; a pixel-art icon too small to read in the inventory is refused.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../../kit.js';
import { testRng } from '../../../testing/rng.js';
import { compileIcon } from '../assets/pack.js';
import { GAME_B2_ID } from '../index.js';
import { B2_TABLE } from '../palette.js';

const PALETTE: Readonly<Record<string, string>> = Object.fromEntries(
  B2_TABLE.map(([, swatch, hex]) => [swatch, hex]),
);

type View = Record<string, (...args: unknown[]) => unknown>;

function view(duration?: number): View {
  const fx: Readonly<Record<string, unknown>> = createKit({
    three: THREE,
    palette: PALETTE,
    rng: testRng(5),
    style: GAME_B2_ID,
  }).api.fx;
  const factory = fx['b2View'] as (params: Record<string, unknown>) => View;
  return factory({
    level: 'warehouse',
    path: [{ at: 0, x: 2.5, y: 8.5, yaw: 0 }],
    seed: 2,
    ...(duration === undefined ? {} : { duration }),
  });
}

const NOTE = { kind: 'note', label: 'MAP' };
const FROM = [3.5, 7.05, 0.45];

describe('take settles before the cut', () => {
  it('refuses a take still swinging back at the end of the shot, with the start to use', () => {
    expect(() => view(4)['take']?.(NOTE, { at: 2.5, from: FROM })).toThrow(
      /still swinging back .*\(back at 4\.20 s, the shot ends at 4\.00 s\).*start it by 2\.00 s/,
    );
    expect(view(4)['take']?.(NOTE, { at: 2, from: FROM })).toEqual({ at: 2, end: 3.7 });
  });

  it('allows a late take that lowers on purpose (until) or a view without a duration', () => {
    expect(() => view(4)['take']?.(NOTE, { at: 2.5, from: FROM, until: 3.9 })).not.toThrow();
    expect(() => view()['take']?.(NOTE, { at: 2.5, from: FROM })).not.toThrow();
  });
});

describe('icon size', () => {
  const art = (rows: string[]) => compileIcon('icons.x', { rows, legend: { o: 'sand' } });

  it('refuses a dot-sized icon and names the size it has', () => {
    const tiny = art(['........', '..oooo..', '..oooo..', '..oooo..', '..oooo..', '........']);
    expect(tiny.ok).toBe(false);
    if (!tiny.ok) expect(tiny.errors.join()).toMatch(/icons\.x: the icon is 4 x 4 px with 16/);
  });

  it('accepts a bold silhouette filling the grid', () => {
    const rows = Array.from({ length: 11 }, (_, y) =>
      y === 0 || y === 10 ? '...oooooo...' : '.oooooooooo.',
    );
    expect(art(rows).ok).toBe(true);
    expect(compileIcon('icons.y', { gen: 'icon', kind: 'book' }).ok).toBe(true);
  });
});
