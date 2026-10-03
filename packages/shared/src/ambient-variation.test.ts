import { describe, expect, it } from 'vitest';
import {
  ambientShotInputs,
  ambientShotSchema,
  ambientVariationSettingsSchema,
  variationBudgetSchema,
  type VariationBudgetInput,
} from './ambient-variation.js';
import { projectAmbientVariation, projectFileSchema } from './project.js';
import { renderManifestSchema } from './render-manifest.js';
import { stylePresetSchema } from './style-preset.js';

const BUDGET: VariationBudgetInput = {
  tones: { navy: ['indigo'] },
  toneShare: 0.3,
  steps: 5,
  cell: [0.8, 1.25],
  horizon: [-0.06, 0.08],
  fade: [0.85, 1.2],
  lightAzimuth: [-24, 24],
  lightElevation: [-8, 8],
  debris: [0.75, 1.3],
  cameraDrift: [1.2, 0.5],
};

const PRESET = {
  version: 1,
  id: 'tiny',
  name: 'Tiny',
  resolution: { width: 64, height: 36 },
  palette: { navy: '#000011', indigo: '#110022', cream: '#eeeeee' },
  tokens: {
    sky: 'navy',
    ground: 'indigo',
    groundAlt: 'indigo',
    hero: 'cream',
    heroTrim: 'cream',
    accent1: 'cream',
    accent2: 'cream',
    accent3: 'cream',
    accent4: 'cream',
    keyLight: 'cream',
    fillLight: 'cream',
    shadow: 'navy',
    text: 'cream',
    textDim: 'cream',
    outline: 'navy',
  },
  dither: { matrix: 'bayer4', spread: 0.1 },
};

describe('variation budget schema', () => {
  it('accepts a budget and needs the neutral value inside every range', () => {
    expect(variationBudgetSchema.safeParse(BUDGET).success).toBe(true);
    expect(variationBudgetSchema.safeParse({ ...BUDGET, cell: [1.1, 1.3] }).success).toBe(false);
    expect(variationBudgetSchema.safeParse({ ...BUDGET, horizon: [0.1, -0.1] }).success).toBe(
      false,
    );
    expect(variationBudgetSchema.safeParse({ ...BUDGET, steps: 2 }).success).toBe(false);
    expect(variationBudgetSchema.safeParse({ ...BUDGET, lightAzimuth: [-90, 0] }).success).toBe(
      false,
    );
  });

  it('lets presets carry budgets whose tones are palette swatches only', () => {
    expect(stylePresetSchema.safeParse(PRESET).success).toBe(true);
    expect(stylePresetSchema.safeParse({ ...PRESET, variation: { voxel: BUDGET } }).success).toBe(
      true,
    );
    const offPalette = stylePresetSchema.safeParse({
      ...PRESET,
      variation: { voxel: { ...BUDGET, tones: { navy: ['#123456'], teal: ['navy'] } } },
    });
    expect(offPalette.success).toBe(false);
    expect(offPalette.error?.issues.map((issue) => issue.path.join('.'))).toEqual([
      'variation.voxel.tones.navy.0',
      'variation.voxel.tones.teal',
    ]);
    const token = stylePresetSchema.safeParse({
      ...PRESET,
      variation: { voxel: { ...BUDGET, tones: { navy: ['sky'] } } },
    });
    expect(token.success).toBe(false);
  });
});

describe('ambient variation switch', () => {
  it('is off for projects without the field', () => {
    const project = projectFileSchema.parse({
      version: 1,
      title: 'Nokia',
      language: 'en',
      style: 'voxel-pixel-crisp640',
      fps: 30,
      seed: 1,
    });
    expect(projectAmbientVariation(project)).toBe(false);
    expect(projectAmbientVariation({ ambientVariation: true })).toBe(true);
  });

  it('validates the manifest settings and per-shot inputs', () => {
    const shot = { id: 's01', t0: 0, t1: 2, scene: { file: 'a.js', source: 'x' } };
    const base = { version: 1, fps: 30, seed: 1, shots: [shot] };
    expect(renderManifestSchema.safeParse(base).success).toBe(true);
    const on = {
      ...base,
      ambientVariation: { enabled: true, seed: 1 },
      shots: [{ ...shot, ambient: { index: 0, act: 0, roll: 'A', look: 'voxel', scale: 1.5 } }],
    };
    expect(renderManifestSchema.safeParse(on).success).toBe(true);
    expect(ambientVariationSettingsSchema.safeParse({ enabled: true, seed: -1 }).success).toBe(
      false,
    );
    expect(
      ambientVariationSettingsSchema.safeParse({ enabled: true, seed: 1, scale: 3 }).success,
    ).toBe(false);
    expect(ambientShotSchema.safeParse({ index: 0, act: 0, roll: 'D' }).success).toBe(false);
  });

  it('derives index, act (new act at every non-cut transition), roll and look', () => {
    expect(
      ambientShotInputs([
        { roll: 'C', look: 'voxel' },
        { roll: 'A', transitionIn: { type: 'cut' } },
        { roll: 'B', look: 'retro-ui', transitionIn: { type: 'glitch', duration: 0.3 } },
        {},
        { transitionIn: { type: 'crossfade', duration: 0.5 } },
      ]),
    ).toEqual([
      { index: 0, act: 0, roll: 'C', look: 'voxel' },
      { index: 1, act: 0, roll: 'A' },
      { index: 2, act: 1, roll: 'B', look: 'retro-ui' },
      { index: 3, act: 1 },
      { index: 4, act: 2 },
    ]);
  });
});
