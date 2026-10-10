import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KitError } from '../errors.js';
import {
  createInkStage,
  STAGE_CONTEXT_SETTINGS,
  type InkStageOptions,
  type StageCanvas,
} from './ink-stage.js';

interface FakeCanvas extends StageCanvas {
  readonly calls: string[];
  settings: CanvasRenderingContext2DSettings | undefined;
}

/** A 2D context that records calls; getImageData returns bytes 0, 1, 2, ... */
function fakeCanvas(available = true): FakeCanvas {
  const calls: string[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]): void => {
      calls.push(`${name}(${args.map(String).join(',')})`);
    };
  const context = {
    reset: record('reset'),
    save: record('save'),
    restore: record('restore'),
    fillRect: record('fillRect'),
    set fillStyle(value: string) {
      calls.push(`fillStyle=${value}`);
    },
    getImageData(x: number, y: number, width: number, height: number) {
      calls.push(`getImageData(${String([x, y, width, height])})`);
      return { data: Uint8ClampedArray.from({ length: width * height * 4 }, (_, i) => i % 256) };
    },
  };
  const canvas: FakeCanvas = {
    width: 0,
    height: 0,
    calls,
    settings: undefined,
    getContext(_id, settings) {
      canvas.settings = settings;
      // The fake implements only what the stage calls.
      return available ? (context as unknown as CanvasRenderingContext2D) : null;
    },
  };
  return canvas;
}

const tools = { three: THREE, track: <T>(resource: T): T => resource };
const OPTIONS: InkStageOptions = { width: 4, height: 2, background: '#16120e', upload: 'canvas' };

describe('createInkStage', () => {
  it('sizes a CPU-backed, opaque 2D canvas', () => {
    const canvas = fakeCanvas();
    createInkStage(tools, OPTIONS, () => canvas);
    expect([canvas.width, canvas.height]).toEqual([4, 2]);
    expect(canvas.settings).toEqual({ willReadFrequently: true, alpha: false });
    expect(canvas.settings).toBe(STAGE_CONTEXT_SETTINGS);
  });

  it('shows the canvas on a full-frame quad: nearest, no flip, no mipmaps, no depth', () => {
    const canvas = fakeCanvas();
    const { mesh } = createInkStage(tools, OPTIONS, () => canvas);
    const material = mesh.material as THREE.ShaderMaterial;
    const texture = (material.uniforms['map'] as { value: THREE.Texture }).value;
    expect(texture).toBeInstanceOf(THREE.CanvasTexture);
    expect(texture.image).toBe(canvas);
    expect([texture.minFilter, texture.magFilter]).toEqual([
      THREE.NearestFilter,
      THREE.NearestFilter,
    ]);
    expect([texture.flipY, texture.generateMipmaps]).toEqual([false, false]);
    expect([material.depthTest, material.depthWrite]).toEqual([false, false]);
    const position = mesh.geometry.getAttribute('position');
    expect(Array.from(position.array)).toEqual([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
    expect(mesh.frustumCulled).toBe(false);
  });

  it('repaints from a reset context every frame and schedules the upload', () => {
    const canvas = fakeCanvas();
    const stage = createInkStage(tools, OPTIONS, () => canvas);
    const material = stage.mesh.material as THREE.ShaderMaterial;
    const texture = (material.uniforms['map'] as { value: THREE.Texture }).value;
    const version = texture.version;
    const seen: number[] = [];
    stage.render(2.5, (_g, t) => {
      canvas.calls.push('paint');
      seen.push(t);
    });
    expect(seen).toEqual([2.5]);
    expect(canvas.calls).toEqual([
      'reset()',
      'fillStyle=#16120e',
      'fillRect(0,0,4,2)',
      'save()',
      'paint',
      'restore()',
    ]);
    expect(texture.version).toBe(version + 1);
  });

  it('pixels upload copies getImageData into a DataTexture', () => {
    const canvas = fakeCanvas();
    const stage = createInkStage(tools, { ...OPTIONS, upload: 'pixels' }, () => canvas);
    const material = stage.mesh.material as THREE.ShaderMaterial;
    const texture = (material.uniforms['map'] as { value: THREE.DataTexture }).value;
    expect(texture).toBeInstanceOf(THREE.DataTexture);
    stage.render(0, () => undefined);
    expect(canvas.calls.at(-1)).toBe('getImageData(0,0,4,2)');
    const data = texture.image.data as Uint8Array;
    expect(Array.from(data.subarray(0, 5))).toEqual([0, 1, 2, 3, 4]);
    expect(data.length).toBe(4 * 2 * 4);
  });

  it('fails clearly without a 2D context or outside a document', () => {
    expect(() => createInkStage(tools, OPTIONS, () => fakeCanvas(false))).toThrow(KitError);
    expect(() => createInkStage(tools, OPTIONS)).toThrow(/no document/);
  });
});
