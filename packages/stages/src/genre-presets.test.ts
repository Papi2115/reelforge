/**
 * Genre presets (PLAN.md#13.8) against the packages they name: shared cannot import the engine,
 * the kit or the pipeline, so the ids in its table are checked here. Also the script tone var.
 */
import { STYLE_REGISTRY } from '@reelforge/engine';
import { isUnwiredWorldStyle, LOOKS } from '@reelforge/kit';
import { MUSIC_MOODS } from '@reelforge/pipeline';
import { GENRE_MUSIC_MOODS, GENRE_PRESETS, resolveGenrePreset } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { scriptToneVar } from './stages/script.js';

describe('genre preset table vs the registries', () => {
  it('mirrors the music engine moods', () => {
    expect([...GENRE_MUSIC_MOODS]).toEqual([...MUSIC_MOODS]);
  });

  it('names only registered styles and built-in looks', () => {
    const lookIds = new Set(LOOKS.map((look) => look.id));
    for (const preset of GENRE_PRESETS) {
      for (const style of preset.styles) expect(STYLE_REGISTRY.allIds).toContain(style);
      for (const look of preset.preferredLooks ?? []) expect(lookIds.has(look)).toBe(true);
    }
  });

  it('skips worlds that are not wired, with the same answer as the stages', () => {
    // The app's rule with Experimental worlds on: registered and not an unwired world.
    const offered = (id: string): boolean =>
      STYLE_REGISTRY.allIds.includes(id) && !isUnwiredWorldStyle(id);
    for (const preset of GENRE_PRESETS) {
      const style = resolveGenrePreset(preset.id, { isStyleAvailable: offered })?.style;
      expect(style).toBeDefined();
      expect(isUnwiredWorldStyle(style)).toBe(false);
    }
  });
});

describe('scriptToneVar', () => {
  it('is the brief tone (or "not specified") without a preset', () => {
    expect(scriptToneVar('friendly, hands-on', undefined)).toBe('friendly, hands-on');
    expect(scriptToneVar(undefined, undefined)).toBe('not specified');
  });

  it("appends the preset's hint to the brief tone", () => {
    expect(scriptToneVar('friendly', 'calm and precise')).toBe('friendly; genre: calm and precise');
    expect(scriptToneVar(undefined, 'calm and precise')).toBe('calm and precise');
    expect(scriptToneVar('  ', 'calm and precise')).toBe('calm and precise');
  });
});
