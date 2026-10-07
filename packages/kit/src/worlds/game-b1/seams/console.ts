/**
 * The console close-up of the Game B1 living room (the showcase's room.js `consoleCloseup`,
 * `cartFront` and `gripHand`): the same room seen low and close, shag carpet, the TV cabinet's
 * corner top left with its screen, the 2600 big across the frame with its slot, and a cartridge
 * held by Dad's hand in a knit sleeve. The cartridge is clipped at the slot (what has gone in is
 * hidden). Room units at the close-up camera (160, 90, zoom 2); pure functions of their inputs.
 */
import { quad } from '../core/canvas.js';
import { hand } from '../core/hand.js';
import { hash } from '../core/math.js';
import { C, SCAN } from '../palette.js';
import { shag } from '../room/props.js';
import type { RoomPen } from '../room/view.js';

/** The close-up camera: the room point at the frame centre and the zoom. */
export const CLOSEUP_VIEW = { fx: 160, fy: 90, s: 2, inTv: 0 } as const;

/** The TV screen of the close-up in px (the cabinet's corner, cut by the frame's top edge). */
export function closeupScreen(p: RoomPen): readonly [number, number, number, number] {
  return [p.X(8), 0, p.X(86) - p.X(8), p.Y(40)];
}

/** Cartridge size in close-up room units; the slot's mouth is at y = 121. */
const CART_W = 64;
const CART_H = 76;
const SLOT_Y = 121;

export interface CartPose {
  /** Top of the cartridge in room units (64 = seated, < -76 = out of the frame). */
  readonly cartY: number | undefined;
  readonly cartX: number;
  /** The hand grips the cartridge by its sides. */
  readonly grip: boolean;
  /** Fingers pressed in (the cartridge resists the slot). */
  readonly squeeze: boolean;
  /** An empty hand's palm (top) in room units, when it is not gripping. */
  readonly handY: number | undefined;
}

export interface CartLook {
  /** Dad's masking-tape label (1 line, his hand). */
  readonly label: string | undefined;
  /** Palette index of the label's stripe. */
  readonly stripe: number;
}

/** The front of a cartridge: grip ridges, the label with its art window, Dad's tape. */
function cartFront(p: RoomPen, x: number, y: number, look: CartLook): void {
  const [w, h] = [CART_W, CART_H];
  p.rr(x, y, w, h, C.GREY_D);
  p.rr(x + 1, y, w - 2, 1, C.GREY);
  for (let i = 0; i < 5; i += 1) p.rr(x + 3, y + 3 + i * 2.6, w - 6, 1, C.VOID);
  p.rr(x, y + h - 2, w, 2, C.VOID);
  const [lx, ly, lw, lh] = [x + 4, y + h * 0.27, w - 8, h * 0.66];
  p.rr(lx, ly, lw, lh, C.CREAM);
  // the art window, printed half a unit off-register to the right
  const [ax, ay, aw, ah] = [lx + 3.5, ly + 2.5, lw - 6, lh * 0.48];
  p.rr(ax, ay, aw, ah, C.NIGHT);
  p.rr(ax, ay + ah * 0.72, aw, ah * 0.28, C.OLIVE_D);
  for (let k = 0; k < aw; k += 3)
    p.rr(ax + k, ay + ah * 0.72 - (k % 6 === 0 ? 1 : 0), 3, 1, C.AVOCADO);
  p.rell(ax + aw * 0.7, ay + ah * 0.33, ah * 0.2, ah * 0.2, C.GOLD);
  p.rell(ax + aw * 0.7 + ah * 0.09, ay + ah * 0.29, ah * 0.17, ah * 0.17, C.NIGHT);
  for (const [px, py] of [
    [0.18, 0.2],
    [0.34, 0.45],
    [0.5, 0.15],
  ] as const)
    p.rr(ax + aw * px, ay + ah * py, 1, 1, C.CREAM);
  p.rr(lx, ay + ah + 1.5, lw, 1.6, look.stripe);
  if (look.label === undefined) return;
  // masking tape torn off the roll, stuck across the grip at a slant; Dad's marker on it
  const [tx, ty, tw, th] = [x + 3, y + 2.5, w - 5, h * 0.17];
  const angle = -0.045;
  const corners = quad(p.X(tx + tw / 2), p.Y(ty + th / 2), tw * p.s, th * p.s, angle);
  p.cv.poly(
    corners.map((v, i) => v + (i % 2 === 1 ? p.s : p.s * 0.5)),
    0,
    SCAN,
  );
  p.cv.poly(corners, C.CREAM);
  for (let k = 0; k < 4; k += 1) {
    p.rr(tx - 0.5, ty + 0.5 + (k * th) / 4 + (k % 2), 1, th / 8, C.GREY_D);
    p.rr(tx + tw - 0.6, ty + 1 + (k * th) / 4, 1, th / 9, C.GREY_D);
  }
  hand(p.cv, look.label, {
    x: p.X(tx + 3.5),
    y: p.Y(ty + 1.4),
    size: p.s * 1.12,
    angle: angle - 0.02,
    seed: 82,
    colour: C.WALNUT_D,
    slant: 0.22,
    brush: 2,
  });
}

