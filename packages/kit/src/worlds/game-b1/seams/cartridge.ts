/**
 * Cartridge insert / pull (the showcase's shots 4 -> 5 and 7, "the environment stays
 * continuous"): the camera pulls back from the TV picture into the console close-up of the same
 * room, Dad's hand brings a cartridge down, it resists the slot, clicks in (the frame shakes, the
 * TV shows the garbage frame of a cartridge rocking in its slot) and the hand lets go; or the hand
 * comes down, squeezes, pushes, and pulls the cartridge out (garbage, then the TV goes dark). The
 * camera may push back INTO the TV at the end. The pull-back's first frame and the push's last
 * frame are exactly the TV-only frame, so the move is one continuous camera.
 */
import { z } from 'zod';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { EASES, frameOf, lerp, seg, shake } from '../core/math.js';
import { C } from '../palette.js';
import type { GlassRect } from '../room/living-room.js';
import type { ScreenModel } from '../screen/model.js';
import { garbage } from '../tv/idle.js';
import {
  CLOSEUP_VIEW,
  closeupScreen,
  consoleCloseup,
  type CartLook,
  type CartPose,
} from './console.js';

export const cartridgeSchema = z.strictObject({
  intent: z
    .string()
    .min(12)
    .max(160)
    .describe('What the swap means (the claim: e.g. "the new game goes in: everyone wanted in")'),
  action: z.enum(['insert', 'pull']),
  at: whenParam.describe('The close-up begins (the pull-back from the picture starts)'),
  label: z.string().min(1).max(10).optional().describe("Dad's masking tape on it, in his hand"),
  stripe: z.string().default('orange').describe('Colour of the label stripe'),
  enter: z
    .enum(['pull-back', 'cut'])
    .default('pull-back')
    .describe('pull-back = the TV picture shrinks into the close-up (continuous)'),
  exit: z
    .enum(['push', 'cut'])
    .optional()
    .describe('push = the camera pushes back into the TV (default: push after an insert)'),
  hold: z.number().min(0).max(4).default(0.3).describe('Seconds held after the action'),
});

export type CartridgeInput = z.input<typeof cartridgeSchema>;

export interface CartridgePlan {
  readonly action: 'insert' | 'pull';
  readonly at: number;
  /** The hand's action starts (after the pull-back). */
  readonly act: number;
  readonly pullBack: boolean;
  /** The push into the TV starts; it ends at `end`. */
  readonly pushAt: number | undefined;
  readonly end: number;
  readonly look: CartLook;
}

const PULL_BACK = 0.5;
const PUSH = 0.4;
/** Seconds from the action's start until the cartridge is in / out and the hand is gone. */
const ACTION = { insert: 1.0, pull: 0.9 } as const;
/** When the cartridge clicks home (insert) or lets go of the contacts (pull). */
const CLICK = { insert: 0.7, pull: 0.5 } as const;
const ROCK = [0, 1, 0, 1, 1, 0] as const;

export function planCartridge(
  o: z.output<typeof cartridgeSchema>,
  at: number,
  look: CartLook,
): CartridgePlan {
  const pullBack = o.enter === 'pull-back';
  const act = at + (pullBack ? PULL_BACK : 0);
  const done = act + ACTION[o.action] + o.hold;
  const exit = o.exit ?? (o.action === 'insert' ? 'push' : 'cut');
  const pushAt = exit === 'push' ? done : undefined;
  return {
    action: o.action,
    at,
    act,
    pullBack,
    pushAt,
    end: pushAt === undefined ? done : pushAt + PUSH,
    look,
  };
}

/** Sound cues: the pull-back, the click and the static, the push. */
export function cartridgeCues(plan: CartridgePlan): { t: number; name: string }[] {
  const click = plan.act + CLICK[plan.action];
  return [
    ...(plan.pullBack ? [{ t: plan.at, name: 'swoosh-out' }] : []),
    { t: click, name: 'click' },
    { t: click + 0.02, name: 'glitch' },
    ...(plan.pushAt === undefined ? [] : [{ t: plan.pushAt, name: 'swoosh-in' }]),
  ];
}

