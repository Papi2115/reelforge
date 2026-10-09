import { describe, expect, it } from 'vitest';
import {
  EXPORT_PRESET_IDS,
  isExportPresetId,
  orientedPreset,
  resolveOutputScale,
} from './presets.js';

describe('resolveOutputScale', () => {
  it.each([
    ['1080p30', 640, 360, 3, 1920, 1080],
    ['1440p', 640, 360, 4, 2560, 1440],
    ['4k', 640, 360, 6, 3840, 2160],
    ['1080p30', 480, 270, 4, 1920, 1080],
    ['4k', 480, 270, 8, 3840, 2160],
  ] as const)('%s from %ix%i is x%i (%ix%i)', (preset, width, height, factor, outW, outH) => {
    const scale = resolveOutputScale(preset, width, height);
    expect(scale.ok).toBe(true);
    if (!scale.ok) return;
    expect(scale.value).toMatchObject({
      factor,
      outputWidth: outW,
      outputHeight: outH,
      renderWidth: width,
      renderHeight: height,
    });
  });

  it('rejects a non-integer factor with a message naming the presets that fit', () => {
    const scale = resolveOutputScale('1440p', 480, 270);
    expect(scale.ok).toBe(false);
    if (scale.ok) return;
    expect(scale.error.kind).toBe('preset-mismatch');
    expect(scale.error.message).toContain('not an integer multiple');
    expect(scale.error.message).toContain('x5.33');
    expect(scale.error.message).toContain('presets that fit: 1080p30, 4k');
  });

  it('rejects a different aspect ratio', () => {
    const scale = resolveOutputScale('1080p30', 640, 480);
    expect(!scale.ok && scale.error.kind).toBe('preset-mismatch');
  });

  it('turns the presets upright for a portrait render (PLAN.md#13.18)', () => {
    const cases = [
      ['1080p30', 1080, 1920, 3],
      ['1440p', 1440, 2560, 4],
      ['4k', 2160, 3840, 6],
    ] as const;
    for (const [id, width, height, factor] of cases) {
      const scale = resolveOutputScale(id, 360, 640);
      expect(scale.ok && scale.value).toMatchObject({
        factor,
        outputWidth: width,
        outputHeight: height,
        renderWidth: 360,
        renderHeight: 640,
      });
    }
    expect(orientedPreset('1080p30', 360, 640)).toMatchObject({ width: 1080, height: 1920 });
    expect(orientedPreset('1080p30', 640, 360)).toMatchObject({ width: 1920, height: 1080 });
  });

  it('rejects invalid sizes', () => {
    expect(resolveOutputScale('1080p30', 0, 360).ok).toBe(false);
    expect(resolveOutputScale('1080p30', 640.5, 360).ok).toBe(false);
  });

  it('knows its preset ids', () => {
    expect(EXPORT_PRESET_IDS).toEqual(['1080p30', '1440p', '4k']);
    expect(isExportPresetId('4k')).toBe(true);
    expect(isExportPresetId('8k')).toBe(false);
  });
});
