/**
 * Marks that appear by themselves (draw/appear.ts): never stroke by stroke and never with the
 * hand. `bloom` soaks in pixel by pixel, `type` pops the letters in one by one, `pop` is there at
 * once; `parallel: true` blooms; all pure in t.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../../kit.js';
import { hexPixel } from '../../../looks/blueprint/raster.js';
import { SKETCHBOOK_PALETTE } from '../../../testing/palettes.js';
import { testRng } from '../../../testing/rng.js';
import type { PageApi } from './api.js';
import { sketchPageModel } from './sketch-page.js';

type Page = THREE.Group & PageApi & { update(t: number): void };

function page(): Page {
  const { api } = createKit({
    three: THREE,
    palette: SKETCHBOOK_PALETTE,
    rng: testRng(4),
    style: 'sketchbook',
  });
  const factory = (api.fx as unknown as Record<string, (p: unknown) => Page>)['sketchPage'];
  if (!factory) throw new Error('sketchPage is not bound');
  return factory({ size: [960, 540], seed: 11 });
}

const INK = hexPixel(SKETCHBOOK_PALETTE['ink'] ?? '#1d1b20');

function ink(target: Page, t: number): number {
  target.update(t);
  const mesh = target.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  const texture = mesh.material.uniforms['map']?.value as THREE.DataTexture;
  const pixels = new Uint32Array(Uint8Array.from(texture.image.data as Uint8Array).buffer);
  return pixels.reduce((total, pixel) => total + (pixel === INK ? 1 : 0), 0);
}

function label(options: Record<string, unknown>): Page {
  const target = page();
  target.write('LABEL TEXT', { x: 300, y: 300, size: 40, at: 1, ...options });
  return target;
}

describe('appear: no hand, never stroke by stroke', () => {
  it('blooms in pixel by pixel over ~0.36 s, the whole word at once (no hand on it)', () => {
    const target = label({ appear: 'bloom' });
    const [none, part, full] = [0.99, 1.12, 1.5].map((t) => ink(target, t));
    expect(none).toBe(0);
    expect(part).toBeGreaterThan(0);
    expect(part).toBeLessThan((full ?? 0) * 0.8);
    const model = sketchPageModel(target);
    expect(model?.probe(1.12).pen).toBeNull();
    expect(model?.probe(1.12).drawing).toEqual([]);
  });

  it('types the letters in one by one, pops all at once, blooms with parallel', () => {
    const typed = label({ appear: 'type' });
    const counts = [1.02, 1.2, 1.6].map((t) => ink(typed, t));
    expect(counts[0]).toBeLessThan(counts[1] ?? 0);
    expect(counts[1]).toBeLessThan(counts[2] ?? 0);
    const popped = label({ appear: 'pop' });
    expect(ink(popped, 0.99)).toBe(0);
    expect(ink(popped, 1)).toBe(ink(popped, 1.05));
    const parallel = label({ parallel: true });
    expect(ink(parallel, 1.12)).toBe(ink(label({ appear: 'bloom' }), 1.12));
  });

  it('is a pure function of t in any seek order', () => {
    const [a, b] = [label({ appear: 'bloom' }), label({ appear: 'bloom' })];
    const forward = [1.05, 1.15, 1.3].map((t) => ink(a, t));
    const backward = [1.3, 1.15, 1.05].map((t) => ink(b, t)).reverse();
    expect(backward).toEqual(forward);
  });
});