function insertPose(u: number): CartPose {
  const held = { grip: true, squeeze: false, handY: undefined };
  if (u < 0) return { ...held, cartY: -84, cartX: 12 };
  if (u < 0.42) {
    const k = EASES.inOut(u / 0.42);
    return { ...held, cartY: lerp(-84, 40, k), cartX: lerp(12, 3, k) };
  }
  if (u < 0.6)
    return { ...held, cartX: 3, cartY: 40 + (ROCK[Math.floor((u - 0.42) * 30) % 6] ?? 0) };
  if (u < 0.7) {
    const k = EASES.in((u - 0.6) / 0.1);
    return { ...held, squeeze: true, cartX: 3 - 3 * k, cartY: 40 + 24 * k };
  }
  if (u < 0.78) return { ...held, squeeze: u < 0.72, cartX: 0, cartY: 64 };
  const handY = 64 - EASES.inOut(seg(u, 0.78, 1.0)) * 90;
  return { grip: false, squeeze: false, cartX: 0, cartY: 64, handY };
}

function pullPose(u: number): CartPose {
  if (u < 0) return { grip: false, squeeze: false, cartX: 0, cartY: 64, handY: undefined };
  const squeeze = u >= 0.32 && u < 0.5;
  if (u < 0.5) {
    const handY = u < 0.32 ? lerp(-60, 65, EASES.out(u / 0.32)) : 65;
    return { grip: false, squeeze, cartX: 0, cartY: u >= 0.42 ? 65 : 64, handY };
  }
  const cartY = lerp(65, -100, EASES.in(seg(u, 0.5, 0.74)));
  return {
    grip: false,
    squeeze,
    cartX: 0,
    cartY: cartY > -90 ? cartY : undefined,
    handY: cartY + 1,
  };
}

type TvMode = 'picture' | 'garbage' | 'off';

function tvMode(action: CartridgePlan['action'], u: number): TvMode {
  if (action === 'insert') return u >= 0.7 && u < 0.95 ? 'garbage' : 'picture';
  return u < 0.5 ? 'picture' : u < 0.7 ? 'garbage' : 'off';
}

const GLOW = [C.ORANGE, C.TEAL, C.MAUVE] as const;

/** The close-up frame of a cartridge plan at t (no HUD). */
export function paintCartridge(model: ScreenModel, plan: CartridgePlan, t: number): void {
  const u = t - plan.act;
  const tv = tvMode(plan.action, u);
  const frame = frameOf(t);
  model.paintPicture(model.picture, t);
  if (tv === 'garbage') garbage(model.picture, 0, 0, model.picture.w, model.picture.h, frame, 21);
  else if (tv === 'off') model.picture.fill(C.TUBE);
  model.frame.clip();
  model.frame.fill(C.VOID);
  const jolt =
    plan.action === 'insert' ? shake(t, plan.act + CLICK.insert, 3, 9, 404) : { x: 0, y: 0 };
  model.pen.set(CLOSEUP_VIEW, jolt);
  const screen: GlassRect = closeupScreen(model.pen);
  const glow = tv === 'garbage' ? (GLOW[frame % 3] ?? C.TEAL) : tv === 'off' ? -1 : C.TEAL_D;
  const pose = plan.action === 'insert' ? insertPose(u) : pullPose(u);
  consoleCloseup(model.pen, pose, plan.look, glow, () => {
    model.finishGlass(screen, t, 10, false, true);
  });
  if (plan.pullBack && t < plan.act) {
    const e = EASES.inOut(seg(t, plan.at, plan.act));
    const rect: GlassRect = [
      Math.round(lerp(0, screen[0], e)),
      Math.round(lerp(0, screen[1], e)),
      Math.round(lerp(model.frame.w, screen[2], e)),
      Math.round(lerp(model.frame.h, screen[3], e)),
    ];
    model.finishGlass(rect, t, Math.round(lerp(22, 10, e)), true, true);
  }
  if (plan.pushAt !== undefined && t >= plan.pushAt)
    model.growGlass(screen, seg(t, plan.pushAt, plan.end), t, 10);
}
