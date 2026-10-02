/**
 * Composite + post pass at output resolution: combines up to two low-res shot renders (A =
 * outgoing / only shot, B = incoming) with a transition and applies the style's pixel-art post-fx
 * (gl/post-shader.ts). Output rows are flipped so that `readPixels` yields a top-down image that
 * can go straight to ffmpeg `-f rawvideo`.
 */
import type { TransitionType } from '@reelforge/shared';
import {
  Data3DTexture,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  type Texture,
} from 'three';
import { lutTexels } from '../palette.js';
import type { PostFxSettings } from '../style.js';
import { POST_VERTEX_SHADER, postFragmentShader } from './post-shader.js';

export const COMPOSITE_MODES: Readonly<Record<'single' | Exclude<TransitionType, 'cut'>, number>> =
  {
    single: 0,
    crossfade: 1,
    wipe: 2,
    glitch: 3,
  };
export type CompositeMode = keyof typeof COMPOSITE_MODES;

/**
 * One rendered shot: colour, its pixel-text overlay (RGBA, top-down), optional depth, and the
 * camera clip planes used to linearize depth.
 */
export interface CompositeLayer {
  readonly color: Texture;
  readonly text: Texture;
  readonly depth: Texture | undefined;
  readonly near: number;
  readonly far: number;
}

export interface CompositeInput {
  readonly a: CompositeLayer;
  readonly b: CompositeLayer;
  readonly mode: CompositeMode;
  readonly progress: number;
  /** Per-transition seed (int31) for the glitch pattern. */
  readonly seed: number;
}

export interface CompositePass {
  readonly scene: Scene;
  readonly camera: OrthographicCamera;
  set(input: CompositeInput): void;
  dispose(): void;
}

function createLutTexture(post: PostFxSettings): Data3DTexture {
  const { levels } = post.lut;
  const texture = new Data3DTexture(lutTexels(post.lut), levels, levels, levels);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

export function createCompositePass(
  post: PostFxSettings,
  width: number,
  height: number,
): CompositePass {
  const geometry = new PlaneGeometry(2, 2);
  const lut = createLutTexture(post);
  const material = new ShaderMaterial({
    vertexShader: POST_VERTEX_SHADER,
    fragmentShader: postFragmentShader(post),
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tA: { value: null },
      tB: { value: null },
      xA: { value: null },
      xB: { value: null },
      dA: { value: null },
      dB: { value: null },
      clipA: { value: new Vector2(0.1, 1000) },
      clipB: { value: new Vector2(0.1, 1000) },
      lut: { value: lut },
      mode: { value: COMPOSITE_MODES.single },
      progress: { value: 0 },
      seed: { value: 0 },
      width: { value: width },
      height: { value: height },
    },
  });
  const scene = new Scene();
  scene.add(new Mesh(geometry, material));
  const uniforms = material.uniforms;
  const set = (name: string, value: unknown): void => {
    const uniform = uniforms[name];
    if (uniform) uniform.value = value;
  };
  const setClip = (name: string, layer: CompositeLayer): void => {
    const uniform = uniforms[name];
    if (uniform?.value instanceof Vector2) uniform.value.set(layer.near, layer.far);
  };
  return {
    scene,
    camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
    set(input) {
      set('tA', input.a.color);
      set('tB', input.b.color);
      set('xA', input.a.text);
      set('xB', input.b.text);
      set('dA', input.a.depth ?? null);
      set('dB', input.b.depth ?? null);
      setClip('clipA', input.a);
      setClip('clipB', input.b);
      set('mode', COMPOSITE_MODES[input.mode]);
      set('progress', input.progress);
      set('seed', input.seed & 0x7fffffff);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      lut.dispose();
    },
  };
}
