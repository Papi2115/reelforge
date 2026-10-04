/**
 * The screen-space quad a whiteboard raster is shown on (like the blueprint boards): clip-space
 * vertices, nearest-filtered texture, no depth test or write, transparent texels discarded.
 */
import type * as THREE from 'three';
import type { KitTools } from '../../registry.js';
import type { Raster } from '../blueprint/raster.js';

/** Boards draw after the sky (-3), stars and neon grid floor (-2), before scene objects. */
const BOARD_RENDER_ORDER = -1.5;

export interface QuadOptions {
  /** Part of the frame [x, y, w, h] (0..1 from the top left). */
  readonly region: readonly [number, number, number, number];
  /** Draw order among boards. */
  readonly layer: number;
}

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
void main() {
  vec4 texel = texture2D(map, vec2(vUv.x, 1.0 - vUv.y));
  if (texel.a < 0.5) discard;
  gl_FragColor = vec4(texel.rgb, 1.0);
}`;

export function createQuad(tools: KitTools, raster: Raster, params: QuadOptions) {
  const { three } = tools;
  const texture = tools.track(
    new three.DataTexture(
      raster.data,
      raster.width,
      raster.height,
      three.RGBAFormat,
      three.UnsignedByteType,
    ),
  );
  texture.minFilter = three.NearestFilter;
  texture.magFilter = three.NearestFilter;
  texture.generateMipmaps = false;
  const material = tools.track(
    new three.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: { map: { value: texture } },
      depthTest: false,
      depthWrite: false,
    }),
  );
  const [x, y, width, height] = params.region;
  const [left, right, top, bottom] = [
    x * 2 - 1,
    (x + width) * 2 - 1,
    1 - y * 2,
    1 - (y + height) * 2,
  ];
  const geometry = tools.track(new three.BufferGeometry());
  geometry.setAttribute(
    'position',
    new three.BufferAttribute(
      new Float32Array([left, bottom, 0, right, bottom, 0, right, top, 0, left, top, 0]),
      3,
    ),
  );
  geometry.setAttribute(
    'uv',
    new three.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const mesh: THREE.Mesh = new three.Mesh(geometry, material);
  mesh.name = 'whiteboardBoard';
  mesh.frustumCulled = false;
  mesh.renderOrder = BOARD_RENDER_ORDER + params.layer * 0.01;
  mesh.raycast = () => undefined;
  return { mesh, texture };
}
