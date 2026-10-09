import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit, kitCatalog } from '../kit.js';
import { CRISP_PALETTE } from '../testing/palettes.js';
import { testRng } from '../testing/rng.js';
import {
  END_CARD_FRAME_HEIGHT,
  endCardLayout,
  endCardNameScale,
  splitEndCardText,
  type EndCardFormat,
} from './end-card.js';

function card(format: EndCardFormat) {
  const kit = createKit({ three: THREE, palette: CRISP_PALETTE, rng: testRng(3) });
  return kit.api.fx.endCard({ format, duration: 2 });
}

function pose(object: THREE.Object3D): string {
  const parts: string[] = [];
  object.traverse((child) => {
    parts.push(
      [
        child.visible,
        ...child.position.toArray().map((value) => value.toFixed(5)),
        ...child.scale.toArray().map((value) => value.toFixed(5)),
        child.rotation.y.toFixed(5),
      ].join(','),
    );
  });
  return parts.join('|');
}

describe('kit.fx.endCard', () => {
  it('is bound in the kit but never in the catalog (Claude never writes an end card)', () => {
    expect(kitCatalog().fx.map((entry) => entry.name)).not.toContain('endCard');
  });

  it('pops the badge in, holds it and shrinks it away by the end, deterministically', () => {
    for (const format of ['portrait', 'landscape'] as const) {
      const fx = card(format);
      const badge = fx.children[0];
      if (badge === undefined) throw new Error('no badge');
      fx.update(0);
      expect(badge.visible).toBe(false);
      fx.update(1);
      expect(badge.visible).toBe(true);
      expect(badge.scale.x).toBeCloseTo(1, 5);
      fx.update(2);
      expect(badge.visible).toBe(false);
      fx.update(0.7);
      const first = pose(fx);
      fx.update(1.6);
      expect(pose(fx)).not.toBe(first);
      fx.update(0.7);
      expect(pose(fx)).toBe(first);
    }
  });

  it('keeps the badge in the safe band of the frame', () => {
    for (const format of ['portrait', 'landscape'] as const) {
      const layout = endCardLayout(format);
      const fx = card(format);
      fx.update(1);
      const badge = fx.children[0];
      const top = (0.5 - layout.badgeY - layout.badgeSize / 2) * END_CARD_FRAME_HEIGHT;
      expect(badge?.position.y ?? 0).toBeLessThan(
        0.5 * END_CARD_FRAME_HEIGHT - 0.12 * END_CARD_FRAME_HEIGHT,
      );
      expect(top).toBeGreaterThan(-0.3 * END_CARD_FRAME_HEIGHT);
      expect(layout.leadY).toBeGreaterThan(layout.badgeY + layout.badgeSize / 2);
      expect(layout.nameY).toBeLessThan(0.7);
    }
  });

  it('splits the text at its colon and sizes the channel name by its length', () => {
    expect(splitEndCardText('Full video on YT: Voxplain')).toEqual({
      lead: 'Full video on YT:',
      name: 'Voxplain',
    });
    expect(splitEndCardText('Watch the film')).toEqual({ lead: undefined, name: 'Watch the film' });
    expect(endCardNameScale('portrait', 'Voxplain')).toBe(4);
    expect(endCardNameScale('portrait', 'Voxplain Science')).toBe(2);
    expect(endCardNameScale('landscape', 'Voxplain')).toBe(5);
  });
});
