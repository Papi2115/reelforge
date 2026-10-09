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
import type { FocusState } from '../camera/bokeh.js';
import { lutTexels } from '../palette.js';
import type { PostFxSettings } from '../style.js';
import { needsDepth, POST_VERTEX_SHADER, postFragmentShader } from './post-shader.js';

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
  /** Depth of field of the layer (`ctx.camera.rackFocus`); undefined = all sharp. */
  readonly focus?: FocusState | undefined;
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

/** The palette LUT texture; full-colour styles (`quantize: false`) have none. */
function createLutTexture(post: PostFxSettings): Data3DTexture | null {
  const { lut } = post;
  if (lut === undefined) return null;
  const { levels } = lut;
  const texture = new Data3DTexture(lutTexels(lut), levels, levels, levels);
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
  // One uniform set for both programs; the base program ignores the focus uniforms.
  const uniforms: Record<string, { value: unknown }> = {
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
    focusA: { value: new Vector2(0, 0) },
    focusB: { value: new Vector2(0, 0) },
  };
  const createMaterial = (bokeh: boolean): ShaderMaterial =>
    new ShaderMaterial({
      vertexShader: POST_VERTEX_SHADER,
      fragmentShader: postFragmentShader(post, { bokeh }),
      depthTest: false,
      depthWrite: false,
      uniforms,
    });
  const material = createMaterial(false);
  /** Compiled on the first frame with a focus: shots without one render with the base program. */
  let bokehMaterial: ShaderMaterial | undefined;
  const bokehSupported = needsDepth(post);
  const mesh = new Mesh(geometry, material);
  const scene = new Scene();
  scene.add(mesh);
  const set = (name: string, value: unknown): void => {
    const uniform = uniforms[name];
    if (uniform) uniform.value = value;
  };
  const setClip = (name: string, layer: CompositeLayer): void => {
    const uniform = uniforms[name];
    if (uniform?.value instanceof Vector2) uniform.value.set(layer.near, layer.far);
  };
  const setFocus = (name: string, focus: FocusState | undefined): void => {
    const uniform = uniforms[name];
    if (uniform?.value instanceof Vector2)
      uniform.value.set(focus?.distance ?? 0, focus?.aperture ?? 0);
  };
  const hasFocus = (layer: CompositeLayer): boolean =>
    layer.focus !== undefined && layer.focus.aperture > 0;
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
      setFocus('focusA', input.a.focus);
      setFocus('focusB', input.b.focus);
      const bokeh = bokehSupported && (hasFocus(input.a) || hasFocus(input.b));
      if (bokeh) bokehMaterial ??= createMaterial(true);
      mesh.material = bokeh && bokehMaterial ? bokehMaterial : material;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      bokehMaterial?.dispose();
      lut?.dispose();
    },
  };
}
