/**
 * The first-person hand of the Game B2 view: a timeline of `take` (reach for a world point with an
 * open hand, close on the item, swing back with an overshoot), `hold` (raise into the rest pose
 * holding an item, lower at the end) and `present` (push the held item at someone: a small dip of
 * anticipation, out-back, hold, ease back). Drawn flat-shaded at world resolution, the forearm
 * extended to the frame edge. A pure function of t.
 */
import { EASES, lerp, seg } from '../core/rand.js';
import { C, T } from '../palette.js';
import { handHold, handOpen, type HandSprite } from '../ray/sprites-people.js';
import type { ItemLook } from '../ray/sprites-props.js';
import type { Camera } from '../ray/camera.js';
import { shade } from '../ray/lighting.js';
import { project, VIEW_H, VIEW_W } from '../ray/raycast.js';

const REST = { x: 214, y: 98 } as const;
const REACH = 0.9;
const RETURN = 0.8;
const RAISE = 0.3;

export type HandEvent =
  | {
      readonly kind: 'take';
      readonly at: number;
      readonly until: number;
      readonly item: ItemLook;
      readonly from: readonly [number, number, number];
    }
  | { readonly kind: 'hold'; readonly at: number; readonly until: number; readonly item: ItemLook }
  | { readonly kind: 'present'; readonly at: number; readonly until: number }
  | {
      readonly kind: 'throw';
      /** Wind-up start; the item leaves the hand at `release`; the hand is gone at `until`. */
      readonly at: number;
      readonly release: number;
      readonly until: number;
      readonly item: ItemLook;
    };

export interface HandPose {
  readonly spr: HandSprite;
  readonly x: number;
  readonly y: number;
  readonly s: number;
}

export class HandTrack {
  private readonly events: HandEvent[] = [];
  private readonly sprites = new Map<string, HandSprite>();
  private open: HandSprite | undefined;

  add(event: HandEvent): { at: number; end: number } {
    this.events.push(event);
    this.events.sort((a, b) => a.at - b.at);
    return { at: event.at, end: event.kind === 'take' ? event.at + REACH + RETURN : event.until };
  }

  private holding(item: ItemLook): HandSprite {
    const key = JSON.stringify(item);
    let found = this.sprites.get(key);
    if (found === undefined) {
      found = handHold(item);
      this.sprites.set(key, found);
    }
    return found;
  }

  private openHand(): HandSprite {
    this.open ??= handOpen();
    return this.open;
  }

  /**
   * The throw: a dip back (anticipation), the swing up and forward, the hand opens at the
   * release, follows through and lowers out of view.
   */
  private throwPose(event: HandEvent & { kind: 'throw' }, t: number, cam: Camera): HandPose {
    const { at, release, until } = event;
    if (t < release) {
      const u = seg(t, at, release);
      const dip = EASES.inOut(seg(u, 0, 0.55));
      const swing = EASES.in(seg(u, 0.55, 1));
      return {
        spr: this.holding(event.item),
        x: REST.x + cam.bobX + dip * 8 - swing * 64,
        y: REST.y + cam.bobY + dip * 14 - swing * 52,
        s: 1,
      };
    }
    const follow = EASES.out(seg(t, release, release + 0.14));
    const lower = EASES.in(seg(t, release + 0.16, until));
    return {
      spr: this.openHand(),
      x: REST.x - 56 - follow * 12 + lower * 20,
      y: REST.y - 48 - follow * 6 + lower * 150,
      s: 0.95,
    };
  }

