/**
 * Ink stage: a CPU-backed Canvas 2D raster living in the engine frame, repainted from scratch for
 * every t and shown on a full-frame screen-space quad (nearest filtering, no colour-space
 * conversion) through the normal post pass. Measured in spike PLAN.md#14.0
 * (docs/spikes/ccam-canvas.md); rules for kit-side canvases: ADR-004 addendum.
 *
 * Wrapped by `kit.fx.inkStage` of the c-cam world (PLAN.md#14.2, `worlds/c-cam/stage.ts`), which
 * hands scenes a narrowed drawing surface; this module is the raw canvas + texture + quad.
 */
import type * as THREE from 'three';
import { KitError } from '../errors.js';
import type { KitTools } from '../registry.js';

/** Settings every stage canvas gets: CPU raster (bit-exact, ADR-004 addendum), opaque. */
export const STAGE_CONTEXT_SETTINGS: CanvasRenderingContext2DSettings = Object.freeze({
  willReadFrequently: true,
  alpha: false,
});

/** The part of a canvas element the stage uses (tests pass a fake). */
export interface StageCanvas {
  width: number;
  height: number;
  getContext(
    contextId: '2d',
    settings?: CanvasRenderingContext2DSettings,
  ): CanvasRenderingContext2D | null;
}

export type StageCanvasFactory = () => StageCanvas;

/**
 * `canvas`: texImage2D straight from the canvas element (CanvasTexture);
 * `pixels`: getImageData -> DataTexture (one extra copy on the CPU).
 */
export type StageUpload = 'canvas' | 'pixels';

export interface InkStageOptions {
  readonly width: number;
  readonly height: number;
  /** CSS colour every frame starts from (opaque). */
  readonly background: string;
  readonly upload: StageUpload;
}

/** Paints one frame on a context whose state was reset; must be a pure function of t. */
export type StagePaint = (g: CanvasRenderingContext2D, t: number) => void;

export interface InkStage {
  /** Full-frame quad: add it to ctx.scene. */
  readonly mesh: THREE.Mesh;
  /** Resets the canvas, fills the background, runs paint(g, t) and schedules the upload. */
  render(t: number, paint: StagePaint): void;
  /**
   * Paints over the last `render` without a reset (the world's captions, PLAN.md#14.18) and
   * schedules the upload again; `t` is the time of that render.
   */
  overpaint(paint: StagePaint): void;
  /**
   * Frees the canvas backing store (~8 MB at 1080p): width and height 0. Idempotent; the texture,
   * material and geometry are freed by `tools.track`.
   */
  dispose(): void;
}

/** Same draw slot as the full-frame 2D pages (whiteboard quad.ts). */
const STAGE_RENDER_ORDER = -1.5;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/** Rows arrive top-down (flipY off for both uploads), so v is flipped here. */
const FRAGMENT = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(map, vec2(vUv.x, 1.0 - vUv.y)).rgb, 1.0);
}`;

function documentCanvas(): StageCanvas {
  if (typeof document === 'undefined') {
    throw new KitError(
      'invalid-params',
      'ink stage: no document (the stage runs in the engine frame)',
    );
  }
  return document.createElement('canvas');
}

type StageTools = Pick<KitTools, 'three' | 'track'>;

function stageTexture(
  tools: StageTools,
  canvas: StageCanvas,
  options: InkStageOptions,
): { texture: THREE.Texture; pixels: Uint8Array | undefined } {
  const { three } = tools;
  if (options.upload === 'canvas') {
    // CanvasTexture types its image as a DOM canvas; the stage's is one in the engine frame.
    const texture = new three.CanvasTexture(canvas as HTMLCanvasElement);
    return { texture: tools.track(texture), pixels: undefined };
  }
  const pixels = new Uint8Array(options.width * options.height * 4);
  const texture = new three.DataTexture(
    pixels,
    options.width,
    options.height,
    three.RGBAFormat,
    three.UnsignedByteType,
  );
  return { texture: tools.track(texture), pixels };
}

function stageMesh(tools: StageTools, texture: THREE.Texture): THREE.Mesh {
  const { three } = tools;
  const material = tools.track(
    new three.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { map: { value: texture } },
      depthTest: false,
      depthWrite: false,
    }),
  );
  const geometry = tools.track(new three.BufferGeometry());
  geometry.setAttribute(
    'position',
    new three.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3),
  );
  geometry.setAttribute(
    'uv',
    new three.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const mesh = new three.Mesh(geometry, material);
  mesh.name = 'inkStage';
  mesh.frustumCulled = false;
  mesh.renderOrder = STAGE_RENDER_ORDER;
  mesh.raycast = () => undefined;
  return mesh;
}

export function createInkStage(
  tools: StageTools,
  options: InkStageOptions,
  createCanvas: StageCanvasFactory = documentCanvas,
): InkStage {
  const { three } = tools;
  const canvas = createCanvas();
  canvas.width = options.width;
  canvas.height = options.height;
  const g = canvas.getContext('2d', STAGE_CONTEXT_SETTINGS);
  if (g === null) throw new KitError('invalid-params', 'ink stage: no 2D context');
  const { texture, pixels } = stageTexture(tools, canvas, options);
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.minFilter = three.NearestFilter;
  texture.magFilter = three.NearestFilter;
  const mesh = stageMesh(tools, texture);
  let lastT = 0;
  const upload = (): void => {
    if (pixels !== undefined) pixels.set(g.getImageData(0, 0, options.width, options.height).data);
    texture.needsUpdate = true;
  };
  const render = (t: number, paint: StagePaint): void => {
    lastT = t;
    // reset(): default state, empty path, cleared bitmap; nothing survives from the last frame.
    g.reset();
    g.fillStyle = options.background;
    g.fillRect(0, 0, options.width, options.height);
    g.save();
    paint(g, t);
    g.restore();
    upload();
  };
  const overpaint = (paint: StagePaint): void => {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    paint(g, lastT);
    g.restore();
    upload();
  };
  const dispose = (): void => {
    canvas.width = 0;
    canvas.height = 0;
  };
  return { mesh, render, overpaint, dispose };
}
