/**
 * The four mascots of the character pack (ADR-024), 1:1 from the concept page: Bulb (the channel
 * mascot: lightbulb head that glows and flickers on "Eureka!") and Screen (robot with a 12x8 pixel
 * face) here, Fox and Bean in mascots-animals.ts. Voxel = 1/12 unit.
 */
import type * as THREE from 'three';
import type { KitTools } from '../registry.js';
import type { CharacterBuild } from './build.js';
import { screenFace, voxelFace } from './face.js';
import { humanoid } from './humanoid.js';
import { mod, TAU } from './math.js';
import { buildBean, buildFox } from './mascots-animals.js';
import { castHex } from './palette.js';
import { buildRig, type BodySpec } from './rig.js';
import { meshShape, Shape } from './shape.js';

export const MASCOTS = ['bulb', 'screen', 'fox', 'bean'] as const;
export type MascotId = (typeof MASCOTS)[number];

export const MASCOT_INFO: Readonly<Record<MascotId, string>> = {
  bulb: 'Bulb, the channel mascot: lightbulb head, teal overalls; "eureka" pose lights the bulb up (glow + flicker + rays).',
  screen: 'Screen: small robot whose face is a 12x8 pixel display; pink blinking antenna.',
  fox: 'Fox: curious fox in a teal scarf; tail, ears and scarf move on their own.',
  bean: 'Bean: pink bean with huge eyes and a sprout on top; reads even 40 px small.',
};

const UNIT = 1 / 12;

export interface MascotOptions {
  /** Bulb: a point light that lights the surroundings while the bulb glows. */
  readonly light: boolean;
}

function bulb(tools: KitTools, options: MascotOptions): CharacterBuild {
  const { three } = tools;
  const u = UNIT;
  const spec: BodySpec = {
    unit: u,
    leg: 4,
    thigh: 2,
    hipX: 1.2,
    shoulderX: 3.7,
    shoulderY: 4,
    upper: 2.5,
    neckY: 5,
  };
  const S = humanoid(spec, {
    sleeve: 'slateGrey',
    hand: 'cream',
    handW: 1.9,
    handH: 1.6,
    pants: 'slateGrey',
    shoe: 'darkSlate',
    armW: 1.1,
    legW: 1.4,
    toe: 1,
    shoeH: 1.1,
  });
  S('torso')
    .cb('brightTeal', [0, 0, 0], [6, 5, 4])
    .cb('slateGrey', [-1.7, 2.5, 2], [0.8, 2.5, 0.15])
    .cb('slateGrey', [1.7, 2.5, 2], [0.8, 2.5, 0.15])
    .cb('slateGrey', [0, 1.2, 2], [2.2, 1.4, 0.15])
    .cb('slateGrey', [0, 4.8, 0], [3, 0.6, 3]);
  const base = S('neck');
  for (const i of [0, 1, 2, 3]) {
    const wide = (i % 2) * 0.6;
    base.cb(
      i % 2 === 1 ? 'slateGrey' : 'darkSlate',
      [0, i * 0.85, 0],
      [3.6 + wide, 0.85, 3.6 + wide],
    );
  }
  const glass = (x: number, y: number, z: number): boolean => {
    const dy = y - 9;
    if (x * x + dy * dy + z * z <= 30) return true;
    if (y >= 3 && y < 6.5) {
      const r = 2.3 + (y - 3) * 0.75;
      return x * x + z * z <= r * r;
    }
    return false;
  };
  base.vox('cream', [-6, 3, -6], [6, 15, 6], glass, 'glass');
  // Glass glint: bright pixels on the stepped front surface, upper left.
  for (const [x, y] of [
    [-4, 10],
    [-4, 11],
    [-3, 12],
    [-2, 13],
  ] as const) {
    let z = 0;
    while (glass(x + 0.5, y + 0.5, z + 1.5)) z += 1;
    base.box('cream', [x, y, z + 1], [x + 1, y + 1, z + 1.15], 'glow');
  }
  const glassMaterial = tools.track(
    new three.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
      emissive: new three.Color(castHex(tools.palette, 'lightOrange')),
      emissiveIntensity: 0,
    }),
  );
  const rig = buildRig(tools, spec, S, [], { glass: glassMaterial });
  const neck = rig.joints.neck;
  let light: THREE.PointLight | undefined;
  if (options.light) {
    light = new three.PointLight(castHex(tools.palette, 'lightOrange'), 0, 5, 2);
    light.position.set(0, 9 * u, 2 * u);
    neck.add(light);
  }
  const rays = new three.Group();
  rays.position.set(0, 9 * u, 0);
  for (let i = 0; i < 8; i += 1) {
    const ray = meshShape(
      tools,
      new Shape(u).cb('lightOrange', [0, 7.4, 0], [0.9, 2.2, 0.9], 'glow'),
    );
    if (!ray) continue;
    ray.rotation.z = (i * TAU) / 8 + TAU / 16;
    rays.add(ray);
  }
  neck.add(rays);
  const face = voxelFace(tools, neck, {
    unit: u,
    eyeX: 2,
    eyeY: 10,
    z: 5,
    eye: [1.5, 2.3],
    white: 'cream',
    mouthY: 7.2,
    mouthW: 2.2,
    alertY: 16.5,
  });
  return {
    id: 'bulb',
    rig,
    energy: 1,
    face,
    headTop: [0, 14.5, 0],
    faceAt: [0, 9, 5],
    hand: [0, -1.7, 0],
    secondary({ pose, time, fx }) {
      // A reaction pops the glow (flicker) or warms it; the rays follow the larger of the two.
      const glow = Math.max(pose.glow, fx.glow);
      const ray = Math.max(pose.glow, fx.rays);
      glassMaterial.emissiveIntensity = 0.1 + 0.8 * glow;
      if (light) light.intensity = 3.5 * glow;
      rays.visible = ray > 0.05;
      rays.scale.setScalar(0.7 + 0.3 * ray);
      rays.rotation.z = time * 0.5;
    },
  };
}

