/**
 * `kit.env.lights`: default lighting rigs tuned for the kit's flat-shaded voxels (three faces of
 * a cube read as three clearly different palette steps after quantization) in every style preset.
 * Colours are palette tokens, so a rig re-tints with the style.
 */
import type * as THREE from 'three';
import { z } from 'zod';
import { createKitObject } from '../object.js';
import { defineEnv, type KitTools } from '../registry.js';
import { asEnv, colorOf } from './shared.js';

interface DirectionalSpec {
  readonly color: string;
  readonly intensity: number;
  /** Degrees around +y from +z (the default camera side), positive towards +x. */
  readonly azimuth: number;
  /** Degrees above the horizon. */
  readonly elevation: number;
}

interface RigSpec {
  readonly sky: string;
  readonly ground: string;
  readonly hemisphere: number;
  readonly key: DirectionalSpec;
  readonly rim?: DirectionalSpec;
}

/**
 * Hemisphere + key (+ rim). The default rig matches the example scenes (hemisphere 2.2, key
 * 2.6): with flat shading the top, the key-side and the shadow-side faces stay distinct palette
 * colours in Crisp 640, Noir Voxel and Soft 480. `noir` is the low-key rig of the Noir Voxel
 * style (works in every style): almost no fill, so unlit faces fall to the darkest swatches.
 */
export const LIGHT_RIGS = {
  default: {
    sky: 'fillLight',
    ground: 'shadow',
    hemisphere: 2.2,
    key: { color: 'keyLight', intensity: 2.6, azimuth: 40, elevation: 55 },
  },
  soft: {
    sky: 'fillLight',
    ground: 'groundAlt',
    hemisphere: 2.8,
    key: { color: 'keyLight', intensity: 1.4, azimuth: 30, elevation: 60 },
  },
  dramatic: {
    sky: 'fillLight',
    ground: 'shadow',
    hemisphere: 0.9,
    key: { color: 'keyLight', intensity: 3.2, azimuth: 70, elevation: 30 },
    rim: { color: 'accent1', intensity: 1.4, azimuth: -150, elevation: 35 },
  },
  neon: {
    sky: 'fillLight',
    ground: 'shadow',
    hemisphere: 2.0,
    key: { color: 'heroTrim', intensity: 2.4, azimuth: 35, elevation: 45 },
    rim: { color: 'accent4', intensity: 1.6, azimuth: -140, elevation: 25 },
  },
  noir: {
    sky: 'fillLight',
    ground: 'shadow',
    hemisphere: 0.5,
    key: { color: 'keyLight', intensity: 3.6, azimuth: -55, elevation: 40 },
    rim: { color: 'accent1', intensity: 2, azimuth: 150, elevation: 20 },
  },
} as const satisfies Record<string, RigSpec>;

export const lightsParams = z.object({
  preset: z
    .enum(['default', 'soft', 'dramatic', 'neon', 'noir'])
    .default('default')
    .describe(
      'default: warm key from front-right + hemisphere fill; soft: flat, low contrast; dramatic: low side key, dark fill, accent rim; neon: cool fill, magenta/accent rim for neon grids; noir: low-key (almost no fill), hard high key from the left, accent rim from behind-right',
    ),
  intensity: z.number().min(0).max(4).default(1).describe('Multiplier of every light of the rig'),
  azimuth: z
    .number()
    .min(-360)
    .max(360)
    .optional()
    .describe(
      'Turns the rig: key light direction in degrees around +y (0 = from +z, the camera side)',
    ),
});

const LIGHT_DISTANCE = 12;

function directional(
  tools: KitTools,
  spec: DirectionalSpec,
  intensity: number,
  azimuth: number,
): THREE.DirectionalLight {
  const { three } = tools;
  const light = new three.DirectionalLight(colorOf(tools, spec.color), spec.intensity * intensity);
  const yaw = (azimuth * Math.PI) / 180;
  const elevation = tools.variation
    ? Math.min(85, Math.max(5, spec.elevation + tools.variation.lightElevation))
    : spec.elevation;
  const pitch = (elevation * Math.PI) / 180;
  light.position.set(
    Math.sin(yaw) * Math.cos(pitch) * LIGHT_DISTANCE,
    Math.sin(pitch) * LIGHT_DISTANCE,
    Math.cos(yaw) * Math.cos(pitch) * LIGHT_DISTANCE,
  );
  return light;
}

export const lights = defineEnv({
  name: 'lights',
  description:
    "Default lighting rig for flat-shaded voxels (hemisphere fill + key light, optional rim), in palette colours. Add exactly one to the scene (ctx.scene.add(kit.env.lights())); lights aim at the rig's position. Static (update is a no-op).",
  params: lightsParams,
  build(params, tools) {
    const { three } = tools;
    const rig: RigSpec = LIGHT_RIGS[params.preset];
    const object = createKitObject(three, { kitType: 'lights' });
    const hemisphere = new three.HemisphereLight(
      colorOf(tools, rig.sky),
      colorOf(tools, rig.ground),
      rig.hemisphere * params.intensity,
    );
    const target = new three.Object3D();
    target.name = 'lightTarget';
    object.add(hemisphere, target);
    // An azimuth override turns the whole rig (the rim keeps its angle to the key); ambient
    // variation (PLAN.md#12.8) turns it a little further per shot.
    const turn =
      (params.azimuth ?? rig.key.azimuth) - rig.key.azimuth + (tools.variation?.lightAzimuth ?? 0);
    const key = directional(tools, rig.key, params.intensity, rig.key.azimuth + turn);
    key.name = 'keyLight';
    key.target = target;
    object.add(key);
    if (rig.rim) {
      const rim = directional(tools, rig.rim, params.intensity, rig.rim.azimuth + turn);
      rim.name = 'rimLight';
      rim.target = target;
      object.add(rim);
    }
    return asEnv(object);
  },
});
