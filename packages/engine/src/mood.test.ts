/**
 * Tension mood grade (PLAN.md#12.22): neutral band around 0.5, darker upper-luma colours when
 * tense, a small lift when calm, palette-pure maps that never touch text/outline colours, and a
 * grader that is off for films without graded shots.
 */
import { ambientShotInputs, type RenderManifest } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { applyTone } from './direction-frame.js';
import {
  blendMoodGrade,
  createMoodGrader,
  MOOD_MAX_DARKEN,
  MOOD_MAX_LIFT,
  moodGradeAmount,
  moodGradeMaps,
} from './mood.js';
import { hexToRgb, LUMA_WEIGHTS } from './palette.js';
import { resolveStyle } from './style.js';
import type { TimelineSample } from './timeline.js';

const style = resolveStyle({ style: 'voxel-pixel-crisp640' });
const pack = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map((value) => Math.round(value * 255));
  return ((r ?? 0) << 16) | ((g ?? 0) << 8) | (b ?? 0);
};
const lumaOf = (packed: number): number =>
  (((packed >> 16) & 255) * LUMA_WEIGHTS[0] +
    ((packed >> 8) & 255) * LUMA_WEIGHTS[1] +
    (packed & 255) * LUMA_WEIGHTS[2]) /
  255;
const maps = moodGradeMaps({
  swatches: style.swatches,
  variation: style.variation,
  protectedColors: [style.palette.text, style.palette.textDim, style.palette.outline],
});
const paletteKeys = new Set(Object.values(style.swatches).map(pack));

describe('moodGradeAmount', () => {
  it('is neutral around 0.5 and for a missing tension', () => {
    for (const tension of [undefined, 0.41, 0.5, 0.55, 0.599, Number.NaN]) {
      expect(moodGradeAmount(tension)).toBe(0);
    }
  });

  it('darkens from 0.6 up and lifts from 0.4 down, monotone and capped', () => {
    expect(moodGradeAmount(0.6)).toBeLessThan(0);
    expect(moodGradeAmount(0.85)).toBeLessThan(moodGradeAmount(0.6));
    expect(moodGradeAmount(1)).toBe(-MOOD_MAX_DARKEN);
    expect(moodGradeAmount(0.4)).toBeGreaterThan(0);
    expect(moodGradeAmount(0.15)).toBeGreaterThan(moodGradeAmount(0.4));
    expect(moodGradeAmount(0)).toBe(MOOD_MAX_LIFT);
  });

  it('blends linearly across a transition', () => {
    expect(blendMoodGrade(-0.6, 0.1, 0)).toBe(-0.6);
    expect(blendMoodGrade(-0.6, 0.1, 1)).toBe(0.1);
    expect(blendMoodGrade(-0.6, 0.2, 0.5)).toBeCloseTo(-0.2);
    expect(blendMoodGrade(-0.6, 0.2, 7)).toBe(0.2);
  });
});