function screen(tools: KitTools): CharacterBuild {
  const u = UNIT;
  const spec: BodySpec = {
    unit: u,
    leg: 4,
    thigh: 2,
    hipX: 1.3,
    shoulderX: 3.8,
    shoulderY: 4.2,
    upper: 2.4,
    neckY: 5.6,
  };
  const S = humanoid(spec, {
    sleeve: 'darkSlate',
    hand: 'slateGrey',
    handW: 1.8,
    handH: 1.3,
    pants: 'darkSlate',
    shoe: 'slateGrey',
    armW: 1.4,
    legW: 1.6,
    toe: 1.2,
    shoeH: 1,
  });
  S('torso')
    .cb('slateGrey', [0, 0, 0], [6, 5, 4])
    .cb('darkSlate', [0, 1, 2], [4, 3, 0.15])
    .cb('brightTeal', [-1, 2.8, 2.1], [0.8, 0.8, 0.2], 'glow')
    .cb('pink', [0.4, 2.8, 2.1], [0.8, 0.8, 0.2], 'glow')
    .cb('darkSlate', [0, 5, 0], [2, 1, 2]);
  S('neck')
    .cb('darkSlate', [0, 0.5, 0], [10, 7.5, 6])
    .cb('black', [0, 1.3, 3], [8.6, 6, 0.2])
    .cb('slateGrey', [-5.3, 2.5, 0], [0.8, 2.6, 2.6])
    .cb('slateGrey', [5.3, 2.5, 0], [0.8, 2.6, 2.6])
    .cb('slateGrey', [0, 0, 0], [6, 0.6, 4]);
  S('antenna').cb('slateGrey', [0, 0, 0], [0.6, 3, 0.6]);
  const rig = buildRig(tools, spec, S, [['antenna', 'neck', 2, 8, -1]]);
  const antenna = rig.joints['antenna'] ?? rig.joints.neck;
  const on = meshShape(tools, new Shape(u).cb('pink', [0, 3, 0], [1.5, 1.5, 1.5], 'glow'));
  const off = meshShape(tools, new Shape(u).cb('wine', [0, 3, 0], [1.5, 1.5, 1.5]));
  if (on) antenna.add(on);
  if (off) antenna.add(off);
  const face = screenFace(tools, rig.joints.neck, u, 1.6, 3.12);
  return {
    id: 'screen',
    rig,
    energy: 0.8,
    face,
    headTop: [0, 8, 0],
    faceAt: [0, 4.3, 3.2],
    hand: [0, -1.75, 0],
    secondary({ time, velocity, fx }) {
      // The LED flashes fast while a reaction glitches the display.
      const lit = fx.face.glitch > 0.05 ? mod(time, 0.16) < 0.08 : mod(time, 1.3) < 0.9;
      if (on) on.visible = lit;
      if (off) off.visible = !lit;
      antenna.rotation.set(
        0.1 * velocity - 0.5 * fx.boing,
        0,
        0.12 * Math.sin(TAU * 0.9 * time) - 0.06 * velocity + fx.boing,
      );
    },
  };
}

export function buildMascot(tools: KitTools, id: MascotId, options: MascotOptions): CharacterBuild {
  switch (id) {
    case 'bulb':
      return bulb(tools, options);
    case 'screen':
      return screen(tools);
    case 'fox':
      return buildFox(tools);
    case 'bean':
      return buildBean(tools);
  }
}