/** Dad's hand and knit sleeve holding a cartridge by its sides (palm above its top edge). */
function gripHand(p: RoomPen, cx: number, top: number, squeeze: boolean): void {
  const q = squeeze ? 1 : 0;
  p.rpoly([cx + 2, top - 16, cx + 24, top - 8, cx + 84, top - 84, cx + 52, top - 100], C.ORANGE);
  for (let i = 0; i < 4; i += 1) {
    const [a, b] = [i * 2.5, i * 3];
    // prettier-ignore
    p.rpoly([cx + 4 + a, top - 18 - b, cx + 25 + a, top - 10 - b, cx + 26 + a, top - 12 - b,
      cx + 5 + a, top - 20 - b], C.RUST);
  }
  p.rpoly([cx - 31, top + 1, cx + 31, top + 1, cx + 27, top - 15, cx - 20, top - 19], C.TAN);
  p.rpoly([cx + 8, top + 1, cx + 31, top + 1, cx + 27, top - 15, cx + 12, top - 17], C.TEAK);
  p.rr(cx - 22, top - 13, 9, 1, C.TEAK);
  p.rr(cx - 6, top - 15, 7, 1, C.TEAK);
  // the thumb on the left side, three uneven fingertips round the right side
  p.rr(cx - 35 + q, top - 1, 7, 18, C.TAN);
  p.rr(cx - 29 + q, top - 1, 1, 18, C.TEAK);
  p.rr(cx - 34 + q, top + 13, 4, 3, C.CREAM);
  for (const [dy, h, thin] of [
    [2, 9, 0],
    [12, 8, 1],
    [21, 6, 0],
  ] as const) {
    p.rr(cx + 28 - q, top + dy, 7 - thin, h, C.TAN);
    p.rr(cx + 28 - q, top + dy + h - 1, 7 - thin, 1, C.TEAK);
  }
}

/**
 * The close-up set. `screen(rect)` is called at the TV screen's place in the z order (the model
 * fills it with the picture and its CRT); `glow` = the screen colour on the console top (-1 off).
 */
export function consoleCloseup(
  p: RoomPen,
  pose: CartPose,
  look: CartLook,
  glow: number,
  screen: () => void,
): void {
  shag(p, 0, 181, 31, 2600);
  p.rmap(-40, 0, 400, 30, SCAN, 0.5);
  p.rr(-10, -10, 112, 64, C.TEAK);
  p.rr(-10, 52, 112, 2, C.WALNUT_D);
  p.rr(4, -10, 86, 54, C.GREY_D);
  screen();
  p.rr(20, 54, 4, 10, C.WALNUT_D);
  p.rr(84, 54, 4, 10, C.WALNUT_D);
  const cx = 34;
  p.rr(cx, 96, 290, 90, C.VOID);
  p.rr(cx, 96, 290, 1, C.GREY_D);
  for (let i = 0; i < 6; i += 1) p.rr(cx + 8, 100 + i * 3, 104, 1, C.GREY_D);
  p.rr(cx + 200, 100, 70, 14, C.TUBE);
  for (let i = 0; i < 5; i += 1) p.rr(cx + 204, 102 + i * 2.5, 62, 1, C.GREY_D);
  if (glow >= 0) p.rd(cx, 97, 120, 2, glow, 0.5);
  p.rr(150, 118, 78, 8, C.GREY_D);
  p.rr(152, 120, 74, 5, C.VOID);
  p.rr(cx, 134, 290, 30, C.TEAK);
  p.rr(cx, 134, 290, 1, C.TAN);
  for (let i = 0; i < 7; i += 1)
    p.rr(cx + 2 + hash(8, i, 1) * 150, 137 + i * 3.7, 60 + hash(8, i, 2) * 120, 1, C.WALNUT);
  for (let i = 0; i < 6; i += 1) {
    const sx = cx + 22 + i * 44 + (i === 4 ? 2 : 0);
    p.rr(sx, 142, 10, 8, C.VOID);
    p.rr(sx + 2, 143 + (i % 2) * 3, 6, 3, C.GREY);
  }
  p.rr(cx, 164, 290, 30, C.VOID);
  if (pose.cartY !== undefined) {
    const x = 157 + pose.cartX;
    p.cv.clip(0, 0, p.cv.w, p.Y(SLOT_Y));
    cartFront(p, x, pose.cartY, look);
    p.cv.clip();
    if (pose.grip) gripHand(p, x + CART_W / 2, pose.cartY, pose.squeeze);
  }
  if (pose.handY !== undefined) gripHand(p, 189, pose.handY, pose.squeeze);
}