describe('moodGradeMaps', () => {
  it('maps palette colours to darker / lighter palette colours only', () => {
    expect(maps.darker.size).toBeGreaterThan(4);
    expect(maps.lighter.size).toBeGreaterThan(3);
    for (const [from, to] of maps.darker) {
      expect(paletteKeys.has(from) && paletteKeys.has(to)).toBe(true);
      expect(lumaOf(to)).toBeLessThan(lumaOf(from));
    }
    for (const [from, to] of maps.lighter) {
      expect(paletteKeys.has(from) && paletteKeys.has(to)).toBe(true);
      expect(lumaOf(to)).toBeGreaterThan(lumaOf(from));
    }
  });

  it('never grades text, dim text or outline colours, and prefers the tone family', () => {
    for (const token of ['text', 'textDim', 'outline'] as const) {
      const key = pack(style.palette[token]);
      expect(maps.darker.has(key) || maps.lighter.has(key)).toBe(false);
      expect([...maps.darker.values(), ...maps.lighter.values()]).not.toContain(key);
    }
    const swatch = style.swatches;
    // brightTeal's family is [teal]; lightOrange's family starts with orange.
    expect(maps.darker.get(pack(swatch['brightTeal'] ?? ''))).toBe(pack(swatch['teal'] ?? ''));
    expect(maps.darker.get(pack(swatch['lightOrange'] ?? ''))).toBe(pack(swatch['orange'] ?? ''));
  });

  it('darkens a frame of upper-luma colours and keeps it in the palette', () => {
    const width = 16;
    const sources = [...maps.darker.keys()];
    const frame = new Uint8Array(width * 16 * 4);
    for (let index = 0; index < width * 16; index += 1) {
      const key = sources[index % sources.length] ?? 0;
      frame.set([(key >> 16) & 255, (key >> 8) & 255, key & 255, 255], index * 4);
    }
    const out = new Uint8Array(frame.length);
    applyTone(frame, width, maps, moodGradeAmount(0.95), out);
    let before = 0;
    let after = 0;
    for (let offset = 0; offset < frame.length; offset += 4) {
      const key =
        ((out[offset] ?? 0) << 16) | ((out[offset + 1] ?? 0) << 8) | (out[offset + 2] ?? 0);
      expect(paletteKeys.has(key)).toBe(true);
      before += lumaOf(
        ((frame[offset] ?? 0) << 16) | ((frame[offset + 1] ?? 0) << 8) | (frame[offset + 2] ?? 0),
      );
      after += lumaOf(key);
    }
    expect(after).toBeLessThan(before * 0.95);
  });
});

function manifest(tensions: readonly (number | undefined)[], enabled = true): RenderManifest {
  const shots = tensions.map((_, index) => ({
    id: `s${String(index + 1)}`,
    t0: index,
    t1: index + 1,
  }));
  const inputs = ambientShotInputs(shots.map(() => ({})));
  return {
    version: 1,
    fps: 30,
    seed: 7,
    ambientVariation: { enabled, seed: 7 },
    shots: shots.map((shot, index) => {
      const tension = tensions[index];
      const input = inputs[index];
      return {
        ...shot,
        scene: { file: 'a.js', source: '' },
        ...(input === undefined
          ? {}
          : { ambient: tension === undefined ? input : { ...input, tension } }),
      };
    }),
  };
}

const sample = (index: number, outgoing?: number, progress = 0): TimelineSample => ({
  current: { index, localTime: 0 },
  ...(outgoing === undefined
    ? {}
    : {
        transition: { type: 'crossfade', outgoing: { index: outgoing, localTime: 0.5 }, progress },
      }),
});

describe('createMoodGrader', () => {
  it('is off without tension, at neutral tension and with ambient variation off', () => {
    expect(createMoodGrader(manifest([undefined, undefined]), style)).toBeUndefined();
    expect(createMoodGrader(manifest([0.5, 0.45, 0.58]), style)).toBeUndefined();
    expect(createMoodGrader(manifest([0.9, 0.1], false), style)).toBeUndefined();
  });

  it('grades each shot by its tension and blends across transitions', () => {
    const grader = createMoodGrader(manifest([0.9, 0.5, 0.2]), style);
    expect(grader).toBeDefined();
    if (grader === undefined) return;
    const at = (value: TimelineSample): number => grader.amount(value);
    expect(at(sample(0))).toBeCloseTo(moodGradeAmount(0.9));
    expect(at(sample(1))).toBe(0);
    expect(at(sample(2))).toBeCloseTo(moodGradeAmount(0.2));
    expect(at(sample(1, 0, 0.5))).toBeCloseTo(moodGradeAmount(0.9) / 2);
  });

  it('is deterministic', () => {
    const grader = createMoodGrader(manifest([1]), style);
    if (grader === undefined) throw new Error('expected a grader');
    const frame = new Uint8Array(style.width * style.height * 4);
    const key = [...maps.darker.keys()][0] ?? 0;
    for (let offset = 0; offset < frame.length; offset += 4) {
      frame.set([(key >> 16) & 255, (key >> 8) & 255, key & 255, 255], offset);
    }
    const first = grader.apply(frame, -0.5).slice();
    const second = grader.apply(frame, -0.5).slice();
    expect(second).toEqual(first);
    expect(first).not.toEqual(frame);
  });
});
