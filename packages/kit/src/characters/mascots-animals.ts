/**
 * The animal-like mascots of the character pack (ADR-024), 1:1 from the concept page: Fox
 * (scarf, ears and tail with secondary motion) and Bean (big eyes, a sprout on top).
 */
import type * as THREE from 'three';
import type { KitTools } from '../registry.js';
import type { CharacterBuild } from './build.js';
import { INK, voxelFace } from './face.js';
import { humanoid } from './humanoid.js';
import { bump, mod, TAU } from './math.js';
import { buildRig, type BodySpec } from './rig.js';

const UNIT = 1 / 12;

export function buildFox(tools: KitTools): CharacterBuild {
  const u = UNIT;
  const spec: BodySpec = {
    unit: u,
    leg: 4,
    thigh: 2,
    hipX: 1.3,
    shoulderX: 4,
    shoulderY: 4,
    upper: 2.2,
    neckY: 5,
  };
  const S = humanoid(spec, {
    sleeve: 'orange',
    hand: INK,
    handH: 1.2,
    pants: 'orange',
    shin: INK,
    shoe: INK,
    armW: 2,
    legW: 2.2,
    toe: 0.7,
  });
  S('torso')
    .cb('orange', [0, 0, 0], [6, 5, 4])
    .cb('cream', [0, 0.4, 2], [3.2, 3.4, 0.15])
    .cb('brightTeal', [0, 3.7, 0], [7, 1.6, 5])
    .cb('brightTeal', [1.4, 3.3, 2.4], [1.7, 1.7, 0.9]);
  S('scarf')
    .cb('brightTeal', [0, -3.8, 0], [1.6, 3.8, 0.7])
    .cb('teal', [0, -4.4, 0], [1.6, 0.6, 0.7]);
  S('neck')
    .cb('orange', [0, 0, 0], [9, 8, 8])
    .cb('cream', [0, 0, 5], [4.4, 3.2, 2])
    .cb(INK, [0, 2.4, 6.1], [1.6, 1.1, 0.8])
    .cb('orange', [-5, 0.6, 0.5], [1.2, 3, 4])
    .cb('orange', [5, 0.6, 0.5], [1.2, 3, 4])
    .cb('cream', [-5.7, 0.4, 1], [1, 1.8, 2.6])
    .cb('cream', [5.7, 0.4, 1], [1, 1.8, 2.6]);
  for (const side of ['earL', 'earR']) {
    S(side)
      .cb('orange', [0, 0, 0], [3.2, 1.6, 2])
      .cb('orange', [0, 1.6, 0], [2.3, 1.4, 1.8])
      .cb(INK, [0, 3, 0], [1.3, 1.3, 1.6])
      .cb('cream', [0, 0.4, 1], [1.6, 1.8, 0.2]);
  }
  S('tail1').box('orange', [-1.2, -1.2, -3.5], [1.2, 1.2, 0]);
  S('tail2').box('orange', [-1.8, -1.8, -4], [1.8, 1.8, 0]);
  S('tail3').box('cream', [-1.4, -1.4, -3], [1.4, 1.4, 0]);
  const rig = buildRig(tools, spec, S, [
    ['scarf', 'torso', 1.5, 3.6, 2.6],
    ['earL', 'neck', 2.8, 8, -0.5],
    ['earR', 'neck', -2.8, 8, -0.5],
    ['tail1', 'hips', 0, 1.2, -1.8],
    ['tail2', 'tail1', 0, 0, -3.2],
    ['tail3', 'tail2', 0, 0, -3.6],
  ]);
  const joint = (name: string): THREE.Group => rig.joints[name] ?? rig.joints.neck;
  const [tail1, tail2, tail3, earL, earR, scarf] = [
    'tail1',
    'tail2',
    'tail3',
    'earL',
    'earR',
    'scarf',
  ].map(joint);
  const face = voxelFace(tools, rig.joints.neck, {
    unit: u,
    eyeX: 2.3,
    eyeY: 5.3,
    z: 4,
    eye: [1.6, 2.2],
    white: 'cream',
    mouthY: 0.9,
    mouthZ: 6,
    mouthW: 2,
    alertY: 13,
  });
  return {
    id: 'fox',
    rig,
    energy: 1,
    face,
    headTop: [0, 8, 0],
    faceAt: [0, 4, 4],
    hand: [0, -1.6, 0],
    secondary({ pose, time, velocity, expression, fx }) {
      if (!tail1 || !tail2 || !tail3 || !earL || !earR || !scarf) return;
      const sway = pose.pelvisY + pose.spineY + pose.pelvisZ;
      const glad = expression === 'joy' || expression === 'wink' || fx.wag > 0.5;
      const f = glad ? 2.6 : 0.8;
      const a = glad ? 0.55 : 0.3;
      tail1.rotation.set(
        0.7 + 0.12 * Math.sin(TAU * time * 0.6) + 0.1 * velocity + 0.4 * fx.tailPuff,
        a * Math.sin(TAU * f * time) - 1.5 * sway,
        0,
      );
      tail2.rotation.set(0.35, a * Math.sin(TAU * f * time - 0.8), 0);
      tail3.rotation.set(0.25, a * Math.sin(TAU * f * time - 1.6), 0);
      // A startled fox puffs its tail up (thicker segments) and lays its ears back.
      const puff = 1 + 0.45 * fx.tailPuff;
      for (const segment of [tail1, tail2, tail3]) segment.scale.set(puff, puff, 1);
      const twitch = bump(0, 0.05, 0.1, 0.2, mod(time, 3.7));
      const back =
        expression === 'surprised' || expression === 'alarm' || expression === 'jaw-drop'
          ? -0.45
          : expression === 'sceptical' || expression === 'smug' || expression === 'brow-raise'
            ? 0.2
            : 0;
      const laid = back + (-0.45 - back) * fx.earsBack;
      earL.rotation.set(laid, 0, -0.25 - 0.3 * twitch + fx.earFlick);
      earR.rotation.set(laid, 0, 0.25 - 0.6 * fx.earFlick);
      scarf.rotation.set(
        0.15 - 0.12 * velocity + 0.06 * Math.sin(TAU * 0.7 * time),
        0,
        -0.8 * sway,
      );
    },
  };
}

