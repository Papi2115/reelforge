/**
 * The per-shot acting of a Grim Ink person (PLAN.md#14.9): `kit.people.<id>.draw` takes the shot's
 * `props` (what the person carries, JSON-like, handed to the module's drawings as `p` with `t`) and
 * up to `MAX_GAGS` gags (draw/gags.ts). This file checks both and folds the module's own hooks
 * (`arms`, `held`, `beforeHand`) and the gags into the rig's inputs: the character for this draw
 * (its drawings bound to `p`), the pose (gag hand targets), the expression and the figure options
 * (hand shapes, arm layers, hooks). Order: pose < module < gags < the scene's explicit options.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import type { BrushEnv } from '../draw/brushes.js';
import { neckHead, type Character, type NeckSpec } from '../draw/character.js';
import type { FaceState } from '../draw/face.js';
import {
  resolveView,
  solvePose,
  type ArmHook,
  type ArmLayerOverrides,
  type ArmSide,
  type DrawFigureOptions,
  type FigureHook,
  type FigureView,
  type HandOverrides,
  type HeadHook,
} from '../draw/figure.js';
import { gagFrame, gagSeed } from '../draw/gag-acts.js';
import {
  GAG_KINDS,
  MAX_GAGS,
  gagPhase,
  gagSpecSchema,
  type FaceSpots,
  type GagFrame,
  type GagSpec,
  type ResolvedGag,
} from '../draw/gags.js';
import type { Paint2D } from '../draw/paint.js';
import type { Pose } from '../draw/poses.js';
import { palm } from '../draw/rig-ik.js';
import type { ViewIndex } from '../draw/rig-views.js';
import {
  armSettingsSchema,
  inkOptionsSchema,
  issuesText,
  type ArmSettings,
  type PersonData,
  type PersonModule,
  type PersonProps,
} from './contract.js';
import { inkTools } from './ink-tools.js';

const gagsSchema = z.union([gagSpecSchema, z.array(gagSpecSchema).max(MAX_GAGS)]);

/** `p` of a draw: the checked props plus the shot time. */
export function personProps(props: unknown, t: number, label: string): PersonProps {
  if (props === undefined) return Object.freeze({ t });
  const parsed = inkOptionsSchema.safeParse(props);
  if (!parsed.success) {
    throw new KitError(
      'invalid-params',
      `${label}: props must be an object of plain values (numbers, strings, booleans, lists): ${issuesText(parsed.error)}`,
    );
  }
  return Object.freeze({ ...parsed.data, t });
}

/** The checked gags of a draw (none when undefined). */
export function personGags(
  gag: GagSpec | readonly GagSpec[] | undefined,
  label: string,
): readonly ResolvedGag[] {
  if (gag === undefined) return [];
  const parsed = gagsSchema.safeParse(gag);
  if (!parsed.success) {
    throw new KitError(
      'invalid-params',
      `${label}: gag must be { kind, t0?, rate?, hand?, seed?, visor? } or a list of at most ${String(MAX_GAGS)} (kinds: ${GAG_KINDS.join(', ')}): ${issuesText(parsed.error)}`,
    );
  }
  return Array.isArray(parsed.data) ? parsed.data : [parsed.data];
}

/** The rig character for one draw: the module's data with its drawings bound to `p`. */
export function boundCharacter(base: PersonData, module: PersonModule, p: PersonProps): Character {
  const { torso, head, drawNeck } = module;
  return Object.freeze({
    ...base,
    torso: (g: Paint2D, env: BrushEnv, view: ViewIndex) => {
      torso(g, inkTools(g, env), view, p);
    },
    head: (g: Paint2D, env: BrushEnv, view: ViewIndex, face: FaceState) => {
      head(g, inkTools(g, env), view, face, p);
    },
    ...(drawNeck === undefined
      ? {}
      : {
          drawNeck: (g: Paint2D, env: BrushEnv, view: ViewIndex, spec: NeckSpec) => {
            drawNeck(g, inkTools(g, env), view, spec, p);
          },
        }),
  });
}

/** Head-local face points of a head view (face anchors, else estimated from the head box). */
export function faceSpots(character: Character, view: ViewIndex): FaceSpots {
  const k = character.headScale;
  const [ox, oy] = neckHead(character.neck[view]);
  const box = character.D.head;
  const top = ((box?.top ?? oy - 200) - oy) / k;
  const bottom = ((box?.bottom ?? oy) - oy) / k;
  const cx = ((box?.x[view] ?? ox) - ox) / k;
  const rx = (box?.hw ?? 60) / k;
  const h = bottom - top;
  const face = [0, 0.3, 0.55, 0][view] ?? 0;
  const table = character.faceAnchors?.[view];
  return {
    mouth: table?.mouth ?? [cx + face * rx, bottom - 0.2 * h],
    forehead: table?.forehead ?? [cx + face * rx * 0.5, top + 0.3 * h],
    cheek: table?.cheek ?? [cx + 0.55 * rx, bottom - 0.35 * h],
    centre: [cx, (top + bottom) / 2],
    rx,
    ry: h / 2,
  };
}

