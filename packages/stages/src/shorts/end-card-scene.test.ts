import { lintScene } from '@reelforge/engine';
import { DEFAULT_SCENE_SETTINGS } from '../settings.js';
import { legibilityFindings } from '../scenes/source-checks.js';
import { describe, expect, it } from 'vitest';
import { END_CARD_SCENE_MARKER, endCardSceneSource } from './end-card-scene.js';
import { endCardFrameWidth } from './end-card-step.js';

const SHOT = { id: 'end_card', treatment: 'title-card' } as const;

describe('end card scene', () => {
  it('passes the determinism lint and phone legibility in both formats', () => {
    for (const format of ['portrait', 'landscape'] as const) {
      const source = endCardSceneSource({ shot: SHOT, text: 'Full video on YT: Voxplain', format });
      expect(source.startsWith(END_CARD_SCENE_MARKER)).toBe(true);
      expect(lintScene(source, { filename: 'scenes/end_card.js' })).toEqual([]);
      const frameWidth = endCardFrameWidth('voxel-pixel-crisp640', format);
      expect(frameWidth).toBe(format === 'portrait' ? 360 : 640);
      const rules = {
        minScale: DEFAULT_SCENE_SETTINGS.minTextScale,
        minGlyphPx: DEFAULT_SCENE_SETTINGS.minGlyphPx,
        frameWidth,
      };
      expect(legibilityFindings(source, 'scenes/end_card.js', rules)).toEqual([]);
      expect(source).toContain(`kit.fx.endCard({ format: "${format}"`);
      expect(source).toContain('until: ctx.shot.duration');
    }
  });

  it('writes the whole text as the name when it has no lead, scaled down when long', () => {
    const source = endCardSceneSource({
      shot: SHOT,
      text: 'The Very Long Channel Name',
      format: 'portrait',
    });
    expect(source).not.toContain('end-card-lead');
    expect(source).toContain('ctx.text.title("The Very Long Channel Name", { id: "end-card-name"');
    expect(source).toContain('scale: 2');
    // Text is data: quotes and backslashes cannot break out of the string.
    const tricky = endCardSceneSource({
      shot: SHOT,
      text: 'Full video on YT: A"b\\c',
      format: 'portrait',
    });
    expect(tricky).toContain('ctx.text.title("A\\"b\\\\c"');
    expect(lintScene(tricky, { filename: 'scenes/end_card.js' })).toEqual([]);
  });
});
