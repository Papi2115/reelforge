/**
 * Browser-side probe of the real post pass (bundled by full-colour.test.ts): renders a flat
 * background colour through createFrameRenderer with the style preset it is given and returns the
 * colours at the frame centre and corner. Bottom-up rows do not matter for these two points.
 */
import { Color, PerspectiveCamera, Scene } from 'three';
import type { StylePreset } from '@reelforge/shared';
import { createFrameRenderer } from '../../src/gl/frame-renderer.js';
import { createStyleRegistry } from '../../src/presets/registry.js';
import { resolveStyle } from '../../src/style.js';

export type Rgb8 = readonly [number, number, number];

export interface ProbeResult {
  readonly renderer: string;
  readonly center: Rgb8;
  readonly corner: Rgb8;
  /** Number of distinct RGB values in the whole frame. */
  readonly distinct: number;
}

function probe(preset: StylePreset, background: string): ProbeResult {
  const style = resolveStyle({ style: preset.id }, createStyleRegistry([preset], []));
  const canvas = document.createElement('canvas');
  const renderer = createFrameRenderer({
    canvas,
    width: style.width,
    height: style.height,
    post: style.post,
  });
  try {
    const scene = new Scene();
    scene.background = new Color(background);
    renderer.render({
      a: { scene, camera: new PerspectiveCamera(50, style.width / style.height, 0.1, 100) },
      mode: 'single',
      progress: 0,
      seed: 1,
    });
    const frame = new Uint8Array(style.width * style.height * 4);
    renderer.readFrame(frame);
    const at = (x: number, y: number): Rgb8 => {
      const offset = (y * style.width + x) * 4;
      return [frame[offset] ?? 0, frame[offset + 1] ?? 0, frame[offset + 2] ?? 0];
    };
    const colours = new Set<number>();
    for (let offset = 0; offset < frame.length; offset += 4) {
      colours.add(
        ((frame[offset] ?? 0) << 16) | ((frame[offset + 1] ?? 0) << 8) | (frame[offset + 2] ?? 0),
      );
    }
    return {
      renderer: renderer.gpuInfo().renderer,
      center: at(style.width >> 1, style.height >> 1),
      corner: at(0, 0),
      distinct: colours.size,
    };
  } finally {
    renderer.dispose();
  }
}

(window as unknown as { __probe: typeof probe }).__probe = probe;