/** Everything `drawFigure` gets for one draw. */
export interface Acting {
  readonly pose: Pose;
  readonly expr: string | undefined;
  readonly options: DrawFigureOptions;
}

function moduleArms(module: PersonModule, p: PersonProps, label: string): ArmSettings {
  if (!module.arms) return undefined;
  const parsed = armSettingsSchema.safeParse(module.arms(p));
  if (parsed.success) return parsed.data;
  throw new KitError(
    'invalid-extension',
    `${label}: arms(p) must return { L?: { hand?, front? }, R?: { hand?, front? } } (${issuesText(parsed.error)})`,
  );
}

type Hook<A extends unknown[]> = ((...args: A) => void) | undefined;

function chain<A extends unknown[]>(hooks: readonly Hook<A>[]): Hook<A> {
  const live = hooks.filter((hook): hook is (...args: A) => void => hook !== undefined);
  if (live.length === 0) return undefined;
  return (...args: A) => {
    for (const hook of live) hook(...args);
  };
}

/** Folds the module hooks and the gags at time t into the rig's inputs. */
export function acting(
  g: Paint2D,
  module: PersonModule,
  character: Character,
  input: {
    readonly pose: Pose;
    readonly view: FigureView;
    readonly expr: string | undefined;
    readonly t: number;
    readonly p: PersonProps;
    readonly gags: readonly ResolvedGag[];
    readonly scene: DrawFigureOptions;
    readonly label: string;
  },
): Acting {
  const { p, t } = input;
  const frames: GagFrame[] = [];
  for (const gag of input.gags) {
    const u = gagPhase(gag, t);
    if (u === undefined) continue;
    const { skin, skinD } = character.arm;
    const seed = gagSeed(character.seed, gag);
    frames.push(gagFrame({ gag, u, t, D: character.D, P: input.pose, skin, skinD, seed }));
  }
  const arms = moduleArms(module, p, input.label);
  let pose = input.pose;
  let hands: HandOverrides = { ...(arms?.L?.hand ? { L: arms.L.hand } : {}) };
  if (arms?.R?.hand) hands = { ...hands, R: arms.R.hand };
  const front = new Set<ArmSide>();
  if (arms?.L?.front) front.add('L');
  if (arms?.R?.front) front.add('R');
  let expr = input.expr;
  let look = input.scene.look;
  let headDy = input.scene.headDy ?? 0;
  for (const f of frames) {
    pose = { ...pose, ...(f.hL ? { hL: f.hL } : {}), ...(f.hR ? { hR: f.hR } : {}) };
    hands = { ...hands, ...f.hands };
    if (f.front) front.add(f.front);
    expr = f.expr ?? expr;
    look = f.look ?? look;
    headDy += f.headDy ?? 0;
  }
  let layer: ArmLayerOverrides = {};
  if (front.size > 0) {
    const J = solvePose(character, pose, input.view);
    for (const side of front) {
      if (!(side === 'L' ? J.aL : J.aR).behind) layer = { ...layer, [side]: 2 };
    }
  }
  layer = { ...layer, ...input.scene.layer };
  const v = resolveView(input.view).v;
  const { held, beforeHand } = module;
  const beforeArm = chain<Parameters<ArmHook>>([
    held &&
      ((side, j, env) => {
        held(g, inkTools(g, env), side, palm(j, character.D.hsz), p);
      }),
    ...frames.map((f): Hook<Parameters<ArmHook>> => {
      const hook = f.beforeArm;
      return (
        hook &&
        ((side, j, env) => {
          hook(g, env, side, j);
        })
      );
    }),
  ]);
  const afterArm = chain<Parameters<ArmHook>>(
    frames.map((f): Hook<Parameters<ArmHook>> => {
      const hook = f.afterArm;
      return (
        hook &&
        ((side, j, env) => {
          hook(g, env, side, j);
        })
      );
    }),
  );
  const afterHead = chain<Parameters<HeadHook>>(
    frames.map((f): Hook<Parameters<HeadHook>> => {
      const hook = f.afterHead;
      return (
        hook &&
        ((view, env) => {
          hook(g, env, view, faceSpots(character, view));
        })
      );
    }),
  );
  const beforeHands = chain<Parameters<FigureHook>>([
    beforeHand &&
      ((J, env) => {
        beforeHand(g, inkTools(g, env), J, v, p);
      }),
    ...frames.map((f): Hook<Parameters<FigureHook>> => {
      const hook = f.beforeHand;
      return (
        hook &&
        ((J, env) => {
          hook(g, env, J, v);
        })
      );
    }),
    input.scene.beforeHand,
  ]);
  const options: DrawFigureOptions = {
    ...input.scene,
    layer,
    hands,
    headDy,
    ...(look === undefined ? {} : { look }),
    ...(beforeArm ? { beforeArm } : {}),
    ...(afterArm ? { afterArm } : {}),
    ...(afterHead ? { afterHead } : {}),
    ...(beforeHands ? { beforeHand: beforeHands } : {}),
  };
  return { pose, expr, options };
}
