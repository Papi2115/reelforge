/** The Grim Ink font report in the load reply (PLAN.md#14.18); other styles unchanged. */
import { describe, expect, it } from 'vitest';
import { inkFontsOf, loadInfoFonts, withInkFonts } from './ink-fonts.js';
import { loadInfoSchema } from './harness/protocol.js';
import type { LoadInfo } from './runtime.js';

const INFO: LoadInfo = {
  duration: 1,
  style: 'voxel-pixel-crisp640',
  width: 640,
  height: 360,
  fps: 30,
  cues: [],
  anchors: [],
  gpu: { vendor: 'v', renderer: 'r', version: '1' },
};

describe('ink fonts in the load reply', () => {
  it('reports the fallback for Grim Ink outside a page and leaves other styles alone', () => {
    expect(withInkFonts(INFO)).toBe(INFO);
    expect(inkFontsOf(INFO.style)).toBeUndefined();
    const ink = withInkFonts({ ...INFO, style: 'c-cam' });
    const parsed = loadInfoSchema.parse(ink);
    expect(loadInfoFonts(parsed)).toMatchObject({ fallback: true });
    expect(loadInfoFonts(parsed)?.missing).toContain('Arial Black');
    expect(loadInfoFonts(loadInfoSchema.parse(INFO))).toBeUndefined();
  });
});
