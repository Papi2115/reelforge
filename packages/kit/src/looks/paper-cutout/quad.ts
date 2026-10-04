/**
 * Full-frame clip-space quad showing the paper stage's composite: one texel per low-res frame
 * pixel, nearest-filtered, no depth write or test (the depth outline and AO never see it; voxel
 * objects, ctx.text and ctx.annotate draw on top), drawn right after the sky backdrops.
 */
import type * as THREE from 'three';
import type { KitTools } from '../../registry.js';

/** After the sky (-3) and the neon grid (-2), before scene objects (0). */
const STAGE_RENDER_ORDER = -1.4;

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
  gl_FragColor = vec4(texture2D(map, vec2(vUv.x, 1.0 - vUv.y)).rgb, 1.0);
}`;

export interface StageQuad {
  readonly mesh: THREE.Mesh;
  readonly texture: THREE.DataTexture;
}

export function createQuad(
  tools: KitTools,
  rgba: Uint8Array,
  width: number,
  height: number,
): StageQuad {
  const { three } = tools;
  const texture = tools.track(
    new three.DataTexture(rgba, width, height, three.RGBAFormat, three.UnsignedByteType),
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
  mesh.name = 'paperStageComposite';
  mesh.frustumCulled = false;
  mesh.renderOrder = STAGE_RENDER_ORDER;
  // A screen-space quad has no place in the world: never pick or raycast it.
  mesh.raycast = () => undefined;
  return { mesh, texture };
}