export function buildBean(tools: KitTools): CharacterBuild {
  const u = UNIT;
  const spec: BodySpec = {
    unit: u,
    leg: 3,
    thigh: 1.5,
    hipX: 2,
    shoulderX: 6.2,
    shoulderY: 6,
    upper: 2,
    neckY: 8,
  };
  const S = humanoid(spec, {
    sleeve: 'pink',
    hand: 'pink',
    handW: 2.2,
    handH: 1.2,
    pants: 'pink',
    shoe: INK,
    armW: 1.9,
    legW: 2.2,
    toe: 0.8,
    shoeH: 1,
  });
  const shape = (x: number, y: number, z: number): boolean => {
    const y0 = 5.5;
    const y1 = 13.5;
    let k = 1;
    if (y < y0) k = Math.sqrt(Math.max(0, 1 - ((y0 - y) / y0) ** 2));
    else if (y > y1) k = Math.sqrt(Math.max(0, 1 - ((y - y1) / (19 - y1)) ** 2));
    if (k <= 0.05) return false;
    return (Math.abs(x) / (6 * k)) ** 3.5 + (Math.abs(z) / (4.8 * k)) ** 3.5 <= 1;
  };
  S('torso')
    .vox('pink', [-7, 0, -6], [7, 8, 6], shape)
    .vox('pink', [-6, 7, -5], [6, 10, 5], (x, y, z) => shape(x / 0.85, y, z / 0.85));
  S('neck').vox('pink', [-7, 0, -6], [7, 12, 6], (x, y, z) => shape(x, y + 8, z));
  S('tuft')
    .cb('green', [0, 0, 0], [0.8, 2.6, 0.8])
    .box('green', [0.3, 2.2, -0.5], [2.6, 3.0, 0.5])
    .box('green', [-2.2, 1.6, -0.5], [-0.3, 2.3, 0.5]);
  const rig = buildRig(tools, spec, S, [['tuft', 'neck', 0, 10.6, 0]]);
  const tuft = rig.joints['tuft'];
  const face = voxelFace(tools, rig.joints.neck, {
    unit: u,
    eyeX: 2.2,
    eyeY: 6.4,
    z: 4.8,
    eye: [3.2, 4.2],
    pupil: [1.8, 2.6],
    white: 'cream',
    browW: 3,
    browGap: 0.8,
    mouthY: 2.6,
    mouthW: 2.2,
    alertY: 14,
  });
  return {
    id: 'bean',
    rig,
    energy: 1,
    face,
    headTop: [0, 11, 0],
    faceAt: [0, 5, 4.8],
    hand: [0, -1.4, 0],
    secondary({ pose, time, velocity, fx }) {
      tuft?.rotation.set(
        0.35 * velocity + 0.05 * Math.sin(TAU * 0.5 * time) - 0.4 * fx.boing,
        0,
        0.18 * Math.sin(TAU * 0.9 * time) - 2 * pose.headZ * 0.3 + fx.boing,
      );
      // A reaction wobbles the bean on its feet like a roly-poly toy.
      rig.body.rotation.z = fx.wobble;
    },
  };
}
