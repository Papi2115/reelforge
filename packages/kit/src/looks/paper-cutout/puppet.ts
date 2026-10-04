/**
 * `kit.props.paperPuppet`: a jointed paper character (head, torso, two arms, two legs held by
 * brass fasteners) re-cut for every frame of the stop-motion clock. Poses are functions of the
 * snapped time, with a seeded hand-placed jitter per frame, so motion steps like real paper
 * animation and is the same for any seek order.
 */
import { z } from 'zod';
import { hashCell } from '../../env/shared.js';
import { defineProp } from '../../registry.js';
import type { PaperColors } from './colors.js';
import { seedParam, toneParam } from './landscape.js';
import { finishPaper, PAPER_GRAIN } from './paper.js';
import { createPiece, ease, memo, type PieceModel } from './piece.js';
import {
  createSprite,
  fillEllipse,
  fillLine,
  fillPolygon,
  fillRect,
  stamp,
  transform,
  type Point,
  type Sprite,
} from './sprite.js';

export const PUPPET_POSES = ['idle', 'wave', 'walk', 'talk', 'point', 'cheer'] as const;
export type PuppetPose = (typeof PUPPET_POSES)[number];

/** Limb angles in degrees (0 = hanging down, + = swung toward the facing side). */
export interface Limbs {
  readonly frontArm: number;
  readonly backArm: number;
  readonly frontLeg: number;
  readonly backLeg: number;
  /** Body lift in units (+ = up) and head tilt in degrees. */
  readonly lift: number;
  readonly tilt: number;
}

const TAU = Math.PI * 2;

/** Limb angles of a pose at stop-motion time `time` (pure). */
export function poseLimbs(pose: PuppetPose, time: number): Limbs {
  const wave = (rate: number, phase = 0): number => Math.sin(TAU * (time * rate + phase));
  const idle = { frontArm: 4 * wave(0.5), backArm: -4 * wave(0.5), frontLeg: 0, backLeg: 0 };
  switch (pose) {
    case 'walk':
      return {
        frontArm: -24 * wave(1),
        backArm: 24 * wave(1),
        frontLeg: 26 * wave(1),
        backLeg: -26 * wave(1),
        lift: 0.35 * Math.abs(wave(2)),
        tilt: 0,
      };
    case 'wave':
      return { ...idle, frontArm: 150 + 22 * wave(2), lift: 0, tilt: 4 };
    case 'talk':
      return { ...idle, frontArm: 35 + 18 * wave(0.8), lift: 0, tilt: 5 * wave(1.5) };
    case 'point':
      return { ...idle, frontArm: 92, lift: 0, tilt: -3 };
    case 'cheer':
      return {
        frontArm: 160 + 10 * wave(2),
        backArm: -160 - 10 * wave(2, 0.5),
        frontLeg: 8,
        backLeg: -8,
        lift: 0.6 * Math.max(0, wave(2)),
        tilt: 0,
      };
    default:
      return { ...idle, lift: 0.15 * Math.max(0, wave(0.5)), tilt: 0 };
  }
}

interface PuppetTones {
  readonly coat: number;
  readonly pants: number;
  readonly skin: number;
  readonly hair: number;
  readonly shoe: number;
  readonly brad: number;
}

/** A limb sprite: strip from `joint` downwards, rotated, ending in a hand or a shoe. */
function cutLimb(
  size: readonly [number, number],
  joint: Point,
  length: number,
  width: number,
  angle: number,
  tone: number,
  end: {
    readonly tone: number;
    readonly shoe: boolean;
    readonly u: number;
    readonly facing: number;
  },
): Sprite {
  const sprite = createSprite(size[0], size[1]);
  const [jx, jy] = joint;
  const tip: Point = transform([[jx, jy + length]], angle, joint)[0] ?? joint;
  fillLine(sprite, joint, tip, width, tone);
  fillEllipse(sprite, jx, jy, width / 2, width / 2, tone);
  if (end.shoe) {
    const shoe = transform(
      [
        [jx - width * 0.55, jy + length - end.u * 0.2],
        [jx + width * 0.55 + end.u * 1.1 * end.facing, jy + length - end.u * 0.2],
        [jx + width * 0.55 + end.u * 1.1 * end.facing, jy + length + end.u * 0.9],
        [jx - width * 0.55, jy + length + end.u * 0.9],
      ],
      angle,
      joint,
    );
    fillPolygon(sprite, shoe, end.tone);
  } else {
    fillEllipse(sprite, tip[0], tip[1], end.u * 0.8, end.u * 0.8, end.tone);
  }
  return sprite;
}

