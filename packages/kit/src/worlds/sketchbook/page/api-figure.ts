/**
 * `page.figure(...)`: a stick person drawn by the hand, with handles to attach props to its
 * joints or head and to ask where a joint is at t. The figure's box over its whole motion is a
 * keep-clear box for the hand (the "hand rests here" rule), unless `subject: false`.
 */
import type { z } from 'zod';
import { KitError } from '../../../errors.js';
import type { Resolver } from '../../../looks/blueprint/timing.js';
import {
  figureMarks,
  jointOf,
  JOINT_NAMES,
  skeleton,
  type JointName,
  type Skeleton,
} from '../draw/figures.js';
import type { Mark } from '../draw/marks.js';
import type { Point } from '../draw/paths.js';
import type { SketchPage } from './model.js';
import { expressionTrack, PageFrame, poseTrack } from './motion.js';
import type { figureOptions } from './schemas.js';

export interface Timed {
  readonly at: number;
  readonly end: number;
}

export interface FigureHandle extends Timed {
  /** Attach marks to a joint: their points are offsets from it. */
  joint(name: JointName): PageFrame;
  /** Attach marks in page px that move with a joint (carried things). */
  carry(name: JointName): PageFrame;
  /** Attach marks to the head: local units = head radius, rotating with the head. */
  head(): PageFrame;
  /** Where a joint is at t (page px). */
  jointAt(name: JointName, t: number): Point;
}

export interface FigureDeps {
  readonly page: SketchPage;
  readonly resolve: Resolver;
  readonly start: number;
  readonly seed: number;
  readonly fps: number;
  readonly name: string;
  commit(marks: Mark[], until?: number): Timed;
}

/** Times the hand-rest box samples the motion at (s). */
const BOX_SAMPLES = Array.from({ length: 25 }, (_, i) => i * 0.5);

/** Bounding box [x, y, w, h] of poses (joints and head), padded. */
function figureBox(poses: readonly Skeleton[]): readonly [number, number, number, number] {
  const points: Point[] = poses.flatMap((s) => [
    [s.head[0], s.head[1] - s.headRadius] as const,
    s.neck,
    s.hip,
    ...s.armL,
    ...s.armR,
    ...s.legL,
    ...s.legR,
  ]);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const pad = (poses[0]?.headRadius ?? 10) * 0.6;
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - pad;
  return [x0, y0, Math.max(...xs) + pad - x0, Math.max(...ys) + pad - y0];
}

export function addFigure(o: z.output<typeof figureOptions>, deps: FigureDeps): FigureHandle {
  const { name, resolve } = deps;
  const pose = poseTrack(o.pose, resolve);
  const placeAt = { x: o.x, y: o.y, h: o.h };
  const sk = (t: number): Skeleton => skeleton(placeAt, pose(t));
  const figure = figureMarks({
    ...placeAt,
    t0: deps.start,
    seed: deps.seed,
    tool: o.tool,
    fps: o.fps ?? deps.fps,
    belly: o.belly,
    brows: o.brows,
    pose,
    expression: expressionTrack(o.expression, resolve),
  });
  const until = o.until === undefined ? undefined : resolve(o.until, deps.start);
  const timed = deps.commit(figure.marks, until);
  if (o.subject) deps.page.keepClear(figureBox([timed.end, ...BOX_SAMPLES].map(sk)));
  const jointName = (joint: unknown, method: string): JointName => {
    if (typeof joint === 'string' && (JOINT_NAMES as readonly string[]).includes(joint)) {
      return joint as JointName;
    }
    throw new KitError(
      'invalid-params',
      `${name}.${method}("${String(joint)}"): joints are ${JOINT_NAMES.join(', ')}`,
    );
  };
  return {
    ...timed,
    joint: (joint) => {
      const j = jointName(joint, 'joint');
      return new PageFrame(`joint:${j}`, (t) => (u, v) => {
        const [x, y] = jointOf(sk(t), j);
        return [x + u, y + v];
      });
    },
    carry: (joint) => {
      const j = jointName(joint, 'carry');
      const [bx, by] = jointOf(sk(0), j);
      return new PageFrame(`carry:${j}`, (t) => (x, y) => {
        const [jx, jy] = jointOf(sk(t), j);
        return [x + jx - bx, y + jy - by];
      });
    },
    head: () =>
      new PageFrame('head', (t) => {
        const s = sk(t);
        const a = (s.headAngle * Math.PI) / 180;
        const [c, si] = [Math.cos(a), Math.sin(a)];
        return (u, v) => [
          s.head[0] + (u * c - v * si) * s.headRadius,
          s.head[1] + (u * si + v * c) * s.headRadius,
        ];
      }),
    jointAt: (joint, t) => {
      if (typeof t !== 'number' || !Number.isFinite(t)) {
        throw new KitError('invalid-params', `${name}.jointAt(): t must be a number`);
      }
      return jointOf(sk(t), jointName(joint, 'jointAt'));
    },
  };
}
