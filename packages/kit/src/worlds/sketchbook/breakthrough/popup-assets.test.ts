/**
 * Film assets on pop-up pieces (real run Sketchbook 4): a cutout or card with `asset` draws the
 * project's figure or prop (the page's `library`) instead of its `draw`, pure in t; an unknown id
 * is a readable error.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../../kit.js';
import { SKETCHBOOK_PALETTE } from '../../../testing/palettes.js';
import { testRng } from '../../../testing/rng.js';
import { InkCanvas } from '../draw/canvas.js';
import { sketchPageModel } from '../page/sketch-page.js';

interface Page {
  popup(spec: unknown): { open: number; pulled: number };
  update(t: number): void;
}

const FARMER = {
  version: 1,
  id: 'farmer',
  kind: 'figure',
  description: 'The farmer with a hood and a pitchfork',
  spec: { clothes: 'vest', hat: 'brim', holds: 'axe' },
};
const HUT = {
  version: 1,
  id: 'hut',
  kind: 'prop',
  description: 'The village hut',
  spec: { draw: 'building', type: 'tower', h: 140 },
};

function page(): Page {
  const { api } = createKit({
    three: THREE,
    palette: SKETCHBOOK_PALETTE,
    rng: testRng(4),
    style: 'sketchbook',
  });
  const make = (api.fx as unknown as Record<string, (p: unknown) => Page>)['sketchPage'];
  if (!make) throw new Error('sketchPage is not bound');
  return make({ size: [960, 540], seed: 21, duration: 8, pen: false, library: [FARMER, HUT] });
}

function inked(target: Page, t: number): number {
  const model = sketchPageModel(target);
  if (!model) throw new Error('no model');
  const canvas = new InkCanvas(960, 540);
  model.render(canvas, t);
  const blank = new InkCanvas(960, 540);
  model.render(blank, -10);
  return canvas.data.reduce(
    (total, value, index) => total + (value === blank.data[index] ? 0 : 1),
    0,
  );
}

function popup(cutout: Record<string, unknown>, card: Record<string, unknown>): unknown {
  return {
    intent: 'the farmer rises out of the snow next to his hut',
    at: 0.36,
    elements: [
      { kind: 'cutout', id: 'farmer', u: 120, at: 0.36, ...cutout },
      { kind: 'card', id: 'hut', u: 300, v: 60, w: 120, h: 110, ...card },
    ],
    pull: { at: 2.4, motions: [{ target: 'hut', to: { y: 20 } }] },
  };
}

describe('pop-up pieces with film assets', () => {
  it('draws the film figure and prop on the pieces instead of their own drawing', () => {
    const plain = page();
    plain.popup(popup({ draw: 'none', text: 'FARMER' }, { text: 'HUT' }));
    const withAssets = page();
    withAssets.popup(popup({ asset: 'farmer', text: 'FARMER' }, { asset: 'hut', text: 'HUT' }));
    expect(inked(withAssets, 4.5)).toBeGreaterThan(inked(plain, 4.5) + 500);
  });

  it('is a pure function of t in any seek order', () => {
    const spec = popup({ asset: 'farmer' }, { asset: 'hut' });
    const [a, b] = [page(), page()];
    a.popup(spec);
    b.popup(spec);
    const times = [0.2, 1.4, 2.9, 4.5];
    const forward = times.map((t) => inked(a, t));
    const backward = [...times]
      .reverse()
      .map((t) => inked(b, t))
      .reverse();
    expect(backward).toEqual(forward);
  });

  it('says which asset is missing', () => {
    expect(() => page().popup(popup({ asset: 'pig' }, { text: 'HUT' }))).toThrow(
      /asset "pig".*no figure "pig"/,
    );
    expect(() => page().popup(popup({ asset: 'Pig!' }, { text: 'HUT' }))).toThrow(/asset/);
  });
});