/** The whole puppet for one frame; origin = between the feet on the ground. */
export function cutPuppet(
  colors: PaperColors,
  tones: PuppetTones,
  height: number,
  limbs: Limbs,
  facing: 1 | -1,
  seed: number,
): { sprite: Sprite; origin: Point; head: Point; hand: Point } {
  const u = height / 16;
  const width = Math.ceil(u * 16);
  const size: [number, number] = [width, Math.ceil(height + u * 6)];
  const cx = width / 2;
  const ground = size[1] - u * 1.2;
  const lift = limbs.lift * u;
  const hipY = ground - u * 7.4 - lift;
  const shoulderY = hipY - u * 5.4;
  const sprite = createSprite(size[0], size[1]);
  const shade = (tone: number): number => colors.shade[tone] ?? tone;
  const mirror = (degrees: number): number => degrees * -facing;
  const limb = (
    joint: Point,
    length: number,
    w: number,
    angle: number,
    tone: number,
    end: number,
    shoe: boolean,
  ): Sprite => cutLimb(size, joint, length, w, mirror(angle), tone, { tone: end, shoe, u, facing });
  // Back limbs first, one shade darker (they are further away).
  stamp(
    sprite,
    limb(
      [cx - u * 0.6 * facing, hipY],
      u * 6.3,
      u * 1.9,
      limbs.backLeg,
      shade(tones.pants),
      shade(tones.shoe),
      true,
    ),
    0,
    0,
  );
  stamp(
    sprite,
    limb(
      [cx - u * 1.3 * facing, shoulderY + u * 0.5],
      u * 5.2,
      u * 1.6,
      limbs.backArm,
      shade(tones.coat),
      shade(tones.skin),
      false,
    ),
    0,
    0,
    colors.shade,
  );
  const body = createSprite(size[0], size[1]);
  fillPolygon(
    body,
    [
      [cx - u * 2.3, shoulderY],
      [cx + u * 2.3, shoulderY],
      [cx + u * 2, hipY + u * 0.6],
      [cx - u * 2, hipY + u * 0.6],
    ],
    tones.coat,
  );
  fillRect(body, cx - u * 0.55, shoulderY - u * 0.9, u * 1.1, u * 1.1, tones.skin);
  stamp(sprite, body, 0, 0, colors.shade);
  stamp(
    sprite,
    limb(
      [cx + u * 0.6 * facing, hipY],
      u * 6.3,
      u * 1.9,
      limbs.frontLeg,
      tones.pants,
      tones.shoe,
      true,
    ),
    0,
    0,
    colors.shade,
  );
  const head = createSprite(size[0], size[1]);
  const headCentre = transform([[cx, shoulderY - u * 2.9]], mirror(limbs.tilt), [
    cx,
    shoulderY,
  ])[0] ?? [cx, shoulderY];
  const [hx, hy] = headCentre;
  fillEllipse(head, hx, hy, u * 2.5, u * 2.6, tones.skin);
  fillPolygon(
    head,
    transform(
      (
        [
          [-2.7, 0.4],
          [-2.5, -1.8],
          [-0.7, -3.0],
          [1.6, -2.7],
          [2.7, -1.2],
          [0.5, -1.3],
          [-1.3, 0.5],
        ] as const
      ).map(([x, y]): Point => [hx + x * u * facing, hy + y * u]),
      mirror(limbs.tilt),
      headCentre,
    ),
    tones.hair,
  );
  fillRect(
    head,
    hx + u * 1.0 * facing - u * 0.25,
    hy - u * 0.1,
    Math.max(1, u * 0.5),
    Math.max(1, u * 0.6),
    tones.shoe,
  );
  // A small smile under the eye, one shade darker than the skin.
  fillRect(
    head,
    hx + u * 0.9 * facing - u * 0.5,
    hy + u * 1.1,
    Math.max(1, u),
    Math.max(1, u * 0.3),
    colors.shade[tones.skin] ?? tones.skin,
  );
  stamp(sprite, head, 0, 0, colors.shade);
  const frontArm = limb(
    [cx + u * 1.3 * facing, shoulderY + u * 0.5],
    u * 5.2,
    u * 1.6,
    limbs.frontArm,
    colors.light[tones.coat] ?? tones.coat,
    tones.skin,
    false,
  );
  stamp(sprite, frontArm, 0, 0, colors.shade);
  finishPaper(sprite, colors, { rim: 'cut', grain: PAPER_GRAIN, seed });
  // Brass fasteners at the front shoulder and hip.
  for (const [bx, by] of [
    [cx + u * 1.3 * facing, shoulderY + u * 0.5],
    [cx + u * 0.6 * facing, hipY],
  ] as const) {
    fillRect(
      sprite,
      Math.round(bx - 0.5),
      Math.round(by - 0.5),
      Math.max(1, Math.round(u * 0.4)),
      Math.max(1, Math.round(u * 0.4)),
      tones.brad,
    );
  }
  const armTip = transform([[cx + u * 1.3 * facing, shoulderY + u * 5.7]], mirror(limbs.frontArm), [
    cx + u * 1.3 * facing,
    shoulderY + u * 0.5,
  ])[0] ?? [cx, shoulderY];
  return {
    sprite,
    origin: [cx, ground],
    head: [hx - cx, hy - u * 2.6 - ground],
    hand: [armTip[0] - cx, armTip[1] - ground],
  };
}

