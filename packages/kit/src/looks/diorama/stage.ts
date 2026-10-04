/**
 * Staging of a diorama: its own light rig per time of day (tuned for the iso camera: bright
 * tops, mid left faces, dark right faces) and the soft base shadow under the floating platform,
 * an ordered-dithered rounded rectangle in one palette colour (no gradients reach the post pass).
 */
import type * as THREE from 'three';
import { shadeColors } from '../../context.js';
import { colorOf } from '../../env/shared.js';
import type { KitTools } from '../../registry.js';
import type { VoxelColor } from '../../voxel/model.js';
import { tone, type ChainName, type TimeOfDay } from './tones.js';

type RigColor = ChainName | 'fillLight' | 'keyLight';

interface RigSpec {
  readonly sky: RigColor;
  readonly ground: ChainName;
  readonly hemisphere: number;
  readonly key: RigColor;
  readonly intensity: number;
  /** Degrees around +y from +z (the iso camera sits at 45). */
  readonly azimuth: number;
  readonly elevation: number;
}

export const DIORAMA_RIGS: Readonly<Record<TimeOfDay, RigSpec>> = {
  day: {
    sky: 'fillLight',
    ground: 'slateBlue',
    hemisphere: 2,
    key: 'fillLight',
    intensity: 2.2,
    azimuth: 10,
    elevation: 50,
  },
  dusk: {
    sky: 'violet',
    ground: 'indigo',
    hemisphere: 2.2,
    key: 'lightOrange',
    intensity: 2.2,
    azimuth: 0,
    elevation: 30,
  },
  night: {
    sky: 'teal',
    ground: 'indigo',
    hemisphere: 2.8,
    key: 'slateGrey',
    intensity: 1.2,
    azimuth: 15,
    elevation: 55,
  },
};

const LIGHT_DISTANCE = 20;

function rigColor(tools: KitTools, name: RigColor): THREE.Color {
  if (name === 'fillLight' || name === 'keyLight') return colorOf(tools, name);
  return colorOf(tools, tone(tools.palette, name));
}

/** Hemisphere + key light aimed at the group's origin. */
export function createRig(tools: KitTools, time: TimeOfDay): THREE.Group {
  const { three } = tools;
  const spec = DIORAMA_RIGS[time];
  const group = new three.Group();
  group.name = 'dioramaLights';
  const hemisphere = new three.HemisphereLight(
    rigColor(tools, spec.sky),
    rigColor(tools, spec.ground),
    spec.hemisphere,
  );
  const key = new three.DirectionalLight(rigColor(tools, spec.key), spec.intensity);
  key.name = 'dioramaKey';
  const yaw = (spec.azimuth * Math.PI) / 180;
  const pitch = (spec.elevation * Math.PI) / 180;
  key.position.set(
    Math.sin(yaw) * Math.cos(pitch) * LIGHT_DISTANCE,
    Math.sin(pitch) * LIGHT_DISTANCE,
    Math.cos(yaw) * Math.cos(pitch) * LIGHT_DISTANCE,
  );
  const target = new three.Object3D();
  target.name = 'dioramaLightTarget';
  key.target = target;
  group.add(hemisphere, key, target);
  return group;
}

const SHADOW_VERTEX = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SHADOW_FRAGMENT = /* glsl */ `
uniform vec3 color;
uniform vec2 halfSize;
uniform float soft;
uniform float strength;
varying vec2 vLocal;
const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
void main() {
  vec2 q = abs(vLocal) - (halfSize - soft);
  float outside = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  float density = strength * (1.0 - clamp(outside / soft, 0.0, 1.0));
  ivec2 p = ivec2(gl_FragCoord.xy);
  float threshold = (BAYER[(p.y % 4) * 4 + (p.x % 4)] + 0.5) / 16.0;
  if (density <= threshold) discard;
  gl_FragColor = vec4(color, 1.0);
}`;

/**
 * Dithered drop shadow: a horizontal rounded rectangle `width` x `depth` (units) under the
 * platform; dense in the middle, fading over `soft` units. Writes no depth (no outline).
 */
export function createBaseShadow(
  tools: KitTools,
  width: number,
  depth: number,
  soft: number,
): THREE.Mesh {
  const { three } = tools;
  const geometry = tools.track(new three.PlaneGeometry(width, depth));
  const material = tools.track(
    new three.ShaderMaterial({
      vertexShader: SHADOW_VERTEX,
      fragmentShader: SHADOW_FRAGMENT,
      uniforms: {
        color: { value: colorOf(tools, tone(tools.palette, 'black')) },
        halfSize: { value: new three.Vector2(width / 2, depth / 2) },
        soft: { value: soft },
        strength: { value: 1 },
      },
      depthWrite: false,
    }),
  );
  const mesh = new three.Mesh(geometry, material);
  mesh.name = 'dioramaShadow';
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  return mesh;
}

/**
 * Backing plane in one palette colour just under a voxel surface: greedy meshes leave hairline
 * T-junction cracks where many small quads meet, and on a big tiled floor the depth outline turns
 * every crack into a black dot; behind the backing a crack shows a floor colour instead.
 */
export function createBacking(
  tools: KitTools,
  width: number,
  depth: number,
  color: VoxelColor,
): THREE.Mesh {
  const { three } = tools;
  const geometry = tools.track(new three.PlaneGeometry(width, depth));
  geometry.rotateX(-Math.PI / 2);
  const [shade] = shadeColors(three, tools.palette, [color]);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) colors.set(shade?.rgb ?? [0, 0, 0], index * 3);
  geometry.setAttribute('color', new three.BufferAttribute(colors, 3));
  const mesh = new three.Mesh(geometry, tools.materials().lit);
  mesh.name = 'dioramaBacking';
  return mesh;
}
