/**
 * Low-res deterministic renderer: shot scene(s) -> width x height targets (Nearest, no AA, depth
 * texture when the style needs it) -> composite + post-fx pass -> RGBA8 output target, read back
 * top-down (ADR-002).
 */
import {
  ColorManagement,
  DataTexture,
  DepthTexture,
  LinearSRGBColorSpace,
  NearestFilter,
  NoToneMapping,
  RGBAFormat,
  UnsignedByteType,
  WebGLRenderTarget,
  WebGLRenderer,
  type PerspectiveCamera,
  type Scene,
} from 'three';
import type { FocusState } from '../camera/bokeh.js';
import type { PostFxSettings } from '../style.js';
import type { TextOverlay } from '../text/text-layer.js';
import { createCompositePass, type CompositeLayer, type CompositeMode } from './composite-pass.js';
import { needsDepth } from './post-shader.js';

export interface GpuInfo {
  readonly vendor: string;
  readonly renderer: string;
  readonly version: string;
}

export interface FrameRendererOptions {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  readonly post: PostFxSettings;
}

export interface RenderView {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  /** Pixel text of the shot (low-res RGBA, top-down), composited before the post-fx. */
  readonly overlay?: TextOverlay;
  /** Depth of field of the frame (`ctx.camera.rackFocus`); absent = everything sharp. */
  readonly focus?: FocusState | undefined;
}

export interface FrameLayers {
  /** Outgoing shot during a transition, otherwise the only shot. */
  readonly a: RenderView;
  /** Incoming shot; present only with a transition mode. */
  readonly b?: RenderView;
  readonly mode: CompositeMode;
  readonly progress: number;
  readonly seed: number;
}

export interface FrameRenderer {
  readonly width: number;
  readonly height: number;
  render(layers: FrameLayers): void;
  /** Copies the last rendered frame (RGBA8, top-down) into `out` (length width*height*4). */
  readFrame(out: Uint8Array<ArrayBuffer>): void;
  gpuInfo(): GpuInfo;
  dispose(): void;
}

/**
 * Palette hex values must reach the shader unconverted: three's colour management is module-global
 * state, so the engine disables it once, before any scene creates a Color (spike pitfall 6).
 */
export function configureColorManagement(): void {
  ColorManagement.enabled = false;
}

type TargetKind = 'output' | 'scene' | 'scene-with-depth-texture';

function createTarget(width: number, height: number, kind: TargetKind): WebGLRenderTarget {
  return new WebGLRenderTarget(width, height, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    type: UnsignedByteType,
    depthBuffer: kind !== 'output',
    depthTexture: kind === 'scene-with-depth-texture' ? new DepthTexture(width, height) : null,
    samples: 0,
    generateMipmaps: false,
  });
}

/** Text overlay texture of one composite slot; re-uploaded only when there is text to show. */
interface OverlaySlot {
  readonly texture: DataTexture;
  sync(overlay: TextOverlay | undefined): void;
}

function createOverlaySlot(width: number, height: number): OverlaySlot {
  const data = new Uint8Array(width * height * 4);
  const texture = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  let blank = true;
  return {
    texture,
    sync(overlay) {
      const empty = !overlay || overlay.empty;
      if (empty && blank) return;
      if (overlay && !empty) data.set(overlay.pixels);
      else data.fill(0);
      blank = empty;
      texture.needsUpdate = true;
    },
  };
}

function readGpuInfo(gl: WebGLRenderingContext | WebGL2RenderingContext): GpuInfo {
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const vendor: unknown = gl.getParameter(debugInfo ? debugInfo.UNMASKED_VENDOR_WEBGL : gl.VENDOR);
  const renderer: unknown = gl.getParameter(
    debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER,
  );
  const version: unknown = gl.getParameter(gl.VERSION);
  return { vendor: String(vendor), renderer: String(renderer), version: String(version) };
}

export function createFrameRenderer(options: FrameRendererOptions): FrameRenderer {
  const { canvas, width, height, post } = options;
  configureColorManagement();
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    depth: true,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.toneMapping = NoToneMapping;

  const sceneKind: TargetKind = needsDepth(post) ? 'scene-with-depth-texture' : 'scene';
  const targetA = createTarget(width, height, sceneKind);
  const targetB = createTarget(width, height, sceneKind);
  const output = createTarget(width, height, 'output');
  const composite = createCompositePass(post, width, height);
  const overlayA = createOverlaySlot(width, height);
  const overlayB = createOverlaySlot(width, height);

  const draw = (view: RenderView, target: WebGLRenderTarget, slot: OverlaySlot): CompositeLayer => {
    renderer.setRenderTarget(target);
    renderer.render(view.scene, view.camera);
    slot.sync(view.overlay);
    return {
      color: target.texture,
      text: slot.texture,
      depth: target.depthTexture ?? undefined,
      near: view.camera.near,
      far: view.camera.far,
      focus: view.focus,
    };
  };

  return {
    width,
    height,
    render(layers) {
      const a = draw(layers.a, targetA, overlayA);
      const b = layers.b ? draw(layers.b, targetB, overlayB) : a;
      composite.set({
        a,
        b,
        mode: layers.b ? layers.mode : 'single',
        progress: layers.progress,
        seed: layers.seed,
      });
      renderer.setRenderTarget(output);
      renderer.render(composite.scene, composite.camera);
      renderer.setRenderTarget(null);
    },
    readFrame(out) {
      renderer.readRenderTargetPixels(output, 0, 0, width, height, out);
    },
    gpuInfo() {
      return readGpuInfo(renderer.getContext());
    },
    dispose() {
      composite.dispose();
      overlayA.texture.dispose();
      overlayB.texture.dispose();
      for (const target of [targetA, targetB, output]) {
        target.depthTexture?.dispose();
        target.dispose();
      }
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
