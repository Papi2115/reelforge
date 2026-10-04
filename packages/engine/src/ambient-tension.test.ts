/**
 * Tension map in the engine (PLAN.md#12.22): the darker member of every tone family comes from
 * the style palette's luma; a manifest shot's `tension` darkens tones and reaches
 * `ctx.ambient.tension`; neutral tension renders the parameters of a shot without one.
 */
import type { RenderManifest } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { createAmbientApi, darkerTones, shotAmbient } from './ambient.js';
import { hexToRgb, LUMA_WEIGHTS } from './palette.js';
import { resolveStyle } from './style.js';

const style = resolveStyle({});

function film(tension: number | undefined, count = 24): RenderManifest {
  return {
    version: 1,
    fps: 30,
    seed: 2115,
    ambientVariation: { enabled: true, seed: 2115 },
    shots: Array.from({ length: count }, (_, index) => ({
      id: `s${String(index + 1).padStart(2, '0')}`,
      t0: index * 5,
      t1: (index + 1) * 5,
      scene: { file: 'scenes/x.js', source: 'x' },
      ambient: { index, act: 0, ...(tension === undefined ? {} : { tension }) },
    })),
  };
}

const luma = (hex: string): number => {
  const [red, green, blue] = hexToRgb(hex);
  return red * LUMA_WEIGHTS[0] + green * LUMA_WEIGHTS[1] + blue * LUMA_WEIGHTS[2];
};

describe('darkerTones', () => {
  it('picks the closest darker member of each family from the palette', () => {
    const budget = style.variation['voxel'];
    if (budget === undefined) throw new Error('crisp640 has a voxel budget');
    const darker = darkerTones(budget, style.swatches);
    expect(darker).toMatchObject({ indigo: 'navy', purple: 'indigo', violet: 'purple' });
    expect(darker).not.toHaveProperty('black');
    for (const [family, member] of Object.entries(darker)) {
      expect(budget.tones[family]).toContain(member);
      expect(luma(style.swatches[member] ?? '')).toBeLessThan(luma(style.swatches[family] ?? ''));
    }
  });
});

describe('shotAmbient with tension', () => {
  it('darkens the tones of a tense film and exposes the tension to scenes', () => {
    const tense = film(1);
    const params = shotAmbient(tense, style, 3);
    expect(params?.tension).toBe(1);
    expect(params?.tones).toMatchObject({ indigo: 'navy', purple: 'indigo' });
    const api = createAmbientApi(params);
    expect(api.tension).toBe(1);
    expect(api.tone('purple')).toBe('indigo');
  });

  it('neutral tension keeps the parameters of a shot without a tension map', () => {
    const plain = film(undefined);
    const neutral = film(0.5);
    for (let index = 0; index < plain.shots.length; index += 1) {
      const { tension, ...rest } = shotAmbient(neutral, style, index) ?? { tension: undefined };
      expect(tension).toBe(0.5);
      expect(rest).toEqual(shotAmbient(plain, style, index));
    }
    expect(createAmbientApi(shotAmbient(plain, style, 0)).tension).toBeUndefined();
    expect(createAmbientApi(undefined).tension).toBeUndefined();
  });
});
