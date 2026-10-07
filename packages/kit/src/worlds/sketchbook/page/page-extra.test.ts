/**
 * The page methods of looks B and C (PLAN.md#13.6) without a browser: the flipbook (its pages,
 * riffle window, purity, sealing), the ruler (only while it is slid in), kraft / sticky / envelope
 * sheets, the chisel nib of big marker words and the torn stubs in the spiral.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../../kit.js';
import { hexPixel } from '../../../looks/blueprint/raster.js';
import { SKETCHBOOK_PALETTE } from '../../../testing/palettes.js';
import { testRng } from '../../../testing/rng.js';
import { SKETCHBOOK_STYLE } from '../style.js';
import type { PageApi } from './api.js';

type Page = THREE.Group & PageApi & { update(t: number): void };
type Book = { page(index: unknown): PageApi };

const SIZE = [480, 270] as const;

function page(params: Record<string, unknown> = {}): Page {
  const { api } = createKit({
    three: THREE,
    palette: SKETCHBOOK_PALETTE,
    rng: testRng(4),
    style: 'sketchbook',
  });
  const factory = (api.fx as unknown as Record<string, (p: unknown) => Page>)['sketchPage'];
  if (!factory) throw new Error('sketchPage is not bound');
  return factory({ size: SIZE, seed: 11, pen: false, ...params });
}

function pixelsAt(target: Page, t: number): Uint32Array {
  target.update(t);
  const mesh = target.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  const texture = mesh.material.uniforms['map']?.value as THREE.DataTexture;
  return new Uint32Array(Uint8Array.from(texture.image.data as Uint8Array).buffer);
}

function same(a: Uint32Array, b: Uint32Array): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function count(pixels: Uint32Array, swatch: string): number {
  const colour = hexPixel(
    (SKETCHBOOK_STYLE.palette as Record<string, string>)[swatch] ?? '#000000',
  );
  return pixels.reduce((total, pixel) => total + (pixel === colour ? 1 : 0), 0);
}

/** A three-page flipbook: a number per page, riffled between 1 and 2 s. */
function flipbook(): Page {
  const target = page();
  const book = target.flipbook({ count: 3, at: 1, until: 2 }) as Book;
  ['325', '900', '1582'].forEach((year, index) => {
    book.page(index).write(year, { x: 500, y: 200, size: 90, hand: 'marker', tool: 'marker' });
  });
  return target;
}

describe('page.flipbook', () => {
  it('shows page 0 before the riffle, the last page after it, and riffles in between', () => {
    const target = flipbook();
    const first = pixelsAt(target, 0.2);
    expect(same(first, pixelsAt(target, 0.9))).toBe(true);
    const last = pixelsAt(target, 2.5);
    expect(same(first, last)).toBe(false);
    expect(same(last, pixelsAt(target, 4))).toBe(true);
    const middle = pixelsAt(target, 1.3);
    expect(same(middle, first) || same(middle, last)).toBe(false);
  });

  it('is a pure function of t in any seek order', () => {
    const [a, b] = [flipbook(), flipbook()];
    const times = [0.5, 1.25, 1.5, 1.8, 3];
    const forward = times.map((t) => pixelsAt(a, t));
    const backward = [...times]
      .reverse()
      .map((t) => pixelsAt(b, t))
      .reverse();
    forward.forEach((frame, index) => {
      expect(same(frame, backward[index] ?? new Uint32Array()), `t=${String(times[index])}`).toBe(
        true,
      );
    });
  });

  it('checks its pages and seals them with the page', () => {
    const target = page();
    const book = target.flipbook({ count: 2, until: 2 }) as Book;
    expect(() => book.page(2)).toThrow(/index must be an integer 0-1/);
    expect(() => target.flipbook({ count: 1, until: 2 })).toThrow(/count/);
    expect(() => target.flipbook({ count: 3, at: 2, until: 1 })).toThrow(/until must be after at/);
    target.update(0);
    expect(() => book.page(0).write('late', { x: 1, y: 1 })).toThrow(/before the first update/);
  });
});

describe('page.ruler', () => {
  it('is on the page only while slid in (in place at `at`, gone 0.32 s after `until`)', () => {
    const plain = page();
    const ruled = page();
    ruled.ruler(30, 240, { at: 1, until: 2 });
    for (const t of [0.5, 2.5])
      expect(same(pixelsAt(ruled, t), pixelsAt(plain, t)), `t=${String(t)}`).toBe(true);
    expect(same(pixelsAt(ruled, 1.5), pixelsAt(plain, 1.5))).toBe(false);
    expect(() => {
      page().ruler('left', 1, { at: 1, until: 2 });
    }).toThrow(/x and y must be numbers/);
  });
});

describe('sheets, nibs and stubs', () => {
  it('paints kraft envelopes and sticky notes in their own inks', () => {
    const kraft = page();
    kraft.sheet({ x: 100, y: 80, w: 500, h: 300, paper: 'kraft', envelope: true });
    const sticky = page();
    sticky.sheet({ x: 100, y: 80, w: 300, h: 300, paper: 'sticky' });
    const plain = page();
    plain.sheet({ x: 100, y: 80, w: 500, h: 300 });
    expect(count(pixelsAt(kraft, 1), 'kraft')).toBeGreaterThan(20_000);
    expect(count(pixelsAt(kraft, 1), 'kraftDark')).toBeGreaterThan(
      count(pixelsAt(plain, 1), 'kraftDark'),
    );
    expect(count(pixelsAt(sticky, 1), 'sticky')).toBeGreaterThan(10_000);
    expect(count(pixelsAt(plain, 1), 'kraft')).toBe(0);
  });

  it('writes big marker words with a wider chisel nib when asked', () => {
    const word = { x: 100, y: 300, size: 150, hand: 'marker', tool: 'marker', at: 0, until: 0.5 };
    const thin = page();
    thin.write('365', word);
    const wide = page();
    wide.write('365', { ...word, nib: [19, -42, 3] });
    expect(count(pixelsAt(wide, 2), 'ink')).toBeGreaterThan(count(pixelsAt(thin, 2), 'ink') * 1.3);
  });

  it('leaves stubs of a torn-out page in the spiral only', () => {
    const [torn, whole] = [pixelsAt(page({ torn: true }), 1), pixelsAt(page(), 1)];
    const changed = [...torn.keys()].filter((index) => torn[index] !== whole[index]);
    expect(changed.length).toBeGreaterThan(50);
    expect(Math.max(...changed.map((index) => index % SIZE[0]))).toBeLessThan(
      60 * (SIZE[0] / 960) + 2,
    );
  });
});