const walkSchema = z
  .object({
    from: z.number().describe('Start x (640x360 px)'),
    to: z.number().describe('End x (640x360 px)'),
    start: z.number().min(0).default(0).describe('Start time (s)'),
    end: z.number().min(0).default(3).describe('Arrival time (s)'),
  })
  .optional()
  .describe('Walk along the ground: walks between start and end, then holds `pose`');

export const paperPuppet = defineProp({
  name: 'paperPuppet',
  description:
    'A jointed paper character (brass fasteners at the joints) posed on the stop-motion clock: idle, wave, walk, talk, point, cheer; can walk across the set. y = ground under its feet.',
  params: z.object({
    pose: z.enum(PUPPET_POSES).default('idle'),
    facing: z.enum(['right', 'left']).default('right'),
    height: z.number().min(24).max(300).default(96).describe('Height (640x360 px)'),
    walk: walkSchema,
    coat: toneParam('hero'),
    pants: toneParam('stoneDark'),
    skin: toneParam('kraft'),
    hair: toneParam('wood'),
    seed: seedParam,
  }),
  anchors: {
    head: 'Top of the head',
    face: 'Centre of the face',
    hand: 'Front hand (follows the pose)',
    feet: 'Between the feet',
  },
  build: (params, tools) => {
    const seed = params.seed ?? tools.rng.int(0, 99_999);
    const model: PieceModel = {
      kitType: 'paperPuppet',
      placement: { layer: 4, x: 320, y: 300 },
      bind: (context) => {
        const { s, colors, clock } = context;
        const tones: PuppetTones = {
          coat: colors.index(params.coat ?? 'hero'),
          pants: colors.index(params.pants ?? 'stoneDark'),
          skin: colors.index(params.skin ?? 'kraft'),
          hair: colors.index(params.hair ?? 'wood'),
          shoe: colors.role('ink'),
          brad: colors.role('sun'),
        };
        const height = params.height * s;
        const walk = params.walk;
        const cut = memo((key) => {
          const [frame, moving, facing] = key.split(':').map(Number);
          const time = (frame ?? 0) / clock.fps;
          const base = poseLimbs(moving === 1 ? 'walk' : params.pose, time);
          const nudge = (salt: number): number => clock.jitter(frame ?? 0, salt, 2);
          const limbs: Limbs = {
            ...base,
            frontArm: base.frontArm + nudge(1),
            backArm: base.backArm + nudge(2),
            tilt: base.tilt + nudge(3),
          };
          return cutPuppet(
            colors,
            tones,
            height,
            limbs,
            facing === -1 ? -1 : 1,
            seed + (frame ?? 0),
          );
        });
        return (t) => {
          const frame = clock.frame(t);
          const time = clock.time(t);
          let x = 0;
          let moving = false;
          let facing: 1 | -1 = params.facing === 'left' ? -1 : 1;
          if (walk !== undefined) {
            const k = walk.end > walk.start ? (time - walk.start) / (walk.end - walk.start) : 1;
            moving = k > 0 && k < 1;
            x = (walk.from + (walk.to - walk.from) * ease(k)) * s - context.originX;
            if (walk.to !== walk.from) facing = walk.to > walk.from ? 1 : -1;
          }
          const pose = cut(`${String(frame)}:${moving ? '1' : '0'}:${String(facing)}`);
          x += clock.jitter(frame, 9, 1);
          const y = hashCell(frame, 4, 4, seed) < 0.2 ? -1 : 0;
          return {
            parts: [{ sprite: pose.sprite, x, y, pivot: pose.origin }],
            anchors: {
              head: { x: x + pose.head[0], y: y + pose.head[1] },
              face: { x: x + pose.head[0], y: y + pose.head[1] + height * 0.14 },
              hand: { x: x + pose.hand[0], y: y + pose.hand[1] },
              feet: { x, y },
            },
          };
        };
      },
    };
    return createPiece(tools, model);
  },
});
