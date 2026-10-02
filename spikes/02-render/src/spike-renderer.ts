/**
 * Low-res deterministic renderer: scene -> 640x360 target (Nearest, no AA) -> palette/dither
 * post pass -> RGBA8 target that is read back top-down with `readPixels`.
 */
import {
  ColorManagement,
  LinearSRGBColorSpace,
  NearestFilter,
  NoToneMapping,
  UnsignedByteType,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { createPostPass } from './post.ts';
import { createVoxelScene } from './scene/voxel-scene.ts';

export interface SpikeRendererOptions {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly powerPreference: WebGLPowerPreference;
}

export interface GpuInfo {
  readonly vendor: string;
  readonly renderer: string;
  readonly version: string;
}

export interface SpikeRenderer {
  readonly width: number;
  readonly height: number;
  /** Render the frame at time `t` (seconds) into the output target. */
  seek(t: number): void;
  /** Copy the last rendered frame (RGBA8, top-down) into `out` (length width*height*4). */
  readFrame(out: Uint8Array): void;
  gpuInfo(): GpuInfo;
}

function createTarget(width: number, height: number, depthBuffer: boolean): WebGLRenderTarget {
  return new WebGLRenderTarget(width, height, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    type: UnsignedByteType,
    depthBuffer,
    samples: 0,
    generateMipmaps: false,
  });
}

function readGpuInfo(gl: WebGL2RenderingContext): GpuInfo {
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const vendor: unknown = gl.getParameter(debugInfo ? debugInfo.UNMASKED_VENDOR_WEBGL : gl.VENDOR);
  const renderer: unknown = gl.getParameter(
    debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER,
  );
  const version: unknown = gl.getParameter(gl.VERSION);
  return { vendor: String(vendor), renderer: String(renderer), version: String(version) };
}

export function createSpikeRenderer(options: SpikeRendererOptions): SpikeRenderer {
  const { canvas, width, height, seed, powerPreference } = options;
  ColorManagement.enabled = false;
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    depth: true,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.toneMapping = NoToneMapping;

  const sceneTarget = createTarget(width, height, true);
  const outputTarget = createTarget(width, height, false);
  const voxelScene = createVoxelScene(seed, width / height);
  const post = createPostPass(sceneTarget.texture, height);

  return {
    width,
    height,
    seek(t: number): void {
      voxelScene.update(t);
      renderer.setRenderTarget(sceneTarget);
      renderer.render(voxelScene.scene, voxelScene.camera);
      renderer.setRenderTarget(outputTarget);
      renderer.render(post.scene, post.camera);
      renderer.setRenderTarget(null);
    },
    readFrame(out: Uint8Array): void {
      renderer.readRenderTargetPixels(outputTarget, 0, 0, width, height, out);
    },
    gpuInfo(): GpuInfo {
      return readGpuInfo(renderer.getContext() as WebGL2RenderingContext);
    },
  };
}
