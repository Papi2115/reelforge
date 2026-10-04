import { emptyTasteProfile, type StoryboardShot, type TasteSignal } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { sceneTasteFeatures, shotDecisionFeatures, shotTasteFeatures } from './features.js';
import {
  MAX_PROFILE_WORDS,
  applyTasteSignals,
  decayedTasteProfile,
  tastePreferences,
  tasteProfileText,
  tasteSignalCount,
} from './profile.js';

const SHOT: StoryboardShot = {
  id: 's03',
  t0: 4,
  t1: 11,
  treatment: 'ui-mockup',
  intent: 'A terminal.',
  scene: 'scenes/s03.js',
  roll: 'B',
  look: 'retro-ui',
  annotations: [{ kind: 'pin', phrase: 'terminal', reason: 'name' }],
};

const SOURCE = `export function build(ctx) {
  const { three, scene, palette, kit } = ctx;
  scene.background = new three.Color(palette.violet);
  scene.add(kit.env.retroDesktop({}), kit.env.lights({}), kit.fx.counter({ color: palette.pink }));
  const glow = palette.pink; const rim = palette.orange; const sky = palette.sky;
  return {};
}
export function update(t, state, ctx) {
  ctx.camera.orbit({ degrees: 40, t0: 1, t1: 4 });
  ctx.camera.rackFocus({ from: 2, to: 5, t0: 1, t1: 2 });
  ctx.annotate.ring({ target: [0, 0, 0], phrase: 'here' });
}
`;

const at = (iso: string): Date => new Date(iso);
const T0 = at('2026-10-01T00:00:00.000Z');

function pick(positive: string[], negative: string[]): TasteSignal {
  const parse = (key: string) => {
    const [feature, value] = key.split(':') as [string, string];
    return { feature: feature as 'look', value };
  };
  return { kind: 'pick', positive: positive.map(parse), negative: negative.map(parse) };
}

describe('taste features', () => {
  it('reads the storyboard entry: look, roll, treatment, tempo, planned density', () => {
    expect(shotTasteFeatures(SHOT)).toEqual([
      { feature: 'look', value: 'retro-ui' },
      { feature: 'roll', value: 'B' },
      { feature: 'treatment', value: 'ui-mockup' },
      { feature: 'tempo', value: 'slow' },
      { feature: 'density', value: 'light' },
    ]);
    const legacy = { ...SHOT, t1: 6, roll: undefined, look: undefined, annotations: undefined };
    expect(shotTasteFeatures(legacy).map((entry) => `${entry.feature}:${entry.value}`)).toEqual([
      'look:voxel',
      'treatment:ui-mockup',
      'tempo:fast',
    ]);
  });

  it('scans the scene: templates, background, accents, camera moves, mark density', () => {
    expect(sceneTasteFeatures(SOURCE, 7).map((entry) => `${entry.feature}:${entry.value}`)).toEqual(
      [
        'template:counter',
        'template:retroDesktop',
        'background:violet',
        'accent:pink',
        'accent:orange',
        'camera:orbit',
        'camera:rackFocus',
        'density:light',
      ],
    );
    // The scene's density wins over the planned one; each pair once.
    const merged = shotDecisionFeatures(SHOT, SOURCE).map((e) => `${e.feature}:${e.value}`);
    expect(merged.filter((key) => key.startsWith('density:'))).toEqual(['density:light']);
    expect(new Set(merged).size).toBe(merged.length);
  });
});

describe('taste profile', () => {
  it('needs enough decisions and evidence before it says anything', () => {
    const empty = emptyTasteProfile();
    expect(tasteProfileText(empty, T0)).toBeUndefined();
    const one = applyTasteSignals(empty, [pick(['camera:orbit'], ['camera:pushIn'])], T0);
    expect(tasteSignalCount(one)).toBe(1);
    expect(tasteProfileText(one, T0)).toBeUndefined();
    expect(tastePreferences(one, T0)).toEqual([]);
  });

  it('learns from a series of decisions and condenses it deterministically', () => {
    const signals = [
      pick(['camera:orbit', 'look:retro-ui'], ['camera:pushIn', 'background:violet']),
      pick(['camera:orbit', 'look:retro-ui'], ['background:violet']),
      pick(['camera:orbit', 'tempo:slow'], ['background:violet', 'look:diorama']),
      { kind: 'lock', positive: [{ feature: 'look', value: 'retro-ui' }], negative: [] },
    ] satisfies TasteSignal[];
    const file = applyTasteSignals(emptyTasteProfile(), signals, T0);
    expect(file.signals).toEqual({ pick: 3, keep: 0, discard: 0, lock: 1, rebuild: 0 });
    const text = tasteProfileText(file, T0);
    expect(text).toBe(
      'Prefers orbit camera moves, the retro-ui look. Usually turns down violet backgrounds.',
    );
    expect(tasteProfileText(structuredClone(file), T0)).toBe(text);
    expect(tastePreferences(file, T0).find((entry) => entry.value === 'orbit')).toMatchObject({
      feature: 'camera',
      value: 'orbit',
      strength: 0.75,
      evidence: 3,
    });
    // Counters are stored sorted (stable JSON).
    const keys = file.counters.map((counter) => `${counter.feature}:${counter.value}`);
    expect(keys).toEqual([...keys].sort());
  });

  it('decays old evidence: half after the half-life, gone below the threshold later', () => {
    const signals = [1, 2, 3].map(() => pick(['camera:orbit'], ['background:violet']));
    const file = applyTasteSignals(emptyTasteProfile(), signals, T0);
    const later = decayedTasteProfile(file, at('2026-11-30T00:00:00.000Z'));
    expect(later.counters.find((counter) => counter.value === 'orbit')?.positive).toBe(1.5);
    expect(tasteProfileText(file, at('2026-11-30T00:00:00.000Z'))).toBeUndefined();
    expect(tasteProfileText(file, T0)).toContain('orbit');
  });

  it('ignores a value on both sides of one decision and caps the text at 120 words', () => {
    const both = applyTasteSignals(
      emptyTasteProfile(),
      [pick(['camera:orbit'], ['camera:orbit'])],
      T0,
    );
    expect(both.counters).toEqual([
      { feature: 'camera', value: 'orbit', positive: 1, negative: 0 },
    ]);
    const names = (prefix: string): string[] =>
      Array.from({ length: 12 }, (_, k) => `${prefix}${String(k)}`);
    const many = Array.from({ length: 30 }, () =>
      pick(names('template:averyveryverylongtemplatename'), names('accent:longswatchname')),
    );
    const text = tasteProfileText(applyTasteSignals(emptyTasteProfile(), many, T0), T0) ?? '';
    expect(text.split(/\s+/).length).toBeLessThanOrEqual(MAX_PROFILE_WORDS);
  });
});
