import { describe, expect, it } from 'vitest';
import { projectFileSchema } from './project.js';
import { renderManifestSchema } from './render-manifest.js';
import {
  frameSizeFormat,
  orientFrameSize,
  videoFormatOf,
  videoFormatSchema,
} from './video-format.js';

const PROJECT = {
  version: 1,
  title: 'Short',
  language: 'en',
  style: 'voxel-pixel-crisp640',
  fps: 30,
  seed: 7,
} as const;

const MANIFEST = {
  version: 1,
  fps: 30,
  seed: 1,
  shots: [{ id: 's01', t0: 0, t1: 2, scene: { file: 's.js', source: 'x' } }],
} as const;

describe('video format', () => {
  it('defaults to landscape when the field is absent', () => {
    expect(videoFormatOf({})).toBe('landscape');
    expect(videoFormatOf({ format: 'portrait' })).toBe('portrait');
  });

  it('keeps the style resolution in landscape and turns it upright in portrait', () => {
    expect(orientFrameSize({ width: 640, height: 360 }, 'landscape')).toEqual({
      width: 640,
      height: 360,
    });
    expect(orientFrameSize({ width: 640, height: 360 }, 'portrait')).toEqual({
      width: 360,
      height: 640,
    });
    expect(orientFrameSize({ width: 960, height: 540 }, 'portrait')).toEqual({
      width: 540,
      height: 960,
    });
  });

  it('tells the format of a frame size', () => {
    expect(frameSizeFormat({ width: 640, height: 360 })).toBe('landscape');
    expect(frameSizeFormat({ width: 360, height: 640 })).toBe('portrait');
    expect(frameSizeFormat({ width: 100, height: 100 })).toBe('landscape');
  });

  it('accepts only the two formats', () => {
    expect(videoFormatSchema.safeParse('portrait').success).toBe(true);
    expect(videoFormatSchema.safeParse('square').success).toBe(false);
  });

  it('is optional in project.json and in the render manifest', () => {
    const plain = projectFileSchema.parse(PROJECT);
    expect(plain.format).toBeUndefined();
    expect(projectFileSchema.parse({ ...PROJECT, format: 'portrait' }).format).toBe('portrait');
    expect(projectFileSchema.safeParse({ ...PROJECT, format: 'vertical' }).success).toBe(false);
    expect(renderManifestSchema.parse(MANIFEST).format).toBeUndefined();
    expect(renderManifestSchema.parse({ ...MANIFEST, format: 'portrait' }).format).toBe('portrait');
  });
});
