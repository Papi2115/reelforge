/**
 * The living room of the Game B1 world (Christmas 1982 in the showcase): panelled wall, shag
 * carpet, the TV cabinet with rabbit ears, the 2600 and its joystick with a hand-drawn cable,
 * and the optional calendar, tree, presents, missing-gift slot, lamp and loose cartridges. The TV
 * picture is not drawn here: `glass(rect)` is called at the TV's place in the z order with the
 * glass rect in px, and the model fills it with the picture inside the TV.
 */
import { hash } from '../core/math.js';
import { C, GHOST, SCAN } from '../palette.js';
import {
  calendar,
  giftSlot,
  lamp,
  looseCarts,
  panelling,
  presents,
  shag,
  tree,
  type CalendarSpec,
  type GiftState,
} from './props.js';
import { TV_GLASS, type RoomPen } from './view.js';

export interface RoomState {
  readonly calendar: CalendarSpec | undefined;
  readonly tree: boolean;
  readonly presents: boolean;
  readonly gift: GiftState | undefined;
  readonly lamp: boolean;
  readonly carts: number;
  readonly seed: number;
}

export type GlassRect = readonly [x: number, y: number, w: number, h: number];

function rabbitEars(p: RoomPen, x: number, y: number): void {
  p.rell(x + 66, y - 2, 9, 3, C.GREY_D);
  p.rline(x + 62, y - 3, x + 47, y - 22, C.GREY, 1);
  p.rline(x + 70, y - 3, x + 92, y - 17, C.GREY, 1);
  p.rr(x + 46, y - 23, 2, 2, C.CREAM);
  p.rr(x + 91, y - 18, 2, 2, C.CREAM);
}

/** The TV cabinet at (22, 44); the glass is TV_GLASS. */
export function tvCabinet(p: RoomPen, glass: (rect: GlassRect) => void): void {
  const x = 22;
  const y = 44;
  p.rr(x + 6, y + 76, 4, 8, C.WALNUT_D);
  p.rr(x + 112, y + 76, 4, 8, C.WALNUT_D);
  p.rr(x, y, 124, 78, C.TEAK);
  p.rr(x, y, 124, 2, C.TAN);
  for (let i = 0; i < 6; i += 1)
    p.rr(
      x + 2 + hash(3, i, 1) * 40,
      y + 6 + i * 12 + hash(3, i, 2) * 4,
      30 + hash(3, i, 3) * 60,
      1,
      C.WALNUT,
    );
  rabbitEars(p, x, y);
  p.rr(x + 8, y + 8, 78, 60, C.GREY_D);
  glass(p.box(TV_GLASS.x, TV_GLASS.y, TV_GLASS.w, TV_GLASS.h));
  // a thumbprint smudge on the glass
  p.rmap(TV_GLASS.x + 48, TV_GLASS.y + 30, 7, 6, GHOST, 0.3);
  p.rr(x + 92, y + 22, 26, 46, C.TAN);
  for (let i = 0; i < 9; i += 1) p.rr(x + 94 + i * 3, y + 22, 1, 46, C.WALNUT);
  p.rell(x + 98, y + 13, 3.5, 3.5, C.GREY);
  p.rell(x + 98, y + 13, 1.2, 1.2, C.GREY_D);
  p.rell(x + 111, y + 13, 3, 3, C.GREY);
  p.rr(x + 111, y + 10, 1, 3, C.GREY_D);
  p.rr(x, y + 76, 124, 2, C.WALNUT_D);
}

export function console2600(p: RoomPen, x: number, y: number): void {
  p.rr(x, y, 62, 16, C.VOID);
  p.rr(x + 2, y, 58, 1, C.GREY_D);
  for (let i = 0; i < 3; i += 1) p.rr(x + 4, y + 3 + i * 2, 18, 1, C.GREY_D);
  p.rr(x + 26, y + 2, 14, 4, C.TUBE);
  p.rr(x + 26, y + 2, 14, 1, C.GREY_D);
  p.rr(x, y + 10, 62, 6, C.TEAK);
  p.rr(x, y + 10, 62, 1, C.WALNUT);
  for (let i = 0; i < 6; i += 1) p.rr(x + 6 + i * 9.4, y + 12, 3, 2, C.GREY);
}

/** The joystick and its cable, drawn by hand (an uneven polyline). */
export function joystick(p: RoomPen): void {
  p.rr(118, 146, 13, 10, C.VOID);
  p.rr(118, 146, 13, 1, C.GREY_D);
  p.rr(119, 147, 3, 2, C.ORANGE);
  p.rr(124, 136, 2, 11, C.GREY_D);
  p.rr(123, 134, 4, 3, C.VOID);
  let [lx, ly] = [118, 154];
  for (const [nx, ny] of [
    [110, 158],
    [101, 157],
    [96, 152],
    [100, 146],
    [104, 144],
  ] as const) {
    p.rline(lx, ly, nx, ny, C.VOID, 1);
    [lx, ly] = [nx, ny];
  }
}

export function livingRoom(
  p: RoomPen,
  t: number,
  state: RoomState,
  glass: (rect: GlassRect) => void,
): void {
  panelling(p, 0, 121, 41);
  for (let i = 0; i < 4; i += 1) p.rmap(-40, i * 5, 400, 5, SCAN, 0.5 - i * 0.12);
  p.rr(-40, 118, 400, 5, C.TEAK);
  p.rr(-40, 118, 400, 1, C.TAN);
  shag(p, 123, 181, 77, 1500);
  if (state.calendar !== undefined) calendar(p, 166, 22, state.calendar);
  if (state.tree) tree(p, t);
  if (state.presents) presents(p);
  tvCabinet(p, glass);
  if (state.lamp) lamp(p);
  console2600(p, 48, 136);
  joystick(p);
  if (state.carts > 0) looseCarts(p, state.carts, state.seed);
  if (state.gift !== undefined) giftSlot(p, state.gift);
}