  /** The pose at t, or null when no hand is up. */
  at(t: number, cam: Camera): HandPose | null {
    const thrown = this.events.filter((e) => e.kind === 'throw' && e.at <= t).at(-1);
    if (thrown?.kind === 'throw' && t < thrown.until) return this.throwPose(thrown, t, cam);
    const carry = this.events
      .filter(
        (e) =>
          e.kind !== 'present' &&
          e.kind !== 'throw' &&
          e.at <= t &&
          t < e.until &&
          (thrown === undefined || e.at >= thrown.at),
      )
      .at(-1);
    if (carry === undefined || carry.kind === 'present' || carry.kind === 'throw') return null;
    const bx = cam.bobX;
    const by = cam.bobY;
    if (carry.kind === 'take' && t < carry.at + REACH + RETURN) {
      const target = project(cam, carry.from[0], carry.from[1], carry.from[2]);
      if (t < carry.at + REACH) {
        const u = EASES.out(seg(t, carry.at, carry.at + REACH));
        return {
          spr: this.openHand(),
          x: lerp(232, target.x - 22, u),
          y: lerp(182, target.y - 30, u) + Math.sin(u * Math.PI) * 6,
          s: lerp(1, 0.8, u),
        };
      }
      const u = EASES.outBack(seg(t, carry.at + REACH, carry.at + REACH + RETURN));
      return {
        spr: this.holding(carry.item),
        x: lerp(target.x - 30, REST.x, u) + bx,
        y: lerp(target.y - 40, REST.y, u) + by,
        s: 1,
      };
    }
    const spr = this.holding(carry.item);
    const raise = carry.kind === 'hold' ? EASES.outBack(seg(t, carry.at, carry.at + RAISE)) : 1;
    const lower = EASES.in(seg(t, carry.until - RAISE, carry.until));
    let x = REST.x + bx;
    let y = REST.y + by + (1 - raise) * 90 + lower * 90;
    const push = this.events.find((e) => e.kind === 'present' && e.at <= t && t < e.until);
    if (push !== undefined) {
      const dip =
        seg(t, push.at, push.at + 0.12) * (1 - seg(t, push.at + 0.12, push.at + 0.25)) * 5;
      const u =
        EASES.outBack(seg(t, push.at + 0.12, push.at + 0.5)) *
        (1 - EASES.inOut(seg(t, push.until - 0.55, push.until)));
      x = lerp(x, 112, u);
      y = lerp(y, 72, u) + dip;
    }
    return { spr, x, y, s: 1 };
  }
}

/** Draws the hand into the world buffer, flat-shaded by the light at the camera. */
export function drawHand(buf: Uint8Array, pose: HandPose, cmap: Uint8Array, light: number): void {
  const { spr, s } = pose;
  const tone = (c: number): number => shade(cmap, c, light, 0, 1, 0);
  const w = Math.round(spr.bmp.w * s);
  const hh = Math.round(spr.bmp.h * s);
  const x0 = Math.round(pose.x);
  const y0 = Math.round(pose.y);
  const yb = y0 + hh;
  if (yb < VIEW_H) {
    const xl = x0 + spr.cuff[0] * s;
    const xr = x0 + spr.cuff[1] * s;
    for (let y = yb - 1; y < VIEW_H; y += 1) {
      const u = (y - yb) / Math.max(1, VIEW_H - yb);
      const a = xl + u * 16;
      const b = xr + u * 30;
      for (let x = Math.max(0, Math.floor(a)); x < Math.min(VIEW_W, Math.ceil(b)); x += 1)
        buf[y * VIEW_W + x] = tone(x - a < 2 ? C.HAZE : x > b - 4 ? C.NIGHT : C.DUSK);
    }
  }
  for (let dy = 0; dy < hh; dy += 1) {
    const y = y0 + dy;
    if (y < 0 || y >= VIEW_H) continue;
    const sy = Math.min(spr.bmp.h - 1, Math.floor(dy / s));
    for (let dx = 0; dx < w; dx += 1) {
      const x = x0 + dx;
      if (x < 0 || x >= VIEW_W) continue;
      const c = spr.bmp.d[sy * spr.bmp.w + Math.min(spr.bmp.w - 1, Math.floor(dx / s))] ?? T;
      if (c !== T) buf[y * VIEW_W + x] = tone(c);
    }
  }
}
